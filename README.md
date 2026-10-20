# ADPHOR · Seguimiento de mantenimiento

Aplicación web adaptable para registrar novedades por copropiedad, asignar responsables, documentar la intervención y verificar el cierre. La demostración pública usa ocho copropiedades completamente ficticias. Las copropiedades reales se configuran en la base privada.

## Probar en local

Requiere Node.js 22 o superior.

```sh
npm ci
npm run dev
```

Abre `http://localhost:8000/adphor-platform/`. Sin variables de Supabase se abre una **demostración local**, identificada en el acceso y en todas las pantallas. No es autenticación ni almacenamiento seguro. Usa exclusivamente información de prueba.

Perfiles de prueba:
- Administración demo: administración de todas las copropiedades.
- Coordinación demo: coordinación de todas las copropiedades.
- Técnico: atención en Residencial Horizonte · Demo, con tareas asignadas a su perfil.
- Consejo: consulta de Residencial Horizonte · Demo, sin escritura.

La demostración guarda únicamente datos de prueba en `adphor.workflow.demo.v3`. Las claves anteriores del navegador se conservan intactas y no se importan automáticamente para evitar mezclar información real con ejemplos públicos. La migración de registros reales a Supabase requiere una revisión privada de los datos.


## Recorrido de aceptación

1. Ingresa como administrador, selecciona Residencial Horizonte · Demo y registra una fuga con área, ubicación, prioridad, responsable Técnico y plazo.
2. Cierra sesión e ingresa como Técnico. En **Mis tareas**, abre el caso e inicia la atención.
3. Describe la intervención, adjunta una fotografía JPG/PNG/WebP y envíala a verificación.
4. Ingresa como Coordinación demo. Abre el caso, revisa la foto y registra la verificación para cerrarlo. También puedes devolverlo a atención con un motivo.
5. Revisa el historial, los indicadores y el informe. Prueba una copropiedad vacía: no debe mostrar cifras ficticias.
6. Usa Consejo: puede consultar, pero no crear ni modificar casos.

## Funciones implementadas

- Resumen operativo con pendientes, vencidos, verificación y cierres calculados.
- Tablero por estados y vista de lista; búsqueda, filtros y «Mis tareas».
- Área, ubicación, prioridad, responsable y plazo obligatorios.
- Flujo Pendiente → En proceso → Por verificar → Cerrada; reapertura por coordinación.
- Intervención con fotografía obligatoria; cierre con nota de verificación.
- Historial de acciones, fechas, responsable y evidencias.
- Vista de áreas con pendientes reales.
- Informes por mes de registro, CSV compatible con Excel e impresión/PDF.
- Validación de imágenes (3 por intervención, 2 MB cada una), manejo de errores y conservación del formulario ante fallos.

Los avisos de urgencia/vencimiento están en el panel y se actualizan al cargar o pulsar **Actualizar**. No se envían correos, WhatsApp ni avisos en segundo plano. El filtro del informe corresponde al **mes de creación**, no a los cierres ocurridos ese mes.

## Activar usuarios y datos compartidos con Supabase

1. Crea un proyecto Supabase. Aplica `supabase/migrations/202610190001_workflow.sql` y después `supabase/seed.sql` mediante el SQL Editor, o el flujo de migraciones del CLI.
2. Crea los usuarios desde Authentication mediante el procedimiento de invitación de tu organización. Desactiva el registro público si solo se admiten colaboradores invitados. No copies contraseñas al repositorio.
3. Desde el SQL Editor, crea cada perfil y sus membresías. Sustituye el UUID por el del usuario real y repite por cada copropiedad autorizada:

```sql
insert into public.profiles(id,name)
values ('UUID-DEL-USUARIO','Nombre del colaborador');
insert into public.memberships(project_id,user_id,role)
values ('demo-01','UUID-DEL-USUARIO','coordinator');
```

Roles permitidos: `admin`, `coordinator`, `technician`, `viewer`. Incluso un administrador necesita membresía explícita en cada copropiedad. Para retirar acceso, revoca/bloquea la cuenta y sus membresías desde la administración; si tiene tareas asignadas, reasígnalas antes de eliminar la membresía.

