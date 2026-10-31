# Ingesta segura de Master_Portal_v4 — auditoría estructural 2026-10-31

## Origen
Archivo recibido por canal privado: `Master_Portal_v4 (1).xlsx` (5,5 MB). El original **no se publica ni se copia a GitHub**. Es una fuente confidencial de datos operativos, personales y potencialmente de autenticación.

## Inventario de hojas (24)
**Catálogos/identidad:** `0_Copropiedades`, `0_Info Copropiedades`, `1_Colaboradores`, `Residentes`, `Residentes_History`.

**Agenda y operación:** `Reuniones`, `Historial Edicion Reuniones`, `Copia de Reuniones`, `Métricas Reuniones Meet`, `Visitas`.

**PQRS:** `PQRS`, `PQRS_Master`, `Copia de PQRS_Master`, `PQRS_Log`, `Historial PQRS`.

**Seguridad, históricos y auxiliares:** `PreguntasRecuperacion`, `Hoja 11`, `Hoja 7`, `Temp`, `Logs`, `Historial Ediciones Test`, `Archive_Registros`, `Registros_Test`, `Copia de Archive_Registros`.

## Precaución sobre conteos
El archivo contiene decenas de miles de filas **serializadas** en catálogos. Esto puede deberse a formato aplicado a filas vacías; el conteo de filas XML NO es el número de registros. **No declarar migración ni conteo operacional a partir de esas cifras.**

## Mapeo previsto a ADPHOR
1. `0_Copropiedades` → catálogo de proyectos y correspondencias de identificadores.
2. `0_Info Copropiedades` → información de cada entidad con campos sensibles segregados.
3. `1_Colaboradores` → personas/roles, sin publicar fotografías, credenciales ni identificadores privados.
4. `Residentes` y `Residentes_History` → identidad y trazabilidad privada, NO iniciar sesiones ni copiar secretos.
5. `Reuniones` e historial → agenda autorizada por copropiedad con deduplicación y política de 24h.
6. `Visitas` → recorridos/visitas con seguimiento.
7. `PQRS`, `PQRS_Master`, `PQRS_Log` → expediente, estado y trazabilidad.
8. Copias, logs y `Registros_Test` → fuentes auxiliares, NO importar como operaciones vivas sin conciliación.
9. `PreguntasRecuperacion` → cuarentena: **no migrar respuestas/preguntas de seguridad a GitHub ni al nuevo método MFA**.

## Bloqueos antes de importación real
- Crear o identificar una base QA aislada, con autorización de costo si aplica.
- Enumerar filas lógicas no vacías, identificadores estables, duplicados, claves foráneas y conflicto de versiones. Nunca confundir filas formateadas con registros.
- Definir clasificación de confidencialidad campo por campo, consentimiento/legitimación de datos personales, retención y restricciones de acceso.
- Implementar importador solo-servidor con staging privado, dry-run, manifest de hash, mapeo y reject log. Nada de claves privadas en `VITE_*`.
- Probar RLS con dos perfiles y dos copropiedades, idempotencia, reversión y reconciliación contra el origen.
- No usar los datos brutos para entrenar el enjambre. Empezar por evaluación minimizada, supervisada y auditada.

## Estado de esta entrega
**Inventario del archivo realizado; cero filas importadas por esta operación.** No se modificó Supabase ni Google Apps Script, no se enviaron notificaciones y no se publicó contenido personal.
