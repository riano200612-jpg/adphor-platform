"""Evaluación temporal y diagnósticos de calibración: solo uso offline."""
from dataclasses import dataclass

from .ml_dataset import EjemploML, preparar_particiones
from .ml_features import VariablesRiesgo
from .ml_training import InformeEntrenamiento, entrenar_y_evaluar


@dataclass(frozen=True)
class IntervaloCalibracion:
    desde: float
    hasta: float
    observaciones: int
    puntuacion_media: float
    frecuencia_observada: float


@dataclass(frozen=True)
class EvaluacionML:
    entrenamiento: InformeEntrenamiento
    brier_ml: float
    brier_referencia: float
    mejora_brier: float
    error_calibracion_esperado: float
    f1_regla: float
    mejora_f1_frente_regla: float
    intervalos: tuple[IntervaloCalibracion, ...]
    habilitado_produccion: bool = False


def regla_basica(variables: VariablesRiesgo) -> bool:
    """Referencia binaria sin aprendizaje, no modifica casos."""
    if not isinstance(variables, VariablesRiesgo):
        raise TypeError("Variables inválidas.")
    return (
        variables.dias_vencidos > 0
        or variables.sin_asignar
        or variables.por_verificar
    )


def evaluar_experimento(
    ejemplos: tuple[EjemploML, ...]
) -> EvaluacionML:
    """Evalúa el modelo sin habilitar predicciones de producción."""
    particion = preparar_particiones(ejemplos)
    informe = entrenar_y_evaluar(ejemplos)

    if informe.habilitado_produccion:
        raise ValueError("No se evalúan modelos preactivados.")

    if (
        informe.inicio_validacion != particion.inicio_validacion
        or informe.registros_validacion != len(particion.validacion)
    ):
        raise ValueError("Partición y entrenamiento inconsistentes.")

    reales = tuple(
        int(x.escalamiento_confirmado_7d)
        for x in particion.validacion
    )
    puntuaciones = tuple(
        informe.modelo.puntuar(x.variables)
        for x in particion.validacion
    )

    tasa_historica = (
        sum(x.escalamiento_confirmado_7d
            for x in particion.entrenamiento)
        / len(particion.entrenamiento)
    )

    n = len(reales)

    brier_ml = sum(
        (p - y) ** 2 for p, y in zip(puntuaciones, reales)
    ) / n

    brier_referencia = sum(
        (tasa_historica - y) ** 2 for y in reales
    ) / n

    tp = fp = fn = 0

    for ejemplo, real in zip(particion.validacion, reales):
        predicho = regla_basica(ejemplo.variables)
        tp += int(predicho and bool(real))
        fp += int(predicho and not real)
        fn += int(not predicho and bool(real))

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1_regla = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )

    intervalos = []
    error_calibracion = 0.0

    for indice in range(5):
        grupo = [
            (p, y)
            for p, y in zip(puntuaciones, reales)
            if min(int(p * 5), 4) == indice
        ]

        if not grupo:
            continue

        cantidad = len(grupo)
        promedio = sum(p for p, _ in grupo) / cantidad
        frecuencia = sum(y for _, y in grupo) / cantidad

        intervalos.append(
            IntervaloCalibracion(
                indice / 5,
                (indice + 1) / 5,
                cantidad,
                promedio,
                frecuencia
            )
        )

        error_calibracion += (
            cantidad / n * abs(promedio - frecuencia)
        )

    return EvaluacionML(
        entrenamiento=informe,
        brier_ml=brier_ml,
        brier_referencia=brier_referencia,
        mejora_brier=brier_referencia - brier_ml,
        error_calibracion_esperado=error_calibracion,
        f1_regla=f1_regla,
        mejora_f1_frente_regla=informe.metricas.f1 - f1_regla,
        intervalos=tuple(intervalos),
    )
