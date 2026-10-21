# ADPHOR · Núcleo del enjambre en Python

Este directorio implementa la arquitectura ML → DL → PLN, independiente del frontend
JavaScript/Vite existente. Es una biblioteca de dominio, no un servicio desplegado.
No requiere dependencias externas para ejecutar sus pruebas con Python 3.11 o superior.

## Componentes

| Archivo | Responsabilidad |
| --- | --- |
| `src/adphor_ai/domain.py` | Casos, entrada inmutable, hallazgos, borrador y estados |
| `src/adphor_ai/contracts.py` | Contratos de inferencia ML, DL y PLN con versión del modelo |
| `src/adphor_ai/agents.py` | Interfaz común y validación de fuentes |
| `src/adphor_ai/ml.py` | Reglas exactas de vencimiento/asignación/verificación y priorización ML |
| `src/adphor_ai/dl.py` | Anomalías potenciales con referencias a casos o indicadores |
| `src/adphor_ai/pln.py` | Borrador con referencias a los hallazgos recibidos |
| `src/adphor_ai/orchestrator.py` | Secuencia fija; interrupción ante fallo; final pendiente de aprobación |
| `src/adphor_ai/approval.py` | Política de aprobación humana y edición que invalida la aprobación |
| `tests/test_flow.py` | Pruebas aisladas con modelos exclusivamente de prueba |

## Ejecución de pruebas

Desde la raíz del repositorio:

```sh
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
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

## Configuración inicial en Cloudflare (etapa de conexión)

Archivos preparados:

- `wrangler.jsonc`: Worker independiente `adphor-ai`; conserva la web actual en Pages.
- `pyproject.toml`: Python 3.13 para el runtime Workers; dependencias de desarrollo.
- `src/worker.py`: rutas de salud y verificación de acceso, sin ejecución de modelos.
- `src/adphor_ai/gateway.py`: valida sesión mediante Supabase Auth y luego la membresía
  usando el token del usuario; no utiliza credencial service-role.
- `.dev.vars.example`: plantilla local sin credenciales reales.

Configuración no secreta incluida: URL del proyecto `oqizvirqjwbbhyyjpthq` y origen web
`https://adphor-platform.pages.dev`. `SUPABASE_PUBLISHABLE_KEY` debe configurarse en el
Worker. Es la clave publishable del proyecto; no usar `sb_secret_*` ni service-role.
Ninguna credencial se toma desde parámetros enviados por el navegador.

Preparación/despliegue manual, dentro de `backend/` y con uv y Node instalados:

```sh
uv sync
uv run pywrangler login
uv run pywrangler secret put SUPABASE_PUBLISHABLE_KEY
uv run pywrangler deploy
```

El secreto se introduce interactivamente, sin añadirlo al comando ni al repositorio.
Revisar previamente la cuenta Cloudflare seleccionada y las condiciones de su plan.
Para desarrollo local, copiar `.dev.vars.example` a `.dev.vars`, reemplazar el valor
y ejecutar `uv run pywrangler dev`. Estos comandos requieren la autorización de tu
cuenta Cloudflare; no fueron ejecutados contra la cuenta del usuario.

Rutas de esta etapa:

| Ruta | Resultado |
| --- | --- |
| `GET /health` | Estado `connection-only`: el proceso responde, no significa IA lista |
| `GET /ready` | HTTP 503 hasta implementar modelos, persistencia y API de aprobación |
| `GET /v1/session?project_id=...` | Verifica token y membresía; devuelve rol y si es Administrador |
| Cualquier operación de escritura | Rechazada; no hay rutas de envío, cierre ni ejecución |

`/v1/session` necesita `Authorization: Bearer <access_token>` del usuario ya autenticado.
El frontend deberá obtenerlo de su sesión Supabase, nunca de una contraseña enviada al
Worker. El resultado no se almacena en caché. El origen permitido es exacto; CORS no
sustituye la verificación de identidad. La comprobación tiene un límite total de 10 s.

Pruebas de esta etapa usan respuestas simuladas de Auth y REST; no prueban aún una
sesión real ni el runtime desplegado. La integración Supabase sugerida en ChatGPT aún
requiere conexión del propietario. Tenerla conectada no despliega este Worker por sí
solo ni conecta los modelos. No se ha entrenado ML/DL con datos reales ni elegido un
proveedor PLN; no se deben sustituir estos pasos por modelos de prueba.

Referencias oficiales consultadas:
- https://developers.cloudflare.com/workers/languages/python/
- https://developers.cloudflare.com/workers/runtime-apis/fetch/
- https://supabase.com/docs/reference/python/auth-getuser

Comprobaciones de configuración realizadas: 18 pruebas aprobadas con Python 3.14,
resolución de dependencias guardada en `uv.lock` y empaquetado Cloudflare con
`uv run pywrangler deploy --dry-run` correcto (sin despliegue ni autenticación en la
cuenta). El código se separó en `src/` para excluir entornos virtuales y pruebas del
paquete. El empaquetado exitoso no demuestra conectividad con Supabase ni inferencia.
El intento de servidor local (`pywrangler dev`) fue bloqueado por el entorno:
`uv_interface_addresses returned Unknown system error 1`. Por tanto, falta la prueba
HTTP del Worker en un entorno compatible; no se afirma que haya sido desplegado o
probado con una sesión real.
