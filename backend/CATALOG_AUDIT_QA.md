# ADPHOR — Control de correspondencias previo al enjambre

ESTADO: CANDIDATO QA / NO DESPLEGAR. Esta validación no conecta agentes ni autoriza lectura real.

## Datos de entrada

Se requieren cuatro CSV exportados localmente por un administrador autorizado:
- Maestro: hoja Copropiedades, columnas ID_Copropiedad y Copropiedad.
- Información ampliada: Info Copropiedades, mismas columnas.
- Actualización Datos Copropidades, mismas columnas.
- Eventos: Registros, columnas ID_Registro y Copropiedad.

Nunca subir los CSV reales, PIN, contactos, fotografías o registros a GitHub o al historial CI.

## Ejecución desde la raíz del repositorio

    PYTHONPATH=. python -m unittest backend.tests.test_catalog_audit -v
    PYTHONPATH=. python -m backend.src.adphor_ai.catalog_audit --master /ruta/privada/Copropiedades.csv --info /ruta/privada/Info_Copropiedades.csv --updates /ruta/privada/Actualizacion.csv --events /ruta/privada/Registros.csv

El validador es local y no escribe en Drive ni Supabase. Reporta cambios de nombre asociados a IDs, registros sin correspondencia e IDs de eventos repetidos. Devuelve estado 2 si existen conflictos de integración. Los campos mapping_approved y gate_open SIEMPRE son false.

## Protocolo de aprobación (obligatorio)
1. El cliente identifica cuál es el catálogo oficial.
2. El administrador de datos revisa IDs, alias y versiones de eventos sin alterar el origen.
3. Aprobación de mapeos hacia el identificador real de copropiedad en SQL; nunca por similitud de nombre.
4. Pruebas de aislamiento A/B en staging aislado, con identidades y JWT reales, RLS y revocación.
5. Cierre verificado de incidencias críticas de seguridad.
6. Aprobación humana explícita antes de habilitar lectura real.

No equiparar registros de reuniones con tickets de mantenimiento. No asignar automáticamente source_record_id a public.projects.id. Las pruebas de este PR son sintéticas y NO certifican seguridad productiva.
