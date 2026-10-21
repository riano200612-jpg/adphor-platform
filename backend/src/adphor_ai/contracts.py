"""Injection boundaries. Production adapters MUST provide real model inference."""
from typing import Protocol
from .domain import Caso, Entrada, Hallazgo, Borrador


class ModeloVersionado(Protocol):
    nombre: str
    version: str


class ModeloML(ModeloVersionado, Protocol):
    def estimar_riesgo(self, caso: Caso, fecha_corte: str) -> float: ...


class ModeloDL(ModeloVersionado, Protocol):
    def detectar_anomalias(self, entrada: Entrada) -> tuple[Hallazgo, ...]: ...


class ModeloPLN(ModeloVersionado, Protocol):
    def redactar(self, entrada: Entrada, hallazgos: tuple[Hallazgo, ...]) -> Borrador: ...
