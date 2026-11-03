# Auditoría de origen y migración ADPHOR — 2026-10-31

## Resultado verificado
- Cloudflare Pages despliega rama `qa/premium-ux-20261030`, HEAD `4e82991720e9fae7d033a92be625f323285d5d2d`, Access protege el dominio y previews. **Desplegado no equivale a datos migrados**.
- Supabase conectado: existe **un único proyecto ADPHOR**, `oqizvirqjwbbhyyjpthq`; las tablas operativas observadas incluyen solo 1 proyecto, 2 memberships, 7 tickets y 21 eventos. La base es el proyecto ya existente: **NO usar para importación experimental sin aislamiento**.
- El ZIP autorizado `adphor-codigo-integracion-qa.zip` contiene 32 archivos fuente (7 Reuniones, 25 Portal), además de dos entradas de directorio. Los originales no están copiados íntegramente ni funcionando en la rama premium.
- El portal original contiene `Portal Team ADPHOR`, identidad #264B6B / #b59c21, estilos en `portal/StyleSheet.html`, lógica en `portal/JavaScript.html`, pantalla en `portal/Index.html`, y un controlador de avatar con estados. La interfaz premium todavía no es idéntica.
- Foto corporativa **original** encontrada: Drive > Fotos Delegados > `0. Miss ADPHOR.png`. La copia comprimida debe instalarse solo como recurso corporativo aprobado, no mediante enlace privado Drive.
- La rama `codex/import-appsscript-client-qa` contiene inventario y adaptador, **no una migración efectiva**. No confundir su rama con la premium.
- El frontend actual conserva modo demostración; los adaptadores `legacy-project-catalog`, `legacy-delegate-adapter` y `legacy-meeting-adapter` **preparan candidatos**, no importan ni concilian registros en una base.
- PQRS permite elegir archivos y mostrar previews; la subida real está deshabilitada hasta que haya Storage y metadatos con RLS.
- Las métricas offline del enjambre existen, pero no se ha conectado una fuente real autorizada ni un conjunto de evaluación supervisado. **No entrenar con los datos reales del cliente todavía**.

## Migración controlada — bloqueos verificables
1. **Base QA aislada:** no encontrada en la cuenta Supabase actual. Necesaria para probar datos personales sin alterar el único proyecto existente. Una rama o proyecto de pago necesita aprobación de costo; como alternativa preparar PostgreSQL aislado sin datos personales en CI.
2. **Fuente de verdad y mapeo:** conciliar las copropiedades y reuniones de los maestros de José por ID, no por nombre o fila; registrar origen, rechazos, hash, conteos y aprobaciones.
3. **Datos sensibles:** no subir a GitHub PIN, contraseña, correos, identificadores privados de Google, perfiles personales, fotos de empleados o extractos completos de hojas.
4. **Carpeta de fotos:** distingue avatar corporativo de imágenes del personal. El carrusel solo podrá mostrar perfiles autorizados en storage privado.
5. **Autorización:** auditar y probar RLS de PostgreSQL y Storage con dos identidades de copropiedades diferentes, acceso cruzado, expiración y revocación.
6. **Agentes:** comenzar por pruebas reproducibles y casos históricos autorizados; medir calidad y latencia con evaluación humana. Sin aprendizaje autónomo, cierres ni comunicaciones.

## Criterios para declarar entrega
- Comparación por archivo de los originales de José y funciones conservadas.
- La imagen corporativa correcta se muestra en ingreso, sin enlaces privados ni tokens.
- Datos migrados con conteos origen/destino y rechazos auditados en infraestructura QA verificada.
- Calendar, PQRS, Recorridos, Mantenimiento y Enjambre unidos por identidad y copropiedad, con persistencia y pruebas E2E.
- Cloudflare Access comprobado y CI exitoso sobre SHA desplegado.
- Para pruebas de correo/WhatsApp: simulación restringida a destinos QA, sin envíos reales.

## Conciliación puntual de la fuente Master (solo metadatos, sin datos personales)
- Hoja `Copropiedades`: **40 filas no vacías** en `A1:AD1000` de `master_portalADPHOR_demo_murano`.
- Hoja `Delegados`: **45 filas no vacías** en el mismo rango.
- Hoja `Reuniones`: **16 filas no vacías** en el mismo rango.
- Estos conteos identifican **la fuente concreta consultada**, no todos los respaldos y no equivalen a registros válidos, únicos o elegibles. Reconciliar IDs y otros maestros antes de importar.
- Supabase ADPHOR actual: **1 proyecto**. Diferencia no conciliada; **0 registros certificados como migrados de esta fuente a QA aislado**.
- Copropiedades/delegados y registros completos de reuniones: NO almacenados en GitHub ni en datos de demostración.
