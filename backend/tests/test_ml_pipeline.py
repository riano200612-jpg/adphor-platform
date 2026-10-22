import unittest
from dataclasses import replace
from datetime import date, timedelta

from adphor_ai.ml_features import VariablesRiesgo
from adphor_ai.ml_dataset import EjemploML, DatasetNoApto
from adphor_ai.ml_temporal import preparar_tres_particiones
from adphor_ai.ml_pipeline import ejecutar_pipeline


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


class PipelineMLTests(unittest.TestCase):

    def setUp(self):
        self.datos = tuple(muestra(i) for i in range(160))

    def test_pipeline_completo(self):
        r = ejecutar_pipeline(self.datos)
        self.assertEqual(r.tamanos, (83, 31, 32))
        self.assertTrue(0 <= r.umbral <= 1)
        self.assertFalse(r.habilitado_produccion)
        self.assertFalse(r.dictamen_final.habilitado_produccion)

    def test_evaluacion_no_modifica_el_umbral(self):
        a = ejecutar_pipeline(self.datos)
        particiones = preparar_tres_particiones(self.datos)
        ids = {x.caso_id for x in particiones.evaluacion}

        cambiados = tuple(
            replace(
                x,
                escalamiento_confirmado_7d=not x.escalamiento_confirmado_7d
            ) if x.caso_id in ids else x
            for x in self.datos
        )

        b = ejecutar_pipeline(cambiados)

        self.assertEqual(a.modelo, b.modelo)
        self.assertEqual(a.umbral, b.umbral)
        self.assertNotEqual(
            a.metricas_finales.verdaderos_positivos
            + a.metricas_finales.falsos_negativos,
            b.metricas_finales.verdaderos_positivos
            + b.metricas_finales.falsos_negativos,
        )

    def test_calibracion_no_reentrena_modelo(self):
        a = ejecutar_pipeline(self.datos)
        particiones = preparar_tres_particiones(self.datos)
        ids = {x.caso_id for x in particiones.calibracion}

        cambiados = tuple(
            replace(
                x,
                escalamiento_confirmado_7d=not x.escalamiento_confirmado_7d
            ) if x.caso_id in ids else x
            for x in self.datos
        )

        b = ejecutar_pipeline(cambiados)
        self.assertEqual(a.modelo, b.modelo)

    def test_determinismo(self):
        a = ejecutar_pipeline(self.datos)
        b = ejecutar_pipeline(tuple(reversed(self.datos)))

        self.assertEqual(a.modelo, b.modelo)
        self.assertEqual(a.umbral, b.umbral)
        self.assertEqual(a.metricas_finales, b.metricas_finales)

    def test_rechaza_datos_insuficientes(self):
        with self.assertRaises(DatasetNoApto):
            ejecutar_pipeline(self.datos[:120])


if __name__ == "__main__":
    unittest.main()
