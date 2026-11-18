# ADPHOR / Miss ADPHOR - Gobierno de conocimiento e informes para junta

**Corte de revisión: 18 de noviembre de 2026.** Destino de desarrollo: una sola QA Integral. Este incremento NO sube datos reales, NO ejecuta entrenamiento, NO cambia RLS ni despliega un Worker.

## 1. Fuentes originales verificadas en lectura de metadatos

- Drive contiene la fuente `Master_Portal_v4`, con 24 hojas de operaciones, PQRS, Visitas, Reuniones, colaboradores, residentes, copias y registros de recuperación. Se confirmó la estructura a nivel de metadatos, no se consumieron ni difundieron filas privadas.
- Existen otros libros `master_portalADPHORv2` y `master_portalADPHOR_demo_murano`; son versiones potencialmente divergentes y NO deben fusionarse sin conciliación.
- En los dos árboles consultados de Drive, las carpetas `03_PROCESAMIENTO_IA` y `04_PROVEEDORES` no tenían archivos directos visibles en la consulta. Eso no acredita que no existan proveedores en otras fuentes.
- La ingesta documentada en `docs/QA_REAL_DATA_INGESTION_POLICY_20261030.md` exige mantener los originales en Drive y separar PostgreSQL operativo y Storage privado; se conserva esa decisión.
- No se copió contenido privado al repositorio, al chat ni a un modelo. Esta revisión no autoriza importar datos personales.

## 2. Cadena segura de conocimiento y aprendizaje

**Etapas independientes: inventario -> clasificación -> revisión jurídica/privacidad -> autorización humana -> indexación privada por copropiedad -> búsqueda trazable -> evaluación -> curación humana de ejemplos -> entrenamiento separado, solo si se autoriza.**

- El módulo `backend/src/adphor_ai/knowledge_governance.py` produce exclusivamente un manifiesto de metadatos opacos, hash, versión, revisión y clasificación. Rechaza contenido crudo, otras copropiedades, duplicados, datos sin huella, acceso sin AAL2 o sin membresía vigente.
- La decisión `eligible_for_private_index_review` solo indica que un humano puede evaluar el origen; **no es permiso de indexación**.
- Datos de recuperación, credenciales, identidad de residentes, PQRS crudas, visitas/personales, comunicaciones y finanzas privadas quedan en cuarentena. Ninguna pregunta de seguridad entra al índice ni al entrenamiento.
- Una ficha de realimentación lleva huella del manifiesto, origen, versión, veredicto humano y evaluación aprobada. Queda como candidato a curación: `model_trained=false` y `persisted=false`.
- Toda verificación de usuario, MFA, rol y tenant proviene de servidor/Supabase, nunca de un campo que el navegador o el modelo pueda declarar por sí solo.
- Deben existir pruebas adversarias contra fuga entre copropiedades, prompt injection de archivos, falseamiento de citas, revocación de usuarios, poisoning de documentos y retención de datos antes de indexar.

## 3. Arquitectura de Miss ADPHOR

Miss es la experiencia conversacional y coordinadora lógica del ecosistema. Los agentes de Operaciones, Análisis, Informes, Seguridad, Usuarios y Proveedores trabajan por **capacidades separadas de privilegio mínimo**. El modelo propone y explica; la autorización del backend decide; una persona aprueba las acciones con impacto externo.

Prohibiciones por defecto: modificar usuarios o permisos, contratar proveedores, cerrar casos, emitir comunicaciones, cargar datos reales a modelos, crear reservas externas, entrenarse sola o alterar configuraciones Cloudflare/Supabase.

Si Salesforce es un sistema de registro corporativo externo, debe verificarse su conector, propietario de datos, alcance y controles antes de considerarlo origen autorizado. No se ha certificado conexión Salesforce-ADPHOR en este incremento.

## 4. Informes como artefactos de junta directiva

- El módulo existente de ADPHOR ya renderiza tarjetas KPI, gráficas, tabla de áreas y exportación CSV / impresión-PDF con cifras del reporte mensual QA.
- `src/js/services/miss-board-governance.js` añade una página estructurada: estado de certificación, conciliación, matriz de riesgos, decisiones propuestas de 30/60/90 días, evidencia cuantitativa, responsabilidad y estado de aprobación.
- `src/js/ui-reports.js` lo incorpora al PDF imprimible y al CSV. No extrae ni inventa información financiera, PQRS, proveedores o Google Calendar.
- Si el mes es parcial o no concilia, muestra estado de revisión y prohíbe interpretarlo como cierre oficial. Los informes siguen siendo BORRADORES hasta validación humana.
- No se genera aún firma criptográfica oficial del paquete desde backend: en el anexo consta explícitamente `Huella certificada: No disponible`. El servidor deberá definir firma/versión y retención antes de la certificación final.

## 5. Matriz de seguridad observada y bloqueos

| Control | Observación de 18/11/2026 | Requisito antes de datos reales |
|---|---|---|
| Cloudflare Access | Aplicación sobre `*.adphor-platform.pages.dev` | Certificar allow/deny anónimo, AAL1, AAL2, roles y revocación |
| Backend del enjambre | `adphor-ai-qa` y Service Binding ausentes | Desplegar privado y verificar tenant/JWT activo sin service_role en navegador |
| Supabase QA | Registro `agent_runs` / `agent_reviews` 0 filas | Validar RLS, permisos y controles negativos reales |
| Funciones SECURITY DEFINER | 9 advertencias del advisor | Revisar cuerpo, grants y tests antes de alterar funciones activas |
| Auth contraseñas | Protección de filtradas deshabilitada | Evaluar y habilitar con aprobación del propietario |
| Originales de Drive | Maestro y versiones históricas disponibles | Clasificar por campo, retención, propietario, copia inmutable, manifest y reversión |
| Salesforce | Integración operativa no certificada | Definir si es fuente de verdad y conectar con OAuth/scopes mínimos |

Referencias: `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable` y `https://genai.owasp.org/llm-top-10/`.

## 6. Puerta GO/NO-GO para cargar contenido real

**NO-GO** hasta que: (1) se identifiquen fuentes y responsable, (2) se clasifiquen permisos y finalidad, (3) se pruebe denegación entre tenants/AAL1/anónimo y revocación, (4) se certifique el backend privado, (5) se establezcan trazabilidad/hash, idempotencia y borrado, (6) se evalúe la seguridad contra inyección de instrucciones en documentos y (7) se apruebe un piloto mínimo. Nunca volcar el archivo maestro completo.

Para iniciar puede prepararse un lote **pequeño, no personal y explícitamente aprobado** de manuales y procedimientos. El entrenamiento de modelos es una fase posterior a la recuperación privada con citas y evaluación humana; cargar documentos no es entrenar.

**Pruebas de este incremento:** suites JavaScript/Python sobre datos sintéticos; CI Vite y Playwright. No deben describirse como certificación de datos reales.
