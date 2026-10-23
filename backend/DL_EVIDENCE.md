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
El procesamiento sigue en proceso: desplegar únicamente tras añadir aislamiento,
cuotas de CPU/RAM, timeout, límites de concurrencia y pruebas de acceso con RLS.
Ver la auditoría y plan en `docs/audits/2026-10-23-continuation.md`.
