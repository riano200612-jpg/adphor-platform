"""Human-only application service. The API must supply verified identity/roles.

This is a domain policy, not an authentication endpoint or durable audit store.
An approval permits neither automatic sending nor case closure.
"""
from dataclasses import dataclass, replace
from datetime import datetime
from .domain import Resultado, EstadoFlujo


@dataclass(frozen=True)
class IdentidadVerificada:
    usuario_id: str
    propiedades_administradas: frozenset[str]


class AprobacionAdministrador:
    def aprobar(self, resultado: Resultado, identidad: IdentidadVerificada,
                huella_revisada: str, aprobado_en: datetime) -> Resultado:
        if not identidad.usuario_id or resultado.entrada.propiedad_id not in identidad.propiedades_administradas:
            raise PermissionError("Solo el Administrador de esta copropiedad puede aprobar.")
        if resultado.estado != EstadoFlujo.PENDIENTE:
            raise ValueError("El resultado no está pendiente de aprobación.")
        if resultado.huella != huella_revisada:
            raise ValueError("El borrador cambió. Revísalo de nuevo.")
        if aprobado_en.tzinfo is None or aprobado_en.utcoffset() is None:
            raise ValueError("La aprobación necesita zona horaria.")
        if aprobado_en < resultado.entrada.leido_en:
            raise ValueError("La aprobación no puede preceder a la lectura.")
        return replace(resultado, estado=EstadoFlujo.APROBADO,
                       aprobado_por=identidad.usuario_id, aprobado_en=aprobado_en)

    def editar_borrador(self, resultado: Resultado, texto: str,
                       identidad: IdentidadVerificada) -> Resultado:
        if not identidad.usuario_id or resultado.entrada.propiedad_id not in identidad.propiedades_administradas:
            raise PermissionError("Solo el Administrador puede editar este borrador.")
        if not texto.strip() or len(texto) > 20000:
            raise ValueError("Texto vacío o demasiado extenso.")
        return replace(resultado, borrador=replace(resultado.borrador, texto=texto.strip()),
                       revision=resultado.revision + 1, estado=EstadoFlujo.PENDIENTE,
                       aprobado_por=None, aprobado_en=None)
