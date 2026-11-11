# ADPHOR QA — Access, Pages y recorrido autenticado

**11 de noviembre de 2026 · Colombia. Resultado global: BLOCKED. No se autoriza publicación con esta evidencia.**

## Alcance y base

Se verificó el HEAD remoto antes de modificar: candidata `6ae113fde8703c4fe9ace9aac00d589e1dbe5147`; QA consolidada `590508630f196b45e4dce92b341e7605f3ebc020`; producción `1cfc33bd76f3163635ac60db1432d230a3a2098b`. No se asumió que un SHA GitHub fuese un deployment. No se desarrollaron cambios de Agenda/PQRS/Visitas en paralelo a Claude.

## A. Access y autenticación administrativa

El panel oficial redirigió a `https://dash.cloudflare.com/login`. El propietario eligió Google mediante autenticación segura y seleccionó su cuenta disponible. Cloudflare devolvió **Unable to sign in. Try again or use your email and password.** Se detuvo ese intento: no se cambió de método, cuenta o navegador para intentar eludir el rechazo. No se inspeccionaron secretos ni se capturaron credenciales. La causa concreta del rechazo no fue expuesta por el sitio; no se atribuye a contraseña, permisos, bot detection o estado global del servicio.

| Control Access | Evidencia de esta fase | Estado |
|---|---|---|
| Aplicación / App ID / AUD | No hay sesión administrativa ni conexión oficial de lectura disponible | BLOCKED |
| Hostnames raíz/wildcard | Referencias previas no equivalen a configuración vigente | BLOCKED |
| Allow / Deny / Google / duración de sesión | Sin acceso al panel efectivo de políticas | BLOCKED |
| Alias QA, acceso anónimo | HEAD exacto al alias: HTTP 403, sin Location, sin seguir redirecciones, sin leer cuerpo; cf-ray presente | BLOCKED para atribuirlo a Access |
| Redirección a login Access | No observada: la comprobación HTTP devolvió 403 | BLOCKED |
| Usuario permitido | No se llegó a Access del portal ni a sesión de aplicación | BLOCKED |
| Usuario no permitido | No existe una segunda identidad con sesión legítima disponible para ese ensayo | BLOCKED |
| URL de deployment / wildcard | Deployment ID actual desconocido; no se inventaron hostnames | BLOCKED |
| Rutas sin protección | No se certificó cobertura global | BLOCKED |

No se visitó producción para probar el hostname raíz del proyecto. El 403 demuestra una respuesta denegada a esa petición, pero no identifica la capa que la produjo ni certifica la política correcta. No se accedió al Team Domain compartido ni se dedujo una asociación errónea por su nombre.

La captura privada entregada muestra solo el formulario vacío y el error. SHA-256: `f3daa16247731c72ea9679c53e4ff07b9ad1de629a40b9a068b4d1f79ba62291`. No contiene email, contraseña, cookies, JWT ni código TOTP. No se publica la captura ni una sesión privada en GitHub.

## B. Identidad de versión

| Elemento | Valor encontrado | Evidencia | Estado |
|---|---|---|---|
| GitHub candidata al inicio | `6ae113fde8703c4fe9ace9aac00d589e1dbe5147` | Conector oficial, commit de rama | PASS |
| GitHub QA consolidada | `590508630f196b45e4dce92b341e7605f3ebc020` | Conector oficial | PASS |
| Producción de referencia | `1cfc33bd76f3163635ac60db1432d230a3a2098b` | Conector oficial, sin modificar | PASS |
| Pages Deployment ID / estado / fecha | No obtenidos | Login administrativo rechazado | BLOCKED |
| Rama productiva y preview efectivas | No verificadas en proveedor | La configuración del repositorio y evidencia anterior no bastan | BLOCKED |
| SHA asociado al deployment | No obtenido | Requiere panel/API Pages | BLOCKED |
| URL exacta del artefacto | No obtenida | Solo se conoce el alias QA solicitado | BLOCKED |
| SHA servido al navegador protegido | No obtenido | Sin portal autenticado | BLOCKED |
| Publicación de la candidata | No demostrada ni ejecutada por Work | Sin deployment autorizado | BLOCKED |

