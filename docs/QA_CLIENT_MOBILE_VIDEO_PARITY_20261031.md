# Auditoría de grabación móvil de Portal ADPHOR — 31 de octubre de 2026

## Evidencia examinada
Video aportado por el usuario `1000052774.mp4`, duración aproximada de 69 segundos. Se revisaron seis momentos separados de la grabación; no constituye una captura completa de cada módulo ni de todos sus estados.

## Aspectos visuales observados
- Cabecera azul petróleo ADPHOR con borde/acento dorado, logo y fotografía circular de una colaboradora en la esquina derecha.
- Menú lateral móvil desplegable con logo central, iconos y texto dorados sobre fondo azul.
- Opciones visibles: **Calendarios, Mis Copropiedades, Reuniones, Visitas, PQRS, Mantenimientos, Recorridos, Proveedores**.
- Páginas de copropiedad con fotografía del edificio, nombre, sector y contadores de PQRS activas por tipo.
- PQRS con filtros de estado/categoría, tarjetas, indicadores y selección de copropiedad.
- En una interacción, **Recorridos muestra un aviso de sección en construcción**.
- El vídeo incluye barras del navegador de Chrome/Google; no son componentes de ADPHOR que deban replicarse.

## Traducción a integración QA
- Se añadió entrada **Recorridos** en navegación de ADPHOR Premium, con lista de novedades ya existentes y carrusel de responsables de la copropiedad (información proveniente de los miembros ya autorizados).
- Botón de **Registrar novedad** reutiliza el flujo existente de mantenimiento, área, responsable, prioridad, seguimiento y cierre supervisado. Las novedades del carrusel no se envían por correo automáticamente.
- Se preservó el diseño azul/dorado del cliente y se añadió adaptación móvil.
- **No se afirma integración multimedia completa**: la función actual usa el mecanismo existente de evidencias fotográficas; audio/video requieren Storage privado, formatos/tamaños, RLS, autorización del titular y pruebas de reproducibilidad.
- Las fotografías del carrusel de empleados no se copiaron de Drive; se emplean iniciales para evitar publicar imágenes personales sin revisión/autorización.
- **Visitas y Proveedores** aparecen en el original, pero requieren contratos específicos antes de llamarlos integrados.
- La experiencia exacta de la plataforma original requiere auditoría visual de las pantallas internas y comparación pixel a pixel en una sesión autorizada.

## Flujo obligatorio de novedad en recorridos
1. Usuario autenticado selecciona copropiedad y área autorizada.
2. Registra hallazgo, responsable, ubicación, fecha y prioridad.
3. Adjunta foto/audio/video/documento en almacenamiento privado, pendiente de implementar.
4. Seguimiento por responsable y administración con línea de tiempo y alertas.
5. Coordinador verifica solución y aprueba cierre; agentes IA solo sugieren prioridades y borradores, nunca cierran o envían comunicaciones solos.
6. Auditoría y métricas por copropiedad sin mezclar información de terceros.

## Protección
Original de José inalterado; no se importan datos personales ni credenciales a GitHub; ninguna acción de envío externo autorizada. Todo cambio permanece en QA y debe superar pruebas antes de demostrar a clientes.
