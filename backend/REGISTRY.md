# Registro de revisiones del enjambre

Migración aplicada en ADPHOR: `agent_review_registry` (21 octubre 2026).
Fuente: `supabase/migrations/20261021180130_agent_review_registry.sql`.

## Contrato de persistencia

- `agent_runs`: snapshot inalterable de una ejecución COMPLETA, entrada, hallazgos,
  tres etapas, borrador y SHA-256 del Resultado Python. Distingue `rules` y `models`.
- `agent_reviews`: una decisión humana por ejecución; FK vincula propiedad, ejecución
  y hash exactos. Administrador y fecha se asignan en el servidor. Un rechazo también
  es definitivo para esa versión.
- `agent_run_status`: vista security-invoker con estado pendiente, aprobado o rechazado.
- Admin y coordinator pueden leer dentro de su propiedad. Solo admin puede insertar
  una decisión. Usuarios anónimos, otras propiedades y agentes no pueden aprobar.
- UPDATE y DELETE no están concedidos. Una edición exige una NUEVA ejecución/id con
  nueva huella; la aprobación antigua no se hereda. No ejecutar el UPDATE que podría
  sugerir una implementación convencional del servicio de edición Python.

La tabla no valida el contenido semántico ni ejecuta los modelos. El futuro backend
debe validar Resultado, propiedad de cada caso, secuencia exitosa, huella y fecha de
lectura antes de insertar. Los fallos de etapa no se insertan como borradores completos.
La aprobación se refiere a la instantánea fechada, no certifica que los casos sigan
iguales después. La UI debe mostrar fecha de lectura y pedir una nueva ejecución si
se requiere analizar datos actuales.

## Integración pendiente

El Worker actual sigue siendo de conexión/diagnóstico: no escribe en estas tablas.
La interfaz todavía no consulta este registro. Los modelos ML/DL/PLN no están activos.

La escritura de resultados está reservada a un backend confiable; no se ha instalado
ninguna clave privada. `service_role` tiene INSERT limitado sobre agent_runs, pero
no INSERT sobre agent_reviews. Una futura credencial con service_role tiene permisos
amplios en otras tablas: debe aislarse en un escritor sin acceso desde los modelos.
No compartir credenciales con agentes. Preferir un rol dedicado de privilegio mínimo
antes de activar ejecución real. Para aprobar, usar la sesión verificada del humano
y su JWT, nunca una clave de servicio ni un rol enviado por el navegador.

No hay disparadores de envío, cierre de casos ni trabajos automáticos en esta migración.
Las funciones existentes de informes mensuales y tickets permanecen independientes.

## Verificación

`supabase/tests/agent_review_registry.sql` ejecutado contra la base conectada:
aislamiento entre propiedades, permisos, pendiente inicial, rechazo de hash incorrecto,
atribución del administrador y rechazo de segunda decisión. Transacción revertida;
agent_runs y agent_reviews quedaron vacías. No se aprobó un informe real.

Asesor de seguridad: sin avisos sobre los objetos nuevos. Avisos previos del proyecto:
funciones SECURITY DEFINER existentes (incluida rls_auto_enable), y protección contra
contraseñas filtradas desactivada. Requieren revisión separada; no cambiar a invoker
las funciones de tickets/informes sin verificar sus permisos y política de escritura.

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
