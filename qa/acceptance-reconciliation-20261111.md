# ADPHOR QA — Reconciliación P0 y aceptación pendiente

## Cronología

Work aplicó `20261111133108_qa_shared_visits_scheduled_contract` en la ejecución anterior a integrar Claude. Su exportación ya estaba incluida en `a6aea10` (11 de noviembre de 2026, 08:49 Colombia). La integración de Claude siguió después (`e7f9bb0`, 09:06 y `70d9e9a`, 09:08 Colombia). No fue una operación paralela. El informe anterior omitió esta distinción de fases. La versión registrada no demuestra por sí sola el instante exacto de aplicación.

La revisión actual realizó SELECT administrativos únicamente. Confirma tabla vacía, migración registrada, RLS habilitada, tres políticas y función SECURITY INVOKER. No ejecutó la migración ni creó registros, usuarios o permisos. Esta comprobación administrativa no equivale a un token AAL2 real.

## Matriz de aceptación

| Funcionalidad | Implementada en candidata | Probada | Disponible en URL QA |
|---|---|---|---|
| Identidad y navegación | Integrada, sin rediseño nuevo | Línea base conservada; visual nueva BLOCKED | BLOCKED: SHA servido no verificado |
| Login/MFA | Auth y AAL2 existentes; QA bloquea fallback a demo | PASS aislado; token AAL2 real BLOCKED | BLOCKED: sesión/artefacto no certificados |
| Home/calendario | Consulta de reuniones verificadas por copropiedad | PASS contratos; lectura autenticada y recarga BLOCKED | BLOCKED |
| Reuniones | Formulario, duración, revisión informativa | PASS aislado; creación corporativa FAIL por servicio no conectado | BLOCKED |
| Horarios sugeridos | No certificada generación automática corporativa; existe comprobación manual | FAIL para sugerencias reales; Google Calendar real BLOCKED | BLOCKED |
| Acompañamientos | Selector filtrado y Sin acompañamiento requerido conservados | PASS de línea base; permisos/disponibilidad reales BLOCKED | BLOCKED |
| Visitas programadas | Formulario y qa_visits/qa_create_visit; flag apagado | PASS SQL aislado/idempotencia; AAL2 y guardado remoto BLOCKED | BLOCKED |
| Ciclo completo de Visitas | No cubre ejecución, ingreso/salida, resultados o seguimiento | FAIL: contrato y operación adicionales pendientes | No certificado |
| PQRS | Consulta, creación/gestión, historial y Atención hoy existentes | PASS aislado previo; ciclo AAL2 remoto BLOCKED | BLOCKED |
| Agenda consulta | UI integrada con repositorio de reuniones verificadas | PASS contratos; navegador autenticado BLOCKED | BLOCKED |
| Agenda transaccional | Servicios aislados/simulados; interfaz no conectada a operaciones corporativas | FAIL para flujo real solicitado; simulación no lo certifica | No disponible como operación corporativa |
| Miss ADPHOR | Guía y navegación contextual existentes | PASS aislado; recorrido autenticado BLOCKED | BLOCKED |
| Fotografías/carrusel | Conservados sin cambios | Evidencia visual previa del propietario, no recertificada | No se asume SHA nuevo publicado |

## Pruebas actuales

- JavaScript: 293/293 PASS; dos regresiones nuevas para impedir sustitución silenciosa por demo en QA.
- Pruebas dirigidas Auth y Visitas: 13/13 PASS, incluidas dentro de las 293.
- Build Vite, sintaxis app.js y git diff --check: PASS.
- Python: evidencia previa 136/136 PASS; backend no modificado en este incremento.
- E2E de candidata en navegador, Supabase AAL2, persistencia remota, Google Calendar: BLOCKED/no ejecutados. No se repitieron ensayos Chromium/Crostini.

## Controles de entrega

La sesión administrativa observada termina en el login oficial de Cloudflare. No se obtuvieron Application ID, AUD, política Allow ni variables efectivas del proveedor. El nombre de un Team Domain compartido no prueba error ni autoriza modificarlo.

GitHub QA consolidada se verificó en `590508630f196b45e4dce92b341e7605f3ebc020`; producción en `1cfc33bd76f3163635ac60db1432d230a3a2098b`. No equivalen a SHA servido por Pages. Deployment ID activo y flags reales siguen pendientes. La candidata permanece en la misma rama de revisión, sin fusionar a QA consolidada.

Antes de publicar: verificar Pages y Access por vía administrativa autorizada, variables QA/MFA, flag de Visitas apagado, referencia objetivo QA, artefacto exacto y navegador compatible protegido. Requiere autorización expresa cualquier activación de escritura, registro piloto o despliegue.

## Intervención necesaria y orden

1. Completar autenticación oficial de Cloudflare en la sesión de navegador de esta tarea para verificar configuración, Access y Deployment ID; no enviar credenciales por chat.
2. Disponer de sesión legítima Supabase AAL2 en el portal validado, sin extraer ni compartir tokens. Access y Supabase son controles distintos.
3. Aprobar por separado el ensayo acotado de escritura de Visitas, indicando copropiedad, responsable y registro sintético revisados. Mantener el flag apagado hasta aprobar controles; la presencia de la RPC no autoriza su invocación para escribir.
4. Ejecutar la candidata en host E2E aislado compatible ya preparado y autorizado; no presentar sus mocks de autenticación como certificación Supabase.
5. Con evidencias satisfactorias, solicitar publicación QA. Persisten brechas funcionales de Agenda transaccional y creación de reuniones, independientes del despliegue.

## Reversión

No se requiere reversión de base de datos: esta revisión no la modificó. No eliminar tabla ni datos. Conservar flags apagados. Para revertir código de revisión, crear commit inverso en la misma rama con revisión; no force-push ni mover ramas protegidas. Antes de cualquier futuro despliegue, registrar Deployment ID/artefacto vigente para poder restaurarlo; ese rollback de proveedor aún no está ensayado ni autorizado.
