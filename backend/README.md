# ADPHOR · Núcleo del enjambre en Python

Este directorio implementa la arquitectura ML → DL → PLN, independiente del frontend
JavaScript/Vite existente. Es una biblioteca de dominio, no un servicio desplegado.
No requiere dependencias externas para ejecutar sus pruebas con Python 3.11 o superior.

## Componentes

| Archivo | Responsabilidad |
| --- | --- |
| `adphor_ai/domain.py` | Casos, entrada inmutable, hallazgos, borrador y estados |
| `adphor_ai/contracts.py` | Contratos de inferencia ML, DL y PLN con versión del modelo |
| `adphor_ai/agents.py` | Interfaz común y validación de fuentes |
| `adphor_ai/ml.py` | Reglas exactas de vencimiento/asignación/verificación y priorización ML |
| `adphor_ai/dl.py` | Anomalías potenciales con referencias a casos o indicadores |
| `adphor_ai/pln.py` | Borrador con referencias a los hallazgos recibidos |
| `adphor_ai/orchestrator.py` | Secuencia fija; interrupción ante fallo; final pendiente de aprobación |
| `adphor_ai/approval.py` | Política de aprobación humana y edición que invalida la aprobación |
| `tests/test_flow.py` | Pruebas aisladas con modelos exclusivamente de prueba |

## Ejecución de pruebas

Desde la raíz del repositorio:

```sh
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
```

Los dobles de modelo existen solo en tests. No son modelos entrenados ni constituyen
implementaciones de ML, DL o PLN para producción. El núcleo no tiene proveedores por
defecto: se debe inyectar un adaptador real para cada contrato.

## Integración prevista

```python
from adphor_ai import (
    AgenteOperaciones, AgenteAnalisis, AgenteInformes, OrquestadorFlujo,
)

# modelo_ml, modelo_dl y modelo_pln: adaptadores reales suministrados por el servidor.
# entrada_autorizada: datos leídos después de autenticar al usuario y comprobar su propiedad.
flujo = OrquestadorFlujo(
    AgenteOperaciones(modelo_ml),
    AgenteAnalisis(modelo_dl),
    AgenteInformes(modelo_pln),
)
resultado = flujo.ejecutar(entrada_autorizada)
# resultado.estado == 'Pendiente de aprobación del administrador'
```

La fecha de corte debe representar el día en Colombia. La hora de lectura lleva zona
horaria explícita. La entrada rechaza casos de otras propiedades, IDs repetidos e
indicadores no finitos. Los adaptadores son código de servidor confiable: estas
interfaces no constituyen un sandbox para ejecutar código de terceros.

### Operaciones (ML)

Un caso está vencido por una comparación exacta de fechas, no porque lo prediga un
modelo. Las reglas seleccionan casos abiertos vencidos, sin asignar o por verificar;
el adaptador ML estima riesgo para ordenar esos casos. El valor 0–1 es una puntuación,
no una probabilidad calibrada a menos que el entrenamiento lo demuestre. Las fechas
faltantes no se convierten en vencimientos. La entrada es una fotografía de datos;
no cierra ni reasigna casos.

### Análisis (DL)

El adaptador DL recibe los indicadores y casos del ámbito autorizado y devuelve
hipótesis. Debe citar IDs o nombres de indicadores existentes. Todas sus anomalías
quedan marcadas como pendientes de validación, incluso si el adaptador devuelve otra
marca. La complejidad de los patrones y la calidad de detección dependen del modelo
entrenado; no se ha entrenado ni evaluado un modelo DL con datos reales en este cambio.

### Informes (PLN)

El adaptador entrega texto y los IDs de hallazgos que lo sustentan. Se rechazan salidas
vacías, excesivas y referencias inexistentes o incompletas. Esta validación estructural
no demuestra que cada afirmación del texto sea verdadera: el administrador debe revisar
el contenido y las cifras. Los datos deben tratarse como datos, nunca como instrucciones
para ejecutar herramientas. El modelo no recibe herramientas de envío o cierre del núcleo.

## Aprobación humana

`AprobacionAdministrador` es un servicio separado del orquestador. Su identidad debe
construirse **solo en el servidor**, a partir de autenticación verificada y membresías
actuales. Nunca aceptar `propiedades_administradas`, rol o ID del administrador desde
el cuerpo enviado por el navegador. El servicio comprueba el ámbito de propiedad y
la huella exacta del resultado mostrado al administrador.

La huella vincula casos y versiones, indicadores, modelos, hallazgos, texto y revisión.
Editar el texto incrementa la revisión, elimina los datos de aprobación y devuelve el
estado a pendiente. Aprobar no cierra casos ni envía reportes. Esas acciones, si se
implementan, deben ser solicitudes humanas separadas con autorización actualizada.

**Persistencia todavía pendiente:** los resultados, pasos y aprobaciones se devuelven
como objetos. No se guardan en Supabase ni SQLite. La futura API debe persistirlos en
una transacción, controlar la versión con compare-and-swap y registrar el actor para
que dos solicitudes concurrentes no aprueben revisiones diferentes. También debe
volver a comprobar las versiones de los datos fuente cuando la política exija vigencia.

Si falla un modelo, `EjecucionFallida` incluye el ID de ejecución y las etapas completadas
más la etapa fallida. No produce un resultado aprobable. El servidor debe conservar ese
registro técnico sin exponer al navegador excepciones internas o datos sensibles.

## Para activar el enjambre real

1. Implementar y evaluar los tres adaptadores con modelos reales; registrar sus versiones.
2. Añadir un servidor Python con autenticación, aislamiento por propiedad y límites de entrada.
3. Persistir ejecuciones, borradores, revisiones y aprobaciones con control de concurrencia.
4. Guardar credenciales de proveedores solo en el servidor; no en variables `VITE_*`.
5. Añadir límites de tiempo, gasto, reintentos y monitoreo a las llamadas de inferencia.
6. Conectar la interfaz de ADPHOR a la API y probar autorizaciones de extremo a extremo.

Este cambio no modifica Supabase, no ejecuta modelos externos y no activa trabajos
programados. La interfaz por reglas preparada por separado tampoco debe presentarse
como este enjambre de modelos hasta que exista la integración real.
