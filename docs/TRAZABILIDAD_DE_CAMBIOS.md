# ADPHOR — Trazabilidad técnica

## Campos mínimos de una revisión

| Campo | Ejemplo de información necesaria |
| --- | --- |
| Módulo | Identidad, PQRS, visitas, calendario, etc. |
| Rama y SHA | Identificador completo del código examinado |
| UI y servicio | Rutas exactas |
| Backend/SQL | Endpoint, contrato o migración relacionados |
| PR | Enlace y estado al momento de consultar |
| Evidencia | Prueba aislada, E2E, autenticada, aceptación |
| Seguridad | Rol, copropiedad y MFA comprobados sin secretos |
| Limitaciones | Dependencias o casos no cubiertos |
| Decisión | Qué se considera listo, bloqueado o pendiente |

```text
Módulo:
Rama@SHA:
Código UI -> servicio -> contrato:
PR y estado:
Tipo y fecha de prueba:
Resultado: NO_VERIFICADO | PASS | FAIL | BLOCKED
Permisos/ámbito revisados:
Limitaciones:
Próximo control:
```

Este bloque es una **plantilla**, no un resultado. No altere documentos históricos para actualizar un estado: cree una nueva evidencia con fecha y SHA.

Para localización de tests: [Matriz de módulos](MAPA_DE_MODULOS.md) · [Calidad](CALIDAD_Y_PRUEBAS.md).