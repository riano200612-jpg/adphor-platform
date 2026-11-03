# ADPHOR — recepción y preconciliación 2026-11-03

**Ámbito**: QA y staging privado. **No es certificación de importación.**

## ZIP recibidos (inmutables)
| Fuente | Archivos | Excel | Imágenes | SHA-256 del ZIP |
|---|---:|---:|---:|---|
| media-20261103T134407Z-1-001.zip | 103 | 0 | 103 | `1bb4d282c7d2ac157451893dfce58b56f08357051ea24df287e74df571483371` |
| 01_BASE_DE_DATOS-20261103T134139Z-1-001.zip | 117 | 7 | 110 | `79e2613ffe82bd2b94e2cd9db102a8313c1e711b6f04688cbc25a8cf0bf2809b` |

**Total** 220 entradas con 129 contenidos SHA-256 distintos (duplicados entre paquetes y copias internas). El inventario privado detallado no debe publicarse: las rutas de fotos identifican personas.

Libros: `Master_ADPHOR.xlsx`, cuatro variantes `Copia de Master_ADPHOR...`, `Copia de Master_ADPHOR(1).xlsx`, `Copia de Master_ADPHOR(2).xlsx`, `Actualización Datos Copropidades.xlsx`. El maestro contiene 22 hojas, incluidas `Registros`, `Métricas Reuniones Meet`, `Visitas`, `PQRS`, `Copropiedades`, `Delegados`, `Historial Ediciones` y `PIN`. **No publicar ni importar hojas PIN sin auditoría y rotación.**

## Supabase
Proyecto existente `oqizvirqjwbbhyyjpthq`. Nueva migración **`qa_private_uploaded_archives_manifest_20261103`** crea `adphor_import_private.qa_uploaded_archives`: RLS habilitada, privilegios anon/authenticated revocados y sin políticas. Se insertaron dos hashes y conteos con `import_state=inventory_only`. No se almacenaron bytes de ZIP, fotografías, filas Excel, identificadores personales ni contraseñas.

Ya existen 755 filas de origen, 40 candidatas de copropiedades y 16 candidatas de reuniones en esquemas privados, **no son compromisos agendados**. Antes de cada inserción realizar conciliación por clave estable y origen, revisión de duplicados (algunos nombres/ID inconsistentes), aislamiento multitenant y aprobación humana. NO ejecutar UPSERT contra `public.tickets`, `public.memberships` ni proyectos reales para importar estas hojas.

## Carrusel QA
`qa/simulacion-operativa.html` incorpora carrusel horizontal con navegación, teclado, estados `aria-pressed`, selección múltiple y botón `Sin acompañamiento requerido`. Usa roles y avatares de texto ficticios (no fotografías de empleados). Requiere autenticación, selector de copropiedad y autorización de cada delegado antes de suministrar fotos reales firmadas desde Storage privado; la UI deberá denegar respuestas de otra copropiedad.

## Matriz de incorporación
| Hoja / medio | Destino previsto | Política |
|---|---|---|
| Copropiedades / Fotos Copropiedades | Catálogo de proyectos autorizado + storage privado | Conciliar IDs antes de asociar |
| Delegados / Fotos Delegados | Asignaciones y carrusel de acompañantes | RLS por copropiedad, consentimiento para fotos |
| Registros / Métricas Reuniones | Agenda y analítica de reunión | Distinguir histórico de reservas operativas |
| Visitas | Módulo Visitas | Importación idempotente con histórico |
| PQRS | Gestión PQRS | Datos sensibles, acceso mínimo |
| PIN | Ningún módulo de UI | Revisar y rotar; NO importar contraseñas/PIN |
| Historial Ediciones | Evidencia de auditoría privada | Inmutabilidad y procedencia |
| imagenCorporativa | Branding privado / assets aprobados | Confirmar derechos y eliminar metadatos |

## Próxima puerta de integración
1. Resolver protección efectiva de URLs de preview en Cloudflare (el control Pages falla al crear política). No usar previews abiertas con datos de clientes.
2. Almacenar ZIP originales y fotografías en **Storage privado** con comprobación de integridad. Esta transferencia **no está realizada** por falta de canal seguro de subida binaria al entorno.
3. Ejecutar ETL local/seguro sobre archivo maestro con reporte de discrepancias. Aprobar mapeos antes de escribir tablas activas.
4. Validar tests RLS hosted/JWT sobre dos usuarios de propiedades distintas.
5. Reprobar UI, MFA, PQRS, agendamiento y carrusel conectado a API; publicar solo después de las pruebas.

**Progreso verdadero:** inventario y trazabilidad importados a Supabase; carrusel simulado integrado. **Pendiente:** archivos binarios, filas de libros y integración real de los módulos.
