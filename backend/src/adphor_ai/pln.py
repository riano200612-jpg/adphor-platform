from dataclasses import replace
from .agents import Agente
from .contracts import ModeloPLN
from .domain import Borrador


class AgenteInformes(Agente):
    nombre = "Informes · PLN"

    def __init__(self, modelo: ModeloPLN):
        super().__init__(modelo)

    def ejecutar(self, contexto):
        borrador = self.modelo.redactar(contexto.entrada, contexto.hallazgos)
        if not isinstance(borrador, Borrador) or not borrador.texto.strip():
            raise ValueError("El modelo PLN devolvió un borrador vacío o inválido.")
        if len(borrador.texto) > 20000 or not isinstance(borrador.hallazgos_ids, tuple):
            raise ValueError("Formato de borrador inválido.")
        if set(borrador.hallazgos_ids) != {h.id for h in contexto.hallazgos}:
            raise ValueError("El borrador debe referenciar todos los hallazgos y ninguno inventado.")
        return replace(contexto, borrador=replace(borrador,
                       texto="BORRADOR · REQUIERE APROBACIÓN DEL ADMINISTRADOR\n\n" + borrador.texto.strip()))
