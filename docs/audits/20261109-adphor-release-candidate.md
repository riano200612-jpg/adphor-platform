# Candidata de consolidación de ADPHOR · 9 de noviembre de 2026

Base QA: `590508630f196b45e4dce92b341e7605f3ebc020`. Comparación contra `codex/flujo-mantenimiento`: 73 commits exclusivos de QA, 0 exclusivos de producción, 86 archivos modificados. Estado: borrador para revisión; promoción bloqueada.

## Matriz de compatibilidad

| Área | Integrado en la base candidata | Control previo a producción |
|---|---|---|
| Identidad y login | Portal común, invitación y recuperación | Probar callbacks y perfiles sobre Auth de producción con identidades autorizadas. |
| MFA y RLS | Flujo de inscripción y verificación; reglas QA adicionales | Validar AAL1/AAL2 y membresías en producción; excluir padrón y concesiones de QA. |
| Cloudflare | Job QA limitado a rama, entorno y verificaciones | Verificar configuración de Pages y Access por entorno y mantener el bootstrap exclusivo de QA. |
| Home y reuniones | Consulta verificada por propiedad, formulario y acompañantes | La fuente histórica de QA tiene 32 eventos importados puntualmente; autorizar fuente y esquema para producción. Probar horarios, conflictos, 24 h y buffer. |
| Visitas y agenda | Módulos y flujos existentes | Demostrar alta, cambios, cancelación, persistencia y aislamiento en un candidato controlado. |
| PQRS | Radicación, campos de ubicación y evidencias QA | Validar compatibilidad de datos, adjuntos privados, historial, cierre y recarga. |
| Personal y fotos | Carrusel filtrado y fotos privadas; activación de fotos vinculada al endpoint QA | Separar configuración por entorno sin ampliar permisos; validar esquema, buckets y asociaciones aprobadas de producción. |
| Miss ADPHOR | Chat existente | PR #28 separado. CI 42722750047 aprobado; prueba AAL2 real y autorización de integración QA pendientes. RAG debe reutilizar esta aplicación. |

## Migraciones y datos

Revisar las migraciones compartidas de fotos, directorio y campos PQRS contra un respaldo restaurable de producción. Los SQL de `qa/database`, las concesiones temporales, importadores y funciones de snapshot/evidencia exclusivas de QA no forman parte del lote SQL de promoción. Documentar una lista explícita de archivos aprobados con orden, precondiciones, RLS, comprobaciones de lectura/escritura y reversión. Verificar que el pipeline no ejecute migraciones por coincidencia de directorio.

Master: 43 copropiedades conciliadas, ID 0 excluido. Retener las 30 claves con versiones distintas en Registros y las 46 de Historial Ediciones. Conservar todas las versiones y su trazabilidad de origen. Las diferencias de Copropiedades, Info Copropiedades, Registros, PQRS, Delegados e Historial Ediciones requieren cotejo de destino y aprobación por registro. No copiar filas, usuarios, objetos, secretos ni eventos QA a producción.

## Promoción y reversión

1. Registrar SHA activo, Deployment ID, configuración y respaldo verificable de esquema, datos y objetos afectados. Probar restauración en un entorno controlado.
2. Fijar variables y secretos independientes, validar que el artefacto candidato apunta al destino previsto y comprobar que el preview exige Access. Excluir controles de importación y bootstrap de QA.
3. Ejecutar CI del SHA final y pruebas autenticadas 0–7, pruebas negativas AAL1 y membresía ajena, y comprobaciones de fotos, recarga, móvil y rendimiento. Registrar evidencia por requisito.
4. Revisar el diff, migraciones y compatibilidad de datos. Obtener autorización explícita para promover el SHA y la ventana acordados.
5. Aplicar solo las migraciones aprobadas y desplegar. Verificar SHA, Deployment ID, sesiones, reuniones, visitas, PQRS, agenda y Storage.
6. Si falla un control crítico, detener la promoción y volver al despliegue anterior. Si el esquema impide usar el frontend anterior, aplicar la reversión ensayada o restaurar el respaldo con revisión de escrituras posteriores al corte.
