# ADPHOR / 99_BACKUPS — plan controlado de unificación (QA)

## Fuente histórica confirmada en informes de trabajo
Drive: Plataforma ADPHOR / 99_BACKUPS / 20260219_Plataforma_Running.zip.
RUNNING/ contiene Código.gs, Index.html, Calendario.gs, Correo.gs, Utilidades.gs, appsscript.json.
La lectura binaria del ZIP **no se consiguió en esta ejecución**. NO se afirma equivalencia, paridad ni fusión de su código.

## Arquitectura
ADPHOR existente permanece como núcleo de Auth, memberships, projects, tickets, Supabase y aprobación humana.
El módulo heredado sirve como especificación a cotejar para reuniones, correos y flujo HTML;
NO copiar credenciales, URLs privadas ni Apps Script con accesos heredados.
Los módulos PQRS/reuniones/informes usan project_id verificado, no inferred delegated ID.

### Pipelines y trazabilidad
Evento → outbox transaccional → worker idempotente → extracción segura (OCR/transcripción opcional)
→ metadatos por project_id → documentos indexables → embeddings versionados → búsqueda híbrida
con filtro project_id y políticas de acceso → propuesta IA → revisión gerente → decisión auditada.
Nunca usar material no autorizado para entrenamiento de modelo ni autodesplegar prompts.
"Autoaprendizaje" = actualización supervisada de índice y evaluación offline, no modificar pesos de forma autónoma.
Guardar versiones de extractor, modelo, prompt, consentimiento, fuente, hash y revisiones;
no indexar datos sensibles sin control y minimización.

### Calendario / regla 24 h
- Enviar solicitud de confirmación cuando la reunión alcance T-24h (job idempotente;
  retries + scheduler y tolerancia a ejecución, no prometer exactitud de reloj).
- Si faltan <24h al agendar/reprogramar: crear solicitud, no reunión definitiva.
- Gerencia puede aceptar/rechazar excepciones con autenticación, control de roles y audit log.
- Recalcular colisiones, disponibilidad y margen en la misma transacción de confirmación.
- Reuniones de alta criticidad, aunque falten >24h, requieren autorización superior para modificar.
- Exclusion constraints para recurso compartido; bloqueo transaccional serializable
  o advisory lock por tenant/recurso cuando se involucren múltiples participantes.

### Evidencias
Bucket privado, subidas firmadas de corta duración, hash, escaneo malware, MIME validado
en backend. MOV depende de codec de navegador; transcodificar en servidor si es necesario.
Audio: MediaRecorder produce tipos compatibles con navegador; conversión opcional.
PDF sandbox; Office preview mediante conversion server-side sanitizada.
La barra de progreso real necesita transporte que notifique bytes transferidos,
no puede inferirse de promesas de supabase-js upload.

### Pruebas bloqueantes
RLS multi-tenant (incluido delegado ambiguo); carrera de reuniones;
T-24h y DST Bogota; cambios críticos; un solo envío recordatorio (idempotencia);
reintentos outbox; almacenamiento entre copropiedades; antivirus y contenidos no confiables.
Cloudflare Access para staging y previews; rama QA sin despliegue automático de main.
