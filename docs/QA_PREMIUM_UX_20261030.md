# ADPHOR — candidato UX/UI para auditoría independiente

Fecha: 30 de octubre de 2026 (Colombia). Rama: `qa/premium-ux-20261030`.
Base recuperada: `16864f58c37ce8cb1928e8b9f5c2263711b5a4f0`, rama de integración del PR #14.

**Estado: PARCIAL — rediseño local probado, pendiente de auditoría y de integración hospedada.**
No es una autorización para presentar datos reales al cliente ni para pasar a producción.

## Trabajo realizado

Se conservó la arquitectura JavaScript/Vite, los servicios existentes y los controles de autenticación. Se creó un worktree independiente; el trabajo previo y los originales no se sobrescribieron.

- Sistema visual centralizado `src/css/premium.css`: azul #264B6B, dorado #B59C21, perla, sombras suaves, vidrio moderado, botones de 44px, foco visible y movimiento reducido. Los textos dorados usan una variante oscura para contraste; el dorado corporativo queda en acentos.
- Acceso y MFA: composición nueva y estados de espera más claros. Sin cambios en Supabase Auth, la verificación MFA ni cuentas. El navegador comprobó el acceso demostrativo, **no una sesión real MFA**.
- Dashboard: accesos por módulo, catálogo autorizado, métricas de bitácora y gráfico interactivo por estado. Se consultan PQRS con indicador de error; en demo las reuniones próximas son locales. No se inventan tendencias, cumplimiento ni cifras del enjambre. La consulta PQRS conserva el límite existente de 200 y lo advierte cuando corresponde.
- Copropiedades: catálogo con búsqueda sin acentos/mayúsculas, ficha operativa, métricas visibles y selector persistente. Se reutilizan exclusivamente las propiedades suministradas por el repositorio autorizado. Fotografías, unidades y ubicación no registradas no se inventan. Iconos ilustrativos no representan fotografías de los inmuebles.
- Reuniones: calendario mensual y semanal; botón + Agendar reunión; cinco pasos con validación, revisión y confirmación. Se conserva el motor local de conflictos, reprogramación, cancelación e historial. La cancelación exige confirmación. Se preservan delegado y asistentes como metadatos locales, sin enviar invitaciones. Se corrigió la interpretación de horarios a America/Bogota, independiente de la zona del navegador.
- La agenda **sigue siendo demostrativa local**. En modo conectado solo se solicita evaluación; no se afirma reserva SQL, envío ni sincronización Google. El enlace manual a Google Calendar sigue siendo una propuesta, no una integración confirmada. Las decisiones gerenciales demo solo se muestran para un perfil administrador/gerencial; no certifican autorización SQL.
- PQRS: formulario organizado junto al seguimiento, + Nueva PQRS y Enviar solicitud PQRS visibles; radicado devuelto por el servicio; estados en español; respuestas y seguimiento desplegables. El borrador se conserva si falla el almacenamiento. En cloud, torre/unidad/solicitante están deshabilitados con explicación porque el adaptador actual no los persiste; se evita recogerlos y descartarlos silenciosamente. Adjuntos siguen bloqueados hasta validar Storage privado.
- Inteligencia: recorrido Operaciones/Análisis/Informes con capacidades y limitaciones explícitas. Estados visuales de pendiente, aprobado, rechazado y error. No se habilitaron modelos ni decisiones automáticas.
- Informes: se conserva la lógica de cálculo, exportación y cierre; tablas desplazables accesibles mediante teclado.

## Pruebas reproducibles y evidencia

