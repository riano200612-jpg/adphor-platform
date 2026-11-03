from uuid import uuid4
from .agents import Contexto
from .ml import AgenteOperaciones
from .dl import AgenteAnalisis
from .pln import AgenteInformes
from .domain import Entrada, Resultado, Paso


class EjecucionFallida(RuntimeError):
    def __init__(self, ejecucion_id, pasos):
        super().__init__("El flujo se detuvo; no se generó un resultado aprobable.")
        self.ejecucion_id = ejecucion_id
        self.pasos = tuple(pasos)


class OrquestadorFlujo:
    def __init__(self, operaciones: AgenteOperaciones, analisis: AgenteAnalisis,
                 informes: AgenteInformes):
        if not (isinstance(operaciones, AgenteOperaciones)
                and isinstance(analisis, AgenteAnalisis)
                and isinstance(informes, AgenteInformes)):
            raise TypeError("Se requiere la secuencia Operaciones → Análisis → Informes.")
        self.agentes = (operaciones, analisis, informes)

    def ejecutar(self, entrada: Entrada) -> Resultado:
        contexto = Contexto(entrada)
        ejecucion_id = str(uuid4())
        pasos = []
        for agente in self.agentes:
            try:
                contexto = agente.ejecutar(contexto)
            except Exception as error:
                pasos.append(Paso(agente.nombre, agente.modelo.nombre,
                                  agente.modelo.version, "Fallido"))
                raise EjecucionFallida(ejecucion_id, pasos) from error
            pasos.append(Paso(agente.nombre, agente.modelo.nombre,
                              agente.modelo.version, "Completado"))
        if contexto.borrador is None:
            raise EjecucionFallida(ejecucion_id, pasos)
        # Always pending. No approval, case closure or delivery capability here.
        return Resultado(ejecucion_id, entrada, contexto.hallazgos,
                         contexto.borrador, tuple(pasos))
