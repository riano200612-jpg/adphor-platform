# ADPHOR — Inicio rápido de ingeniería

Esta guía prepara **una copia local aislada** para lectura y pruebas sintéticas. No habilita conectores, identidades, importaciones ni datos reales.

## Requisitos

- Git, Node.js 22 o superior, npm.
- Python para pruebas del backend cuando corresponda; el workflow de QA examinado utiliza Python 3.13.
- Chromium de Playwright únicamente cuando se ejecuten E2E.
- Un directorio separado de cualquier copia que contenga originales privados o cambios sin guardar.

## Clonar QA Integral para revisión

```bash
git clone --branch qa/integral-claude-reviewed-20261111 --single-branch https://github.com/riano200612-jpg/adphor-platform.git adphor-revision-qa
cd adphor-revision-qa
git status --short
git rev-parse HEAD
```

La última orden identifica el SHA realmente descargado. Para revisar `main`, utilice otra carpeta o GitHub; no sobrescriba un checkout en uso.

## Pruebas locales orientativas

```bash
npm ci
npm test
npm run build
```

```bash
npx playwright install chromium
npm run test:e2e
```

```bash
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
```

Estos comandos no publican la aplicación. Sin embargo, **revise el contenido de scripts y el entorno antes de ejecutarlos**, especialmente si configura variables locales o usa datos que no sean sintéticos.

## Restricciones

- No suba claves, `.env`, tokens, originales de José ni archivos reales.
- No ejecute migraciones o importaciones en servicios de la organización.
- No active sincronización de calendario, comandos IAM ni almacenamiento documental.
- No deduzca funcionamiento certificado de un build correcto.

Si algo falla, registre comando, rama/SHA, versión de runtime y error sin secretos. Vea [Calidad](CALIDAD_Y_PRUEBAS.md).