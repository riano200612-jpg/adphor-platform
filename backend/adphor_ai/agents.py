"""ML, DL and NLP stages: analysis only; no repositories or sending tools."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
import math
from .domain import Entrada, Hallazgo, Borrador


@dataclass(frozen=True)
class Contexto:
    entrada: Entrada
    hallazgos: tuple[Hallazgo, ...] = ()
    borrador: Borrador | None = None


class Agente(ABC):
    nombre: str

    def __init__(self, modelo):
        if not getattr(modelo, "nombre", "") or not getattr(modelo, "version", ""):
            raise ValueError("Configura un modelo con nombre y versión.")
        self.modelo = modelo

    @abstractmethod
    def ejecutar(self, contexto: Contexto) -> Contexto: ...


def validar_hallazgos(entrada, hallazgos):
    if not isinstance(hallazgos, tuple) or any(not isinstance(h, Hallazgo) for h in hallazgos):
        raise ValueError("Salida de hallazgos inválida.")
    ids = {c.id for c in entrada.casos}
    indicadores = {k for k, _ in entrada.indicadores}
    if len({h.id for h in hallazgos}) != len(hallazgos):
        raise ValueError("Identificadores de hallazgo repetidos.")
    for h in hallazgos:
        if not h.id or not h.descripcion.strip():
            raise ValueError("Hallazgo vacío.")
        if not isinstance(h.casos_ids, tuple) or not isinstance(h.indicadores, tuple):
            raise ValueError("Referencias no inmutables.")
        if not set(h.casos_ids).issubset(ids) or not set(h.indicadores).issubset(indicadores):
            raise ValueError("El modelo citó fuentes ajenas o inexistentes.")
        if not h.casos_ids and not h.indicadores:
            raise ValueError("Todo hallazgo necesita fuentes verificables.")
        if h.riesgo is not None and (not math.isfinite(h.riesgo) or not 0 <= h.riesgo <= 1):
            raise ValueError("Riesgo fuera de rango.")


