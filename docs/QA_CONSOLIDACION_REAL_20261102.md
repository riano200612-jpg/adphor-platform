# ADPHOR — consolidación QA tras el Gauntlet (2026-11-02)

## Hechos verificados
- Rama de trabajo: `qa/cliente-integracion-verificada-20261102`, sobre `qa/premium-ux-20261030`; PR #17.
- Commit `f2aba45068fb7288e04c6f7308ceac284cb8a55c`: GitHub Actions **ADPHOR Gauntlet QA** y **Validate ADPHOR** finalizaron con éxito. Son pruebas de compilación y contratos sintéticos, **no** validación hospedada.
- `qa/simulacion-operativa.html` se incluye ahora como entrada opcional de Vite si `ADPHOR_BUILD_QA_DEMOS=true`; sin esta variable no se incluye. Se conserva `QA_DEPLOY_BLOCKED`.
- Comparación remota de PR #16 contra la rama premium muestra la corrección de `src/js/services/staff-directory-contract.js` y sus regresiones. El contenido remoto de esos dos archivos **ya coincide exactamente** con el de `qa/cliente-integracion-verificada-20261102`. No es necesario hacer cherry-pick ni merge de PR #16 por segunda vez.
- Los originales de José permanecen en el repositorio privado y no están copiados a este repositorio público.

## Integración por módulos

| Módulo | Código o simulación | Integración real comprobada |
|---|---|---|
| Identidad/Portal de José | Original recuperado; demo QA separada | No, pendiente comparación visual íntegra |
| Login y MFA | Componentes existentes | MFA hospedado no certificado |
| Inicio/calendario | QA premium y simulación | Disponibilidad Google Calendar no certificada |
| Agendamiento + acompañantes | Contrato de delegados y regresiones presentes | RLS/backend de asignación no probado con JWT real |
| Visitas | Fuente original privada y simulación | SQL hospedado no certificado |
| PQRS | Fuentes originales, módulos QA y simulación | Persistencia y aislamiento reales pendientes |
| Agentes ML → DL → PLN | Contratos QA y modelo de aprobaciones | Ejecución hospedada real no certificada |
| Informes | Módulos y borradores | Informe real no certificado |
| Cloudflare Pages privado | URL pública histórica existente | Access, rama QA y despliegue privado no certificados |

## Qué significa 'listo para cliente'
No compartir URL pública con una simulación no autenticada ni datos reales. Es imprescindible verificar Cloudflare Access, un dominio QA separado, MFA cuando corresponda, navegación, compilación, pruebas RLS y una denegación efectiva a usuarios sin acceso.

## Seguridad y reversión
- `main` no se modifica.
- No se desactivan políticas RLS ni se alteran registros productivos.
- No se fusionan otros PR sin revisión de sus diferencias y evidencias.
- Para revertir este ciclo: revertir commits individuales del PR #17 antes del merge; se conserva la rama anterior.

## Siguiente trabajo técnico
1. Autenticación al dashboard de Cloudflare con sesión del propietario (sin compartir contraseñas).
2. Habilitar un proyecto QA **privado y separado**, sin eludir el bloqueo de builds.
3. Revisar comparación de capturas entre código original de José y UI QA, corregir divergencias.
4. Ensayar integración de reuniones, visitas y PQRS con PostgreSQL aislado y actores de prueba, luego con acceso limitado a datos autorizados.