El alias sujeto a comprobación fue `https://qa-pqrs-carrusel-integracion.adphor-platform.pages.dev/`. La consulta de estados combinados de GitHub sobre QA consolidada devolvió una lista vacía; no prueba ausencia de deployment ni sustituye Pages. No se dispone de credenciales Cloudflare de administración en el entorno de ejecución y la búsqueda de una integración disponible no encontró una conexión utilizable. No se solicitaron tokens por chat ni se crearon identidades o permisos.

## C. Configuración: fuente frente a proveedor

| Variable/control | Requisito o comportamiento versionado | Valor efectivo del proveedor |
|---|---|---|
| VITE_SUPABASE_URL | Proyecto QA exacto | BLOCKED |
| VITE_SUPABASE_ANON_KEY | Presencia requerida; el preflight exige tipo publicable; nunca se incluye el valor en el manifiesto | Presencia/tipo/alcance BLOCKED |
| VITE_REQUIRE_MFA | true obligatorio para build QA protegido | BLOCKED |
| VITE_VISITS_SQL_ENABLED | Apagado por defecto; adaptador exige habilitación booleana explícita | BLOCKED; no se cambió |
| VITE_ADPHOR_QA_READONLY | El nuevo build rechaza true en aplicación QA real para evitar fallback demo | BLOCKED |
| VITE_PORTO_QA_ENABLED / STAGING_REF | true / referencia QA exacta | BLOCKED |
| ADPHOR_PROTECTED_STAGING_QA / ACCESS_VERIFIED | Compuertas versionadas de build; no prueban que Access esté certificado | BLOCKED |
| ADPHOR_QA_ACCESS_BOOTSTRAP | Si se activa, publica solo la página aislada; no es aplicación funcional | BLOCKED |
| ADPHOR_QA_AGENTS_API_URL | Workflow lo mapea a VITE_AGENTS_API_URL | BLOCKED |
| Backend disponibilidad | Debe ser un servicio realmente desplegado; definir variable no lo despliega | URL/SHA/Deployment/OAuth BLOCKED |
| Build/output | Código Vite: dist y base raíz en Pages | Configuración efectiva Pages BLOCKED |

### Corrección segura incorporada

`publicQaBuildConfig` añade al artefacto `qa-auth-config.json` la rama, flags de lectura/escritura/bootstrap, presencia de clave pública y configuración del backend de agentes, sin publicar sus claves ni credenciales. El campo `buildConfigurationOnly` advierte que no acredita Access, AAL2 o conectividad real. El build rechaza clave ausente y modo readonly incompatible; el bloqueo runtime de demo permanece. No se modificó ninguna variable del proveedor.

## D. Pruebas independientes ejecutadas

- **325/325 JavaScript PASS**, incluidas dos nuevas pruebas de configuración; prueba dirigida Auth/build 15/15, subconjunto de las 325.
- **Build Vite, sintaxis y git diff --check PASS**.
- **Reproducibilidad PASS**: dos builds locales controlados de la fuente `88204d38abdc3a7193f7818a129206cfd8f462dc`, con 13 archivos idénticos por SHA-256. Clave dummy y flags sintéticos solo en procesos locales, no en Cloudflare. No son artefactos de una sesión real ni están publicados. SHA-256 del manifiesto de esa prueba: `e5c3e5b6827f8deca5b4782c55b495698499389f3c4087dcf975dd9e509723e4`.
- **RLS administrativa PASS limitado**: SELECT de metadatos en Supabase QA confirma RLS habilitada en memberships, profiles, pilot_pqrs, qa_meeting_events, qa_property_photos y qa_visits. Visitas conserva tres políticas, una restrictiva. El conteo de políticas no demuestra por sí solo autorización efectiva; los ensayos con JWT real siguen BLOCKED. No se consultaron datos personales ni se escribieron filas.
- **E2E sintético BLOCKED**: siete tests se recolectan. Este host es Linux x64 con memoria suficiente, pero falta el navegador requerido. Un único procedimiento de instalación oficial de Playwright terminó con error de ZIP incompleto/inválido y código 1. No se ejecutaron pruebas sin navegador, no se buscaron binarios alternativos ni se retomaron diagnósticos Crostini.
- Backend Python y contratos de negocio no cambiaron; sus evidencias anteriores no se presentan como nuevas pruebas autenticadas.

