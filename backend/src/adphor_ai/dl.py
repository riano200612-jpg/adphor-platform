from dataclasses import replace
from .agents import Agente, validar_hallazgos
from .contracts import ModeloDL


class AgenteAnalisis(Agente):
    nombre = "Análisis · DL"

    def __init__(self, modelo: ModeloDL):
        super().__init__(modelo)

    def ejecutar(self, contexto):
        anomalias = self.modelo.detectar_anomalias(contexto.entrada)
        validar_hallazgos(contexto.entrada, anomalias)
        anomalias = tuple(replace(h, id=f"dl:{h.id}", origen=self.nombre,
                                 requiere_validacion=True) for h in anomalias)
        hallazgos = contexto.hallazgos + anomalias
        validar_hallazgos(contexto.entrada, hallazgos)
        return replace(contexto, hallazgos=hallazgos)


