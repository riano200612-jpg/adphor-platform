"""Control de calidad experimental. Sin activación en producción."""
from dataclasses import dataclass
from math import isclose, isfinite

from .ml_training import InformeEntrenamiento


@dataclass(frozen=True)
class DictamenCalidad:
    supera_criterios_experimentales: bool
    motivos: tuple[str, ...]
    habilitado_produccion: bool = False


def revisar_calidad(informe: InformeEntrenamiento) -> DictamenCalidad:
    if not isinstance(informe, InformeEntrenamiento):
        raise TypeError("Se requiere un informe ML válido.")

    if informe.habilitado_produccion:
        raise ValueError("No se permite un modelo preactivado.")

    m = informe.metricas
    tp = m.verdaderos_positivos
    tn = m.verdaderos_negativos
    fp = m.falsos_positivos
    fn = m.falsos_negativos

    conteos = (tp, tn, fp, fn)
    if any(type(x) is not int or x < 0 for x in conteos):
        raise ValueError("Matriz de confusión inválida.")

    total = sum(conteos)
    if total == 0 or total != informe.registros_validacion:
        raise ValueError("Cantidad de validación inconsistente.")

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )
    exactitud = (tp + tn) / total

    calculadas = {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "exactitud": exactitud,
    }

    for nombre, esperado in calculadas.items():
        declarado = getattr(m, nombre)
        if (
            type(declarado) not in (int, float)
            or not isfinite(declarado)
            or not isclose(declarado, esperado, abs_tol=1e-9)
        ):
            raise ValueError(f"Métrica {nombre} inconsistente.")

    motivos = []

    if total < 20:
        motivos.append("Muestra de validación insuficiente.")

    if tp + fn < 5 or tn + fp < 5:
        motivos.append("Soporte insuficiente por clase.")

    if precision < 0.75:
        motivos.append("Precisión inferior al umbral experimental.")

    if recall < 0.75:
        motivos.append("Recall inferior al umbral experimental.")

    if f1 < 0.70:
        motivos.append("F1 inferior al umbral experimental.")

    return DictamenCalidad(
        supera_criterios_experimentales=not motivos,
        motivos=tuple(motivos),
        habilitado_produccion=False,
    )
