# Respuesta a la auditoría independiente — preparación C1

30 de octubre de 2026, America/Bogota. Dictamen recibido y leído íntegramente, referido al SHA 8b2a5e4dc3cf366d7902fc29508ee440e6d76365.

Se mantienen las conclusiones: desarrollo QA permitido con correcciones; presentación integral con datos reales no aprobada; producción no autorizada. Ningún hallazgo se declara cerrado en esta actualización.

## Verificación del entorno

La consulta de proyectos conectados sólo muestra ADPHOR (proyecto actual con datos reales). No apareció staging separado. No se ejecutó SQL ni se crearon cuentas, factores, proyectos o recursos de pago. Tampoco se encontró docker, psql o supabase CLI en PATH de este entorno de ejecución.

## Implementación entregada

`qa/security/hosted_probe.py` prepara 13 comprobaciones de lectura con tokens reales cuando exista un QA independiente:

- Validación upstream de identidad A con aal1, A con aal2 y B con aal2 mediante /auth/v1/user.
- Existencia de dos PQRS sintéticas de A y dos de B, leídas con su identidad aal2.
- Denegación de aal1 y lectura cruzada de PQRS.
- Descarga autorizada del archivo sintético de A y de B en bucket privado; rechazo de lectura cruzada y de aal1.

El ejecutor bloquea la referencia productiva antes de conectar, usa sólo URL HTTPS derivada de una referencia QA válida y claves públicas. Rechaza claves privilegiadas y tokens sin rol authenticated, sin nivel esperado, con issuer distinto, sin cinco minutos de vigencia o sin las dos identidades distintas. La decodificación inicial de claims es sólo prevalidación: cada token debe ser validado por Supabase.

Las peticiones son sólo GET, con timeout, sin seguir redirecciones, sin usar proxy de entorno y con límite de respuesta. No se imprimen cuerpos de respuesta, JWT, claves, correos ni IDs de usuarios. Errores 5xx no cuentan como denegaciones válidas; una tabla vacía no permite pasar una prueba positiva. Un 404 de Storage sólo se acepta para la prueba negativa después de haber descargado con éxito el mismo objeto con su propietario.

**Alcance limitado:** no prueba escrituras, revocación, URLs públicas/firmadas, RPC privilegiadas, otros módulos ni concurrencia. No instala políticas RLS. No corrige por sí solo C1. Es un ejecutor de comprobación de lectura, no una certificación integral.

## Preparación del staging (no realizada)

En instancia independiente y autorizada se requieren: tablas candidatas existentes, projects qa-a y qa-b, dos usuarios sintéticos con membresías separadas, dos PQRS ficticias por propiedad, MFA TOTP configurada por el flujo autorizado y bucket privado `qa-security-probes`.

Objetos:
- `qa-a/probe.txt`, contenido exacto `ADPHOR qa-a SYNTHETIC PROBE` seguido de salto de línea.
- `qa-b/probe.txt`, contenido exacto `ADPHOR qa-b SYNTHETIC PROBE` seguido de salto de línea.

Se debe comprobar previamente que la referencia no contiene datos reales. El ejecutor no puede verificar la clasificación de todo el proyecto: esa revisión corresponde al administrador QA.

Variables locales, sin guardar valores en GitHub, capturas ni reportes: ADPHOR_QA_REF, ADPHOR_QA_PUBLIC_KEY, ADPHOR_QA_A_AAL1, ADPHOR_QA_A_AAL2, ADPHOR_QA_B_AAL2. Habilitación explícita para ese entorno: ADPHOR_QA_PROBES_AUTHORIZED=synthetic-only. No copiar tokens a la conversación.

Ejecutar `python qa/security/hosted_probe.py`. Códigos de salida: 0 comprobaciones delimitadas aprobadas; 1 fallo; 2 NOT RUN por configuración incompleta. No incluir estos tokens en Actions públicos.

## Evidencia de esta iteración

- 7 pruebas offline nuevas con httpx.MockTransport: contrato positivo, destino productivo bloqueado, respuesta vacía, fuga cruzada, 500, redirección y clave privilegiada. No conectan a Supabase.
- Suite Python: **103 pruebas aprobadas localmente**.
- Ejecución sin variables QA: **NOT RUN**, salida 2, como corresponde.
- Pruebas hospedadas con JWT reales: **NOT RUN**.

## Matriz de hallazgos

| Hallazgo | Estado tras esta entrega |
|---|---|
| C1 — RLS/MFA hospedada | Abierto; ejecutor de lecturas preparado, falta QA y matriz completa |
| A1 — reuniones transaccionales E2E | Abierto, sin cambios en esta entrega |
| A2 — staging protegido | Abierto; bloqueo Cloudflare conservado |
| A3 — importación/procedencia | Abierto, sin nuevas importaciones |
| M1 — selector con sesión real | Abierto; fixtures no sustituyen autorización hospedada |
| M2 — OTP/MFA destino | Abierto; requiere proveedor real y enforcement en todas las vías |
| M3 — PQRS/multimedia/comunicaciones | Abierto |

Siguiente dependencia: QA separado con usuarios/fixtures autorizados; aplicar y auditar políticas restrictivas AAL2 junto a membresías, probar tanto REST como Storage, añadir escrituras negativas y revocación. Referencia técnica consultada: https://supabase.com/docs/guides/auth/auth-mfa . No modificar políticas productivas para hacer pasar pruebas.

Reversión: revertir este commit de herramientas QA. No hay cambios de datos, cuentas ni infraestructura que revertir. Auditor independiente conserva la decisión de cierre y de promoción.
