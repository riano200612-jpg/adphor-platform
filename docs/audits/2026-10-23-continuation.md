# ADPHOR — auditoría y continuación, 23 de octubre de 2026

## Alcance y estado confirmado

Se contrastó el informe `ADPHOR_Informe_Traspaso_GPTWork_2026-10-23.md`, versión 2,
con GitHub, los cuerpos de funciones, privilegios, RLS y asesores de Supabase.
La inspección de infraestructura fue de solo lectura. No se alteraron cuentas,
datos, políticas, buckets, funciones ni configuración de despliegue.

| Elemento | Evidencia actual |
| --- | --- |
| main | `cd9748778daadde9fd998878921744565dce62e0` |
| PR #5 | Fusionado; incluye piloto por reglas, historial y revisión humana |
| PR #6 | Draft abierto, `c38c9b11d68cec76a122bb219fc3482ddb99b101` |
| PR #7 | Draft abierto, `daae1a8ecfc154532b94ac63f5a5dd0630e00370` |
| CI PR #6 | Run 39861058966, completed/success |
| CI PR #7 | Run 39955917921, completed/success |
| Base de datos | 1 copropiedad, 1 caso, 5 eventos, 1 decisión de borrador |
| Cuentas | 2 usuarios Auth y 2 membresías admin; no modificados |
| Storage | Bucket evidence privado; 2 MiB; JPEG/PNG/WebP |

