// Version-specific, read-only source column mapping. This is NOT a migration
// or authorization of ownership, dates, states, staff or calendar events.
// Unmapped original columns are retained in source; they must never be discarded.
import {sourceSchemaVersions,validateSourceSchema} from './source-schema-versions.js';
const rawMappings={
  "portal.visitas.2026-11-05": {
    "sourceId": "ID_Visita",
    "projectCandidate": "ID_Copropiedad",
    "eventDate": "Fecha Inicio",
    "startTime": "Hora Llegada",
    "endTime": "Hora Salida",
    "status": "Resultado",
    "attachments": "Link Adjuntos"
  },
  "master.visitas.2026-11-05": {
    "sourceId": "ID_Visita",
    "projectCandidate": "ID_Copropiedad",
    "eventDate": "Fecha Inicio",
    "startTime": "Hora Llegada",
    "endTime": "Hora Salida",
    "status": "Resultado",
    "attachments": "Link Adjuntos"
  },
  "portal.pqrs.2026-11-05": {
    "sourceId": "ID_PQRS",
    "projectCandidate": "ID_Copropiedad",
    "registeredAt": "Fecha_Radicación",
    "kind": "Tipo",
    "priority": "Prioridad_Original",
    "status": "Estado_Actual",
    "details": "Detalle",
    "attachments": "Archivo_Adjunto"
  },
  "master.pqrs.2026-11-05": {
    "sourceId": "ID Caso",
    "registeredAt": "Fecha_Registro",
    "status": "Estado",
    "details": "Detalle",
    "attachments": "Adjunto (Link)"
  },
  "portal.reuniones.2026-11-05": {
    "sourceId": "ID_Reunion",
    "projectCandidateName": "Copropiedad",
    "eventDate": "Fecha_Evento",
    "startTime": "Hora Inicio Estimada",
    "endTime": "Hora Fin Estimada",
    "status": "Estado",
    "calendarEventId": "ID_Evento_Calendario",
    "meetingLink": "linkMeet"
  },
  "master.registros.2026-11-05": {
    "sourceId": "ID_Registro",
    "projectCandidateName": "Copropiedad",
    "eventDate": "Fecha_Evento",
    "startTime": "Hora Inicio Estimada",
    "endTime": "Hora Fin Estimada",
    "status": "Estado",
    "calendarEventId": "ID_Evento_Calendario",
    "meetingLink": "linkMeet"
  }
};
export const sourceFieldMappings=Object.freeze(Object.fromEntries(
 Object.entries(rawMappings).map(([version,fields])=>[version,Object.freeze(fields)])));
export function inspectVersionedFieldMapping(version,header){
 const checked=validateSourceSchema(version,header);
 if(!checked.ok) return Object.freeze({status:'REVIEW',reason:checked.code});
 const mapping=sourceFieldMappings[version];
 if(!mapping) return Object.freeze({status:'REVIEW',reason:'NO_APPROVED_FIELD_MAPPING'});
 if(Object.values(mapping).some(name=>!header.includes(name)))
   return Object.freeze({status:'REVIEW',reason:'MAPPING_NOT_IN_SOURCE'});
 const missingTenantId=!mapping.projectCandidate;
 return Object.freeze({status:'MAPPING_CANDIDATE_ONLY',
   version,fields:Object.keys(mapping).length,requiresTenantResolution:true,
   requiresFieldSemanticsReview:true,requiresSourceApproval:true,
   projectIdentityMissingInSource:missingTenantId});
}
