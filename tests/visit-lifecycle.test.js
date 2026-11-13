import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createVisitFixture,visitUsers as U} from '../qa/visit-lifecycle-fixture.js';
import {visitActions,visitSchedule,visitTransitionPayload,visitLocalDate} from '../src/js/services/visit-lifecycle.js';
import {createSharedVisitRepository} from '../src/js/services/shared-visits.js';
let f;
before(async()=>{f=await createVisitFixture();});
after(async()=>{await f?.db.close();});
const op=(id,action,version=1,values={})=>({requestId:id,operationId:randomUUID(),version,action,values});
const result={observations:'Revisión',activities:'Inspección',conclusions:'Finalizada',commitments:'Seguimiento en consejo'};
test('fechas Colombia, datos obligatorios y estados cerrados',()=>{
 assert.equal(visitSchedule('2026-11-14T10:00'),'2026-11-14T10:00:00-05:00');
 assert.equal(visitLocalDate('2026-11-14T15:00:00Z'),'2026-11-14T10:00');
 for(const value of ['2026-02-30T10:00','2026-11-14T25:00','',null])assert.throws(()=>visitSchedule(value));
 for(const state of ['completada','cancelada','inventada'])assert.deepEqual(visitActions(state),[]);
 assert.throws(()=>visitTransitionPayload('finish',{...result,conclusions:' '}));
 assert.throws(()=>visitTransitionPayload('cancel',{reason:''}));
 assert.throws(()=>visitTransitionPayload('progress',{...result,activities:'x'.repeat(4001)}));
 assert.throws(()=>visitTransitionPayload('inventada'));
});
test('crear, editar, ingreso, seguimiento, salida e historial inmutable',async()=>{
 const id=randomUUID();await f.create(id);
 const edited=(await f.transition(op(id,'edit',1,{responsible_id:U.coord,motive:'Revisada',scheduled_at:'2026-11-15T09:00:00-05:00'}))).rows[0];
 assert.equal(edited.version,2);assert.equal(edited.responsible_id,U.coord);
 const started=(await f.transition(op(id,'start',2))).rows[0];assert.ok(started.started_at);assert.equal(started.status,'en_ejecucion');
 await f.transition(op(id,'progress',3,result));
 const done=(await f.transition(op(id,'finish',4,result))).rows[0];
 assert.equal(done.status,'completada');assert.equal(done.commitments,result.commitments);assert.ok(done.finished_at>=done.started_at);
 const events=(await f.as(U.admin,'aal2','select * from qa_visit_history where request_id=$1 order by version',[id])).rows;
 assert.deepEqual(events.map(x=>x.action),['create','edit','start','progress','finish']);
 assert.ok(events.every(x=>x.actor_id===U.admin));
 await assert.rejects(f.transition(op(id,'edit',5,{})),/cerrada/);
 for(const table of ['qa_visits','qa_visit_history']){
  await assert.rejects(f.as(U.admin,'aal2',`delete from ${table}`),/permission denied/);
  await assert.rejects(f.as(U.admin,'aal2',`update ${table} set version=20`),/permission denied/);
 }
});
test('reintento idéntico conserva resultado incluso después de otra transición; payload ajeno se rechaza',async()=>{
 const id=randomUUID();await f.create(id);const request=op(id,'start');
 const first=(await f.transition(request)).rows[0];
 await f.transition(op(id,'progress',2,result));
 assert.deepEqual((await f.transition(request)).rows[0],first);
 await assert.rejects(f.transition({...request,values:{unexpected:true}}),/Conflicto/);
 await assert.rejects(f.transition(request,U.coord),/Conflicto/);
 const events=await f.as(U.admin,'aal2','select count(*)::int n from qa_visit_history where request_id=$1',[id]);
 assert.equal(events.rows[0].n,3);
});
test('solicitudes en competencia: una versión gana y la otra falla sin perder datos (motor aislado serializado)',async()=>{
 const id=randomUUID();await f.create(id);
 const results=await Promise.allSettled([f.transition(op(id,'start')),f.transition(op(id,'cancel',1,{reason:'Competencia'}))]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'40001');
 const rows=await f.as(U.admin,'aal2','select version from qa_visits where request_id=$1',[id]);assert.equal(rows.rows[0].version,2);
});
test('AAL1, otra copropiedad, inactivo, visor y anónimo no mutan ni falsifican historia',async()=>{
 const id=randomUUID();await f.create(id);
 for(const [user,aal] of [[U.admin,'aal1'],[U.other,'aal2'],[U.inactive,'aal2'],[U.viewer,'aal2'],[null,'aal2']]){
  await assert.rejects(f.transition(op(id,'start'),user,aal),error=>error.code==='42501');
  if(user!==U.viewer)for(const table of ['qa_visits','qa_visit_history'])assert.equal((await f.as(user,aal,`select * from ${table} where request_id=$1`,[id])).rows.length,0);
 }
 await assert.rejects(f.transition({...op(id,'start'),projectId:'p2'}),error=>error.code==='42501');
 await assert.rejects(f.as(U.admin,'aal2',`insert into qa_visit_history select * from qa_visit_history where request_id=$1`,[id]),/permission denied/);
 await f.db.exec('set role anon');
 try{await assert.rejects(f.db.query('select * from qa_transition_visit($1,$2,$3,1,$4,$5)',['p1',id,randomUUID(),'start',{}]),/permission denied/);}finally{await f.db.exec('reset role');}
});
test('validaciones SQL, responsable ajeno, transiciones inválidas y cancelación justificada',async()=>{
 const id=randomUUID();await f.create(id);
 for(const [action,values] of [['finish',result],['cancel',{}],['start',{started_at:'inventado'}],['edit',{motive:'X'}],['edit',{responsible_id:U.other,motive:'X',scheduled_at:'2026-11-14T10:00:00-05:00'}]])await assert.rejects(f.transition(op(id,action,1,values)));
 await assert.rejects(f.create(randomUUID(),{4:'infinity'}));
 await assert.rejects(f.create(randomUUID(),{3:''}));
 await assert.rejects(f.create(randomUUID(),{2:null}));
 await assert.rejects(f.transition({...op(id,'start'),operationId:null}));
 const cancelled=(await f.transition(op(id,'cancel',1,{reason:'Reprogramación autorizada'}))).rows[0];
 assert.equal(cancelled.status,'cancelada');assert.ok(cancelled.finished_at);assert.equal(cancelled.started_at,null);
 await assert.rejects(f.transition(op(id,'start',2)),/cerrada/);
});
test('finalizar exige conclusión y el fracaso no aumenta versión ni añade eventos',async()=>{
 const id=randomUUID();await f.create(id);await f.transition(op(id,'start'));
 await assert.rejects(f.transition(op(id,'finish',2,{...result,conclusions:''})));
 await assert.rejects(f.transition(op(id,'progress',2,{...result,activities:null})));
 await assert.rejects(f.transition(op(id,'edit',2,{responsible_id:U.admin,motive:'X',scheduled_at:'2026-11-14T10:00:00-05:00'})));
 const rows=await f.as(U.admin,'aal2','select version,status from qa_visits where request_id=$1',[id]);
 assert.equal(rows.rows[0].version,2);assert.equal(rows.rows[0].status,'en_ejecucion');
});
test('flags son opt-in estricto y el contrato anterior sigue siendo consultable',async()=>{
 const url='https://qfctnnnnltghepwujpdm.supabase.co';
 for(const config of [{},{writesEnabled:true},{writesEnabled:true,lifecycleEnabled:'true'},{lifecycleEnabled:true}]){
  const repo=createSharedVisitRepository({}, {url,...config});assert.equal(repo.lifecycleEnabled,false);
  await assert.rejects(repo.transition({}),/deshabilitado/);await assert.rejects(repo.history('p1','x'),/deshabilitado/);
 }
});
