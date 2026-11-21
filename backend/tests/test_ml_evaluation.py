import unittest
from dataclasses import replace
from datetime import date, timedelta

from adphor_ai.ml_features import VariablesRiesgo
from adphor_ai.ml_dataset import EjemploML, DatasetNoApto
from adphor_ai.ml_evaluation import evaluar_experimento, regla_basica


def muestra(i):
    corte = date(2026, 1, 1) + timedelta(days=i)
    return EjemploML(
        propiedad_id="demo-01",
        caso_id=f"caso-{i}",
        fecha_corte=corte,
        fecha_validacion=corte + timedelta(days=7),
        variables=VariablesRiesgo(
            i % 20, bool(i % 2), bool(i % 3), True, False
        ),
        escalamiento_confirmado_7d=(i % 4 == 0),
        validado_por_admin=True,
    )


class EvaluacionMLTests(unittest.TestCase):

    def setUp(self):
        self.datos = tuple(muestra(i) for i in range(120))

    def test_metricas_calibracion_y_referencias(self):
        resultado = evaluar_experimento(self.datos)
        self.assertFalse(resultado.habilitado_produccion)

        for valor in (
            resultado.brier_ml,
            resultado.brier_referencia,
            resultado.error_calibracion_esperado,
            resultado.f1_regla
        ):
            self.assertTrue(0 <= valor <= 1)

        self.assertAlmostEqual(
            resultado.mejora_brier,
            resultado.brier_referencia - resultado.brier_ml
        )

        self.assertEqual(
            sum(x.observaciones for x in resultado.intervalos),
            resultado.entrenamiento.registros_validacion
        )

    def test_no_fuga_del_periodo_de_validacion(self):
        antes = evaluar_experimento(self.datos)

        modificados = tuple(
            replace(
                x,
                escalamiento_confirmado_7d=(
                    not x.escalamiento_confirmado_7d
                )
            )
            if x.fecha_corte >= antes.entrenamiento.inicio_validacion
            else x
            for x in self.datos
        )

        despues = evaluar_experimento(modificados)

        self.assertEqual(
            antes.entrenamiento.modelo,
            despues.entrenamiento.modelo
        )
        self.assertNotAlmostEqual(
            antes.brier_ml,
            despues.brier_ml
        )

    def test_resultados_independientes_del_orden(self):
        a = evaluar_experimento(self.datos)
        b = evaluar_experimento(tuple(reversed(self.datos)))

        self.assertEqual(a.entrenamiento.modelo, b.entrenamiento.modelo)
        self.assertAlmostEqual(a.brier_ml, b.brier_ml)

    def test_referencia_basada_en_reglas(self):
        self.assertTrue(
            regla_basica(VariablesRiesgo(0, True, False, False, False))
        )
        self.assertFalse(
            regla_basica(VariablesRiesgo(0, False, False, True, False))
        )

        with self.assertRaises(TypeError):
            regla_basica(None)

    def test_rechaza_datos_insuficientes(self):
        with self.assertRaises(DatasetNoApto):
            evaluar_experimento(self.datos[:8])


if __name__ == "__main__":
    unittest.main()
