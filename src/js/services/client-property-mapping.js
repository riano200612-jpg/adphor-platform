// Adapter for the Copropiedades sheet supplied by José.
// Never trust an 'isAdmin' parameter received from a browser: authorization must
// be checked with authenticated role + live memberships on the server.
export const COPROPERTY_COLUMNS=Object.freeze({
 id:0,name:1,delegateId:2,photo:5,sector:6,website:7,tourist:8,
 constructionYear:9,developer:10,residentialUnits:11,touristUnits:12,
 commercialUnits:13,otherUnits:14,totalUnits:15,coordinates:16,
 floors:17,height:18
});
const clean=v=>v===undefined||v===null||String(v).trim()===''?null:String(v).trim();
const nonnegative=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&Number.isInteger(n)?n:null;};
export function mapClientPropertyRow(row){
 if(!Array.isArray(row)||row.length<19)throw Error('Fila de copropiedad incompleta.');
 const c=COPROPERTY_COLUMNS;
 const id=clean(row[c.id]),name=clean(row[c.name]),delegateId=clean(row[c.delegateId]);
 if(!id||!name)throw Error('Copropiedad sin identificador o nombre.');
 return {sourceId:id,name,delegateId,photo:clean(row[c.photo]),sector:clean(row[c.sector]),
  website:clean(row[c.website]),isTourist:clean(row[c.tourist]),
  constructionYear:nonnegative(row[c.constructionYear]),developer:clean(row[c.developer]),
  units:{residential:nonnegative(row[c.residentialUnits]),tourist:nonnegative(row[c.touristUnits]),
   commercial:nonnegative(row[c.commercialUnits]),other:nonnegative(row[c.otherUnits]),total:nonnegative(row[c.totalUnits])},
  coordinates:clean(row[c.coordinates]),floors:nonnegative(row[c.floors]),height:clean(row[c.height])};
}
// This returns candidates for a verified server-side membership, not a permission.
// The caller must enforce RLS and approve the source-ID -> project-ID mapping.
export function mapAuthorizedPropertyRows(rows,{authorizedSourceIds}){
 if(!(authorizedSourceIds instanceof Set))throw new TypeError('Se requiere un conjunto de IDs de origen autorizados.');
 if(!Array.isArray(rows))throw new TypeError('Filas inválidas');
 return rows.slice(1).map(row=>{try{return mapClientPropertyRow(row)}catch{return null}})
  .filter(row=>row&&authorizedSourceIds.has(row.sourceId));
}
