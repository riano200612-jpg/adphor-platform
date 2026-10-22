"""Prevalidación local de fotografías; no realiza inferencia DL."""
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256

from .domain import Entrada

FIRMAS = {
    "image/jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "image/png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda b: (
        b.startswith(b"RIFF") and b[8:12] == b"WEBP"
    ),
}
MAX_BYTES = 10 * 1024 * 1024


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

        if self.mime not in FIRMAS:
            raise ValueError("Formato no permitido.")

        if type(self.tamano) is not int or not 0 < self.tamano <= MAX_BYTES:
            raise ValueError("Tamaño inválido.")

        if (
            len(self.sha256_hex) != 64
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


def verificar_archivo(evidencia: EvidenciaDL, contenido: bytes):
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
