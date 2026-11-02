# Migración privada ADPHOR — fuente real revisada (2026-10-31)

## Fuentes revisadas
Drive privado: `master_portalADPHOR_demo_murano` contiene hojas `Copropiedades`, `Delegados` y `Reuniones`. La hoja de copropiedades incluye nombre, sector, delegado, coordinador, foto y metadatos de edificios. La de delegados incluye rol, identificador, estado, **PIN** y correo. La de reuniones incluye fechas, horarios, estado, datos del delegado y referencias de Calendar/Meet. Se inspeccionaron encabezados y filas de muestra, **no hay conciliación integral de todos los registros**.

También existe `Fotos Delegados`, con imágenes de empleados y el recurso `Miss ADPHOR` encontrados previamente. Mantenerlas en la fuente privada hasta revisar derechos de uso y relación con el personal activo.

## Implementado en esta rama
- `legacy-project-catalog.js`: prepara nombres y sectores **solo con mapeo de IDs aprobado**; omite delegado, email y fotografías. Rechaza filas sin correspondencia.
- `legacy-delegate-adapter.js`: prepara asignaciones de delegados sin PIN ni correo.
- `legacy-meeting-adapter.js` y `legacy-meeting-calendar.js`: normalizan/proyectan reuniones en lectura sin calendarios externos.
- `staff-directory-contract.js`: validación básica de rol/área, foto aprobada y pertenencia.
- Interfaz principal: ingreso Portal Team, Bitácora guiada, Recorridos, PQRS, mantenimiento y panel de enjambre coexistentes.

## Puertas estrictas de importación
1. Crear o certificar **PostgreSQL QA aislado** y Storage privado. No usar base productiva de forma accidental; no cargar registros reales en `main`, fixtures públicos ni ramas Git.
2. Extraer archivos desde Drive en contexto privado temporal, producir hashes y conteos de origen, aprobaciones de mapeo, rechazos e historial de importación.
3. Importar primero **copropiedades** con ID aprobado. Luego perfiles y asignaciones autenticadas, después reuniones, mantenimiento, PQRS, adjuntos.
4. Rechazar `PIN`, contraseña, OTP, preguntas de recuperación y tokens; excluir correos de envíos reales. Datos personales solo en tablas con RLS y cuentas autorizadas.
5. `Fotos Delegados` y `Miss ADPHOR`: verificar uso permitido y archivo íntegro, convertir a formato web, subir a Storage privado o a asset público solo si es corporativo y existe autorización específica.
6. Recorridos/carrusel: mostrar fotos de empleados autorizados tras comprobación de usuario, pertenencia y estado; asignar novedades mediante API transaccional y auditoría.
7. **Correo QA:** usar lista explícita de destinatarios de prueba, sandbox/dry-run por defecto, comprobación previa y consentimiento antes de habilitar entrega a buzón autorizado. **WhatsApp QA:** requiere proveedor y número verificado/consentido, plantilla aprobada y restricción absoluta de destinatarios.
8. Ningún mensaje a propietario, residente, proveedor, empleado ni cliente sin aprobación; nunca suponer que el correo del usuario de ChatGPT coincide con el buzón destinatario.
9. Probar con dos delegados, 40+ propiedades, acceso cruzado RLS y URL firmadas privadas.
10. Reportar importados/rechazados y errores antes de cualquier despliegue con datos reales.

## Lo que NO se ha ejecutado
No hubo migración efectiva a una base QA aislada, transferencia de fotos, envío de correos ni WhatsApp, ni comprobación del acceso autenticado en el servidor. No declarar estos objetivos cumplidos.
