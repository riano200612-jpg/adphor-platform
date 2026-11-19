import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTaskCandidate,validateQaCandidateRows} from '../src/js/services/task-catalog.js';
const migration=new URL('../supabase/migrations/20261119210000_qa_task_catalog_candidate_review.sql',import.meta.url);

test('proposal validates cadence and refuses invented deadlines',()=>{
 assert.deepEqual(validateTaskCandidate({title:'  Recorrido de edificio ',description:' ',cadence:'daily'}),
 {title:'Recorrido de edificio',description:'',cadence:'daily'});
 for(const row of [{title:'X',cadence:'daily'},{title:'Válida',cadence:'fake'},
 {title:'Válida',cadence:'daily',description:'a'.repeat(1001)}])
 assert.throws(()=>validateTaskCandidate(row));
});
test('client rejects foreign rows, duplicates and forged active status',()=>{
 const row={id:'id1',project_id:'p1',title:'Tarea',cadence:'daily',status:'proposed',created_by:'u1'};
 assert.equal(validateQaCandidateRows([row],'p1').length,1);
 assert.throws(()=>validateQaCandidateRows([row,{...row,project_id:'p2'}],'p1'));
 assert.throws(()=>validateQaCandidateRows([row,row],'p1'));
 assert.throws(()=>validateQaCandidateRows([row,{...row,id:'id2',status:'activated'}],'p1'));
 assert.throws(()=>validateQaCandidateRows(null,'p1'));
});
test('SQL contracts: isolated QA, AAL2, read-only grants, audit and two-person decisions',()=>{
 const sql=readFileSync(migration,'utf8');
 for(const part of [
 "to_regnamespace('qa_identity_private')",
 "ENABLE ROW LEVEL SECURITY",
 "GRANT SELECT ON public.qa_task_catalog_candidates TO authenticated",
 "REVOKE ALL ON public.qa_task_catalog_candidates FROM PUBLIC, anon, authenticated",
 "REVOKE ALL ON public.qa_task_catalog_events FROM PUBLIC, anon, authenticated",
 "qa_identity_private.current_principal()",
 "record_data.created_by=actor",
 "coalesce(public.project_role(target_project),'') NOT IN",
 "coalesce(public.project_role(record_data.project_id),'') NOT IN",
 "ON CONFLICT (id) DO NOTHING",
 "SECURITY DEFINER SET search_path = ''",
 "reviewed_for_design",
 "INSERT INTO public.qa_task_catalog_events"
 ])assert.ok(sql.includes(part),part);
 assert.ok(!/pg_cron|cron\.schedule|http_post|notification_outbox/i.test(sql));
});
test('QA route is privileged and corporate Calendar untouched',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('mountQaTaskCatalog'));
 assert.ok(app.includes('qaTaskCatalogEnabled'));
 assert.ok(app.includes('isManager(role())'));
 assert.ok(app.includes('mountVerifiedAgenda'));
 assert.ok(app.includes('data-page="task-catalog"'));
 assert.ok(!app.includes("nav.push(['task-catalog'"),'No extra Inicio circle for proposal workflow');
});