Enlaces: [PR 6](https://github.com/riano200612-jpg/adphor-platform/pull/6),
[PR 7](https://github.com/riano200612-jpg/adphor-platform/pull/7),
[CI ML](https://github.com/riano200612-jpg/adphor-platform/actions/runs/39861058966),
[CI DL](https://github.com/riano200612-jpg/adphor-platform/actions/runs/39955917921).

La evidencia del bot de Cloudflare en PR #6 muestra despliegues preview automáticos.
No se dispone de verificación directa de la configuración vigente de ramas en
Cloudflare ni de la URL pública de FastAPI. Un check verde de Pages no demuestra
que Python esté desplegado. No se publicó esta rama: hacerlo podría disparar un
preview experimental sin la autorización requerida. No hubo merge ni despliegue.

## Hallazgos de seguridad y decisiones

### P1 — funciones privilegiadas: revisión por función

El asesor mantiene cinco avisos de SECURITY DEFINER ejecutable por authenticated.
Las cinco tienen search_path vacío, anon sin EXECUTE y referencias cualificadas.
Esto reduce riesgos; el aviso por sí solo no demuestra explotación.

| Función | Control observado | Acción propuesta |
| --- | --- | --- |
| project_role | Consulta membresía por auth.uid() y copropiedad | Mantener hasta diseñar helper privado: membership_read la invoca y un cambio directo a INVOKER puede causar recursión RLS |
| visible_profile | Identidad propia o copropiedad compartida | Revisar traslado a esquema no expuesto, conservando la política; no revocar a ciegas |
| ticket_command | Auth, membresía, versión, estado y pertenencia de evidencias; cambios mediante RPC | Conservar autorización explícita; probar rechazo de casos ajenos y bloqueo de fila antes de autorizar; no convertir a INVOKER sin rediseñar escrituras |
| monthly_report | Exige membresía; consulta datos por proyecto | Candidata a INVOKER: validar todos los SELECT y las políticas en staging antes de migrar |
| finalize_monthly_report | Auth y admin/coordinator, mes terminado, lock, inserción idempotente | Diferencia con aprobación final exclusiva del Administrador: proponer admin-only y adaptar UI/pruebas antes de aplicar |

La aprobación del enjambre ya es admin-only. El cierre del informe mensual es otro
flujo: hoy permite coordinador. No se cambió producción para resolver esta diferencia.
`ticket_command` también permite cierre humano de casos por coordinador; no existe
cierre automático de agentes. La política de quién verifica casos debe distinguirse
de la aprobación final de un informe.

`rls_auto_enable()` tiene EXECUTE denegado para anon y authenticated.
RLS está activo en todas las tablas inspeccionadas de public y storage.
`agent_reviews` impide insertar administrator_id o decided_at desde authenticated,
impide UPDATE y deniega INSERT(decision) a service_role. Se mantiene la aprobación
humana vinculada al hash exacto, con una sola decisión por ejecución.
Una prueba READ ONLY bajo authenticated con UUID sin membresía devolvió 0 casos,
0 ejecuciones y 0 objetos visibles; no sustituye pruebas completas de múltiples
tenants y roles con fixtures en staging.

### P1 — credenciales y permisos residuales

Persisten permisos TRUNCATE/REFERENCES/TRIGGER de service_role sobre seis tablas
operativas (profiles, memberships, projects, tickets, ticket_events, monthly_reports).
No se probaron operaciones destructivas. TRUNCATE no está controlado por RLS y no
es una operación normal de la API REST, pero ese rol no debe tratarse como un rol
mínimo. Antes del backend público: revisar/revocar privilegios residuales mediante
migración probada y aislar el escritor. Los modelos nunca reciben la clave privada.
El asesor también mantiene protección contra contraseñas filtradas desactivada.
No se modificó Auth; las opciones de alta pública y acceso anónimo descritas en el
informe no fueron verificadas de nuevo mediante configuración de Auth en esta sesión.

Remediación oficial:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### P1 — evidencias y Storage

El validador del PR #7 aceptaba `cabecera PNG + prueba` con hash correcto. Una prueba
nueva falló con el código original y pasó después de la corrección. Hash y cabecera
comprueban integridad/tipo preliminar, no decodificabilidad ni veracidad de la escena.

Storage separa copropiedades por el primer segmento de ruta. La subida exige que el
segundo segmento sea el usuario y un rol operativo. La lectura permite a cualquier
miembro de la copropiedad ver sus objetos, incluidos objetos aún no vinculados a
casos. No hay políticas UPDATE/DELETE sobre evidence. La RPC verifica objeto y ruta
al adjuntar; el INSERT de Storage no prueba que el caso exista. No endurecer esa
política sin contemplar que el flujo actual sube antes de crear el caso.

Próximo adaptador DL: Auth verificado + membresía actual; resolver la referencia
exacta desde el caso autorizado y su historial, nunca una URL suministrada por el
cliente/modelo; descargar de evidence con JWT humano y RLS, límite streaming de
2 MiB, timeout, concurrencia limitada, sin redirects y sin service_role; preservar
hash original; procesar secuencialmente en proceso aislado sin red/secretos; entregar
solo copia preparada al modelo. Probar acceso ajeno, objeto no adjunto, permisos
revocados, respuesta sobredimensionada, timeout y objeto cambiado. El modelo no
puede listar, subir, sobrescribir, borrar ni generar URLs firmadas. No se descargaron
fotos reales ni se implementó conexión activa a Storage en esta entrega.

### P2 — rendimiento y operabilidad

El asesor reporta 3 FKs sin índice cubriente y 4 índices sin uso. No borrar índices
con una sola fila como evidencia. Revisar planes de tickets.created_by y
monthly_reports.finalized_by bajo carga real. La FK compuesta de agent_reviews
incluye run_id, que ya es PK única: analizar antes de duplicar índices.
El log postgres consultado (ventana por defecto últimas 24 horas) no devolvió
mensajes ERROR/FATAL; no es una certificación de salud de todos los servicios.
La prueba existente de informe con 10.000 casos sintéticos en PGlite tardó 97 ms
esta vez; no representa concurrencia, latencia ni capacidad productiva de Supabase.

## Cambio implementado sobre PR #7

Rama local `codex/dl-decoder-hardening-20261023`, basada en `daae1a8`.
No se duplicó el validador ni se mezcló la rama ML.

- Mantiene EvidenciaDL, validar_manifest y verificar_archivo; añade preparar_imagen.
- Pillow 13.0.0 fijado en requirements-dl.txt; el workflow instala la dependencia.
- Entrada máxima 2 MiB, 12 millones de píxeles, 8192 por dimensión.
- Formatos permitidos explícitos; verify y reapertura/load de los mismos bytes.
- Rechazo de corrupción, truncamiento detectado por decodificador, animaciones,
  bombas de descompresión y configuración global que tolere truncamiento.
- Corrige orientación EXIF, reduce copia a 2048 por dimensión, compone transparencia
  sobre blanco y re-encodea PNG desde píxeles nuevos sin copiar metadatos.
- Conserva hashes original/preparado. El original no se sobrescribe ni se sube.
- Endurece validación de tipos MIME/hash. No añade red, credenciales, inferencia,
  aprobación, cierre ni envío al módulo.

La copia es un insumo de inferencia, no un reemplazo forense. Una imagen con bytes
adicionales que el decoder admita puede producir una copia válida: esos bytes no se
reenvían. No es escáner de malware, detector de rostros ni anonimizador de contenido
visible. El decodificador corre en proceso y no impone límite duro de CPU/RAM;
aislamiento de proceso/contenedor con cuotas es obligatorio antes de exponer una
API para archivos no confiables. Los límites de resolución son política provisional
que debe revisarse con fotos reales autorizadas. Esta entrega sigue siendo offline.

## ML: reproducción y límites

Se ejecutaron 64 pruebas del commit c38c9b1 y se reprodujo el pipeline sintético:
83/31/32 ejemplos; umbral 0.443363; TP 6, TN 18, FP 6, FN 2; precisión .50,
recall .75, F1 .60, Brier .128177. Calidad experimental False, producción False.
No se alteraron parámetros para hacer pasar el criterio ni se generó historia falsa.
Una sola incidencia y cinco eventos no permiten mejora demostrable con datos reales.

Plan de datos: definir escalamiento a 7 días con negocio; registrar evento observado,
caso/versión, instante de corte, fecha de maduración, revisor humano e identificador
de decisión verificable. `validado_por_admin=True` no prueba por sí mismo identidad.
Construir features históricas solo con eventos anteriores al corte, no con estado
actual; pseudonimizar exportación, versionar dataset y guardar hash de particiones.
Separar entrenamiento, selección de umbral y evaluación final temporal reservada;
retener purga de siete días y agrupación por caso. Revisar balance y suficiencia
por clase, intervalos de confianza y coste de falsos negativos con gerencia.
Comparar con reglas y no ajustar al conjunto final. Calibración probabilística y
selección de umbral son tareas distintas. No entrenar con fotos/PII por defecto.

## Plan priorizado y criterios de salida

1. P1: revisar previews Cloudflare y acordar publicación del cambio DL sin activar
   componentes; revisar diferencia admin/coordinator y preparar migración separada.
2. P1: validar este cambio de decodificación con revisión humana del diff y CI;
   aislar el proceso antes de integrar acceso a Storage. Modelo visual aún ausente.
3. P1: staging con dos copropiedades y todos los roles; probar Storage/funciones,
   ajustar permisos mínimos y sólo después proponer migraciones de producción.
4. P2: capturar etiquetas históricas auténticas y auditar dataset; evaluación ML
   independiente sin promover el modelo hasta aprobación explícita y métricas reales.
5. P2: adaptadores DL/PLN versionados; PLN con cifras calculadas y referencias,
   pruebas de inyección en texto/OCR y validación humana de afirmaciones.
6. P2: informe ejecutivo con gráficos y fuentes, fechas de corte y decisión exacta;
   pruebas de carga y observabilidad antes de puesta en producción.

## Validación de esta entrega

- Regresión reproducida antes del fix: cabecera PNG falsa aceptada (test falló).
- 51 pruebas Python de la rama DL corregida: OK (36 anteriores + 15 nuevas).
- 64 pruebas Python ML en worktree separado: OK; resultados sintéticos reproducidos.
- npm test: 20 pruebas OK, incluida base de datos PostgreSQL local PGlite.
- npm run build: OK. No hubo cambios de UI.
- Pruebas locales Python 3.12; CI preparado mantiene 3.13, usuario usa 3.11.
- No se ejecutó CI remoto del nuevo cambio ni se afirma que esté aprobado.
- Aviso no bloqueante de Starlette TestClient/httpx; seguimiento separado.

## Referencias técnicas consultadas

- https://pillow.readthedocs.io/en/stable/reference/Image.html (open es lazy; verify no sustituye load; bombas de descompresión)
- https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/changelog/cbc-tls-ciphers-deprecated (cambio futuro desde 10/11/2026; mantener TLS moderno)