## E. Recorrido autenticado

| Módulo/operación de solo lectura | Estado | Evidencia que falta |
|---|---|---|
| Access → portal | BLOCKED | Configuración efectiva, Allow/Deny y sesión legítima |
| Login Supabase QA | BLOCKED | Ingreso real con URL/clave QA verificados |
| MFA/AAL2 y rechazo AAL1 | BLOCKED | Token concreto del flujo oficial, sin compartirlo; no inscribir nuevo factor sin autorización |
| Copropiedades asignadas y ausencia de demo | BLOCKED | Datos del portal autenticado y artefacto servido |
| Home/calendario/recarga | BLOCKED | Navegador autenticado |
| Reuniones/duración/acompañamientos | BLOCKED | Navegación real, equipo autorizado y Sin acompañamiento requerido |
| Verificación y cinco sugerencias | BLOCKED | Backend/OAuth corporativo y sesión AAL2 reales |
| Visitas: formulario/lectura/flag apagado | BLOCKED | Artefacto y lectura autenticada; no guardar en esta fase |
| PQRS: consulta/historial/clasificaciones | BLOCKED | Lectura autorizada, sin modificar datos |
| Agenda: consulta/filtros/Bogotá | BLOCKED | Pantalla autenticada; no reprogramar/cancelar |
| Miss ADPHOR | BLOCKED | Navegación contextual y avisos coherentes en la URL real |
| Directorio/fotos/carrusel | BLOCKED | Nueva comprobación visual por membresía; evidencia anterior del propietario conservada |

No se crearon usuarios, cambiaron contraseñas, registraron factores, activaron escrituras ni modificaron datos. No se presentó un mock como sesión AAL2.

## F. Plan de cierre

| Bloqueo | Responsable | Acción concreta | Riesgo/control | Autorización |
|---|---|---|---|---|
| Rechazo del login Google en Cloudflare | Propietario/admin Cloudflare | Revisar el rechazo desde una sesión legítima o habilitar una conexión oficial existente de solo lectura para ADPHOR | No cambiar SSO, Access ni usar otras cuentas automáticamente; no enviar secretos | Auditoría aprobada; cualquier nuevo permiso requiere aprobación separada |
| App ID/AUD/hosts/políticas desconocidos | Work con acceso administrativo válido | Leer aplicación ADPHOR, registrar raíz/wildcard, Allow/Deny, proveedor, sesión y logs sin JWT/cookies | No tocar otras aplicaciones ni inferir asociaciones por nombres | Solo lectura ya autorizada |
| Deployment/variables/rollback desconocidos | Work con acceso Pages | Leer adphor-platform: deployment QA vigente, ID, rama, commit, hora Colombia, URL, configuración no secreta y deployment anterior | Evitar producción y distinguir GitHub/deployment/servido | Solo lectura ya autorizada |
| Navegador Playwright local ausente | Operador QA/Work | Ejecutar la plantilla existente en host compatible autorizado con binario oficial; plantilla sigue inactiva | Sin servicios corporativos ni diagnósticos ARM; no aprovisionar recursos de pago | Requiere entorno disponible; no se activó workflow |
| Sesión Supabase AAL2 del portal | Propietario/identidad autorizada | Autenticación oficial tras certificar Access; observar solo nivel y resultados, no token | No crear cuenta/factor ni enviar TOTP al chat | Recorrido de lectura ya aprobado |
| Publicación candidata | Propietario | Decisión separada después de controles y rollback verificados | No publicar solo por PASS unitario | NO autorizada en esta fase |

## G. Reversión y conservación

No hay cambios operativos que revertir: no se modificaron Cloudflare, Supabase, Google Calendar ni producción. La revisión de código puede revertirse con un commit inverso revisado, preservando avances concurrentes; no force-push ni merge a ramas protegidas. El Deployment ID previo y la posibilidad de rollback del proveedor **no están verificados**, por lo que no se declara listo el plan de despliegue. Se mantienen RLS, MFA y el flag de escritura de Visitas sin activación.
