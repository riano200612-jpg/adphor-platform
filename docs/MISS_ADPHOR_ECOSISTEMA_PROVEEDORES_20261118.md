# Miss ADPHOR — Ecosistema operativo y catálogo de proveedores

**Fecha:** 18 de noviembre de 2026. **Entorno:** única QA Integral. **Estado:** preparación, sin servicio ejecutor ni catálogo real.

## Visión y límites

Miss ADPHOR representa la interfaz virtual que coordinará el enjambre de Operaciones, Análisis, Informes, Usuarios y Seguridad, PQRS, Visitas, Calendar, Incidencias y Proveedores. Ningún agente recibe permisos implícitos por ser el orquestador: cada capacidad debe ser autorizada por un backend, RLS y un humano cuando produce efectos importantes.

## Incremento implementado

- La interfaz de Miss reconoce consultas sobre averías y proveedores; ofrece clasificación provisional por reglas, especialidad sugerida y guía hacia Recorridos.
- Gas, humo e incendios requieren intervención de servicios oficiales de emergencia y personal autorizado; no hay instrucciones para reparar instalaciones peligrosas.
- El motor Python `adphor_ai/provider_triage.py` valida el ámbito de copropiedad, rol administrativo, MFA AAL2 declarado por el llamador, aprobación registrada, vigencia y especialidad de un catálogo sintético. **No está conectado a Supabase ni desplegado**. No puede verificar un JWT por sí mismo.
- Produce hasta cinco candidatos ordenados, únicamente con ID, nombre y especialidad. No devuelve teléfonos, correos, identificaciones, precios o contratos.
- Las propuestas llevan SHA-256 y quedan pendientes de aprobación humana. No generan órdenes de servicio, comunicaciones, contrataciones ni cambios de usuarios.
- Una propuesta de retroalimentación revisada se reduce a referencias, categoría, decisión, versión y hash. El modelo NO se entrena y NO se guarda información.
- Dos botones nuevos del chat: **Ecosistema Miss** y **Reportar avería**. Son consultas de solo lectura.

## Contrato de entrada propuesto para la futura base de proveedores

Se requiere el archivo autorizado, todavía no entregado. La futura ingesta en QA deberá mapear: `id(uuid)`, `project_id(text)`, `display_name`, `specialties(text[])`, `status(approved|inactive|suspended)`, `verified_at(timestamptz)` y `valid_until(timestamptz)`. Es un contrato de software provisional, sujeto a conciliación con los archivos originales y la normativa aplicable.

Los datos de contacto, contratos y pagos deberán permanecer en un almacenamiento de acceso restringido. La aprobación interna no constituye una certificación externa de idoneidad del proveedor. No inventar proveedores.

## Gate para avanzar con datos reales

1. Recibir e inventariar la base oficial de proveedores con autorización y controles de privacidad. No copiar a prompts de modelos.
2. Revisar y aplicar migración exclusivamente en Supabase QA con RLS, acceso a AAL2, estado de pertenencia en vivo, principio de mínimo privilegio y pruebas negativas anónimo/AAL1/otra copropiedad/revocación.
3. Integrar Worker privado `adphor-ai-qa` y Service Binding Pages; sin endpoint público ni clave service_role expuesta. El servicio todavía está bloqueado.
4. Ejecutar matching con catálogo real ya validado por backend, no tomando el parámetro de rol o MFA del navegador como prueba.
5. Crear bandeja de alertas **sin envío externo predeterminado**, con severidad, responsable, evidencia y confirmación de administración. Un desastre real exige protocolo de emergencia, no esperar a la IA.
6. Implantar monitoreo, versionado, deduplicación, human-in-the-loop, retención y ciclo de retroalimentación supervisado con aceptación humana.
7. Certificar revocación de usuarios, rutas de acceso y reportes sin escrituras autónomas; proteger los datos de empleados/clientes y auditar cada intervención.

## Estado de otras capacidades

| Componente | Estado comprobado con este incremento | Próximo gate |
| --- | --- | --- |
| Miss y navegación | Orientación contextual y clasificación provisional por reglas | E2E QA real |
| Proveedores | Motor puro offline y pruebas adversarias | Base real, RLS, conexión privada |
| Reportes | Servicios existentes de consulta/reglas | Certificación de fuentes, firma humana |
| Seguridad y usuarios | Auditoría de lectura existente | Backend de operaciones con doble autorización según riesgo |
| Aprendizaje | Propuesta minimizada en memoria | Datos lícitos, revisión, evaluación, registro y activación explícita |
| Alertas | Solo texto de recomendación, nada enviado | Bandeja persistente, roles, pruebas controladas |

**Ninguna migración ni cambio remoto de Supabase/Cloudflare se ejecuta en este PR. Producción permanece intacta.**

### Validación

- Node: `npm test` incluye `tests/miss-incident-guidance.test.js`.
- Python: `PYTHONPATH=backend/src python -m unittest discover -s backend/tests -p 'test_*.py'` incluye `test_provider_triage.py`.
- CI de QA debe pasar, y se debe verificar el SHA de Pages antes de declarar un despliegue.
