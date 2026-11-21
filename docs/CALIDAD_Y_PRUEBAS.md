# ADPHOR — Calidad y comprobaciones

## Capas de evidencia

| Nivel | Dónde buscar | Qué demuestra | Qué no demuestra |
| --- | --- | --- | --- |
| Unitarias JS | `tests/*.test.js` | Reglas y contratos simulables | Autorización de usuarios reales |
| E2E | `tests/e2e/*.spec.js` | Navegación y experiencia de pruebas | Integración real automática |
| Python | `backend/tests/` | Contratos de dominio y gateway | Proveedores IA entrenados |
| SQL aislado | `supabase/tests/`, `qa/database/` | Contratos de DB con fixtures | JWT y Storage del proveedor en vivo |
| Gates QA | `qa/security/`, `.github/workflows/` | Reglas y controles de CI | Aceptación comercial por el cliente |

## Comandos en clon aislado

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
```

Los workflows se revisan en **la misma rama y SHA** del cambio. Esta documentación no está ejecutando pruebas de aplicación.

## Registro de calidad

Por cada prueba anotar: módulo, `rama@SHA`, comando, entorno, resultado y evidencia. Categorías: `CODIGO_PRESENTE`, `PR_EN_REVISION`, `INTEGRADO`, `VALIDADO_AISLADO`, `VERIFICADO_AUTENTICADO`, `ACEPTADO`.

Cambios de permisos, MFA, evidencias o documentos requieren comprobar denegación cruzada, caducidad y autorización con identidades de QA. Una prueba sintética nunca se declara equivalente a una prueba real.

Más detalle: [Trazabilidad](TRAZABILIDAD_DE_CAMBIOS.md).