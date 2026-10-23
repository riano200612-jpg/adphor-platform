"""Prevalidación local de fotografías; no realiza inferencia DL."""
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from io import BytesIO
import warnings

from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError

from .domain import Entrada

FIRMAS = {
    "image/jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "image/png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda b: (
        b.startswith(b"RIFF") and b[8:12] == b"WEBP"
    ),
}
# Matches the private evidence bucket inspected on 2026-10-23.
MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 12_000_000
MAX_DIMENSION = 8192
MAX_OUTPUT_DIMENSION = 2048
MAX_OUTPUT_BYTES = 16 * 1024 * 1024
FORMATOS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


@dataclass(frozen=True)
class ImagenPreparadaDL:
    ancho: int
    alto: int
    contenido_png: bytes
    sha256_original: str
    sha256_preparado: str
    mime: str = "image/png"



@dataclass(frozen=True)
class EvidenciaDL:
    imagen_id: str
    propiedad_id: str
    caso_id: str
    mime: str
    tamano: int
    sha256_hex: str
    capturada_en: datetime

    def __post_init__(self):
        if any(
            not isinstance(x, str) or not x.strip()
            for x in (
                self.imagen_id, self.propiedad_id, self.caso_id
            )
        ):
            raise ValueError("Identidad incompleta.")

        if not isinstance(self.mime, str) or self.mime not in FIRMAS:
            raise ValueError("Formato no permitido.")

        if type(self.tamano) is not int or not 0 < self.tamano <= MAX_BYTES:
            raise ValueError("Tamaño inválido.")

        if (
            not isinstance(self.sha256_hex, str)
            or len(self.sha256_hex) != 64
            or any(c not in "0123456789abcdef"
                   for c in self.sha256_hex)
        ):
            raise ValueError("Hash SHA-256 inválido.")

        if (
            not isinstance(self.capturada_en, datetime)
            or self.capturada_en.tzinfo is None
            or self.capturada_en.utcoffset() is None
        ):
            raise ValueError("Fecha sin zona horaria.")


def _verificar_integridad(evidencia: EvidenciaDL, contenido: bytes):
    if not isinstance(evidencia, EvidenciaDL):
        raise TypeError("Evidencia inválida.")

    if type(contenido) is not bytes:
        raise TypeError("Contenido inválido.")

    if len(contenido) != evidencia.tamano:
        raise ValueError("Tamaño no coincide.")

    if sha256(contenido).hexdigest() != evidencia.sha256_hex:
        raise ValueError("Integridad SHA-256 incorrecta.")

    if not FIRMAS[evidencia.mime](contenido):
        raise ValueError("Firma de archivo incorrecta.")



def preparar_imagen(evidencia: EvidenciaDL, contenido: bytes) -> ImagenPreparadaDL:
    """Decode one bounded photo; return pixels re-encoded without source metadata.

    Offline only. This function is NOT a process sandbox or a malware detector.
    Storage authorization must precede reading bytes; no network/credentials here.
    """
    _verificar_integridad(evidencia, contenido)
    # Do not silently accept a process configured elsewhere to tolerate truncation.
    if ImageFile.LOAD_TRUNCATED_IMAGES:
        raise ValueError("El decodificador permite imágenes truncadas.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(contenido), formats=list(FORMATOS.values())) as image:
                if image.format != FORMATOS[evidencia.mime]:
                    raise ValueError("El formato decodificado no coincide con el MIME.")
                width, height = image.size
                if not (0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION) or width * height > MAX_PIXELS:
                    raise ValueError("Resolución de imagen fuera de límites.")
                if getattr(image, "n_frames", 1) != 1:
                    raise ValueError("No se admiten fotografías animadas o multipágina.")
                image.verify()
            # verify() does not decode pixels; reopen the same immutable bytes and load.
            with Image.open(BytesIO(contenido), formats=[FORMATOS[evidencia.mime]]) as image:
                image.load()
                oriented = ImageOps.exif_transpose(image)
                try:
                    oriented.thumbnail((MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION))
                    with oriented.convert("RGBA") as rgba:
                        with Image.new("RGB", rgba.size, "white") as clean:
                            with rgba.getchannel("A") as alpha:
                                clean.paste(rgba, mask=alpha)
                            output = BytesIO()
                            # Fresh pixels only: EXIF/GPS/XMP/text/ICC are not copied.
                            clean.save(output, format="PNG")
                            prepared = output.getvalue()
                            result_size = clean.size
                finally:
                    oriented.close()
        if len(prepared) > MAX_OUTPUT_BYTES:
            raise ValueError("La imagen preparada supera el límite.")
        return ImagenPreparadaDL(*result_size, prepared, evidencia.sha256_hex,
                                 sha256(prepared).hexdigest())
    except (UnidentifiedImageError, OSError, SyntaxError, EOFError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError("La fotografía no se pudo decodificar de forma válida.") from error


def verificar_archivo(evidencia: EvidenciaDL, contenido: bytes):
    preparar_imagen(evidencia, contenido)
    return True


def validar_manifest(entrada: Entrada, evidencias: tuple):
    if not isinstance(entrada, Entrada):
        raise TypeError("Entrada inválida.")
    if not isinstance(evidencias, tuple):
        raise TypeError("Colección inválida.")
    if len(evidencias) > 100:
        raise ValueError("Demasiadas evidencias.")

    casos = {c.id for c in entrada.casos}
    ids = set()

    for e in evidencias:
        if not isinstance(e, EvidenciaDL):
            raise TypeError("Evidencia inválida.")
        if e.imagen_id in ids:
            raise ValueError("Imagen duplicada.")
        ids.add(e.imagen_id)

        if e.propiedad_id != entrada.propiedad_id:
            raise ValueError("Copropiedad diferente.")
        if e.caso_id not in casos:
            raise ValueError("Caso desconocido.")
        if e.capturada_en > entrada.leido_en:
            raise ValueError("Fotografía posterior a la lectura.")

    return tuple(evidencias)
