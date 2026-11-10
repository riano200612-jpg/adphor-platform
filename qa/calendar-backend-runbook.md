# FastAPI de calendario en ADPHOR QA

## Destino

Reutilizar un host persistente autorizado y la entrada protegida de QA, si existen. En el host, instalar Python y las dependencias fijadas en `backend/requirements-fastapi.txt`. Ejecutar `bash qa/run-calendar-backend.sh` desde la raíz de un checkout del SHA aprobado, bajo el supervisor del host. El proceso escucha solo en 127.0.0.1:8000. Registrar el SHA del checkout y el ID de release del supervisor o del proveedor. Usar un túnel persistente con la política Access verificada y sin puerto de origen público.

Un contenedor gestionado con entrada privada es una alternativa si no hay host persistente. Requiere identificar proveedor, costo, secretos, responsable, monitoreo y autorización antes de aprovisionar. Un proceso local transitorio sirve para comprobar el arranque, pero no constituye un despliegue QA persistente.

## Configuración y controles

- Inyectar SUPABASE_URL y FRONTEND_ORIGIN exactos de QA y SUPABASE_PUBLISHABLE_KEY desde configuración del host. Utilizar únicamente la clave publicable QA.
- Inyectar ADPHOR_QA_CALENDAR_ID, ADPHOR_QA_CALENDAR_OAUTH_CLIENT_ID, ADPHOR_QA_CALENDAR_OAUTH_CLIENT_SECRET y ADPHOR_QA_CALENDAR_OAUTH_REFRESH_TOKEN desde el gestor autorizado. Limitar el consentimiento al free/busy del calendario aprobado. No registrar valores.
- El lanzador activa el modo synthetic porque el guard compartido lo exige. La consulta /meetings/availability llama a Google con OAuth real después de comprobar el proyecto/origen exactos, el token Supabase, AAL2 y la membresía. Los datos sintéticos pertenecen a las rutas de consulta separadas.
- Verificar el origen protegido y el preflight OPTIONS desde Pages. El frontend envía Authorization con el Bearer de Supabase y usa credentials: omit. Un hostname Access separado puede requerir integración adicional. No enviar tokens de servicio de Access al navegador ni permitir un POST anónimo para resolver CORS. Preferir una ruta del mismo origen bajo la protección existente si el mecanismo autorizado la admite.
- Configurar ADPHOR_QA_AGENTS_API_URL y, en compilación nativa de Pages, VITE_AGENTS_API_URL solo cuando exista una URL efectiva verificada. Comprobar que el artefacto servido apunta a ese origen.
- Verificar ruta con una solicitud sin sesión y con sesión AAL2 autorizada. Registrar solo códigos HTTP y número de intervalos; probar AAL1, identidad sin membresía y propiedad ajena. Verificar OAuth y el botón en escritorio/móvil sin crear eventos.
- Monitorear salud privada, latencia y tasas de 401/403/502/503 sin tokens ni cuerpos. Para revertir, restaurar el proceso/SHA y el valor frontend anterior, y retirar solo el enrutamiento nuevo. No modificar Access, MFA, RLS ni calendarios productivos.
