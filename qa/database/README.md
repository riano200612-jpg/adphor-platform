# Contrato de integración exclusivamente QA

No ejecutar esta migración en Supabase del cliente. Es un contrato mínimo,
independiente en esquema adphor_qa, no la migración completa del negocio.
Generada con Supabase CLI 2.81.3. Prerrequisitos: rol authenticated y auth.uid().

Ejecutar localmente: `npm ci --ignore-scripts` y `node qa/database/test-contract.mjs`.
El ejecutor crea PostgreSQL embebido efímero PGlite y usa claims sintéticos; no
certifica PostgREST, Storage ni JWT reales. No conecta a Supabase.

Se prueba FK de asignación aprobada, copropiedad, tipo, duplicados, lectura por
membresía, denegación de escritura y revocación. Índices: copropiedad/fecha y
copropiedad/categoría. IDs QA-A/QA-B: UUID terminados en 001/002.

La tabla assignments representa exclusivamente decisiones aprobadas previamente;
los roles de aplicación no tienen escritura. Falta integrar la autorización del
administrador que registra esa decisión, FK de approved_by a Auth, catálogo
maestro, compuerta de incidencias y revocación de correspondencias. No habilitar
agentes reales con este contrato parcial. La migración candidata anterior no
imponía la relación entre mapeo aprobado y actividad: este contrato prueba esa FK.

Reversión en QA efímero: destruir la instancia de prueba. El test además elimina
las cinco tablas en orden de dependencias, sin CASCADE, y el esquema. Nunca usar
esa limpieza en producción. Para una migración final se requiere revisión del
DDL de producción, respaldo, verificación de dependencias y autorización específica.
