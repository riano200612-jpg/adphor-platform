# Miss ADPHOR · Informe semanal QA de consulta privada · 20-11-2026

Primer incremento de integración real a Informes y el chat de Miss ADPHOR.

La consulta revalida sesión propia con Supabase Auth, MFA AAL2 y membresía actual por copropiedad; jamás acepta el alcance propuesto por el navegador sin comprobarlo contra el servidor. Usa solo SELECT con RLS y límites de 5.000 registros por fuente. Los datos ausentes o no legibles aparecen como NO DISPONIBLE y se bloquea cualquier mezcla entre copropiedades.

Las 43 copropiedades se consultan únicamente si el administrador corporativo tiene membresías autorizadas en todas ellas. Los demás perfiles solo consultan su copropiedad seleccionada. Los cálculos de tareas terminadas y cumplimiento permanecen NO DISPONIBLE por falta de conciliación temporal. Las reuniones importadas NO son reservas Calendar en vivo.

El PDF puede guardarse desde imprimir y el CSV de respaldo es seguro contra fórmulas de Excel. Los PDF/XLSX profesionales independientes de validación se generaron como archivos reales en el ciclo V10, pero todavía no se guardan en Storage de ADPHOR ni se generan automáticamente en el navegador. Ninguna ejecución automática, envío, modelo IA o aprobación ha sido activada.
