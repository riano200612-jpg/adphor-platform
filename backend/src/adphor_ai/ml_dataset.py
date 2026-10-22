"""Preparación segura de datos etiquetados para ML offline."""
from dataclasses import dataclass
from datetime import date, timedelta

from .ml_features import VariablesRiesgo


class DatasetNoApto(ValueError):
    pass


@dataclass(frozen=True)
class EjemploML:
    propiedad_id: str
    caso_id: str
    fecha_corte: date
    fecha_validacion: date
    variables: VariablesRiesgo
    escalamiento_confirmado_7d: bool
    validado_por_admin: bool

    def __post_init__(self):
        if not self.propiedad_id or not self.caso_id:
            raise ValueError("Identidad incompleta.")
        if type(self.fecha_corte) is not date or type(self.fecha_validacion) is not date:
            raise ValueError("Fechas inválidas.")
        if not isinstance(self.variables, VariablesRiesgo):
            raise TypeError("Variables ML inválidas.")
        if type(self.escalamiento_confirmado_7d) is not bool:
            raise ValueError("Etiqueta inválida.")
        if self.validado_por_admin is not True:
            raise ValueError("La etiqueta requiere validación humana.")
        if self.fecha_validacion < self.fecha_corte + timedelta(days=7):
            raise ValueError("La etiqueta todavía no tiene siete días de observación.")


@dataclass(frozen=True)
class ParticionML:
    entrenamiento: tuple[EjemploML, ...]
    validacion: tuple[EjemploML, ...]
    inicio_validacion: date


def preparar_particiones(ejemplos: tuple[EjemploML, ...]) -> ParticionML:
    if not isinstance(ejemplos, tuple):
        raise TypeError("Se requiere una colección inmutable.")
    if any(not isinstance(x, EjemploML) for x in ejemplos):
        raise TypeError("Ejemplo ML inválido.")

    if len({x.propiedad_id for x in ejemplos}) > 1:
        raise DatasetNoApto("No mezclar copropiedades.")

    if len({x.caso_id for x in ejemplos}) != len(ejemplos):
        raise DatasetNoApto("No duplicar casos entre entrenamiento y validación.")

    fechas = sorted({x.fecha_corte for x in ejemplos})
    if len(fechas) < 2:
        raise DatasetNoApto("No existe suficiente historia temporal.")

    inicio = fechas[int(len(fechas) * 0.8)]

    # Solo entrenar con etiquetas conocidas antes del período de validación.
    entrenamiento = tuple(
        x for x in ejemplos if x.fecha_validacion < inicio
    )
    validacion = tuple(
        x for x in ejemplos if x.fecha_corte >= inicio
    )

    if len(entrenamiento) < 80 or len(validacion) < 20:
        raise DatasetNoApto("Datos insuficientes para la evaluación inicial.")

    for grupo in (entrenamiento, validacion):
        if {x.escalamiento_confirmado_7d for x in grupo} != {False, True}:
            raise DatasetNoApto("Se requieren ejemplos de ambas clases.")

    return ParticionML(entrenamiento, validacion, inicio)
