# ADPHOR — auditoría del propietario antes del cliente

Estado de entrega: **NO APROBADO POR EL PROPIETARIO**.

## Fase 1: revisión interna

Sólo el propietario técnico tiene autorización de acceso a QA. El padrón privado
mantiene la identidad del cliente con active=false, preservando su rol para una
futura fase. No enviar invitaciones, códigos ni notificaciones al cliente.
La política de recuperación administrativa del propietario debe conservarse.

No cambiar producción, RLS, MFA ni Access para facilitar la revisión. Una
compilación exitosa, pruebas automáticas o una inspección del asistente no
constituyen aprobación del propietario.

La URL vigente de comprobación es:
https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev/

Actualmente contiene una página mínima. No presentarla como plataforma completa.
El acceso Supabase Auth sigue pendiente de alta y registro personal de MFA.

## Registro de evaluación del propietario

No se han recibido calificaciones ni observaciones de la versión funcional.
Cada hallazgo debe asociarse al SHA realmente revisado, su módulo, evidencia,
criticidad y resultado de la corrección. No completar puntuaciones por inferencia.

| Módulo | Calificación del propietario | Observaciones | Estado |
| --- | --- | --- | --- |
| Acceso, MFA y recuperación | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| Miss ADPHOR y navegación | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| Copropiedades y carrusel | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| Colaboradores y roles | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| PQRS y evidencias | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| Reuniones | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| Google Calendar | Pendiente | Integración real no certificada | Pendiente |
| Visitas y agenda | Pendiente | Sin auditoría funcional del propietario | Pendiente |
| Informes y agentes | Pendiente | Ejecución hospedada no certificada | Pendiente |
| Persistencia y experiencia móvil | Pendiente | Sin auditoría funcional del propietario | Pendiente |

## Fase 2: cliente

El cliente tendrá el rol funcional/auditor preparado, sin permisos de
infraestructura ni credenciales privilegiadas. Activar sólo después de:

1. Revisar los resultados y corregir los hallazgos de la fase interna.
2. Recibir autorización expresa del propietario para el SHA evaluado.
3. Reactivar conscientemente la identidad del cliente y su política QA.
4. Completar su alta segura, MFA y prueba de acceso personal.

No adelantar el envío del enlace, invitaciones o notificaciones al cliente.
No registrar aprobación hasta que el propietario la otorgue explícitamente.
