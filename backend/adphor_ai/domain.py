"""Immutable snapshots and results; never ORM entities with write capabilities."""
from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from hashlib import sha256
import json
import math


class EstadoCaso(str, Enum):
    PENDIENTE = "Pendiente"
    EN_PROCESO = "En proceso"
    POR_VERIFICAR = "Por verificar"
    CERRADA = "Cerrada"


class EstadoFlujo(str, Enum):
    PENDIENTE = "Pendiente de aprobación del administrador"
    APROBADO = "Aprobado por el administrador"


@dataclass(frozen=True)
class Caso:
    id: str
    propiedad_id: str
    estado: EstadoCaso
    responsable_id: str | None
    vencimiento: date | None
    version: int = 1

    def __post_init__(self):
        if not self.id or not self.propiedad_id or self.version < 1:
            raise ValueError("Caso sin identidad o versión válida.")
        if not isinstance(self.estado, EstadoCaso):
            raise ValueError("Estado de caso no reconocido.")
        if self.vencimiento is not None and type(self.vencimiento) is not date:
            raise ValueError("El vencimiento debe ser una fecha de calendario.")


@dataclass(frozen=True)
class Entrada:
    propiedad_id: str
    fecha_corte: date
    leido_en: datetime
    casos: tuple[Caso, ...]
    indicadores: tuple[tuple[str, float], ...]

    def __post_init__(self):
        if not self.propiedad_id or type(self.fecha_corte) is not date:
            raise ValueError("Propiedad o fecha de corte inválida.")
        if self.leido_en.tzinfo is None or self.leido_en.utcoffset() is None:
            raise ValueError("La lectura necesita zona horaria.")
        if not isinstance(self.casos, tuple) or not isinstance(self.indicadores, tuple):
            raise ValueError("La entrada debe contener colecciones inmutables.")
        if any(c.propiedad_id != self.propiedad_id for c in self.casos):
            raise ValueError("No se pueden mezclar copropiedades.")
        if len({c.id for c in self.casos}) != len(self.casos):
            raise ValueError("Existen casos duplicados.")
        keys = []
        for item in self.indicadores:
            if not isinstance(item, tuple) or len(item) != 2:
                raise ValueError("Indicador inválido.")
            key, value = item
            if not isinstance(key, str) or not key or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError("Indicador inválido.")
            keys.append(key)
        if len(set(keys)) != len(keys):
            raise ValueError("Existen indicadores duplicados.")


@dataclass(frozen=True)
class Hallazgo:
    id: str
    origen: str
    descripcion: str
    casos_ids: tuple[str, ...] = ()
    indicadores: tuple[str, ...] = ()
    riesgo: float | None = None
    requiere_validacion: bool = True


@dataclass(frozen=True)
class Borrador:
    texto: str
    hallazgos_ids: tuple[str, ...]


@dataclass(frozen=True)
class Paso:
    agente: str
    modelo: str
    version_modelo: str
    estado: str


@dataclass(frozen=True)
class Resultado:
    ejecucion_id: str
    entrada: Entrada
    hallazgos: tuple[Hallazgo, ...]
    borrador: Borrador
    pasos: tuple[Paso, ...]
    revision: int = 1
    estado: EstadoFlujo = EstadoFlujo.PENDIENTE
    aprobado_por: str | None = None
    aprobado_en: datetime | None = None

    @property
    def huella(self) -> str:
        # Bind approval to exact input, findings, model versions and draft revision.
        from dataclasses import asdict
        payload = {"id": self.ejecucion_id, "entrada": asdict(self.entrada),
                   "hallazgos": [asdict(h) for h in self.hallazgos],
                   "borrador": asdict(self.borrador), "pasos": [asdict(p) for p in self.pasos],
                   "revision": self.revision}
        return sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                 default=str).encode()).hexdigest()
