import unittest
from dataclasses import replace
from datetime import date, datetime, timezone, timedelta
from hashlib import sha256
from io import BytesIO
from PIL import Image

from adphor_ai.domain import Caso, Entrada, EstadoCaso
from adphor_ai.dl_evidence import (
    EvidenciaDL, verificar_archivo, validar_manifest
)


class EvidenciaDLTests(unittest.TestCase):
    def setUp(self):
        self.fecha = datetime(
            2026, 10, 22, 12, tzinfo=timezone.utc
        )
        buffer = BytesIO()
        with Image.new("RGB", (32, 24), "blue") as image:
            image.save(buffer, format="PNG")
        self.contenido = buffer.getvalue()

        self.entrada = Entrada(
            "demo-01",
            date(2026, 10, 22),
            self.fecha,
            (
                Caso(
                    "caso-1", "demo-01",
                    EstadoCaso.EN_PROCESO, None, None
                ),
            ),
            (),
        )

        self.evidencia = EvidenciaDL(
            "foto-1", "demo-01", "caso-1",
            "image/png",
            len(self.contenido),
            sha256(self.contenido).hexdigest(),
            self.fecha,
        )

    def test_rechaza_cabecera_png_sin_imagen(self):
        fake = b"\x89PNG\r\n\x1a\nprueba"
        evidence = replace(self.evidencia, tamano=len(fake), sha256_hex=sha256(fake).hexdigest())
        with self.assertRaises(ValueError):
            verificar_archivo(evidence, fake)

    def test_integridad_correcta(self):
        self.assertTrue(
            verificar_archivo(self.evidencia, self.contenido)
        )

    def test_rechaza_contenido_modificado(self):
        with self.assertRaises(ValueError):
            verificar_archivo(
                self.evidencia,
                b"\x89PNG\r\n\x1a\n" + b"cambio"
            )

    def test_rechaza_firma_falsa(self):
        falso = b"archivo-falso"
        e = replace(
            self.evidencia,
            tamano=len(falso),
            sha256_hex=sha256(falso).hexdigest()
        )
        with self.assertRaises(ValueError):
            verificar_archivo(e, falso)

    def test_no_mezcla_copropiedades(self):
        e = replace(self.evidencia, propiedad_id="otra")
        with self.assertRaises(ValueError):
            validar_manifest(self.entrada, (e,))

    def test_no_acepta_casos_desconocidos(self):
        e = replace(self.evidencia, caso_id="otro-caso")
        with self.assertRaises(ValueError):
            validar_manifest(self.entrada, (e,))

    def test_no_acepta_fechas_futuras(self):
        e = replace(
            self.evidencia,
            capturada_en=self.fecha + timedelta(days=1)
        )
        with self.assertRaises(ValueError):
            validar_manifest(self.entrada, (e,))

    def test_manifest_valido(self):
        resultado = validar_manifest(
            self.entrada, (self.evidencia,)
        )
        self.assertEqual(resultado, (self.evidencia,))


if __name__ == "__main__":
    unittest.main()
