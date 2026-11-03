# ADPHOR — unificación de primera fase y Portal José (QA, 2026-10-31)

## Verificación de código
- Primera fase **Mantenimientos**: el mismo `src/js/app.js` incluye registro de novedades, asignación, prioridad, ubicación, historial, evidencias fotográficas, estados y cierre supervisado; su repositorio Supabase conecta casos cuando se configura sesión válida. No es una app separada.
- **Enjambre IA**: `src/js/ui-agent-history.js` expone historial, borradores y decisiones de revisión humana; la presencia del módulo **no prueba que los modelos estén procesando datos del cliente en vivo**.
- El módulo **Recorridos** ya muestra responsables vinculados al proyecto y lista los tickets de la copropiedad actual. Se añadió navegación directa a Mantenimientos, Mis tareas, Historial del enjambre e Informes.
- Las pantallas y funciones del Portal original siguen siendo la especificación de producto; las capturas del video de 31-oct muestran Calendarios, Mis Copropiedades, Reuniones, Visitas, PQRS, Mantenimientos, Recorridos y Proveedores. **Visitas y Proveedores** aún no tienen equivalentes certificados.

## Acciones todavía necesarias para un solo producto real
1. Consolidar pantallas originales, avatar y fotografías autorizadas (no mover fotos de personas a carpetas públicas).
2. Comparar contratos de datos de Sheets y Google Drive con `public.projects`, membresías y `tickets`; importación validada a PostgreSQL QA separado, no SQL productivo.
3. Conectar Recorridos a creación de tickets con adjuntos seguros de audio, video, imágenes; seguimiento y contacto del responsable mediante cola **sin envío de pruebas hasta aprobación**.
4. Vincular agentes a novedades autorizadas por copropiedad: clasificar, detectar alertas, preparar borradores; administrador aprueba y verifica cierre.
5. Garantizar roles, autenticación, trazabilidad, RLS, restricciones multiempresa y Storage privado desde navegador externo.
6. Terminar deploy de Cloudflare QA; confirmación HTTPS y Access de usuarios externos autorizados. La existencia de una URL de GitHub no significa aplicación desplegada.

## Protección
No modificar Apps Script de José, base productiva o `main`; no subir datos personales o secretos a GitHub; no enviar correos reales; no declarar una funcionalidad persistente si funciona únicamente con almacenamiento local.

## Criterio de entrega al cliente
Un usuario externo autorizado inicia sesión, selecciona su copropiedad, crea novedad con evidencia privada, la asigna a un responsable, consulta su seguimiento, permite informe IA con aprobación, y verifica cierre en una segunda sesión. Misma identidad ADPHOR del cliente, sin duplicidad de apps.

**Estado:** navegación y código unificados parcialmente en rama QA; importación real, multimedia y presentación hospedada aún no certificadas.
