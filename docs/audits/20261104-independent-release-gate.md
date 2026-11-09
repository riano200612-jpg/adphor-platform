# ADPHOR — Puerta de publicación QA (verificación independiente 2026-11-04)

## Confirmado mediante lectura directa de Supabase

Proyecto **adphor-qa** `qfctnnnnltghepwujpdm`: ACTIVE_HEALTHY, independiente de producción `oqizvirqjwbbhyyjpthq`.

Consulta de solo lectura: 43 filas en `public.projects`; 8 tablas de `public` con RLS habilitado; 0 buckets públicos; existe `qa-case-evidence` privado con límite de 20 MiB; no existe `public.qa_property_photos`.

## Verificado en GitHub

La rama `qa/pqrs-carrusel-integracion-20261104` contiene el commit de aprovisionamiento `fb44aac906d74ce49a0a60184d0861ff22e635f8`. El documento de ese commit registra las migraciones y la importación. Esta nota certifica únicamente las observaciones independientes arriba, no la funcionalidad completa.

## Bloqueos de publicación

- Fotografías y colaboradores reales: falta esquema aprobado, importación privada, correspondencias y prueba autenticada de lectura.
- PQRS: no existe prueba E2E autenticada de radicado, archivo y asociación persistente.
- Seguridad: auditar las funciones SECURITY DEFINER y políticas de almacenamiento, incluyendo aislamiento entre copropiedades.
- Despliegue: falta confirmar Cloudflare Access, URL asociada al SHA, navegación, MFA y pruebas reales en navegador.

## Regla de entrega

Mantener los avances en rama QA; no fusionar a `main` ni activar flags de datos privados o publicación hasta aprobar las verificaciones. No presentar un enlace histórico como despliegue actualizado. Ningún dato personal ni secreto debe entrar al repositorio.

## Siguiente bloque autorizado

1. Diagnosticar la migración rechazada de medios, sin reintentos ciegos.
2. Revisar y aprobar SQL/políticas para QA aislado.
3. Crear usuarios de prueba y membresías autorizadas.
4. Ejecutar E2E de PQRS y lectura de fotografías con RLS.
5. Desplegar preview protegida y verificarla; registrar SHA y URL exactos.
