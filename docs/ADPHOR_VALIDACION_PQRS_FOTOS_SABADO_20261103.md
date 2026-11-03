# ADPHOR · Auditoría de carrusel y PQRS (03/11/2026)

## Revisión sobre las instrucciones del sábado 31/10
Objetivo original: conservar Portal de José, recuperar radicación pública y acceso de empleados, subir/consultar evidencias, carrusel con fotografías de delegados, cargo, dependencia/área, funciones, responsabilidades, copropiedad, autorización y permiso para recibir novedades.

## Evidencia y resultados de conciliación de fuentes privadas
- Paquete QA verificado: **44** copropiedades, **55** perfiles de delegados (sin PIN), **628** actividades históricas enlazadas, **56** actividades en cuarentena y **29** PQRS históricas.
- ZIP multimedia: **45** fotografías de colaboradores.
- **41/44** copropiedades tienen relación identificable con una ficha de delegado; **42/55** delegados tienen foto con coincidencia textual de nombre; **36/44** copropiedades tienen al menos un delegado principal con fotografía correspondiente.
- Una foto con el mismo nombre es una coincidencia técnica; **no prueba identidad ni consentimiento**. Estas fotos se muestran solo mediante carga local en el navegador de un administrador y nunca deben publicarse en el repositorio o CDN.
- El maestro incluye columnas de nombre, rol/leyenda, sector coordinado, estado y copropiedad; no contiene una matriz certificada de funciones específicas por empleado ni permiso vigente para asignar novedades.
- Los dos archivos completos están en el propietario/ZIP privado, no en el repositorio.

## Motivos por los que el usuario no veía el carrusel
1. No existe un directorio de 55 delegados homologado en `public.memberships`: solo dos membresías en la base operativa actual. El carrusel de Reuniones lee únicamente estas membresías y, por diseño, no incluye fotografías inventadas ni no autorizadas.
2. El visor privado exige seleccionar el ZIP conciliado y el ZIP multimedia; **las fotos no se guardan en Cloudflare**.
3. El CSS del visor estaba condicionado a `#page-content.source-review`, pero el render original no aplicaba la clase: corregido.
4. El enlace desde Reuniones al visor no aparecía: se incorporó **Ver equipo y fotografías reales** para el administrador en la nueva interfaz.
5. El visor ya lista cargo/función, sector y estado de origen; asignaciones de novedades bloqueadas hasta JWT, RLS, consentimiento y autorización por copropiedad.

## PQRS: estado del envío y evidencias
- El módulo moderno presenta pestañas **Propietarios · Radicar PQRS**, **Consultar radicado** y **Empleados · Portal y PQRS**, y botón principal contextual para abrir el servicio original.
- No hay una URL `/exec` de Portal original verificada en este repositorio; `VITE_ADPHOR_PORTAL_EXEC_URL` debe configurarse o un administrador debe introducir el enlace en su navegador. **Sin /exec no hay radicación real**.
- En el código original privado `portal/PQRSForm.html`, radicación con `registrarPQRSPublico` y **un** archivo por envío de hasta 10 MB; incluye audio en el formulario.
- El trabajo nuevo del sábado en `src/js/ui-pqrs.js` contempla **5 archivos x 20 MB**, validación y previsualización, pero bloquea guardado con archivos hasta disponer de backend/Storage privado. No se convirtió ese bloqueo en confirmación falsa.
- Las operaciones PQRS pueden persistir en el Apps Script original, cuando está desplegado y autenticado, pero **no** se ha probado en este turno con envío, recarga y lectura de caso real.
- Los accesos del Portal original `?page=form`, `?page=status` y `?page=portal-team` se mantienen separados por finalidad.

## Próximas certificaciones necesarias para operación completa
- Definir la URL productiva real Apps Script `/exec`; confirmar autenticación, creación de radicado, adjunto, recarga y consulta con cuenta autorizada. Configurar `VITE_ADPHOR_PORTAL_EXEC_URL` en Cloudflare Pages para todos los usuarios (el enlace guardado localmente en la cuenta administradora **no** configura los demás navegadores).
- Homologar copropiedades, delegados, roles, permisos y responsabilidades, sin suponer autorizaciones por relación de nombre o foto.
- Preparar Supabase Storage privado, políticas por copropiedad y URL de corta duración. Los permisos backend no pueden descansar en un selector de UI.
- No divulgar nombres/fotos, PIN, correos, adjuntos, tokens, ni grabaciones del cliente mediante el repositorio GitHub público.

## Entrega en código
- `src/js/ui-pqrs-unified.js` rutas y botón principal contextual; mensajes honestos de conexión no verificada.
- `src/js/ui-client-source-review.js` clase y carrusel filtrado por ID.
- `src/js/ui-meeting-assessment.js` acceso directo al carrusel desde Reuniones.
- `src/js/ui-unified-hub.js` texto del estado PQRS consistente con flujo original.
- Pruebas de regresión y GitHub CI antes de publicar.
