# ADPHOR QA Integral — activación acotada de evidencias privadas PQRS

**Fecha:** 19 de noviembre de 2026. **Objetivo:** pruebas reales controladas del sábado, manteniendo una única QA Integral. Sin integración Google Calendar, correos automáticos, producción ni modificaciones de originales.

## Preflight de infraestructura (solo lectura, Supabase QA)
- `public.qa_case_evidence` existe, RLS activo y políticas para insertar/leer por copropiedad y autor.
- Bucket `qa-case-evidence` privado, máximo de 20 MB; 43 IDs de copropiedad compatibles con la ruta de almacenamiento.
- Storage permite escribir objetos únicamente con membresía válida, identidad propia, radicado PQRS existente y ruta anidada. La tabla rechaza filas sin objeto guardado y se audita su asociación.
- `authenticated` tiene privilegios mínimos de INSERT/SELECT; `anon` no debe acceder mediante las políticas.
- En el cliente se exigen MFA AAL2, membresía, radicado válido, tipo permitido y máximo cinco archivos. Objetos identificados por hash por usuario/archivo/radicado, `upsert:false`, reintento sin duplicar y enlaces firmados a corto plazo.

## Garantía de activación
Solo se admite `VITE_QA_EVIDENCE_UPLOAD_ENABLED=true` con Supabase QA, `VITE_PORTO_QA_ENABLED=true`, ref exacta QA y hostname **qa-integral-claude-reviewed.adphor-platform.pages.dev**. La rama histórica, otros previews, localhost y producción fallan cerrados. No se permite backend alternativo si falla la puerta en QA.

El indicador `pqrsEvidenceUploadConfigured` del build reporta solamente **configuración**; no declara subida real probada. La activación en Cloudflare Pages **preview** debe preservar todas las demás variables y no modificar `production`; la publicación ocurre solo al desplegar un commit QA aprobado tras CI.

## Flujo de aceptación humana
1. Iniciar sesión con cuenta autorizada y completar TOTP MFA AAL2.
2. Elegir copropiedad asignada; entrar en PQRS; completar tipo, asunto y descripción sencillos.
3. Añadir **un PDF o imagen ficticia y sin datos personales** (máx. 20 MB).
4. Enviar; verificar radicado real de QA y el mensaje de asociación de evidencia. Reintentar el mismo borrador solo si la pantalla indica error.
5. Actualizar, abrir el radicado, consultar evidencia privada y obtener enlace firmado. Verificar que otra copropiedad/no-miembro no pueda acceder.
6. Registrar la evidencia de prueba y la versión SHA de QA; no enviar correos ni modificar Calendar.

**No se certifica** entrega automática de PQRS por correo, envío a responsables ni una sesión real AAL2 con pruebas sintéticas de Chromium. Es necesaria aceptación de la empresa con su propia cuenta.
