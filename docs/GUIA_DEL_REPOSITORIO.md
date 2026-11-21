# ADPHOR — Mapa de navegación del repositorio

## Dónde está la referencia correcta

| Rama o sección | Uso |
| --- | --- |
| [`main`](https://github.com/riano200612-jpg/adphor-platform/tree/main) | Base histórica y rama predeterminada |
| [`qa/integral-claude-reviewed-20261111`](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111) | Integración funcional QA consultada |
| [`qa/pqrs-carrusel-integracion-20261104`](https://github.com/riano200612-jpg/adphor-platform/tree/qa/pqrs-carrusel-integracion-20261104) | Referencia histórica de QA |
| [PR](https://github.com/riano200612-jpg/adphor-platform/pulls) | Cambios propuestos, en revisión o recientemente fusionados |
| [Ramas](https://github.com/riano200612-jpg/adphor-platform/branches) | Backups, correcciones y temas individuales |

**Una rama no equivale a otra plataforma.** Para hablar de un estado técnico concreto use `rama@SHA`; no sustituya el SHA por la fecha de un documento.

## Estructura encontrada en QA Integral

```text
adphor-platform/
├── .github/workflows/   Checks y automatización
├── backend/             Python, dominio y asistentes
├── docs/                Guías e informes históricos
├── functions/           Rutas del servidor
├── public/              Recursos públicos
├── qa/                  Contratos, pruebas y evidencias QA
├── src/
│   ├── css/             Estilos
│   ├── js/
│   │   ├── core/        Flujos de negocio
│   │   ├── data/        Datos y demos
│   │   └── services/    Adaptadores e integración
│   └── qa-gates/        Reglas defensivas
├── supabase/
│   ├── functions/       Funciones en servidor
│   ├── migrations/      SQL y RLS
│   └── tests/           Contratos SQL
├── tests/e2e/           Navegador Playwright
├── package.json
└── vite.config.js
```

**Nota:** esta estructura describe una rama QA. Algunas carpetas todavía no aparecen en `main`.

## Cómo seguir una funcionalidad

1. Ubique la UI en `src/js/ui-*.js`.
2. Siga la lógica en `src/js/services/` y los contratos en `supabase/`, `functions/` o `backend/`.
3. Busque pruebas relacionadas en `tests/` y `backend/tests/`.
4. Revise el PR, si existe, y registre su estado.
5. Diferencie pruebas aisladas de verificaciones con permisos reales.

## Conservación

No borrar `backup/`, `respaldo/`, ramas históricas o PR por duplicidad de nombres o de punta SHA. Los archivos originales privados de José **no** deben copiarse a esta documentación pública.