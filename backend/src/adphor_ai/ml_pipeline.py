"""Pipeline ML offline con evaluación temporal independiente."""
from dataclasses import dataclass

from .ml_dataset import EjemploML
from .ml_temporal import preparar_tres_particiones
from .ml_training import (
    ModeloMLOffline,
    MetricasML,
    InformeEntrenamiento,
    ajustar_modelo,
)
from .ml_quality import DictamenCalidad, revisar_calidad


@dataclass(frozen=True)
class ResultadoPipelineML:
    modelo: ModeloMLOffline
    umbral: float
    metricas_calibracion: MetricasML
    metricas_finales: MetricasML
    dictamen_final: DictamenCalidad
    brier_final: float
    tamanos: tuple[int, int, int]
    habilitado_produccion: bool = False


def calcular_metricas(modelo, ejemplos, umbral):
    tp = tn = fp = fn = 0

    for ejemplo in ejemplos:
        predicho = modelo.puntuar(ejemplo.variables) >= umbral
        real = ejemplo.escalamiento_confirmado_7d

        if predicho and real:
            tp += 1
        elif predicho and not real:
            fp += 1
        elif not predicho and real:
            fn += 1
        else:
            tn += 1

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )

    return MetricasML(
        tp, tn, fp, fn,
        precision,
        recall,
        f1,
        (tp + tn) / len(ejemplos),
    )


def ejecutar_pipeline(
    ejemplos: tuple[EjemploML, ...],
) -> ResultadoPipelineML:
    particiones = preparar_tres_particiones(ejemplos)

    # Etapa 1: no ve etiquetas de calibración ni evaluación.
    modelo = ajustar_modelo(particiones.entrenamiento)

    # Etapa 2: selecciona un umbral solamente con calibración.
    candidatos = sorted(
        {0.0, 0.5, 1.0} | {
            modelo.puntuar(x.variables)
            for x in particiones.calibracion
        }
    )

    opciones = [
        (
            umbral,
            calcular_metricas(
                modelo, particiones.calibracion, umbral
            ),
        )
        for umbral in candidatos
    ]

    umbral, metricas_calibracion = max(
        opciones,
        key=lambda item: (
            item[1].f1,
            item[1].precision,
            item[0],
        ),
    )

    # Etapa 3: evaluación final sin reajustar modelo ni umbral.
    metricas_finales = calcular_metricas(
        modelo, particiones.evaluacion, umbral
    )

    brier = sum(
        (
            modelo.puntuar(x.variables)
            - float(x.escalamiento_confirmado_7d)
        ) ** 2
        for x in particiones.evaluacion
    ) / len(particiones.evaluacion)

    informe = InformeEntrenamiento(
        modelo=modelo,
        metricas=metricas_finales,
        registros_entrenamiento=len(particiones.entrenamiento),
        registros_validacion=len(particiones.evaluacion),
        inicio_validacion=particiones.evaluacion[0].fecha_corte,
        habilitado_produccion=False,
    )

    dictamen = revisar_calidad(informe)

    return ResultadoPipelineML(
        modelo=modelo,
        umbral=umbral,
        metricas_calibracion=metricas_calibracion,
        metricas_finales=metricas_finales,
        dictamen_final=dictamen,
        brier_final=brier,
        tamanos=(
            len(particiones.entrenamiento),
            len(particiones.calibracion),
            len(particiones.evaluacion),
        ),
        habilitado_produccion=False,
    )
