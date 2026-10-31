# Validación de prioridades del cliente — audio 2026-10-31

Fuente: nota de voz compartida en conversación. Se sintetizan requisitos operativos, sin datos personales ni información médica.

## Petición expresa (orden indicado por el cliente)
1. Mantener la **parte gráfica original** y seguir migrando de forma incremental; tecnologías a criterio del equipo.
2. **Calendario**: que muestre correctamente los eventos y reuniones ya registrados, con la presentación esperada.
3. **Usuarios/delegados**: autenticarse y visualizar **únicamente las copropiedades asignadas**; comprobar con cuentas de distintos delegados.
4. **Segundo factor (MFA)**: durante el ingreso, verificar un código enviado por correo o método equivalente aprobado; comprobar que llega y que el flujo completo funciona.
5. Preparar un **flujo de pruebas integral** para la revisión del cliente a su regreso. El cliente indicó que enviará un plan detallado y que después ejecutará el test completo.
6. Se puede continuar trasladando funcionalidad y datos autorizados antes de esa revisión.

## Contraste con rama qa/premium-ux-20261030 (estado del código, no prueba de producción)
| Requisito | Hallazgo verificable | Brecha |
| --- | --- | --- |
| Login | `src/js/services/supabase.js` autentica en Supabase | No validado con las cuentas reales del cliente en staging |
| MFA | `managed-mfa.js` admite TOTP verificado de **6 dígitos** y `aal2` cuando el usuario ya tiene un factor; `begin()` devuelve false si no existe factor | **NO hay flujo de OTP por correo del cliente**, no se obliga segundo factor para todas las cuentas, sin prueba de entrega al correo |
| Copropiedades | `ui-project-selector.js` busca y muestra `projects` recibidos de `load()` | El frontend obtiene proyectos por consulta general; la separación depende de RLS en backend. Falta prueba con dos delegados, asignaciones reales y verificación cruzada |
| Agenda | `ui-meeting-assessment.js` usa `demo-calendar` en demo y evaluación no persistente en cloud | **NO sincroniza eventos reales de Google Calendar ni implementa vista real multiusuario** |
| Imagen y UX | Premium publicado, navegación con secciones originales parcial | Comparación visual exhaustiva de pantallas internas pendiente |
| QA despliegue | GitHub Actions #101 completado correctamente; staging Cloudflare protegida mediante Access para administración | Acceso del cliente no habilitado; no es certificación de funcionamiento del flujo real |

## Criterios de aceptación, antes de hacer el test con el cliente
- Dos cuentas delegadas distintas, sesión independiente: la cuenta A no puede enumerar, abrir o escribir datos de las propiedades de B; validación por servidor y pruebas RLS.
- MFA obligatorio para perfiles definidos. Si se elige OTP por correo, debe implementarse por proveedor gestionado con expiración, límite de intentos, bloqueo y trazabilidad, nunca simulación en producción. Probar entrega **solo a buzones de QA expresamente autorizados**; ninguna notificación a propietarios o invitados sin aprobación.
- Agenda presenta datos reales permitidos a cada delegado en America/Bogota. Vista lista/semana/mes, tipos, estados, colores, prevención de choques, manejo de invitaciones bajo consentimiento.
- Primer módulo integrado visible tras autenticación: selector de copropiedad y calendario correcto.
- Registrar evidencia de ejecución de cada prueba, fallos, responsables y criterios de cierre; verificar también mantenimiento, recorridos, PQRS y enjambre posteriormente.
- Mantener `main`, Apps Script original y datos productivos intactos hasta auditoría y autorización.

## Prioridad técnica
**P0**: MFA real y obligatorio + acceso del delegado a su copropiedad + calendario auténtico de reuniones.
**P1**: paridad visual e integración de módulos existentes.
**P2**: recorridos multimedia, carrusel de empleados, informes IA completos y ampliación a más propiedades.

Este documento registra la petición oral y la brecha comprobada de código; no reemplaza el plan detallado que el cliente aún debe entregar.
