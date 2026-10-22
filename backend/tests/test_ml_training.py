import unittest
from dataclasses import replace
from datetime import date, timedelta

from adphor_ai.ml_features import VariablesRiesgo
from adphor_ai.ml_dataset import EjemploML, DatasetNoApto
from adphor_ai.ml_training import entrenar_y_evaluar


def muestra(i):
    fecha = date(2026, 1, 1) + timedelta(days=i)
    return EjemploML(
        propiedad_id="demo-01",
        caso_id=f"caso-{i}",
        fecha_corte=fecha,
        fecha_validacion=fecha + timedelta(days=7),
        variables=VariablesRiesgo(
            i % 20, bool(i % 2), bool(i % 3), True, False
        ),
        escalamiento_confirmado_7d=(i % 4 == 0),
        validado_por_admin=True,
    )


class EntrenamientoMLTests(unittest.TestCase):

    def setUp(self):
        self.datos = tuple(muestra(i) for i in range(120))

    def test_entrenamiento_y_metricas(self):
        reporte = entrenar_y_evaluar(self.datos)
        self.assertFalse(reporte.habilitado_produccion)
        self.assertGreaterEqual(reporte.registros_entrenamiento, 80)
        self.assertGreaterEqual(reporte.registros_validacion, 20)

        m = reporte.metricas
        total = (
            m.verdaderos_positivos + m.verdaderos_negativos
            + m.falsos_positivos + m.falsos_negativos
        )
        self.assertEqual(total, reporte.registros_validacion)
        for valor in (m.precision, m.recall, m.f1, m.exactitud):
            self.assertTrue(0 <= valor <= 1)

    def test_no_filtracion_desde_validacion(self):
        original = entrenar_y_evaluar(self.datos)
        cambiados = tuple(
            replace(
                x,
                escalamiento_confirmado_7d=(
                    not x.escalamiento_confirmado_7d
                )
            ) if x.fecha_corte >= original.inicio_validacion else x
            for x in self.datos
        )
        nuevo = entrenar_y_evaluar(cambiados)
        self.assertEqual(original.modelo, nuevo.modelo)

    def test_entrenamiento_determinista(self):
        original = entrenar_y_evaluar(self.datos)
        invertido = entrenar_y_evaluar(tuple(reversed(self.datos)))
        self.assertEqual(original.modelo, invertido.modelo)

    def test_rechaza_datos_insuficientes(self):
        with self.assertRaises(DatasetNoApto):
            entrenar_y_evaluar(self.datos[:10])

    def test_rechaza_variables_invalidas(self):
        modelo = entrenar_y_evaluar(self.datos).modelo
        with self.assertRaises(ValueError):
            modelo.puntuar(
                VariablesRiesgo(900, True, False, False, False)
            )


if __name__ == "__main__":
    unittest.main()
