import unittest
from dataclasses import FrozenInstanceError, replace
from datetime import date, timedelta

from adphor_ai.ml_features import VariablesRiesgo
from adphor_ai.ml_dataset import EjemploML, DatasetNoApto
from adphor_ai.ml_temporal import preparar_tres_particiones


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


class ParticionesTemporalesTests(unittest.TestCase):

    def setUp(self):
        self.datos = tuple(muestra(i) for i in range(160))

    def test_tres_conjuntos(self):
        p = preparar_tres_particiones(self.datos)
        self.assertEqual(len(p.entrenamiento), 83)
        self.assertEqual(len(p.calibracion), 31)
        self.assertEqual(len(p.evaluacion), 32)

    def test_sin_filtracion_temporal(self):
        p = preparar_tres_particiones(self.datos)
        self.assertLess(
            max(x.fecha_validacion for x in p.entrenamiento),
            min(x.fecha_corte for x in p.calibracion),
        )
        self.assertLess(
            max(x.fecha_validacion for x in p.calibracion),
            min(x.fecha_corte for x in p.evaluacion),
        )

    def test_rechaza_120_registros(self):
        with self.assertRaises(DatasetNoApto):
            preparar_tres_particiones(self.datos[:120])

    def test_rechaza_propiedades_mezcladas(self):
        alterados = (
            replace(self.datos[0], propiedad_id="otra"),
            *self.datos[1:],
        )
        with self.assertRaises(DatasetNoApto):
            preparar_tres_particiones(tuple(alterados))

    def test_particiones_inmutables(self):
        p = preparar_tres_particiones(self.datos)
        with self.assertRaises(FrozenInstanceError):
            p.entrenamiento = ()


if __name__ == "__main__":
    unittest.main()
