# Auditoría de recuperación de código José — 2026-10-30 (solo QA)

## Fuente verificada
Drive: Proyecto ADPHOR / 99_BACKUPS / `20260219_Plataforma_Running.zip` (42 202 bytes comprimidos, 146 344 bytes de seis archivos). El archivo se leyó sin alterar la fuente.

| Archivo original | Tamaño en bytes | Funciones encontradas | Situación en plataforma premium |
|---|---:|---|---|
| `Código.gs` | 33129 | `validarUsuario`, `getCopropiedadesData`, `registrarEvento`, `buscarReunion`, `procesarGestionReunion`, `verificarChoqueHorario`, `getDuracionEstimada` | Traslado parcial: formulario y demo, no backend equivalente completo |
| `Index.html` | 87595 | Acceso, reloj visual, alta/búsqueda/edición de reunión, confirmación, presentación de tarjetas y navegación | Nuevo calendario premium, no equivalencia funcional certificada |
| `Calendario.gs` | 9367 | Crear, actualizar, eliminar evento y Google Meet | Sólo enlace/propuesta de calendario; no sincronización autenticada |
| `Correo.gs` | 4832 | `enviarNotificacion`, `construirPlantillaEmail` | Planificador de avisos sin entrega real; HTML original no copiado |
| `Utilidades.gs` | 10771 | Gestión de fotos, PIN, permisos, correos de delegados y borrado de pruebas | Excluido por cambios de permisos, secretos y efectos externos |
| `appsscript.json` | 650 | Configuración de servicios/scopes | No trasladar permisos amplios de Apps Script |

## Comparación técnica priorizada
1. **Conservar el contrato de reuniones:** registrar, consultar, editar, cancelar, confirmar, y mantener ID externo estable; evitar borrado+recreación Google Calendar.
2. **Migración de datos:** originales dependen de Sheets y Calendar; PostgreSQL QA necesita relación validada de copropiedad y usuarios, con RLS y transacciones. No declarar funcional la base por simples demos.
3. **Agenda:** implementar conflicto concurrente a nivel de base y excepciones gerenciales auditadas; el simulador local no valida permisos reales.
4. **Correos:** conservar plantillas corporativas, CC, confirmaciones y recordatorios; no enviar mensajes en QA sin aprobación específica.
5. **Interfaz:** preservar nomenclatura y recorridos de José, integrándolos con acceso premium azul/dorado; no inventar propiedades ni fotos.
6. **Origen protegido:** archivos originales no se modifican, sus IDs de Sheets/Calendar, usuarios, PIN y contenidos personales no se replican en este documento ni en el frontend.

## Riesgos de copia literal
- `GmailApp.sendEmail` y equivalentes producen efectos externos.
- `setSharing` puede cambiar la privacidad de fotos.
- Los auxiliares de borrado pueden afectar reuniones reales.
- Autenticación basada en PIN/Sheet debe reemplazarse con identidad gestionada y MFA.
- Los modelos de permisos del frontend no sustituyen comprobación en backend.

## Alcance pendiente
Este ZIP contiene la aplicación de reuniones del 19 de febrero de 2026; **no** acredita que se hayan recuperado todos los archivos del Portal ADPHOR, PQRS, multimedia, catálogos o backups posteriores. La recuperación integral exige enumerar cada fuente y conciliar hashes/filas con las copias existentes antes de ingesta.

## Próximo criterio de aceptación
Demostración autenticada de una reunión de la copropiedad correcta, persistida en PostgreSQL QA, visible desde otra sesión autorizada, con historial y reglas de colisión y 24 horas verificadas. Envíos externos desactivados. No subir el ZIP bruto al repositorio.
