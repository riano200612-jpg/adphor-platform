# ADPHOR QA Integral — revisión de formularios sencillos (19 de noviembre de 2026)

Prioridad: el personal debe completar registros sin dificultades, especialmente las personas poco familiarizadas con sistemas digitales. Se conserva el diseño corporativo, los originales de José, todos los permisos del backend, el portal QA único y la exclusión de Google Calendar hasta la migración del cliente.

## Auditoría y mejoras
1. **Usuarios / IAM:** el editor original presentaba las 43 copropiedades como una lista extensa. Ahora muestra inicialmente solo ocho opciones, permite buscar por nombre, muestra cuántas están seleccionadas y ofrece un botón explícito para ver el catálogo completo. Los permisos **no se conceden al buscar**, ni al ocultar o mostrar opciones: solo las casillas marcadas se incluyen en el payload que el backend valida. La revisión humana y la confirmación antes de enviar invitaciones o cambios continúan.
2. **Validación IAM:** mensajes junto al formulario (nombre, correo, copropiedades, justificación, cuenta y confirmación) llevan al campo que requiere atención. No se modifica la API de invitaciones, roles o bajas.
3. **Visitas:** únicamente el selector habitual de fecha/hora está visible al entrar; «Prefiero escribir la fecha y hora» permite usar texto cuando el calendario del equipo no es cómodo. Un mensaje visible indica qué dato falta para revisar. El botón de guardar y la validación del servidor siguen sujetos a los mismos controles.
4. **PQRS:** si faltan asunto o descripción, la pantalla muestra una instrucción precisa en lenguaje sencillo, resalta el campo y conserva lo escrito. No cambia radicado, archivos privados ni políticas de acceso.

## Pruebas y restricciones
Pruebas Node sobre contratos y tests reales de interfaz Chromium con datos sintéticos cubren: búsqueda/selección entre 43 copropiedades, edición de rol sin conceder acceso, campos incompletos, selección alternativa de fecha en móvil, preparación de visita y no escritura de cuentas reales. Se ejecuta la batería global CI después del PR y nuevamente después del merge.

La prueba personal de una cuenta de ADPHOR con MFA AAL2 **no** se sustituye por pruebas sintéticas. La pestaña oficial QA Integral se leyó con autorización del usuario, pero este flujo de navegador en Chat solo permite consultar el estado y no pulsar formularios ni compartir contraseñas. No se genera acceso masivo ni se modifican originales, Google Calendar, Production o email PQRS.

## Pasos prácticos para validación
- Acceso autorizado → Equipo administrativo → Invitar personal → buscar copropiedad, marcar solo la aprobada, seleccionar rol, completar razón y cancelar la confirmación si solo se está comprobando usabilidad.
- Visitas → elegir motivo, calendario, responsable → revisar y confirmar solo si la visita sintética está autorizada; actualizar la lista y verificar.
- PQRS → asunto y descripción → comprobar avisos, corregir, subir archivo de prueba y verificar radicado + enlace privado solo con sesión autorizada.

**No afirmar «operación real certificada» hasta comprobar cada ciclo con la cuenta y permisos previstos.**
