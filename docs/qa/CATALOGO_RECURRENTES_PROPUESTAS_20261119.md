# ADPHOR QA Integral — Catálogo de propuestas recurrentes (19-Nov-2026)

Requisitos R11–R13 de la reunión 18-Nov: primero se recopilan propuestas de actividades administrativas por copropiedad y periodicidad. **Ninguna propuesta crea una tarea operativa, programador, correo, evento Google Calendar ni obligación legal.**

- Solo perfiles `admin` y `coordinator` con membresía y sesión válida MFA AAL2 (comprobada en servidor) pueden listar y presentar propuestas.
- Una persona **distinta del autor** debe revisarlas, con justificación registrada; `reviewed_for_design` significa *revisada para el diseño*, no aprobada para ejecución.
- La base QA usa RLS de tenant, solo `SELECT` para cliente, comando de escritura controlado y bitácora append-only; el catálogo parte vacío y no importa datos originales.
- La migración falla cuando faltan marcadores de identidad/infraestructura QA. No se aplica a producción. No modifica originales de José ni calendarios.
- Navegación integrada en la plataforma única QA, con interfaz descriptiva que reconoce los errores de fuente y no interpreta una consulta fallida como lista vacía.

**Pendiente antes de permitir recurrencia real:** José debe validar actividad por actividad, unidad responsable, matriz de roles, copropiedades, periodicidad exacta, cierres, evidencias y autorización del envío. El servicio de generación y asignación de tareas recurrentes permanece deliberadamente inexistente.

Las pruebas Chromium son con repositorio sintético; la certificación de operaciones reales de dos usuarios con MFA AAL2 y su pertenencia a la misma copropiedad requiere ensayo separado. El SQL se verifica con PostgreSQL aislado y tras migración se deben consultar RLS, roles y asesores de Supabase QA. No se utilizan credenciales de cuentas originales.
