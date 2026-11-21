# Colaborar en ADPHOR

Este repositorio es público para consulta. **El acceso de lectura no concede permisos de escritura.** Los permisos de colaboración los administra el propietario en GitHub.

## Antes de abrir un cambio

1. Identifique el módulo y la rama base correcta; no dé por vigente `main` para trabajo de QA Integral.
2. Revise los PR del área para evitar duplicar correcciones.
3. Presente el alcance, riesgos, archivos afectados y criterios de aceptación.
4. Mantenga un cambio lógico acotado por propuesta. Aporte pruebas de regresión cuando cambie comportamiento.
5. Documente claramente qué está probado localmente y qué depende de validación con servicios autorizados.

## Calidad y pruebas locales

Para la aplicación JavaScript/Vite, use Node.js 22 o la versión que indique la rama que revise:

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Para las pruebas Python cuando corresponda:

```bash
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
```

Las pruebas adicionales de QA, PostgreSQL y seguridad se describen en sus workflows y guías específicas. **Los comandos anteriores son instrucciones, no pruebas ejecutadas por esta documentación.**

## Seguridad y privacidad

- No incluir secretos, tokens, contraseñas, PIN, `.env`, datos personales o expedientes reales en commits/PR.
- No copiar al repositorio público los originales privados de José o documentos de Drive.
- Mantener aislados datos de una copropiedad respecto de otra; requerir MFA AAL2 donde corresponda.
- No activar migraciones, operaciones externas ni cambios productivos como parte de una reorganización.
- La evidencia simulada debe etiquetarse como simulada; las capturas y logs se revisan antes de publicarse.

## Pull requests

Cada PR debe indicar: **objetivo**, **rama base**, **archivos modificados**, **pruebas realizadas**, **riesgos de seguridad**, **funciones externas aún no verificadas** y **plan de reversión**. No se fusiona un PR solo porque exista o se haya construido exitosamente.

## Documentación y navegación

Empiece por [la guía del repositorio](docs/GUIA_DEL_REPOSITORIO.md) y [el mapa de módulos](docs/MAPA_DE_MODULOS.md). Los historiales de auditoría se conservan como evidencia de su fecha; no deben confundirse con el estado operativo actual.
