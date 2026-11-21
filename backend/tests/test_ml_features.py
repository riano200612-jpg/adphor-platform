import unittest
from datetime import date

from adphor_ai.domain import Caso, EstadoCaso
from adphor_ai.ml_features import extraer_variables


class VariablesMLTests(unittest.TestCase):

    def test_caso_vencido_sin_asignar(self):
        caso = Caso(
            "c1", "demo-01", EstadoCaso.POR_VERIFICAR,
            None, date(2026, 10, 20)
        )
        resultado = extraer_variables(caso, date(2026, 10, 22))

        self.assertEqual(resultado.dias_vencidos, 2)
        self.assertTrue(resultado.sin_asignar)
        self.assertTrue(resultado.por_verificar)

    def test_sin_plazo_no_inventa_vencimiento(self):
        caso = Caso(
            "c2", "demo-01", EstadoCaso.EN_PROCESO,
            "tecnico", None
        )
        resultado = extraer_variables(caso, date(2026, 10, 22))

        self.assertEqual(resultado.dias_vencidos, 0)
        self.assertTrue(resultado.sin_plazo)
        self.assertTrue(resultado.en_proceso)

    def test_caso_cerrado_no_se_prioriza(self):
        caso = Caso(
            "c3", "demo-01", EstadoCaso.CERRADA,
            None, date(2026, 10, 20)
        )
        with self.assertRaises(ValueError):
            extraer_variables(caso, date(2026, 10, 22))

    def test_fecha_invalida_rechazada(self):
        caso = Caso(
            "c4", "demo-01", EstadoCaso.PENDIENTE,
            None, None
        )
        with self.assertRaises(TypeError):
            extraer_variables(caso, "2026-10-22")


if __name__ == "__main__":
    unittest.main()
