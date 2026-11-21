# ADPHOR — Seguridad, datos y privacidad

**El repositorio es público.** No contiene autorización para copiar o consultar documentos privados del cliente.

| Frontera | Regla de ingeniería |
| --- | --- |
| Identidad | Validar identidad y sesión en servidor, no en el botón de la UI |
| Copropiedades | Limitar lecturas/escrituras a membresías y roles autorizados |
| MFA | Revalidar AAL2 cuando sea requisito de la política |
| Storage | Mantener evidencias privadas con permisos y enlaces temporales |
| Miss ADPHOR | Consultar solo fuentes aprobadas; no ejecutar efectos sin autorización |
| Integraciones | Respetar los permisos del sistema de origen y el principio de mínimo privilegio |

## No publicar en Git

Contraseñas, tokens, claves de servicio, `.env`, logs con `Authorization`, URLs firmadas vigentes, capturas con datos personales, expedientes o originales privados de José.

**Si se publica un secreto:** retirarlo del flujo activo no basta; gestionar rotación/revocación con el proveedor y tratar el historial por canal privado.

## Pruebas exigibles según el cambio

Para IAM y RLS, revisar accesos cruzados entre copropiedades, roles y MFA. Para documentos, revisar carga privada, lectura autorizada, expiración y denegación. Un archivo `qa` puede afectar servicios compartidos si se ejecuta fuera de su entorno previsto; nunca probar migraciones sin revisar el destino.

No publicar vulnerabilidades sensibles en issues abiertos: [SECURITY](../SECURITY.md).