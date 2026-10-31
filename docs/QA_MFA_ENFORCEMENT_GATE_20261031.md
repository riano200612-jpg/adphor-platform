# Puerta de MFA obligatorio — QA

La plataforma original exige verificar un segundo factor en el inicio de sesión. Se incorpora el control `VITE_REQUIRE_MFA=true` para impedir que cuentas sin un factor verificado entren a la interfaz cloud. **No se activa automáticamente:** primero debe configurarse un proceso de alta segura y recuperación para no bloquear usuarios legítimos.

- Con `VITE_REQUIRE_MFA=true`: sin factor verificado, rechazar login; con factor TOTP, exigir desafío y AAL2.
- Sin la variable: se mantiene la conducta histórica, permitiendo usuarios no enrolados; **no afirmar que MFA sea obligatorio**.
- El código no envía correos ni implementa OTP por correo. Para satisfacer la solicitud del cliente, diseñar un método de segundo factor gestionado por proveedor y probado con buzones QA autorizados; no confiar solo en controles del frontend.
- Los permisos de datos deben reforzarse en el servidor mediante RLS y políticas AAL2 cuando el sistema exija MFA. Un valor `VITE_*` público no establece protección de backend.
- Antes de activar: aprobar procedimiento de enrolamiento, soporte, recuperación, validación RLS, dos delegados de copropiedades diferentes, pruebas navegador y plan de reversión.
