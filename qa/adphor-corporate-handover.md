# Entrega corporativa ADPHOR

## Arquitectura candidata

Un repositorio en la organización GitHub de ADPHOR con ambientes QA y producción separados. Pages bajo cuenta corporativa y una ruta QA del mismo origen para disponibilidad. La Pages Function debe aceptar únicamente POST en la ruta fija, estar cubierta por Access, conservar el Bearer del usuario, excluir cookies de destino y usar un Service Binding de preview a un Worker QA sin workers.dev ni rutas públicas. Un binding limita el transporte, pero el backend conserva validación Auth, AAL2, membresía, rol y el proyecto QA exacto. No reenviar credenciales a destinos dinámicos, devolver datos de eventos ni cachear disponibilidad. Verificar costos y límites del runtime antes de habilitar.

La opción Python usa el adaptador ASGI de Workers en lugar de Uvicorn. No promover el backend completo hasta verificar arranque, lifespan, compatibilidad de dependencias Pyodide y transporte saliente HTTPS de Supabase y Google. Si la aplicación completa no funciona, portar solo disponibilidad a una Supabase Edge Function del QA existente, sin copiar las otras rutas. Conservar el contrato y pruebas. En ese diseño, la Pages Function sería el proxy protegido hacia el endpoint fijo y Supabase verificaría la identidad y membresía del usuario.

## Transferencia por etapas

1. Inventariar titulares, repositorio, DNS, cuenta Pages/Access, proyectos Supabase, calendario y aplicaciones OAuth. Designar administradores corporativos con MFA y acceso de contingencia. Acordar presupuesto, ventana de corte y reversión.
2. Crear respaldo Git privado de todas las referencias y etiquetas, y guardar evidencia de PR, reglas, variables y pipelines sin exportar secretos. Transferir el repositorio a la organización corporativa tras validar permisos; reautorizar GitHub Apps, protecciones, environments y pipelines.
3. Probar Pages y Access con un hostname de QA aprobado, sin cambiar el dominio activo. Exportar DNS y documentar callbacks, certificados y políticas. Configurar secretos corporativos por ambiente, incluidos OAuth de solo lectura y Supabase. Verificar que el PR de preview no tenga acceso al entorno productivo.
4. Para Supabase, evaluar primero transferencia de propiedad del proyecto con referencia intacta. Si se requiere migrar a otro proyecto, respaldar y restaurar esquema, datos y Auth y copiar objetos privados por separado con hashes. Verificar MFA, membresías, RLS, cron, Edge Functions, redirecciones y recuentos. Conservar 43 copropiedades, 32 reuniones y 42 fotos sin duplicarlas. Ensayar la restauración antes del corte.
5. En Google Workspace, el administrador corporativo controla la aplicación OAuth, el calendario, el consentimiento y la rotación. Certificar freeBusy con la cuenta corporativa y sin crear eventos.
6. Aprobar el corte por separado. Registrar SHA, despliegues, respaldos, conteos, DNS anterior y responsables. Verificar en QA los flujos autenticados, AAL1/AAL2, acceso ajeno, caché y recarga. Transferir propiedad operativa y revocar accesos personales solo tras comprobar la recuperación corporativa.

## Costos y reversión

Cotizar Pages/Workers, Access, Supabase, dominio y Workspace con los volúmenes medidos. Registrar plan, límites y alertas antes de habilitar consumo. No hay presupuesto nuevo aprobado en esta fase. Para revertir, restaurar DNS y configuración al destino anterior, restaurar el artefacto previo y reconciliar escrituras posteriores antes de restaurar una base. Mantener origen, respaldos y acceso de emergencia durante la ventana acordada.
