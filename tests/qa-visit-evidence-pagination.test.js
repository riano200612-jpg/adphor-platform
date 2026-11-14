import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createQaVisitEvidenceRepository} from '../src/js/services/qa-visit-evidence.js';

const projectId='p1',visitId=randomUUID(),actor=randomUUID();
const rows=Array.from({length:51},(_,i)=>{
 const id=randomUUID();
 return {id,project_id:projectId,request_id:visitId,
  storage_bucket:'qa-visit-evidence',
  storage_path:[projectId,'visitas',visitId,actor,id+'.pdf'].join('/'),
  media_type:'application/pdf',file_bytes:i+1,uploaded_by:actor,
  file_name:'Documento '+(51-i)+'.pdf',
  created_at:new Date(Date.UTC(2026,10,14,15,0,i)).toISOString()};
}).reverse();
test('Visitas paginated evidence stays scoped and readable beyond 50 attachments',async()=>{
 let aal='aal2',role='admin',tampers=false;const queried=[];
 const client={
  auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})},
   getUser:async()=>({data:{user:{id:actor}}})},
  from(table){
   if(table==='memberships')
    return {select(){return this},eq(){return this},limit(){return {data:[{role}]}}};
   if(table==='qa_visits')
    return {select(){return this},eq(){return this},single(){return {data:{project_id:projectId,request_id:visitId,status:'programada'}}}};
   assert.equal(table,'qa_visit_evidence');
   return {select(){return this},eq(){return this},order(){return this},
    range(from,to){queried.push([from,to]);
     const data=rows.slice(from,to+1).map(x=>({...x}));
     if(tampers&&data[0])data[0].project_id='p2';
     return {data};
    }};
  }
 };
 const repo=createQaVisitEvidenceRepository(client);
 const first=await repo.listEvidencePage(projectId,visitId,0);
 assert.equal(first.rows.length,50);assert.equal(first.hasMore,true);
 assert.equal(first.rows[0].file_name,'Documento 1.pdf');
 const second=await repo.listEvidencePage(projectId,visitId,50);
 assert.equal(second.rows.length,1);assert.equal(second.hasMore,false);
 assert.deepEqual(queried,[[0,50],[50,100]]);
 await assert.rejects(repo.listEvidencePage(projectId,visitId,-1),/Paginación/);
 await assert.rejects(repo.listEvidencePage(projectId,visitId,1.5),/Paginación/);
 aal='aal1';
 await assert.rejects(repo.listEvidencePage(projectId,visitId,0),/MFA AAL2/);
 aal='aal2';role='viewer';
 await assert.rejects(repo.listEvidencePage(projectId,visitId,0),/Copropiedad/);
 role='admin';tampers=true;
 await assert.rejects(repo.listEvidencePage(projectId,visitId,0),/autorizada/);
});
