// Source: a CLONED workbook in a temporary, authorized import process.
// This module never reads Drive, never writes operational tables, IAM or models.
// Never serialize the input row: its columns may contain PIN, passwords or links.
const fields=Object.freeze({
  Copropiedades:Object.freeze({kind:'projects',id:'ID_Copropiedad',
    map:{id:'ID_Copropiedad',name:'Copropiedad',delegate_id:'ID_Delegado',
      coordinator_id:'ID_Coordinador',sector:'Sector',operational_email:'Correo Electrónico'}}),
  Delegados:Object.freeze({kind:'delegates',id:'ID_Delegado',
    map:{id:'ID_Delegado',name:'Delegado',username:'Usuario',role:'Rol',
      status:'Estado',historical_contact:'Correo',sector:'Sector Coordinado'}}),
  PQRS:Object.freeze({kind:'pqrs',id:'ID Caso',
    map:{id:'ID Caso',registered_at:'Fecha_Registro',delegate_id:'ID_Delegado',
      status:'Estado',manual_priority:'Prioridad Manual',ai_priority:'Prioridad IA'}}),
  'Info Copropiedades':Object.freeze({kind:'property_info',id:'ID_Copropiedad',
    map:{id:'ID_Copropiedad',name:'Copropiedad',delegate_id:'ID_Delegado',
      construction_year:'Año Construcción',units_total:'Total Unidades',
      council_frequency:'Periodicidad Consejos',builder:'Constructora'}})
});
const normalized=value => String(value??'').trim();
export const QA_CLONE_TAB_RULES=fields;

export function preparePrivateClonedSnapshot(sheet,rows) {
 const rule=fields[sheet];
 if(!rule||!Array.isArray(rows)||rows.length>50000)
   throw Error('Copia, hoja o rango no autorizado.');
 const result=[],seen=new Set();
 for(const entry of rows) {
  if(!entry||!Number.isSafeInteger(entry.rowNumber)||entry.rowNumber<2||
     !entry.values||typeof entry.values!=='object'||Array.isArray(entry.values))
   throw Error('Fila de copia no verificable.');
  const key=normalized(entry.values[rule.id]);
  if(!key)continue;
  if(key.length>160||/[\u0000-\u001f]/.test(key)||seen.has(key))
    throw Error('ID de copia inválido o duplicado.');
  seen.add(key);
  const payload={};
  for(const [out,input] of Object.entries(rule.map)) {
   const value=normalized(entry.values[input]);
   if(value.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
     throw Error('Valor de copia inválido o demasiado extenso.');
   if(value)payload[out]=value;
  }
  // No sensitive unknown columns (PIN, password, secrets, raw PQRS, Drive
  // attachments, recovery questions, historical meeting notes) can escape.
  result.push(Object.freeze({sourceRow:entry.rowNumber,sourceKey:key,
   sourceKind:rule.kind,payload:Object.freeze(payload)}));
 }
 return Object.freeze(result);
}
