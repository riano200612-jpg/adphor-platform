# ADPHOR — entrega técnica y sincronización VS Code (2026-11-02)

## Alcance de este ciclo
- Referencia visual recuperada de `portal/StyleSheet.html` del repositorio PRIVADO de José: `--bg-color:#264B6B`, `--gold:#b59c21`, `--bg-darker:#1e3b54`, `--off-white:#EAF1F7`.
- La simulación QA `qa/simulacion-operativa.html` usa ahora dichos colores e incorpora fuentes Inter/Playfair Display.
- El carrusel de acompañantes de la simulación ahora admite seleccionar/deseleccionar opciones y `Sin acompañamiento requerido` limpia la selección. Las solicitudes simuladas conservan una copia de las opciones elegidas en memoria.
- `tests/qa-jose-identity.test.js` agrega regresiones de identidad, identificación sintética y selección de acompañantes, conectado a `ADPHOR Gauntlet QA`.
- Este cambio NO es el clon visual completo de José ni integración SQL real, ni MFA hospedado.
- Código original José permanece íntegramente en GitHub privado; no copiarlo al público.

## Receta segura para VS Code en Linux
No actualizar el checkout antiguo `~/adphor-platform` si contiene conflictos u otros cambios. Crear una copia nueva:
```bash
set -e
mkdir -p "$HOME/adphor-workspaces"
cd "$HOME/adphor-workspaces"
git clone --branch qa/cliente-integracion-verificada-20261102 --single-branch https://github.com/riano200612-jpg/adphor-platform.git adphor-cliente-qa
cd adphor-cliente-qa
git status --short
git log -1 --oneline
npm ci
npm test
ADPHOR_BUILD_QA_DEMOS=true npm run build
code .
```
Si no existe el comando `code`, abrir la carpeta `~/adphor-workspaces/adphor-cliente-qa` desde VS Code manualmente.

## Respaldo privado de José (conservado)
```bash
git clone https://github.com/riano200612-jpg/adphor-jose-original-private.git "$HOME/adphor-workspaces/jose-original-private"
cd "$HOME/adphor-workspaces/jose-original-private"
git log -1 --oneline
find portal reuniones -maxdepth 1 -type f | wc -l
```
El resultado esperado del último comando es 32 fuentes (no incluir archivos auxiliares).

## Estado de entrega
No compartir el dominio Pages histórico como QA privada; Cloudflare Access sin certificación de panel. Los catálogos de Supabase siguen siendo fuentes privadas de conciliación. Validar tests del commit más reciente antes de marcar la etapa terminada.
