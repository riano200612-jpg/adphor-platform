# ADPHOR — revisión protegida con catálogo real, 2026-11-03

## Alcance efectivo
Esta rama presenta dos experiencias diferentes y etiquetadas:
1. `/qa/simulacion-operativa.html`: simulación con escenarios ficticios y carrusel de cuatro roles ficticios; no realiza escritura.
2. `/qa/datos-reales.html`: consulta de **datos históricos reales** previamente importados, protegida por Cloudflare Access, Supabase Auth y comprobación de rol administrador en el servidor. Consulta exclusivamente un resumen histórico del catálogo; no muestra PII ni credenciales ni fotos.

## Migración verificada
- Ya existen 755 filas históricas verificadas y preservadas en Supabase: 44 registros de copropiedades, 682 eventos y 29 PQRS; no duplicarlas ni llamar reservas activas a eventos.
- El maestro recibido el 2026-11-03 contiene 44 filas Copropiedades, 684 Registros, 29 PQRS y 55 Delegados.
- Dos filas nuevas de Registros frente a la copia histórica quedaron en tabla de staging privada `adphor_import_private.qa_new_meeting_candidates_20261103`, **pendientes de conciliación**; no afectan el calendario real.
- Excel, fotos de personas y credenciales no se han cargado en la interfaz. Están fuera del repo público y los datos personales no son parte del resumen de QA.
- La función SQL `public.qa_client_readonly_snapshot` tiene EXECUTE sólo para `service_role`, y la Edge Function `qa-client-readonly-snapshot` exige JWT de usuario y rol administrador, retornando contenido de solo lectura. No ejecuta comandos de agentes.

## Protección
- Cloudflare Access probado sin sesión tanto en el dominio QA principal como en una URL de deployment; ambos exigieron login.
- El build con Vite exige `ADPHOR_PROTECTED_STAGING_QA=true` y una rama explícitamente permitida.
- El entorno Cloudflare Preview configura `ADPHOR_BUILD_QA_DEMOS=true`, `VITE_SUPABASE_URL`, clave pública `VITE_SUPABASE_ANON_KEY` y `VITE_ADPHOR_QA_READONLY=true`. La aplicación principal permanece en modo demostración para evitar escrituras accidentales; sólo la página de consulta histórica usa el API real protegido.
- Todos los endpoints y archivos requieren comprobación HTTP y UI tras desplegar. El hash de commit en GitHub no garantiza un deployment.

## Fuera de alcance / bloqueos
- No se importaron archivos binarios a Supabase Storage, ni contenido sensible de los libros Excel, ni se reconciliaron delegados completos.
- La navegación, reuniones y PQRS del aplicativo principal aún no son un sistema en vivo con la base del cliente.
- MFA/TOTP del usuario administrador no se ha probado en la instancia hospedada.
- No existe enlace de cliente certificado hasta ejecutar pruebas autenticadas y de acceso anónimo.

## Reversión
Eliminar la rama de preview no altera la versión QA anterior ni `main`. No modificar datos originales.
