# Acceso del propietario a la aplicación QA

El usuario Auth existente fue comprobado, sin recrearlo ni cambiar su contraseña.
Se ejecutó el aprovisionamiento privado: perfil administrativo y 43 membresías
admin sobre las copropiedades QA actuales. La identidad del cliente sigue inactiva.

## Primer ingreso

1. Abrir el alias protegido por Access.
2. Ingresar con el correo y contraseña del usuario Auth ya creado en adphor-qa.
   La sesión del dashboard de Supabase/GitHub no sustituye esta autenticación.
3. Si no existe TOTP verificado, pulsar Registrar autenticador.
4. Escanear el QR en una aplicación autenticadora personal, o introducir la clave
   manual en esa aplicación. No enviar QR, clave o códigos por chat.
5. Verificar los seis dígitos. Sólo después se consulta el perfil y los datos.

El registro inicial de TOTP está habilitado en el código exclusivamente para QA
Supabase explícito. Fuera de ese entorno se mantiene la conducta anterior.
El usuario solicita el registro con un botón; no se generan factores durante
la simple carga de la pantalla. Se comprueba la identidad antes de registrar y
verificar, y aal2 después de la verificación. No se borran ni reinician factores.
El secreto se muestra en la pantalla actual; no se guarda en almacenamiento local,
logs o estado persistente. El SVG se representa como imagen, no como HTML activo.

## Verificación

- 207 pruebas JavaScript PASS y build PASS.
- Pruebas adicionales: no verificar antes de registrar, registrar sólo por acción
  explícita, impedir cambio de sesión, consumir desafío verificado una sola vez.
- Dos escenarios Playwright preparados para primera inscripción y representación
  segura de QR/clave. Pendiente resultado CI de este commit.
- La inscripción real y el login requieren al propietario: no se conoce su
  contraseña ni se ha manipulado su autenticador.

## Configuración y límites

El alias exacto es https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev/ .
La sesión administrativa del dashboard de Supabase no estaba guardada en el perfil
TinyFish: se observó formulario de login/captcha, sin cambios de redirección.
Por tanto Site URL, Redirect URLs, hook de altas y configuración TOTP del dashboard
siguen sin verificación administrativa. El login por contraseña utiliza el API Auth
directamente y no necesita un callback de redirección. No se añadió OAuth a la app.

La publicación de la interfaz integrada es para auditoría interna, sin aprobación
funcional del propietario. No certifica Google Calendar, importación de fotos,
backend de informes/agentes ni módulos que dependan de servicios aún no conectados.
No se deben representar esos servicios como integrados por mostrar su menú.
