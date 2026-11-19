# ADPHOR Guardian — Evaluación recíproca y camino mínimo seguro

**Destino único:** rama \`qa/integral-claude-reviewed-20261111\` y Supabase QA
\`qfctnnnnltghepwujpdm\`. No crear otra plataforma, no afectar
\`codex/flujo-mantenimiento\`, ni tocar archivos originales de José.

## Observación real (18-11-2026, lectura SQL agregada, no contenido personal)

| Fuente QA | Registros | Proyectos con registros |
|---|---:|---:|
| pilot_pqrs | 1 | 1 |
| qa_meeting_events | 32 | 27 |
| qa_visits | 1 | 1 |
| qa_visit_evidence | 1 | 1 |
| agent_runs | 0 | 0 |
| agent_reviews | 0 | 0 |

**No** hay observaciones suficientes de acierto/errores de agentes para
declarar ganadora una versión de IA ni para entrenar modelos. Las reuniones
no se equiparan a etiquetas humanas de calidad. No se han consultado aquí
descripciones PQRS, nombres, correos, imágenes ni documentos.

## Implementación de doble evaluación

\`backend/src/adphor_ai/guardian_mutual_eval.py\` implementa un gate
determinista y offline para rutas de ejecución QA:

1. **Quality Guardian:** prueba cobertura de pasos obligatorios, precedencias
   y duplicados; evalúa longitud de la ruta.
2. **Security Guardian:** comprueba alcance QA, lectura exclusiva de contadores,
   pasos conocidos y ausencia de acciones externas.
3. **Examen cruzado:** Quality comprueba las afirmaciones de Security y
   Security verifica de nuevo las afirmaciones de Quality. Cualquier fallo
   bloquea la ruta.
4. **Decisión reproducible:** entre las rutas correctas y seguras selecciona
   la más corta; el empate se resuelve por ID estable. La decisión únicamente
   recomienda un flujo interno de auditoría QA; no promociona modelos.
5. **Evidencia:** hash SHA-256 de agregados de origen, sin guardar datos
   personales. Datos inválidos o de producción son rechazados.

**Lo que NO es:** no son dos LLM en vivo, no hace entrenamiento automático,
no infiere calidad a partir de la cantidad de registros, no ejecuta
\`agent-runs\`, no escribe en Supabase, no envía correos, no altera
usuarios, permisos ni calendarios. Sus permisos no pueden ser aumentados
por la salida de ningún evaluador. La selección de versiones reales
requerirá pruebas etiquetadas suficientes y medición de resultados.

## Seguridad y despliegue

- Pruebas aisladas: \`PYTHONPATH=backend/src python -m unittest backend.tests.test_guardian_mutual_eval -v\`.
- Se integra solo en QA Integral tras CI Python, JS, Vite, Worker dry-run
  y Playwright. El módulo no tiene endpoints ni invocación automática.
- Sin credenciales en código ni fuentes originales modificadas.
- El backend remoto privado sigue BLOQUEADO hasta certificación
  Cloudflare Access, AAL2, scope por copropiedad, y binding de QA.
- Ningún cambio se autoriza en producción.

### Siguiente incremento

Integrar pruebas de salida contra casos reales minimizados y autorizados
por copropiedad, con etiquetas humanas o referencias verificables.
Antes de automatizar, obtener una medición de aciertos sobre muestras
válidas y fijar umbrales mínimos independientes del enjambre.
