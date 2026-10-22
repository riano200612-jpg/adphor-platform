"""Tres conjuntos temporales para experimentos ML offline."""
from dataclasses import dataclass

from .ml_dataset import (
    EjemploML,
    DatasetNoApto,
    preparar_particiones,
)


@dataclass(frozen=True)
class TresParticionesML:
    entrenamiento: tuple[EjemploML, ...]
    calibracion: tuple[EjemploML, ...]
    evaluacion: tuple[EjemploML, ...]


def preparar_tres_particiones(
    ejemplos: tuple[EjemploML, ...]
) -> TresParticionesML:
    base = preparar_particiones(ejemplos)

    historicos = sorted(
        base.entrenamiento,
        key=lambda x: (x.fecha_corte, x.caso_id),
    )

    indice = len(historicos) * 3 // 4
    inicio_calibracion = historicos[indice].fecha_corte

    entrenamiento = tuple(
        x for x in historicos
        if x.fecha_validacion < inicio_calibracion
    )

    calibracion = tuple(
        x for x in historicos
        if x.fecha_corte >= inicio_calibracion
    )

    evaluacion = tuple(
        sorted(
            base.validacion,
            key=lambda x: (x.fecha_corte, x.caso_id),
        )
    )

    if (
        len(entrenamiento) < 80
        or len(calibracion) < 20
        or len(evaluacion) < 20
    ):
        raise DatasetNoApto(
            "Datos insuficientes para tres particiones."
        )

    for grupo in (entrenamiento, calibracion, evaluacion):
        clases = {
            x.escalamiento_confirmado_7d for x in grupo
        }
        if clases != {False, True}:
            raise DatasetNoApto(
                "Cada conjunto necesita ambas clases."
            )

    if max(x.fecha_validacion for x in entrenamiento) >= min(
        x.fecha_corte for x in calibracion
    ):
        raise DatasetNoApto(
            "Filtracion temporal hacia calibracion."
        )

    if max(x.fecha_validacion for x in calibracion) >= min(
        x.fecha_corte for x in evaluacion
    ):
        raise DatasetNoApto(
            "Filtracion temporal hacia evaluacion."
        )

    return TresParticionesML(
        entrenamiento,
        calibracion,
        evaluacion,
    )
