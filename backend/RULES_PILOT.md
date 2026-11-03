# Piloto por reglas: ejecución y borrador persistido

Este piloto usa Python 3.11+ con FastAPI. Es independiente del Worker Python y de
los adaptadores ML/DL/PLN. No es un modelo entrenado. No aprueba, cierra ni envía.

## Qué implementa

POST /agent-runs recibe solo project_id y request_id UUID. Valida la sesión con
Supabase Auth y exige pertenencia admin vigente. Lee únicamente los campos operativos
de casos y miembros, en páginas de 200. Rechaza colecciones superiores a 5000 filas,
fuentes inconsistentes y diferencias entre dos lecturas consecutivas. Este control
detecta cambios durante la lectura, pero no equivale a una transacción repeatable-read:
los datos pueden cambiar después. El borrador identifica su fecha de corte.

Tres etapas puras: Operaciones (vencidos, sin asignar, por verificar), Calidad
(sin plazo, responsable sin rol operativo) e Informe (plantilla ejecutiva). No se
leen descripciones, documentos, fotografías o instrucciones contenidas en casos.
Se cuentan casos únicos y se preservan los IDs de fuentes. El hash SHA-256 incluye
id, propiedad, datos, solicitante, fecha, hallazgos, etapas y texto.

Solo después de completar las etapas se inserta agent_runs con engine_kind=rules.
El estado pendiente lo calcula la vista existente; no se inserta agent_reviews.
El UUID permite recuperar una solicitud ya guardada del mismo administrador sin
duplicarla. Si se pierde la respuesta, reintentar desde la misma pantalla conserva
el UUID; si se recarga o cambia de pantalla, consultar el historial antes de generar
otra ejecución. No se reintenta automáticamente un POST.

GET /agent-runs conserva la lista paginada. GET /agent-runs/{id} devuelve el borrador
con el JWT humano y RLS; otra propiedad/no autorizado obtiene 404. La consulta no
constituye aprobación. La UI solo muestra el botón de ejecución al Administrador.

## Credencial y límites de seguridad

SUPABASE_AGENT_WRITER_KEY es una clave secreta de backend (sb_secret_...) o service_role
legada. No es una credencial de privilegio mínimo: puede tener amplios permisos en
el proyecto. La aplicación solo la usa en el INSERT fijo a agent_runs; las reglas
no reciben credenciales ni clientes HTTP. No entregarla a modelos, herramientas de
agentes ni navegadores. Antes de un despliegue público de producción, aislar el
escritor con credenciales de mínimo privilegio, añadir límites de solicitudes y
verificar autenticación/RLS extremo a extremo. Nunca usar esta clave para aprobar.

Sin la clave, POST responde 503 y no simula guardado. No se modifican las políticas
de Supabase ni se amplían los permisos del cliente para facilitar el piloto.

## Configuración local

En la raíz del repositorio, conservar las tres variables existentes en .env:
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y FRONTEND_ORIGIN. Añadir localmente mediante
un editor SUPABASE_AGENT_WRITER_KEY con la clave secreta obtenida en Supabase.
No pegarla en el chat, no poner prefijo VITE_ y no subir .env a GitHub.

```bash
source .venv/bin/activate
python -m pip install -r backend/requirements-fastapi.txt
python -m uvicorn backend.local_api:app --host 127.0.0.1 --port 8000
```

Detener antes el servidor antiguo main:app con Ctrl+C. No sobrescribir main.py.
En otra terminal, mantener el frontend con el proxy local:

```bash
VITE_AGENTS_API_URL=http://localhost:5173 npm run dev -- --port 5173 --strictPort --host 127.0.0.1
```

Iniciar sesión como admin, abrir Historial del enjambre y pulsar Ejecutar análisis
por reglas. Comprobar borrador pendiente y recuperarlo mediante Consultar historial
y Ver borrador. No hay activación automática ni despliegue público en esta entrega.

## Validación

```bash
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
node --test tests/agent-api.test.js
npm run build
```

Las pruebas HTTP utilizan Supabase simulado: no acreditan una ejecución real guardada.
Comprueban autorización, escritura limitada a agent_runs, idempotencia, snapshot
cambiado, credencial ausente, entrada adicional rechazada, escape HTML y separación
de propiedades. Las pruebas de SQL del registro siguen siendo independientes.

Referencia de claves: https://supabase.com/docs/guides/getting-started/api-keys

## Revisión humana del borrador

El detalle ofrece Aprobar/Rechazar y observaciones (hasta 4000 caracteres) solo al
Administrador. Una confirmación explícita precede al guardado. La decisión se
inserta directamente en `agent_reviews` usando la sesión humana de Supabase;
la clave privada del escritor y los agentes no participan en la aprobación.
RLS valida el rol por copropiedad. La FK vincula la decisión al hash del borrador,
la clave primaria impide decisiones duplicadas y no hay UPDATE ni DELETE.
El servidor asigna autor y fecha. Una decisión no envía informes ni cierra casos.
El detalle muestra estado, autor, fecha y observaciones; el texto original del
borrador conserva su condición inicial para mantener la instantánea inmutable.
Si falla la confirmación de guardado, consultar el historial antes de reintentar.

Pruebas del cliente: `node --test tests/agent-api.test.js tests/agent-review.test.js`.
Reiniciar Python tras actualizar para que el detalle también devuelva `note`.
