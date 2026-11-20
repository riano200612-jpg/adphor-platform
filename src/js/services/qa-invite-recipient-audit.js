// QA IAM: read-only approval gate for PERSONAL invitation destinations.
// This module is not an invitation sender, identity provider or authorization
// boundary. It must run ONLY on server-private data supplied by an authorized
// operator workflow. Never use it as a reason to skip IAM AAL2, Auth or RLS.
const trim = value => String(value ?? '').trim();
const fold = value => trim(value).toLowerCase();
const emailValid = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const active = new Set(['activo','activa','active']);
const delegate = new Set(['d','delegada','delegado']);
function inputArray(value,name){
 if(!Array.isArray(value)||value.length>5000 ||
   value.some(x=>!x||typeof x!=='object'||Array.isArray(x)))
  throw Error('Fuente de destinatarios incompleta: '+name);
 return value;
}
function countEmails(rows,field){
 const counts=new Map();
 for(const row of rows){
  const address=fold(row[field]);
  if(address)counts.set(address,(counts.get(address)||0)+1);
 }
 return counts;
}
const count = (values,condition) => values.reduce((n,value)=>n+(condition(value)?1:0),0);

/**
 * @param people Private legacy roster: {legacyId,legacyEmail,status,role,reviewClassification}
 * @param properties Private reference: {projectId,propertyContactEmail}
 * @param recipients *Independently* verified destination approvals:
 *   {legacyId,individualEmail,personVerified,mailboxConfirmed,ownerApproved}
 *
 * Do not derive recipients from legacyEmail, propertyContactEmail, PIN,
 * password, user_metadata or aliases. No automatic activation can follow.
 * The output contains NO personal names, aliases, emails, phone or passwords.
 */
export function auditIndividualInvitationDestinations({people,properties,recipients}={}){
 inputArray(people,'personas');inputArray(properties,'copropiedades');
 inputArray(recipients,'destinatarios');
 if(!people.length||!properties.length)throw Error('Inventario original vacío o incompleto.');
 const ids=new Set();
 for(const person of people){
  const id=trim(person.legacyId);
  if(!id||ids.has(id))throw Error('Identificadores originales incompletos o duplicados.');
  ids.add(id);
 }
 const projectIds=new Set();
 for(const property of properties){
  const id=trim(property.projectId);
  if(!id||projectIds.has(id))throw Error('Identificadores de edificios incompletos o duplicados.');
  projectIds.add(id);
 }
 const originCounts=countEmails(people,'legacyEmail');
 const propertyEmails=new Set(properties.map(p=>fold(p.propertyContactEmail)).filter(Boolean));
 const recipientCounts=countEmails(recipients,'individualEmail');
 const mappedRecipients=new Map();
 let invalidRecipientReferences=0;
 for(const recipient of recipients){
  const id=trim(recipient.legacyId);
  if(!ids.has(id)){invalidRecipientReferences++;continue;}
  const matches=mappedRecipients.get(id)||[];
  matches.push(recipient);
  mappedRecipients.set(id,matches);
 }
 const reasons={};
 let ready=0,eligible=0,sharedLegacyUsers=0;
 const groups={};
 for(const person of people){
  const id=trim(person.legacyId);
  const origin=fold(person.legacyEmail);
  if(originCounts.get(origin)>1)sharedLegacyUsers++;
  const state=fold(person.status),role=fold(person.role);
  let reason;
  if(!active.has(state))reason='SOURCE_NOT_ACTIVE';
  else if(!delegate.has(role))reason='ROLE_NOT_DELEGATE';
  else if(person.reviewClassification!=='MATCHED')reason='IDENTITY_REVIEW';
  else{
   eligible++;
   const matches=mappedRecipients.get(id)||[];
   if(matches.length!==1)reason='PERSONAL_EMAIL_APPROVAL_MISSING_OR_AMBIGUOUS';
   else {
    const link=matches[0],address=fold(link.individualEmail);
    if(!emailValid(address))reason='PERSONAL_EMAIL_INVALID';
    else if(recipientCounts.get(address)!==1)reason='PERSONAL_EMAIL_SHARED';
    else if(originCounts.get(address)>1)reason='LEGACY_SHARED_EMAIL_UNSAFE';
    else if(propertyEmails.has(address))reason='PROPERTY_CONTACT_NOT_PERSONAL';
    else if(link.personVerified!==true||link.mailboxConfirmed!==true||link.ownerApproved!==true)
      reason='IDENTITY_OR_MAILBOX_UNVERIFIED';
    else{
      ready++;
      reason='READY_FOR_PRIVATE_IAM_REVIEW';
    }
   }
  }
  reasons[reason]=(reasons[reason]||0)+1;
  groups[reason]=true;
 }
 return Object.freeze({
  source:'private-qa-invite-readiness',readonly:true,canSend:false,canProvision:false,
  totalPeople:people.length,totalProperties:properties.length,
  eligibleDelegateCandidates:eligible,readyForPrivateReview:invalidRecipientReferences?0:ready,
  sharedLegacyUsers,legacyDistinctAddresses:originCounts.size,
  propertyContactDistinctAddresses:propertyEmails.size,
  invalidRecipientReferences,
  reasonCounts:Object.freeze(reasons),
  certified:false,
  warning:'No se enviaron invitaciones. Requiere IAM AAL2, autorización individual, RLS y prueba de inicio de sesión.'
 });
}
