# Visitas QA — Ensayo AAL2 preparado, NO autorizado ni ejecutado

## Límites

Usar únicamente Supabase QA y el portal ADPHOR QA previamente certificado. No aplicar migraciones ni crear cuentas. `qa_visits`/`qa_create_visit` ya existen. `VITE_VISITS_SQL_ENABLED` sigue apagado por defecto. El flag controla la interfaz y el adaptador; no sustituye RLS ni revoca los privilegios SQL existentes.

La certificación de escritura está BLOCKED hasta autorizar el piloto concreto y disponer de sesión AAL2 real. No usar el acceso administrativo SQL ni los claims sintéticos de PGlite para certificarlo.

## Datos que se deben revisar antes de autorizar

- SHA/Deployment ID del artefacto QA protegido y copia de las variables no secretas relevantes.
- Identidad existente con correo validado, MFA y rol admin/coordinator de la copropiedad seleccionada.
- Project ID autorizado y responsable Auth con membresía de esa misma copropiedad; no sustituirlo por un ID del directorio de empleados.
- Motivo explícito `QA-PILOTO-VISITA-<identificador de auditoría>`, fecha/hora aprobadas en America/Bogota.
- Una sola solicitud nueva. Conservar el request_id generado al revisar. La aprobación debe incluir reintentos idénticos y pruebas negativas acotadas.
- Aprobación separada de la habilitación temporal del flag en el artefacto QA. No cambiar Access, MFA, RLS ni privilegios para que pase la prueba.

## Ejecución posterior a autorización

1. Ingresar por Access y Supabase Auth con la identidad existente, completar TOTP oficialmente. No copiar tokens, contraseñas o códigos al chat ni a archivos de evidencia.
2. Registrar únicamente el nivel AAL devuelto por el SDK oficial y el resultado de la sesión validada; nunca imprimir el JWT. Corroborar que la solicitud efectiva pasa la política RLS AAL2. Un factor verificado por sí solo no basta.
3. Tomar el conteo inicial del conjunto acotado Project ID/identificador de auditoría. No asumir que el conteo global seguirá en cero cuando se ejecute.
4. Abrir Visitas, seleccionar datos revisados, revisar y confirmar. No mostrar éxito hasta que RPC devuelva una sola fila con autor, proyecto, solicitud, responsable, motivo y horario coincidentes.
5. Reintentar con el MISMO request_id y datos, probar doble clic y comparar el registro. Debe persistir una fila nueva, no dos. Un request_id nuevo no prueba idempotencia.
6. Consultar por Project ID/request_id, registrar identificador SQL y valores esperados. Recargar el portal y volver a autenticarse/MFA si se exige; no modificar persistSession para evitar esa verificación. Releer el mismo registro.
7. Probar rechazo de AAL1, rol viewer, identidad sin membresía y responsable ajeno con identidades existentes y autorizadas para pruebas. Si no existen, mantener esos casos BLOCKED; no crear usuarios ni ampliar membresías automáticamente.
8. Reutilizar clave con contenido diferente: debe devolver conflicto sin alterar la fila. Otra identidad no puede reclamar el reintento del autor original.
9. Registrar pantallas sin secretos y respuestas HTTP sin cabeceras de autorización. Separar evidencia administrativa, cliente autenticado y navegador real.
10. Finalizar la ventana de prueba y volver al flag apagado según la autorización. Conservar la fila sintética claramente rotulada para auditoría. No borrarla ni alterar RLS: la tabla no ofrece DELETE al cliente y cualquier limpieza administrativa necesita aprobación independiente.

## Estados del producto

Programada significa únicamente programación guardada. No significa realizada ni cerrada. El contrato actual no registra ingreso/salida, resultados, adjuntos o cierre. Estas funciones no se simulan ni habilitan mediante columnas inventadas.

## Aceptación y reversión

PASS requiere evidencia real de AAL2, autorización, fila única, reintento, recarga y aislamiento. Los tests locales son preparación, no aprobación remota. Si falla un control, detener la habilitación; no cambiar políticas para resolverlo. Revertir interfaz/flag no elimina registros ni invalida automáticamente tokens. No se requiere ni se autoriza rollback destructivo de esquema.