| Comprobación | Resultado | Alcance |
|---|---|---|
| npm ci | Ejecutado | Instalación inicial; axe-core añadido después y lock actualizado |
| npm test | 77 PASS | Incluye dos pruebas nuevas de fecha/hora Bogotá |
| Python unittest | 110 PASS | Servicios con fixtures, no llamadas reales a Supabase |
| PGlite SQL | 30 PASS | 40 propiedades/400 PQRS sintéticas; no JWT hospedados |
| Build | PASS | Bundle Vite local |
| Aislamiento build | 3 PASS | Default, opt-in QA y eliminación de salida obsoleta |
| Bloqueo Cloudflare | PASS | CF_PAGES=1 rechaza el build con QA_DEPLOY_BLOCKED |
| Playwright | 9 PASS | Chromium real 153 local, escritorio 1440px/móvil 390px |
| axe-core | 15 estados evaluados, sin violaciones automáticas | WCAG 2 A/AA, 2.1 AA y 2.2 AA aplicables; no certificación completa |
| Supabase hospedado/JWT/MFA real | NOT RUN | Sin entorno QA autorizado verificado en esta iteración |
| Google Calendar/Meet | NOT RUN | Ningún envío ni operación externa |
| IA-01–IA-20 integrales | NOT RUN | No inferencia real ni pipeline documental habilitado |

Comandos:

```bash
npm ci
npm test
npm run build
node qa/porto/test-persistence.mjs
node qa/checks/build-isolation.mjs
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
npx playwright install --with-deps chromium
npm run test:e2e
```

La descarga estándar de Chromium volvió a fallar en este entorno. Para ejecutar realmente el navegador se utilizó Chromium 153 de `@sparticuz/chromium` extraído en `/tmp`, con `CHROMIUM_PATH=/tmp/adphor-chromium`; no se añadió este binario al proyecto ni se alteró el runner estándar de CI. CI conserva su instalación Playwright normal. Los tests nuevos generan capturas y resultados axe; el workflow conserva los artefactos también en ejecuciones exitosas.

Las 8 pruebas Python inicialmente fallidas dependían del orden de importación: otro test cargaba `backend.local_api` antes de configurar el entorno. Se corrigió **la fixture de test**, asignando configuración sintética por caso y restaurándola al terminar. No se relajó ninguna validación del backend.

Los logs están en `qa/visual-premium/logs/`. Los JSON axe incluyen comprobaciones incompletas que requieren revisión humana. Los resultados automatizados no prueban todas las combinaciones de lectores de pantalla, zoom ni dispositivos.

## Evidencia visual

Capturas anteriores tomadas sobre la base 16864f5 antes de editar. Todas usan información demostrativa. Después se inspeccionaron visualmente acceso, dashboard, revisión de reunión, PQRS y calendario móvil; Playwright captura además catálogo, informes, agentes y estados de error/guardado.

| Pantalla | Antes | Después |
|---|---|---|
| Acceso | [Antes](../qa/visual-premium/before-login.png) | [Después](../qa/visual-premium/after-login.png) |
| Dashboard | [Antes](../qa/visual-premium/before-dashboard.png) | [Después](../qa/visual-premium/after-dashboard.png) |
| Reuniones | [Antes](../qa/visual-premium/before-meetings.png) | [Después](../qa/visual-premium/after-meetings.png) |
| PQRS | [Antes](../qa/visual-premium/before-pqrs.png) | [Después](../qa/visual-premium/after-pqrs.png) |

[Móvil calendario](../qa/visual-premium/after-mobile-meetings.png) · [Revisión de reunión](../qa/visual-premium/after-meeting-review.png) · [Error de PQRS](../qa/visual-premium/after-pqrs-error.png).

## Matriz de trazabilidad y límites

