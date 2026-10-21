from dataclasses import replace
import math
from .agents import Agente
from .contracts import ModeloML
from .domain import Hallazgo, EstadoCaso


class AgenteOperaciones(Agente):
    nombre = "Operaciones · ML"

    def __init__(self, modelo: ModeloML):
        super().__init__(modelo)

    def ejecutar(self, contexto):
        hallazgos = []
        for caso in contexto.entrada.casos:
            if caso.estado == EstadoCaso.CERRADA:
                continue
            motivos = []
            if caso.vencimiento is not None and caso.vencimiento < contexto.entrada.fecha_corte:
                motivos.append("vencido")
            if not caso.responsable_id or not caso.responsable_id.strip():
                motivos.append("sin asignar")
            if caso.estado == EstadoCaso.POR_VERIFICAR:
                motivos.append("pendiente de verificación")
            if not motivos:
                continue
            riesgo = self.modelo.estimar_riesgo(caso, contexto.entrada.fecha_corte.isoformat())
            if not isinstance(riesgo, (float, int)) or not math.isfinite(riesgo) or not 0 <= riesgo <= 1:
                raise ValueError("El modelo ML devolvió un riesgo inválido.")
            hallazgos.append(Hallazgo(f"ml:{caso.id}", self.nombre,
                                     ", ".join(motivos), (caso.id,), riesgo=float(riesgo)))
        hallazgos.sort(key=lambda h: (-h.riesgo, h.id))
        return replace(contexto, hallazgos=contexto.hallazgos + tuple(hallazgos))


