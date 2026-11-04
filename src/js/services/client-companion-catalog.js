// Adaptación de la selección de acompañantes del portal original ADPHOR.
// No contiene datos personales ni concede acceso: el catálogo debe llegar
// filtrado por el servidor según las membresías autorizadas.
export const GLOBAL_COMPANION_ROLES = Object.freeze(['GG','GF','GT','CG','CO','A']);
export const ALLOWED_COMPANION_ROLES = Object.freeze([...GLOBAL_COMPANION_ROLES,'CZB','CZM','CZN','OV','AI']);

export function zoneRoleForSector(sector) {
  const s=String(sector??'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(s.includes('bocagrande')||s.includes('castillogrande'))return 'CZB';
  if(s.includes('manga')||s.includes('popa'))return 'CZM';
  if(s.includes('norte'))return 'CZN';
  return null;
}

export function companionCandidates(authorizedStaff,sector) {
  if(!Array.isArray(authorizedStaff))throw new TypeError('Catálogo de colaboradores inválido');
  const zone=zoneRoleForSector(sector);
  const order=[zone,...GLOBAL_COMPANION_ROLES].filter(Boolean);
  const seen=new Set();
  return authorizedStaff.filter(person=>{
    if(!person||typeof person!=='object')return false;
    const id=String(person.id??'').trim();
    const role=String(person.rol??person.role??'').trim();
    if(!id||seen.has(id)||!ALLOWED_COMPANION_ROLES.includes(role))return false;
    if(!GLOBAL_COMPANION_ROLES.includes(role)&&role!==zone)return false;
    seen.add(id);
    return true;
  }).sort((a,b)=>{
    const ra=String(a.rol??a.role),rb=String(b.rol??b.role);
    return order.indexOf(ra)-order.indexOf(rb);
  }).map(person=>({
    id:String(person.id),nombre:String(person.nombre??person.name??''),
    rol:String(person.rol??person.role),
    leyendaRol:String(person.leyendaRol??person.roleLabel??person.rol??person.role),
    // Una foto solo puede ser mostrada después de obtener una URL firmada
    // por un servicio autorizado. No exponemos enlaces de Drive de origen.
    photoStoragePath:person.photoStoragePath??null
  }));
}
