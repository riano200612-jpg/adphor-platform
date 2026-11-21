# Contribuir a ADPHOR

Repositorio público para consulta; los cambios requieren permisos de GitHub y revisión.

## Antes de proponer cambios

1. Revisar [la orientación para ingeniería](docs/GUIA_PARA_JOSE.md) y [arquitectura](docs/ARQUITECTURA_GENERAL.md).
2. Seleccionar la rama de referencia y registrar SHA; `main` no refleja necesariamente QA Integral.
3. Buscar propuestas abiertas del mismo módulo.
4. Aislar un cambio lógico por PR e incorporar pruebas de regresión cuando corresponda.
5. No publicar archivos originales privados del cliente, datos personales, secretos ni capturas sensibles.

## Estructura de un PR

**Objetivo · Base/HEAD SHA · Archivos · Pruebas y entorno · Riesgos · Seguridad/roles/RLS · Limitaciones · Reversión · Aprobación requerida.**

## Revisión local de código en un clon aislado

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
```

Antes de ejecutar revise scripts/variables de la rama. Los comandos no sustituyen pruebas autenticadas. Consulte [Inicio rápido](docs/INICIO_RAPIDO_INGENIERIA.md) y [Calidad](docs/CALIDAD_Y_PRUEBAS.md).

## No realizar por limpieza

No borrar backups, forzar ramas, cerrar PR, mover el código original, modificar migraciones, secretos ni conectar sistemas externos. Todo cambio de funcionamiento necesita revisión y aprobación separadas de la documentación.

**Definición de evidencia:** código presente ≠ PR integrado ≠ validación aislada ≠ aceptación del cliente.