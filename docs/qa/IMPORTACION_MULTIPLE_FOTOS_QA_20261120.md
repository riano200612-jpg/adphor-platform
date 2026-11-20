# ADPHOR QA Integral · importación múltiple privada de fotografías
Fecha: 2026-11-20

## Alcance
Solo usuarios administradores corporativos previamente autenticados con MFA AAL2 pueden importar fotos pendientes desde **Equipo corporativo**. Ni producción ni hojas de José se modifican.

## Procedimiento de certificación
1. Extraer localmente las 7 imágenes del paquete privado preparado; **no cargar el ZIP directamente**.
2. Entrar a la única QA Integral con credenciales personales vigentes, completar MFA AAL2 y acceder a **Equipo corporativo**.
3. En la sección **Importación múltiple de fotografías**, seleccionar las siete imágenes simultáneamente.
4. Revisar las 7 asociaciones antes de pulsar **Importar 7 fotografías verificadas**; no deben aparecer imágenes rechazadas.
5. El navegador procesa cada foto secuencialmente y exige autorización AAL2 y permiso corporativo en cada transacción. Tras cada confirmación, el directorio actualizado muestra el retrato privado.
6. Verificar Supabase QA: conteo de miembros con foto y auditoría de importación, sin datos públicos. En la siguiente sesión el directorio debe conservar las fotos.

## Controles
- Identificador de archivo y nombre deben corresponder con la ficha corporativa.
- Una foto existente **no se sustituye**. Una selección duplicada no se importa.
- Solo JPEG/PNG/WebP auténtico; 10 MB máximo. El servicio confirma los bytes reales y el servidor impone bucket privado y permisos.
- No crea usuarios, credenciales, PIN o bypass de MFA. No publica imágenes en GitHub.
- La importación se detiene ante el primer error para evitar continuar tras una sesión vencida.
- Quedan por conciliar: delegate-45, 49, 50 con imágenes de iconos genéricos y delegate-54 con nombre de ficha inválido.
