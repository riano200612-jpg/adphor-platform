# ADPHOR — Guía de cinco minutos para José

Este es el punto de partida para revisar profesionalmente el trabajo de ADPHOR. El repositorio es público para **consulta**; la escritura requiere autorización expresa del propietario.

## Qué encontrará

- **Interfaz web:** Vite, JavaScript y CSS, con componentes y servicios.
- **Operación:** mantenimiento, tareas, PQRS, visitas, agenda y reuniones.
- **Identidad y acceso:** usuarios, membresías por copropiedad, IAM y MFA.
- **Asistencia:** Miss ADPHOR y núcleo Python con contratos de agentes.
- **Persistencia:** Supabase/PostgreSQL, políticas RLS y almacenamiento privado.
- **Calidad:** pruebas JavaScript, Playwright, Python y contratos SQL.

## Ruta de revisión recomendada

| Paso | Qué revisar | Enlace |
| --- | --- | --- |
| 1 | Arquitectura y separación de responsabilidades | [Arquitectura](ARQUITECTURA_GENERAL.md) |
| 2 | Qué módulos existen y dónde están | [Mapa de módulos](MAPA_DE_MODULOS.md) |
| 3 | Código de desarrollo más reciente en la integración | [QA Integral](https://github.com/riano200612-jpg/adphor-platform/tree/qa/integral-claude-reviewed-20261111) |
| 4 | Cambios en discusión antes de incorporarse | [Pull requests](https://github.com/riano200612-jpg/adphor-platform/pulls) |
| 5 | Seguridad, calidad y límites de uso | [Seguridad](SEGURIDAD_Y_DATOS.md) · [Calidad](CALIDAD_Y_PRUEBAS.md) |

## Importante al evaluar el avance

La rama predeterminada `main` muestra una base histórica. No la tome como inventario completo de los módulos QA. Una prueba sintética aprobada no certifica una operación con usuarios reales. Las fuentes originales del cliente y los documentos privados permanecen fuera del repositorio público.

Para una revisión local sin datos reales, lea [Inicio rápido](INICIO_RAPIDO_INGENIERIA.md). Para sugerir mejoras, consulte [CONTRIBUTING](../CONTRIBUTING.md).