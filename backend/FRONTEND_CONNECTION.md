# Historial conectado a FastAPI

La navegación Historial del enjambre consulta GET /agent-runs usando la sesión
actual de Supabase. No pide otra contraseña, no guarda tokens adicionales y no
incluye acciones de aprobación, cierre o envío. El piloto añade ejecución por reglas
solo para Administradores y consulta de borradores; ver [RULES_PILOT.md](RULES_PILOT.md).
La API sigue verificando
la identidad y RLS limita las filas. Admin y coordinator ven la pantalla.

## Historial con el main.py anterior (solo lectura)

Para ejecutar reglas, sustituir el comando de arranque por el indicado en
[RULES_PILOT.md](RULES_PILOT.md); el main.py anterior no implementa POST ni detalles.

Mantener FastAPI en 127.0.0.1:8000. En otra terminal, desde el repositorio:

```bash
VITE_AGENTS_API_URL=http://localhost:5173 npm run dev -- --port 5173 --strictPort --host 127.0.0.1
```

Abrir http://localhost:5173/adphor-platform/ e iniciar sesión. Las variables
VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar configuradas en .env.local.
Vite reenvía /agent-runs al servidor Python local; el navegador consulta su mismo
origen y no hace falta modificar CORS del backend. No iniciar Vite en 8000 para
esta prueba: ese puerto pertenece a FastAPI. Este proxy solo existe en desarrollo.

## Producción

Configurar VITE_AGENTS_API_URL con el origen HTTPS público real del backend y
recompilar. Mantener FRONTEND_ORIGIN=https://adphor-platform.pages.dev en FastAPI.
Sin URL, la interfaz informa que el servicio no está conectado. No configurar
localhost en Cloudflare Pages. No hay backend público desplegado en esta entrega.

El historial usa páginas de 20 registros y muestra fecha de lectura, método y
estado. Una lista vacía solo significa que no hay registros visibles en esa página.
Al cambiar de propiedad o cerrar sesión, las respuestas tardías no se muestran en
la nueva pantalla. Los modelos siguen pendientes de configuración.
