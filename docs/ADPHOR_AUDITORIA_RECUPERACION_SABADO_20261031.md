# ADPHOR · Auditoría de recuperación del sábado 31/10/2026 (03/11)

## Evidencia verificada

1. Grabación del usuario `Screen recording 2026-11-03 15.11.49.webm`: el sitio `adphor-platform.pages.dev`, con navegación moderna y Miss ADPHOR, abre **PQRS · Seguimiento histórico**, muestra 29 PQRS y el botón deshabilitado **Radicación real pendiente de conexión segura**. No aparece el formulario de radicación.
2. Repositorio productivo `codex/flujo-mantenimiento` antes de la corrección: en `src/js/app.js` el render de `pqrs` está condicionado por `portoVisible()`; fuera del staging QA aislado monta `src/js/ui-pqrs-source-status.js` en vez de `src/js/ui-pqrs.js`. Esto oculta el formulario construido.
3. `src/js/ui-pqrs.js`: contiene **Nueva PQRS**, tipo, asunto, torre, apartamento, nombre de propietario, descripción, carga múltiple de hasta cinco fotografías, videos o PDF de 20 MB, previsualización y **Enviar solicitud PQRS**. El mismo código bloquea explícitamente el envío con evidencias porque no existe servicio de Storage privado integrado.
4. `src/js/services/porto.js`: exige ref staging diferente de `oqizvirqjwbbhyyjpthq`. El proyecto operativo actual solo contiene `demo-01`; no hay `public.pilot_pqrs` ni su historial/respuestas. Por tanto, el formulario previo no es operativo en producción.
5. `adphor-jose-original-private/portal/Código.js`: tiene rutas para `?page=form` (radicación propietarios), `?page=status` (consulta), `?page=portal-team` (acceso personal) y otras, configuradas con `XFrameOptionsMode.ALLOWALL`.
6. `adphor-jose-original-private/portal/PQRS.js` contiene `registrarPQRSPublico`, `consultarTicketPublico`, `adjuntarEvidenciaPQRS`, `obtenerHistorialPQRS` y seguimiento del caso; `portal/Visitas.js` maneja visitas y `reuniones/Calendario.js` crea eventos de Google Calendar. Los despliegues reales `/exec` no estaban disponibles en los archivos o conexiones verificadas.
7. Fotos: ZIP `media-20261103T134407Z-1-001(1).zip` contiene 45 fotos de colaboradores. El ZIP conciliado conserva 55 fichas de delegados y 44 copropiedades. Por normalización exacta de nombres, 42 de las 55 fichas presentan una coincidencia textual en fotografías; no prueba identidad o permiso. La interfaz original mostraba todo el directorio del ZIP sin vinculación real por proyecto.
8. PR #16 del sábado (Draft) corrige permisos booleanos y cruces entre copropiedades en asignaciones; pruebas unitarias correctas, integración de backend/RLS y almacenamiento privado pendientes.

## Recuperación ejecutada

- `src/js/ui-pqrs-unified.js`: interfaz única con pestañas de propietarios, consulta de radicado y portal de empleados; integra la página original activa en un iframe restringido, con enlace nuevo-tab por compatibilidad. **No escribe datos en Supabase** ni crea un falso radicado.
- Configuración posible: `VITE_ADPHOR_PORTAL_EXEC_URL` (URL base del desplegado por el cliente) o ingreso de la URL `/exec` por un administrador; en el segundo caso se almacena únicamente en ese navegador, no como configuración global. Los usuarios deben cumplir el login original. **Nunca aceptar /dev ni inventar deployment ID.**
- Se conserva abajo el resumen de los 29 casos históricos, sin presentarlos como caso operativo.
- `src/js/ui-client-source-review.js`: carrusel del archivo privado restringido a empleados que coinciden por ID con delegado o coordinador de la copropiedad seleccionada. Busca fotografías por coincidencia textual exacta de nombre normalizado, muestra cargo/función registrados, sector y estado de la fuente. **No muestra por defecto fotos de personal ajeno**. Asignar novedad permanece deshabilitado hasta validar permisos del backend.
- `src/css/client-source-review.css`: estilos responsivos del carrusel y calendario restaurados en la rama moderna.
- `tests/pqrs-saturday-recovery.test.js`: validación de rutas, aislamiento por copropiedad y coincidencia de fotografías.

## Pendientes reales y verificaciones

- Confirmar las URLs completas `/exec` del portal original y configurar la variable en Cloudflare; sin ellas el sistema nuevo presenta las pestañas pero no puede radicar.
- Verificar autenticación, subida, envío, radicado, recarga y consulta dentro del iframe original con cuenta autorizada; fallback externo si no puede incrustarse.
- Persistir los datos en backend moderno solo después de homologar 44 copropiedades, identidades, Storage, RLS y el modelo de PQRS con pruebas E2E. No exponer expedientes ni fotografías en repositorio público.
- El carrusel del ZIP es una **vista privada histórica**. Para usar fotos operativas en agenda y asignaciones, crear directorio privado con consentimientos, URL firmada, vigencia y permisos de datos reales.
- No convertir una mejora de navegación en certificación de notificaciones, radicación o persistencia del sistema nuevo.

## Despliegue y seguridad

- Rama de integración: `qa/p1-integracion-modulos-gate-20261103`. El movimiento a `codex/flujo-mantenimiento` exige las tres suites GitHub en verde y mantener el respaldo `backup/prod-legacy-ui-pre-unification-20261103`.
- Sin datos personales ni archivos del ZIP en GitHub. No modificar la base productiva ni el portal del cliente para hacer visible el formulario.
