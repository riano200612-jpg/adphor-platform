import unittest
from dataclasses import replace
from datetime import date

from adphor_ai.ml_training import (
    InformeEntrenamiento, ModeloMLOffline, MetricasML
)
from adphor_ai.ml_quality import revisar_calidad


def informe(tp, tn, fp, fn):
    total = tp + tn + fp + fn
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )

    return InformeEntrenamiento(
        modelo=ModeloMLOffline((0.0,) * 5, 0.0),
        metricas=MetricasML(
            tp, tn, fp, fn,
            precision, recall, f1, (tp + tn) / total
        ),
        registros_entrenamiento=80,
        registros_validacion=total,
        inicio_validacion=date(2026, 7, 1),
    )


class CalidadMLTests(unittest.TestCase):

    def test_metricas_experimentales_suficientes(self):
        resultado = revisar_calidad(informe(6, 14, 0, 0))
        self.assertTrue(resultado.supera_criterios_experimentales)
        self.assertFalse(resultado.habilitado_produccion)

    def test_rechaza_modelo_sin_detecciones(self):
        resultado = revisar_calidad(informe(0, 18, 0, 2))
        self.assertFalse(resultado.supera_criterios_experimentales)

    def test_rechaza_modelo_con_bajo_recall(self):
        resultado = revisar_calidad(informe(1, 12, 2, 5))
        self.assertFalse(resultado.supera_criterios_experimentales)

    def test_detecta_metricas_manipuladas(self):
        reporte = informe(1, 12, 2, 5)
        alterado = replace(
            reporte,
            metricas=replace(reporte.metricas, f1=1.0)
        )
        with self.assertRaises(ValueError):
            revisar_calidad(alterado)

    def test_detecta_conteos_inconsistentes(self):
        reporte = replace(
            informe(6, 14, 0, 0),
            registros_validacion=25
        )
        with self.assertRaises(ValueError):
            revisar_calidad(reporte)

    def test_impide_modelo_previamente_activado(self):
        reporte = replace(
            informe(6, 14, 0, 0),
            habilitado_produccion=True
        )
        with self.assertRaises(ValueError):
            revisar_calidad(reporte)


if __name__ == "__main__":
    unittest.main()
