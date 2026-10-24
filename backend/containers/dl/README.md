# Contenedor DL: prueba de aceptación offline

Estado: configuración experimental **ejecutada en GitHub Actions, Ubuntu 24.04
con Docker y cgroup v2**, como prueba de aceptación offline en el PR #7. La
prueba cubre aislamiento de ejecución, PNG sintético, rechazo de mensajes
incorrectos y cuota de stdout. No sustituye a `dl_isolation`, no está
conectada a FastAPI ni a Storage y no habilita modelos. El job aprobado NO
equivale a un sandbox de producción certificado.

En un host Linux de pruebas con Docker y cgroup v2, desde la raíz del repositorio:

```sh
docker build -f backend/containers/dl/Dockerfile -t adphor-dl-sandbox:test .
python3 backend/containers/dl/smoke.py
```

La construcción descarga Python/Pillow; la ejecución usa `network=none`. El contexto
de construcción tiene una lista de archivos permitidos mediante el dockerignore
específico: solo requirements DL y fuentes Python. No copiar .env, datos, claves
ni montar el directorio del proyecto. La etiqueta de Python es mutable: registrar
y fijar un digest revisado y analizar vulnerabilidades antes de promover la imagen.

La prueba crea contenedores efímeros sin puertos, bind mounts, volúmenes ni socket
Docker. UID/GID 65532, raíz de solo lectura, todas las capabilities eliminadas,
no-new-privileges, seccomp predeterminado de Docker, tmpfs de 32 MiB sin ejecución,
512 MiB de memoria sin swap adicional, una CPU y 16 PIDs. Conserva el worker y su
protocolo existentes. El programa verifica cgroup v2, red solo loopback, bloqueo de
conexión, permisos efectivos, raíz read-only, ausencia de secretos conocidos y
socket Docker; además procesa un PNG sintético y rechaza un mensaje inválido.
Falla explícitamente si el host no presenta los límites esperados.

El límite de espera es 20 segundos por prueba. En `finally` elimina su contenedor
por nombre aleatorio; no basta matar el CLI de Docker. El runner lee stdout en
streaming, con cuota de 16 MiB + 4096 bytes en memoria, y mata el cliente
Docker y elimina el contenedor si se supera. La prueba incluye un proceso que
intenta emitir más de 20 MiB de stdout. Este runner sigue siendo una herramienta
de aceptación para entradas sintéticas, **no un adaptador público**. Antes de
admitir fotos externas falta incorporar esta cuota en el broker real, controlar
la concurrencia agregada entre procesos, recuperar contenedores huérfanos tras
caída del supervisor y ampliar pruebas adversariales. No exponer el daemon/socket
Docker al servidor de aplicaciones. Ejecutar estas pruebas solo en un host
de laboratorio; no cambian cuentas ni datos de Supabase.

Contenedores comparten kernel: esto no garantiza aislamiento ante vulnerabilidades
del kernel/runtime. Antes de producción: host dedicado y actualizado, imagen
mínima fijada por digest y analizada, política de ejecución revisada y prueba de
límites ante bloqueo/agotamiento, además de autorización RLS para cada objeto.
Todo resultado continúa siendo un borrador pendiente de administrador.

Referencia técnica: https://docs.docker.com/engine/containers/run/