| Requisito | Implementación / evidencia | Estado |
|---|---|---|
| Identidad y componentes reutilizables | premium.css; capturas acceso/dashboard | Implementado y probado localmente |
| Acceso real sin debilitar MFA | Servicios Auth/MFA intactos; tests unitarios existentes | Parcial: proveedor real NOT RUN |
| Dashboard de datos autorizados | app.js; gráfico de estados; lecturas y errores PQRS | Parcial: sin métricas históricas integradas |
| Calendario y agendamiento en pasos | ui-meeting-experience.js; E2E reserva/reprogramación/cancelación local | Parcial: persistencia hospedada pendiente |
| PQRS, radicado y seguimiento | ui-pqrs.js; E2E recarga, respuesta y error | Parcial: demo probada, PostgreSQL hospedado NOT RUN |
| Archivos privados | Controles no habilitados; aviso explícito | Bloqueado por Storage QA pendiente |
| Catálogo sin fuga de propiedades | ui-premium.js; fixture de 40 propiedades y usuario restringido | Probado localmente; RLS/JWT hospedados pendientes |
| Enjambre y decisiones | Presentación de estados, reglas existentes conservadas | Parcial: ML/DL/PLN reales no integrados por este cambio |
| Responsive y teclado | Playwright móvil; tablas enfocables; pasos y validación | Probado en el alcance descrito |
| WCAG AA | axe-core sin violaciones detectadas; contraste corregido | Parcial: auditoría manual integral pendiente |
| Producción/originales protegidos | Rama/worktree separados; guard de despliegue intacto | Sin cambios de producción realizados |
| Staging privado para el cliente | Sin URL nueva ni despliegue | Pendiente de autorización/verificación de Access y QA |

## Riesgos y seguridad

- `npm audit` detectó 3 vulnerabilidades de dependencias de desarrollo: Vite alta, esbuild moderada y postcss-selector-parser moderada. El reporte completo se conserva en `qa/visual-premium/npm-audit.json`. No se realizó una actualización mayor automática de Vite durante el rediseño. Requiere una actualización dedicada y pruebas antes de exponer un servidor de desarrollo. Se limitó dev/preview a 127.0.0.1 por defecto.
- Escaneo detect-secrets: 21 hallazgos nuevos, todos hashes SHA-256 de capturas recalculados y verificados; sin credenciales identificadas en archivos modificados. Evidencia en `secret-scan-review.json`.
- No se modificaron políticas RLS, cuentas, datos reales, secretos, calendarios externos ni proyectos originales. No se realizaron llamadas a Supabase del cliente durante estas pruebas.
- Los controles demo no son autorización real. La base real continúa fuera del alcance del enjambre.
- Build bloqueado en Cloudflare no demuestra protección Access de previews históricos. No se afirma que esos previews se hayan protegido.
- Documentos históricos, aprobación de correspondencias, 32 originales y migraciones previas no se consideran completamente integrados por este rediseño. Se conserva su trabajo y sus bloqueos anteriores.

## Entrega, actualización VS Code y reversión

Publicar en Draft dirigido a la rama QA de integración, no main. El SHA remoto y el enlace del PR se entregan al verificar la publicación; no confundir con el SHA local si el conector crea un commit equivalente.

Para recuperar esta rama sin sobrescribir tu trabajo actual:

```bash
git -C ~/adphor-integrado-vscode status --short
git -C ~/adphor-integrado-vscode fetch origin
git -C ~/adphor-integrado-vscode worktree add -b qa/premium-vscode ../adphor-premium-vscode origin/qa/premium-ux-20261030
code ~/adphor-premium-vscode
```

Si esa carpeta o rama ya existen, detenerse y revisar su estado; no borrarlas. Desde la carpeta nueva: `npm ci`, `npm test`, `npm run dev`. No copiar credenciales productivas para probar.

Reversión: cerrar el PR sin fusionar; volver a la copia QA anterior. Si se integra posteriormente con autorización, revertir el commit mediante otro PR QA. No requiere migración inversa porque no se cambió SQL. Las fuentes originales y main permanecen fuera del cambio.

Siguiente orden propuesto: auditoría visual/manual → actualización de dependencias → QA hospedado independiente con JWT/MFA/RLS/Storage → reuniones/PQRS transaccionales y notificaciones autorizadas → validación de modelos → staging privado → dictamen independiente antes de presentar al cliente.
