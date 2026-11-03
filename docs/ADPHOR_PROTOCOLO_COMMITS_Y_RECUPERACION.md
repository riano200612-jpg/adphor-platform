# ADPHOR — Protocolo obligatorio de commits y recuperación

Fecha inicial: 2026-11-03. Se aplica a trabajos futuros realizados sobre este repositorio.

## Regla de ejecución

1. **Antes de modificar**: identificar rama y commit HEAD, crear rama QA/feature desde una base conocida y un respaldo antes de cualquier promoción.
2. **Un cambio lógico = un commit**: usar `feat(área):`, `fix(área):`, `test(área):`, `docs(área):` o `chore(área):`. No agrupar restauración de datos con cambios de interfaz ni con ajustes de seguridad. No subir tokens, PIN, credenciales o ZIP con datos reales.
3. **Después de cada cambio**: conservar SHA, archivos y pruebas en el PR. Si el cambio afecta funcionalidad del cliente, añadir prueba de regresión que falle si vuelve a desaparecer.
4. **Antes de promocionar a Cloudflare**: ejecutar `npm test`, `npm run build`, `npm run test:e2e`, Python unit tests, Gauntlet QA y contrato PostgreSQL QA; todas las suites requeridas deben estar en verde. Validar permisos, RLS y acceso si se tocaron datos/servicios.
5. **Promover solo desde rama QA certificada**: crear antes una rama `backup/prod-before-<alcance>-<fecha>`. Ejecutar actualización fast-forward con comprobación del SHA esperado; jamás forzar si no es indispensable.
6. **Verificación independiente de Cloudflare**: inspeccionar Deployment ID, commit origen, estado Success y abrir UI con autenticación; confirmar los módulos relevantes por navegador. La CI verde **no** demuestra que el último commit esté desplegado.
7. **Prueba funcional real**: para PQRS, enviar un radicado de prueba autorizado, adjuntar evidencia al sistema original o al backend QA, recargar y recuperar caso y adjunto. Para Reuniones, confirmar evento con calendario autorizado. Para fotos, validar consentimiento y almacenamiento privado. Sin estas comprobaciones, estado `PENDIENTE`.
8. **Reversión**: conservar ramas backup; documentar commit previo, razón y procedimiento. No borrar backups hasta certificado de entrega y autorización del propietario.

## Línea base de recuperación (03/11/2026)

- Punto anterior validado `aa50dbada8b8cd73bc903d5fe6c4195b4172124e`: QA/prod con CI 3/3 PASS.
- Cambios recientes: acceso al carrusel real para administrador desde Centro integrado, recuperación de PQRS propietario/empleados, vista histórica separada y fotos desde ZIP privado local.
- Auditoría `docs/ADPHOR_AUDITORIA_RECUPERACION_SABADO_20261031.md`; informe `docs/ADPHOR_VALIDACION_PQRS_FOTOS_SABADO_20261103.md`.
- Test permanente `tests/recovery-no-regression-20261103.test.js` asegura que futuros commits no sustituyan estas funciones por un contador histórico deshabilitado.

## Pendientes que no pueden darse por terminados

- Variable `VITE_ADPHOR_PORTAL_EXEC_URL` con la URL `/exec` real verificada del cliente y comprobación de recepción/radicado. El texto de un botón o iframe no equivale a envío.
- Datos reales de 44 copropiedades y directorio de personal homologados a roles y membresías de un entorno QA con RLS. No usar la fila `demo-01` como dato real.
- Storage privado para evidencias/fotografías, consentimiento y direcciones firmadas. No subir imágenes ni expedientes personales a GitHub.
- Cloudflare: versión servida, despliegue y fecha deben verificarse en el panel. Prohibido afirmar publicación por el simple hecho de promover un commit.

## Responsabilidad del equipo

No declarar "listo para cliente" sin enlazar: commit, CI, Deployment ID y prueba E2E autenticada. Ante un fallo, reportar causa concreta y el último punto estable. Esta es una regla del flujo de trabajo, no una protección de rama instalada automáticamente en GitHub.
