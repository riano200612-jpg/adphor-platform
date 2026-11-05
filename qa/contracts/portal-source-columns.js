// Contract verified against the header row of the original Portal ADPHOR Google Sheet (2026-11-05).
// Headers only: no client records, credentials, or images are included.
// Source: https://docs.google.com/spreadsheets/d/1m4xuzos7k37xhZvKvH2GBB35QCD-htY4mLOQn4ZbrIY/edit
// Preserve punctuation and historical names: never infer columns by position from a different revision.
export const portalSourceColumns = Object.freeze({
  Visitas: Object.freeze([
  "ID_Visita",
  "Fecha_Registro",
  "ID_Copropiedad",
  "Copropiedad",
  "Correo Copropiedad",
  "Sector",
  "ID_Visitante",
  "Visitante",
  "Correo Visitante",
  "Motivo",
  "Planificada",
  "Incidencia",
  "ID_Asociado",
  "Fecha Inicio",
  "Hora Llegada",
  "Registro Bloque",
  "Fecha Fin",
  "Hora Salida",
  "Duración",
  "Duración Texto",
  "Resultado",
  "Detalles Resultado",
  "Visita Inconclusa",
  "Motivo Inconclusión",
  "Fecha Proxima",
  "Hora Proxima",
  "Link Adjuntos",
  "Notas Adicionales",
  "Fecha Cierre",
  "Usuario",
  "Duracion Activa",
  "Duracion Activa Texto"
]),
  PQRS_Master: Object.freeze([
  "ID_PQRS",
  "Fecha_Radicación",
  "ID_Copropiedad",
  "Copropiedad",
  "ID_Delegado",
  "Delegado",
  "Tipo",
  "Prioridad_Original",
  "Detalle",
  "Usuario",
  "Correo_Usuario",
  "Prefijo_Telefono_Usuario",
  "Telefono_Usuario",
  "Unidad",
  "Archivo_Adjunto",
  "Estado_Actual",
  "Asignado_A",
  "Prioridad_Actual",
  "Categoría",
  "Sub_Categoría",
  "Plan_Accion",
  "Evidencia",
  "Verificación_Coordinador",
  "Tipo_Última_Actualización",
  "Notas_Última_Actualización",
  "Fecha_Última_Actualización",
  "Actualizado_Por",
  "Conteo_Actualizaciones",
  "Fecha_Último_Avance",
  "Último_Avance_Por",
  "Último_Avance",
  "Fecha_Última_Solicitud_Actualización",
  "Última_Solicitud_Actualización_Por",
  "Conteo_Solicitudes_Actualización",
  "C-SAT",
  "NPS",
  "PMF",
  "Notas_Cierre_Usuario",
  "Evaluacion_IA",
  "Just_Cambio_Prioridad,",
  "Just_Cambio_Categoria",
  ", Just_Cambio_Sub-categoria",
  "Prioridad_Gemini",
  "Categoria_Gemini",
  "SubCategoria_Gemini",
  "Origen",
  "ResultadoSolicitud"
])
});
export function validatePortalHeader(sheetName, incoming) {
  const expected = portalSourceColumns[sheetName];
  if (!expected) throw new Error('Unknown Portal source sheet');
  if (!Array.isArray(incoming) || incoming.some(value => typeof value !== 'string')) {
    throw new Error('Portal source header must be a string array');
  }
  if (incoming.length !== expected.length) {
    throw new Error(`Portal ${sheetName} column count mismatch: expected ${expected.length}, got ${incoming.length}`);
  }
  for (let index = 0; index < expected.length; index++) {
    if (incoming[index] !== expected[index]) {
      throw new Error(`Portal ${sheetName} schema mismatch at column ${index + 1}: explicit version mapping required`);
    }
  }
  return true;
}
