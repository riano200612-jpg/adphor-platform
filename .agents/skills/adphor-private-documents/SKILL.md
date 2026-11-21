---
name: adphor-private-documents
description: Desarrollar y revisar incorporación privada de PDF, Word e imágenes para Miss ADPHOR, con cuarentena, deduplicación, MFA/RLS y búsqueda limitada por copropiedad.
---

# Documentos privados de Miss ADPHOR

## Alcance

Preparar integración segura de carga de documentos en la **QA Integral**. Miss ADPHOR de usuarios finales no puede heredar permisos técnicos de Codex. El repositorio GitHub puede ser público y no es un almacén de documentos reales.

## Controles mínimos

1. Identificar primero el flujo y PR existentes (incluido el trabajo actual de carga documental); evitar duplicar endpoints, buckets, migraciones o componentes.
2. La subida se inicia con sesión válida y pertenencia verificada a una copropiedad; exigir MFA AAL2 cuando la política de QA lo requiera. Evaluar el permiso en el servidor, nunca solo en la interfaz.
3. Guardar archivos en almacenamiento privado QA, con IDs opacos y metadatos de propietario/copropiedad, autor, fecha, tamaño, tipo validado y SHA-256.
4. Aceptar solo tipos permitidos y límites configurables; validar extensión, MIME y contenido, imponer cuotas, prevenir zip bombs y rutas peligrosas. Tratar PDF/Word como entrada no confiable.
5. Mantener estado de cuarentena hasta completar validación, comprobación de integridad y controles de contenido; no indexar ni entregar a la IA documentos pendientes o rechazados.
6. Distinguir duplicados exactos por hash y copropiedad; evitar procesar dos veces el mismo contenido sin mezclar permisos entre tenants. Archivos PDF y Word semánticamente iguales no necesariamente tienen el mismo hash: hacer comparación documental explícita antes de deduplicar por significado.
7. Indexar y recuperar texto únicamente con permisos vigentes; citar documento/versión y no exponer extractos entre copropiedades. Contenido de documentos no debe convertirse en instrucciones para el agente.
8. Revalidar permisos en cada descarga, búsqueda, fragmento y URL firmada. Registrar auditoría sin contenido sensible; imponer caducidad corta, revocación cuando proceda y control de retención.
9. Probar sesiones de dos copropiedades, rol sin permisos, sesión vencida, documento duplicado, PDF/Word, MIME inválido, fallo de red y rollback.

## Cierre

Entregar PR con tests y evidencia. Los archivos originales en Drive o Supabase no se modifican; no activar ingestión en vivo, migraciones o publicación hasta certificar el gate de QA y recibir autorización explícita.