4. Copia `.env.example` a `.env` y configura:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
```

Usa la clave pública anon/publishable; **nunca** una clave `service_role` o secreta en variables `VITE_*`. El cliente es público y la protección depende de las políticas RLS y las funciones del servidor.

5. Reinicia Vite o vuelve a compilar. Con ambas variables configuradas aparece el ingreso real por correo y contraseña; con una sola, el acceso queda bloqueado para evitar una configuración ambigua.
6. Para GitHub Pages, configura esas dos variables en Settings → Secrets and variables → Actions → Variables. El workflow de despliegue las usa al compilar. No subas `.env`.
7. Prueba dos cuentas de copropiedades diferentes y comprueba el flujo con imágenes en el proyecto real antes de usar datos de producción.

Las políticas permiten leer únicamente copropiedades asignadas. La escritura usa `ticket_command`, que valida cargo, responsable, estado, versión y evidencia en una transacción. Los clientes no pueden actualizar tablas directamente ni falsificar el autor del historial. La versión evita sobrescribir cambios concurrentes. Las fotografías se guardan en un bucket privado y se consultan mediante enlaces temporales; la política de Storage no permite reemplazar ni borrar evidencias desde el cliente.

## Comprobaciones

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` incluye pruebas del flujo y ejecución de la migración/RPC/políticas en PostgreSQL embebido (PGlite). El test crea contratos mínimos de Auth y Storage; no reemplaza una prueba de integración con el servicio Supabase real. Playwright comprueba el recorrido con varios perfiles, imágenes, persistencia, modo de consulta, filtros, móvil y error de almacenamiento.

GitHub Actions ejecuta pruebas y compilación. El despliegue a Pages sigue ocurriendo desde `main`; una propuesta de cambios no publica la aplicación.

## Antes del piloto con datos reales

- Configurar las cuentas, membresías y el proyecto Supabase; no se han aprovisionado servicios externos desde este repositorio.
- Verificar invitaciones, acceso, carga/lectura de imágenes y aislamiento de usuarios en Supabase real.
- Definir conservación de evidencias y el procedimiento para retirar imágenes privadas mediante administración autorizada.
- Configurar copias de seguridad de la base y de los archivos por separado y probar su restauración. Este código no configura copias automáticas del proveedor.
- Revisar periódicamente archivos subidos sin vincular a un caso tras un fallo de red. Permanecen privados y requieren limpieza administrativa; no borrar evidencias referenciadas.
- No depender del sistema para emergencias: activar primero el protocolo local y el contacto directo.

Fuera de esta versión: notificaciones externas, sensores, IA, contabilidad, portal de residentes, tareas preventivas programadas y trabajo sin conexión completo. El acceso se mantiene solo durante la sesión de la página; recargar requiere volver a ingresar.


## Demostración para dirección

El usuario `adphor` se resuelve a `demo-adphor@example.invalid` en Supabase Auth.
Crear esa cuenta manualmente con Auto Confirm User y una contraseña temporal privada;
el correo es un identificador reservado, no un buzón para recuperación. Para cambiar
la contraseña se requiere intervención del administrador. No incluir contraseñas
en GitHub ni en variables VITE. Las cuentas existentes siguen entrando por correo.

Ejecutar `supabase/demo-owner.sql` en SQL Editor después de crear la cuenta.
Crea 16 proyectos separados con `is_demo=true`, membresía de coordinador y cuatro
casos ficticios por proyecto. Los nombres provienen de https://adphor.com/clientes/;
las áreas, ubicaciones, estados y trabajos son ejemplos, no información operativa.
Los casos precargados no representan intervenciones verificadas y su historial lo
indica. Los nuevos casos mantienen los requisitos normales de evidencia y cierre.
El script es repetible, no restablece casos modificados, y rechaza una cuenta que
ya tenga membresías operativas. RLS aplica el aislamiento por membresías: no asignar
a esta cuenta compartida proyectos reales de operación.

Tras desplegar, entrar como adphor, comprobar el aviso de demostración, las 16
propiedades y el ciclo de un caso nuevo. No se ha validado esta cuenta en producción
hasta que el administrador la cree y ejecute el script.
