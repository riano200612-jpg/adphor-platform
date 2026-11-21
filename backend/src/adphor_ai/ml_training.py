"""Entrenamiento ML offline. No habilita modelos en producción."""
from dataclasses import dataclass
from datetime import date
from math import exp, isfinite

from .ml_dataset import EjemploML, preparar_particiones, DatasetNoApto
from .ml_features import VariablesRiesgo


def _vector(v: VariablesRiesgo) -> tuple[float, ...]:
    if not isinstance(v, VariablesRiesgo):
        raise TypeError("Variables de riesgo inválidas.")
    if type(v.dias_vencidos) is not int or not 0 <= v.dias_vencidos <= 365:
        raise ValueError("Días vencidos fuera de rango.")
    flags = (v.sin_asignar, v.por_verificar, v.en_proceso, v.sin_plazo)
    if any(type(flag) is not bool for flag in flags):
        raise ValueError("Indicadores binarios inválidos.")
    return (v.dias_vencidos / 365.0, *(float(flag) for flag in flags))


def _sigmoide(z):
    if not isfinite(z):
        raise ValueError("Puntuación no finita.")
    if z >= 0:
        e = exp(-z)
        return 1.0 / (1.0 + e)
    e = exp(z)
    return e / (1.0 + e)


@dataclass(frozen=True)
class ModeloMLOffline:
    pesos: tuple[float, ...]
    sesgo: float
    nombre: str = "regresion-logistica-offline"
    version: str = "0.1.0-experimental"

    def puntuar(self, variables: VariablesRiesgo) -> float:
        if len(self.pesos) != 5 or not all(
            isfinite(x) for x in (*self.pesos, self.sesgo)
        ):
            raise ValueError("Modelo inválido.")
        return _sigmoide(
            self.sesgo + sum(
                a * b for a, b in zip(self.pesos, _vector(variables))
            )
        )


@dataclass(frozen=True)
class MetricasML:
    verdaderos_positivos: int
    verdaderos_negativos: int
    falsos_positivos: int
    falsos_negativos: int
    precision: float
    recall: float
    f1: float
    exactitud: float


@dataclass(frozen=True)
class InformeEntrenamiento:
    modelo: ModeloMLOffline
    metricas: MetricasML
    registros_entrenamiento: int
    registros_validacion: int
    inicio_validacion: date
    habilitado_produccion: bool = False


def ajustar_modelo(
    entrenamiento: tuple[EjemploML, ...]
) -> ModeloMLOffline:
    """Entrena exclusivamente con ejemplos históricos aprobados."""
    if not isinstance(entrenamiento, tuple) or any(
        not isinstance(x, EjemploML) for x in entrenamiento
    ):
        raise TypeError("Ejemplos de entrenamiento inválidos.")

    if len(entrenamiento) < 80:
        raise DatasetNoApto("Menos de 80 ejemplos para entrenar.")

    if len({x.propiedad_id for x in entrenamiento}) != 1:
        raise DatasetNoApto("Copropiedades mezcladas.")

    if len({x.caso_id for x in entrenamiento}) != len(entrenamiento):
        raise DatasetNoApto("Casos duplicados.")

    if any(x.validado_por_admin is not True for x in entrenamiento):
        raise DatasetNoApto("Existen etiquetas sin validar.")

    if {x.escalamiento_confirmado_7d for x in entrenamiento} != {
        True, False
    }:
        raise DatasetNoApto("Se necesitan ambas clases.")

    train = sorted(
        entrenamiento,
        key=lambda x: (x.fecha_corte, x.caso_id)
    )
    vectores = [_vector(x.variables) for x in train]
    etiquetas = [
        float(x.escalamiento_confirmado_7d) for x in train
    ]

    pesos = [0.0] * 5
    sesgo = 0.0
    tasa = 0.3
    regularizacion = 0.01
    n = len(train)

    for _ in range(350):
        errores = [
            _sigmoide(
                sesgo + sum(w * v for w, v in zip(pesos, fila))
            ) - y
            for fila, y in zip(vectores, etiquetas)
        ]
        gradientes = [
            sum(
                err * fila[j]
                for err, fila in zip(errores, vectores)
            ) / n + regularizacion * pesos[j]
            for j in range(5)
        ]
        sesgo -= tasa * sum(errores) / n
        pesos = [
            w - tasa * g
            for w, g in zip(pesos, gradientes)
        ]

    return ModeloMLOffline(tuple(pesos), sesgo)


def entrenar_y_evaluar(
    ejemplos: tuple[EjemploML, ...]
) -> InformeEntrenamiento:
    particion = preparar_particiones(ejemplos)

    modelo = ajustar_modelo(particion.entrenamiento)
    tp = tn = fp = fn = 0

    for ejemplo in particion.validacion:
        predicho = modelo.puntuar(ejemplo.variables) >= 0.5
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

    metricas = MetricasML(
        tp, tn, fp, fn,
        precision, recall, f1,
        (tp + tn) / len(particion.validacion)
    )

    return InformeEntrenamiento(
        modelo,
        metricas,
        len(particion.entrenamiento),
        len(particion.validacion),
        particion.inicio_validacion
    )
