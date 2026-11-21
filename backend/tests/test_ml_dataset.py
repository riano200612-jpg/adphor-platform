import unittest
from dataclasses import replace
from datetime import date, timedelta

from adphor_ai.ml_features import VariablesRiesgo
from adphor_ai.ml_dataset import (
    EjemploML, DatasetNoApto, preparar_particiones
)


def muestra(i, propiedad="demo-01"):
    fecha = date(2026, 1, 1) + timedelta(days=i)
    return EjemploML(
        propiedad_id=propiedad,
        caso_id=f"caso-{i}",
        fecha_corte=fecha,
        fecha_validacion=fecha + timedelta(days=7),
        variables=VariablesRiesgo(
            dias_vencidos=i % 20,
            sin_asignar=bool(i % 2),
            por_verificar=bool(i % 3),
            en_proceso=True,
            sin_plazo=False,
        ),
        escalamiento_confirmado_7d=(i % 4 == 0),
        validado_por_admin=True,
    )


class DatasetMLTests(unittest.TestCase):

    def test_separacion_temporal(self):
        datos = tuple(muestra(i) for i in range(120))
        resultado = preparar_particiones(datos)

        self.assertGreaterEqual(len(resultado.entrenamiento), 80)
        self.assertGreaterEqual(len(resultado.validacion), 20)
        self.assertTrue(all(
            x.fecha_validacion < resultado.inicio_validacion
            for x in resultado.entrenamiento
        ))
        self.assertTrue(all(
            x.fecha_corte >= resultado.inicio_validacion
            for x in resultado.validacion
        ))

    def test_rechaza_pocos_datos(self):
        with self.assertRaises(DatasetNoApto):
            preparar_particiones(tuple(muestra(i) for i in range(10)))

    def test_rechaza_copropiedades_mezcladas(self):
        datos = (muestra(0), muestra(1, "otra-propiedad"))
        with self.assertRaises(DatasetNoApto):
            preparar_particiones(datos)

    def test_rechaza_etiquetas_no_validadas(self):
        with self.assertRaises(ValueError):
            replace(muestra(0), validado_por_admin=False)
        with self.assertRaises(ValueError):
            replace(muestra(0), fecha_validacion=date(2026, 1, 2))

    def test_requiere_ambas_clases(self):
        datos = tuple(
            replace(muestra(i), escalamiento_confirmado_7d=False)
            for i in range(120)
        )
        with self.assertRaises(DatasetNoApto):
            preparar_particiones(datos)


if __name__ == "__main__":
    unittest.main()
