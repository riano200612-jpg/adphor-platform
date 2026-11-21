# Codex para ADPHOR QA Integral — incorporación controlada

## Estado inicial del plan

Este paquete **no instala ni habilita** Codex Cloud, no cambia políticas de GitHub/Cloudflare y no publica software. Aporta instrucciones de repositorio y Skills reutilizables. Para habilitar Codex Cloud y Code Review hace falta una acción del propietario en la interfaz de OpenAI y los permisos de integración pertinentes.

## Fase A — configuración del repositorio (esta propuesta)

- `AGENTS.md` define convenciones y límites.
- Tres Skills en `.agents/skills/` codifican diagnóstico 503, gate de QA y documentos privados.
- Todo entra mediante un PR **Draft** con un commit, base QA vigente y sin merge automático.
- El PR dispara pruebas de GitHub Actions; una CI verde no significa que el código se haya desplegado.

## Fase B — activación por propietario

1. Abrir **https://chatgpt.com/codex** y conectar GitHub desde Codex, si la integración todavía no está autorizada.
2. Elegir el repositorio `riano200612-jpg/adphor-platform`; limitar permisos a lo necesario.
3. Crear entorno Codex Cloud para este repositorio y seleccionar la rama QA Integral vigente como referencia de trabajo. Comprobar el HEAD antes de cada tarea.
4. Verificar que Codex lee `AGENTS.md` y puede descubrir las Skills de `.agents/skills`.
5. Habilitar Codex Code Review para este repositorio si está disponible en la cuenta. Probar primero una revisión del PR de configuración. Revisión de Codex **no sustituye** CI, revisión humana ni las protecciones de ramas.
6. Para Codespaces, autenticarse en Codex de manera interactiva únicamente mediante el proveedor oficial; no pegar tokens ni contraseñas en chats, archivos de proyecto o outputs.
7. Mantener separadas las credenciales QA y producción. No introducir secretos en Codex hasta haber revisado su necesidad y alcance.

## Fase C — primer objetivo operativo

1. Ejecutar la Skill `adphor-503-triage` para investigar el error HTTP 503 de Miss ADPHOR, con logs de la versión realmente desplegada.
2. Proponer un PR mínimo con test de regresión y evidencia.
3. Invocar `adphor-qa-certification` y presentar dictamen.
4. Solo tras autorización explícita fusionar a la **misma** rama QA Integral, certificar deployment ID/SHA/alias y probar en vivo.
5. Continuar con el trabajo existente de adjuntos privados de Miss ADPHOR. Evitar ramas o implementaciones duplicadas.

## Ciclo diario

Aprovechar la automatización diaria ya existente de ADPHOR (06:00 hora Colombia) para lectura, priorización y propuesta de trabajo. **No crear un segundo schedule** que compita o haga despliegues duplicados. Cualquier automatización de Codex debe mantenerse a nivel de investigación o revisión hasta tener controles de ejecución y publicación auditados.

## Criterios de puesta en marcha

- [ ] PR de incorporación aprobado y checks GitHub Actions correctos.
- [ ] Conexión del propietario Codex Cloud ↔ GitHub confirmada.
- [ ] `AGENTS.md` y Skills detectadas por una tarea real de Codex.
- [ ] Code Review revisa PR de prueba; hallazgos útiles confirmados.
- [ ] Primera incidencia 503 auditada con evidencia reproducible o bloqueo explicado.
- [ ] Ningún cambio en producción, credenciales, Access, datos originales o despliegue no autorizado.

## Herramientas y enlaces

- [Codex](https://chatgpt.com/codex)
- [Documentación de Codex](https://developers.openai.com/codex)
- [Reglas de revisión Codex](https://developers.openai.com/blog/custom-code-review-rules-for-codex)

No afirmar que un criterio está cumplido sin evidencia independiente.
