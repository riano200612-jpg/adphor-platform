"""Variables de riesgo para ML. Sin predicciones ni escrituras."""
from dataclasses import dataclass
from datetime import date

from .domain import Caso, EstadoCaso


@dataclass(frozen=True)
class VariablesRiesgo:
    dias_vencidos: int
    sin_asignar: bool
    por_verificar: bool
    en_proceso: bool
    sin_plazo: bool


def extraer_variables(caso: Caso, fecha_corte: date) -> VariablesRiesgo:
    if not isinstance(caso, Caso):
        raise TypeError("Se requiere un caso válido.")

    if type(fecha_corte) is not date:
        raise TypeError("La fecha de corte debe ser una fecha.")

    if caso.estado == EstadoCaso.CERRADA:
        raise ValueError("No se priorizan casos cerrados.")

    dias = 0
    if caso.vencimiento is not None:
        dias = max(0, (fecha_corte - caso.vencimiento).days)

    return VariablesRiesgo(
        dias_vencidos=min(dias, 365),
        sin_asignar=not bool((caso.responsable_id or "").strip()),
        por_verificar=caso.estado == EstadoCaso.POR_VERIFICAR,
        en_proceso=caso.estado == EstadoCaso.EN_PROCESO,
        sin_plazo=caso.vencimiento is None,
    )
