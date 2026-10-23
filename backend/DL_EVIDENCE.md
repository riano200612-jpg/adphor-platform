# Validación offline de evidencias DL

Continuación del PR #7, sin inferencia visual ni descarga de Storage.
Instalar desde la raíz:

```sh
python -m pip install -r backend/requirements-fastapi.txt -r backend/requirements-dl.txt
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
```

`validar_manifest(entrada, evidencias)` comprueba asociación al snapshot.
Después, para cada evidencia, `preparar_imagen(evidencia, contenido)` comprueba
hash/tamaño, decodifica y devuelve `ImagenPreparadaDL`: ancho, alto, PNG sin
metadatos originales, hash original y hash preparado. `verificar_archivo` conserva
su retorno True para los consumidores que sólo necesitan validar.

El límite anterior de 10 MiB se reduce a 2 MiB para coincidir con Storage actual;
12 MP y 8192 por lado antes de cargar píxeles, salida máximo 2048 por lado.
No se aceptan animaciones. La orientación EXIF se aplica antes de eliminarla.
La copia preparada no se guarda en Storage ni sustituye evidencia original.

No demuestra autenticidad de captura, existencia de daño ni autorización del
usuario. El servicio futuro debe verificar sesión/membresía y la referencia exacta
al objeto del caso antes de descargar. El manifiesto no debe venir confiado desde
el navegador. No entregar credenciales ni originales con metadatos a modelos.
La función base `preparar_imagen` decodifica en proceso y se conserva para pruebas.
La entrada recomendada para el siguiente adaptador es `preparar_imagen_aislada`
del módulo `adphor_ai.dl_isolation`, disponible solo en Linux. No hay fallback a la
función base si el aislamiento falla.
Ver la auditoría y plan en `docs/audits/2026-10-23-continuation.md`.


## Subproceso con límites (experimental)

```python
from adphor_ai.dl_isolation import preparar_imagen_aislada
# Sesión/membresía/referencia de Storage deben verificarse ANTES de obtener bytes.
# validar_manifest ya debe haber comprobado el snapshot autorizado.
preparada = preparar_imagen_aislada(evidencia, contenido)
```

Cada imagen usa un intérprete nuevo (`-I -B`), con directorio temporal privado,
entorno explícito sin credenciales heredadas, descriptores adicionales cerrados y
sin leer .env. El protocolo transmite únicamente MIME, tamaño, hash y bytes;
no transmite JWT, usuario, propiedad ni caso. El padre no decodifica la respuesta
con Pillow: verifica el marco, dimensiones y hash sin pickle ni ejecución de datos.

El worker fija límites duros antes de importar Pillow y leer los datos:

| Recurso | Límite |
| --- | --- |
| Espacio de direcciones por worker | 512 MiB (RLIMIT_AS, no equivalente a RSS exacto) |
| CPU por worker | 3 segundos |
| Espera del padre | 8 segundos en communicate; creación de proceso depende del SO |
| Tamaño de archivo de salida | 16 MiB + 4096 bytes de marco |
| Descriptores del worker | 32 |
| Core dump | Deshabilitado |
| Concurrencia | 2 workers por proceso padre, rechazo inmediato al saturarse |

Ante timeout se mata el grupo de procesos y se espera al hijo; los archivos
temporales se eliminan y se libera la plaza también ante fallo. stderr se descarta
para no propagar datos privados de un decoder. Los errores expuestos son genéricos.
El resultado no aprueba nada, no escribe en Storage y no ejecuta modelos.

**Límite de la protección:** estos límites contienen bloqueos y consumo del decoder;
no son un sandbox frente a ejecución nativa arbitraria. El proceso conserva el UID,
el acceso a archivos permitido a ese UID y la posibilidad de crear conexiones de
red. Antes de una API pública: contenedor/proceso dedicado sin privilegios, sin
red, sin secretos montados, código de solo lectura, tmpfs limitado, cuota agregada
de memoria/PIDs y pruebas de RLS. Dos workers por proceso no es una cuota global
si hay varios servidores. La llamada es síncrona: desde FastAPI debe programarse
fuera del event loop con capacidad acotada. Cloudflare Workers no ofrece este
modelo de subprocesos Linux; requiere backend compatible separado.

Pruebas de esta etapa: 11 nuevas pruebas con procesos reales, incluyendo límite CPU,
memoria, salida, timeout con reap del proceso, variables/descriptores no heredados,
saturación, respuesta inválida, recuperación y rechazo de plataforma no soportada.

## Siguiente etapa: contenedor offline

La configuración y prueba reproducible están en
[`containers/dl/README.md`](containers/dl/README.md). Su validación real requiere
Docker en Linux y cgroup v2; no fue ejecutada en el entorno de edición. No conecta
Storage, no cambia el backend activo y no habilita inferencia ni aprobación.
