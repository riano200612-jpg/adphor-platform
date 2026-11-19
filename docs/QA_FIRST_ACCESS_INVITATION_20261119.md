# ADPHOR QA Integral — Primer acceso por invitación (19/11/2026)

- La invitación administrativa ya existe en `adphor-iam`; no se habilita autorregistro.
- La URL de invitación se acepta exclusivamente en el alias HTTPS QA Integral y se eliminan los tokens de la URL antes de procesarlos.
- Si el enlace es de tipo `invite`, el usuario recibe instrucciones de primera contraseña; `recovery` conserva su flujo anterior.
- El titular crea su contraseña en Supabase Auth. Se intenta cerrar la sesión temporal antes del ingreso ordinario.
- El acceso a datos sigue protegido por identidad verificada, MFA TOTP AAL2 y RLS; la pantalla de invitación no consulta datos empresariales.
- No se habilita por esta mejora el inicio de sesión mediante alias `j.guzman`, ni se envían invitaciones de prueba a personas reales.
- Para certificar empleados reales se requieren correo verificado, identidad, roles y asignaciones previamente aprobados.
