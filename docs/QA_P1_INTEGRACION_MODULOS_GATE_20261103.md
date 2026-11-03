# ADPHOR P1 — contrato de integración sin sustitución (2026-11-03)

**Estado: INICIADO / BLOQUEADO PARA PUBLICACIÓN.** Documento de implementación QA; no prueba de despliegue, no certificado de integración, no autorización de migración.

## Evidencia verificada en la rama base
- Base: `qa/cliente-preview-real-readonly-20261103`. Está 224 commits por delante de `main`; difiere en un documento de `qa/cliente-integracion-verificada-20261102`.
- `src/js/services/supabase.js`: acceso real a projects, memberships, tickets, `monthly_report`, agent APIs, revisión humana y Storage `evidence`.
- `src/js/services/porto.js`: servicio PQRS piloto activado **solo** cuando `VITE_PORTO_QA_ENABLED=true` y el ref es staging **distinto** de `oqizvirqjwbbhyyjpthq`; no conectar al proyecto productivo ignorando el gate.
- `qa/datos-reales.html`: consulta histórica agregada mediante Edge Function protegida y Auth; no guarda reuniones ni PQRS.
- `qa/simulacion-operativa.html`: carrusel y escenarios ficticios, no escritura.
- El esquema público hospedado contiene 8 tablas con RLS y 9 políticas; `public` carece de tablas operativas de reuniones, visitas y PQRS. Hay fuentes históricas en esquemas privados, **no** deben interpretarse como agendas activas.
- Inspección externa: `https://adphor-platform.pages.dev/qa/datos-reales.html` entregó el contenido de inicio de la aplicación de mantenimiento; `https://75562929.adphor-platform.pages.dev/qa/simulacion-operativa.html` devolvió 404 al inspeccionarse. No son pruebas de publicación de esta rama.

## Regla de compatibilidad por módulo

| Módulo | Mantener | Integrar cuando | Bloqueador actual |
|---|---|---|---|
| Identidad/MFA | Supabase Auth + MFA existente; visual de José | Revisión de login, AAL2 y rol con JWT hospedado | AAL2 no certificado |
| Copropiedades | `projects` + `memberships` operativos | Mapeo autorizado de 44 filas históricas a IDs de proyectos, sin sobreescrituras | Mapeo incompleto |
| Reuniones | Reglas, formularios, carrusel y fuentes Apps Script originales | API transaccional staging, disponibilidad, anticolisión, persistencia, RLS | No existe circuito real certificado |
| Calendario / agenda | Flujo original y permisos por actor | Solo reservas verificadas; distinguir eventos históricos y citas futuras | Histórico ≠ agenda activa |
| Visitas | Formularios y recorridos originales de José | API y tablas QA con aislamiento por copropiedad y escritura auditada | Sin persistencia hospedada certificada |
| PQRS | Original José + servicio `porto` en QA | Staging con lifecycle, adjuntos privados, idempotencia y pruebas JWT | Gate intencionado impide usar Supabase producción |
| Archivos | `evidence` actual de mantenimiento | Storage privado por módulo, políticas por tenant, hash y trazabilidad | ZIP y fotos originales no incorporados |
| Informes | `monthly_report` existente | Métricas de origen identificable, aprobación gerencial, historial | Fuentes de reuniones/PQRS sin conciliar |
| Agentes ML/DL/PLN | `agent_runs`, `agent_reviews` y revisión humana | Filtrar por actor/proyecto; nunca notificar/cerrar sin decisión humana | E2E hosted pendiente |

## Orden de implementación P1
1. **Contract tests:** reunir módulos heredados y QA en un único mapa de rutas y roles; no recrear el login ni sustituir las pantallas originales. Mantener adaptadores de compatibilidad para `?page=form`, `?page=gestion-correos`, `?page=status`.
2. **Staging privado:** preparar migraciones versionadas de `meetings`, `meeting_attendees`, `visits`, `pilot_pqrs`, `audit_events` y `media_objects`, sin ejecutarlas en producción. Cada tabla con políticas que validen JWT y pertenencia a copropiedad.
3. **ETL reversible:** validar 44 copropiedades / 684 registros / 29 PQRS / 55 delegados del maestro del 3 de noviembre; distinguir copia histórica 682 + 2 candidatos en staging. Mapear claves, deduplicar, hashes, rechazos y decisiones humanas.
4. **API y repositorios:** conectar UI a contratos tipados y transacciones seguras; habilitar lectura real primero, escrituras únicamente en staging QA y con rol probado. No exponer `service_role` al frontend.
5. **Multimedia:** almacenamiento privado y URLs firmadas; no publicar fotos personales ni hojas PIN; asociar a recurso y copropiedad.
6. **Pruebas E2E:** dos usuarios de distintas propiedades, MFA, calendario sin colisiones, PQRS, visitas, carrusel autorizado, reportes y agentes en espera de revisión. Capturas y logs.
7. **Entrega protegida:** validar configuración Cloudflare Access y denegación anónima *antes* de activar el portal con datos reales; build ligado al commit y ruta de rollback.

## No despliegue de este corte
Este commit **no** cambia el esquema, no hace importación, no crea usuario, no altera `main` y no habilita exposición pública. El trabajo de implementación debe continuar en esta rama o una rama derivada y producir pruebas E2E y URL privada verificable antes de anunciar 'terminado'.

## Criterio de salida
No existe certificación P1 mientras reuniones, visitas, PQRS, agenda y archivos no funcionen con persistencia QA autorizada, ni si faltan MFA, aislamiento multitenant, Cloudflare Access, conciliación y evidencia de despliegue.
