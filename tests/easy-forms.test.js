import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {availableProjectAreas,availableAssignees,locateFormError,QA_PROVISIONAL_AREAS} from '../src/js/services/easy-form-options.js';
import {renderEasyCaseForm} from '../src/js/ui-easy-case-form.js';

test('nine understandable QA categories without browser fallback or duplicates',()=>{
 assert.equal(QA_PROVISIONAL_AREAS.length,9);
 assert.equal(new Set(QA_PROVISIONAL_AREAS).size,9);
 assert.ok(QA_PROVISIONAL_AREAS.includes('Otra área'));
 assert.deepEqual(availableProjectAreas({areas:[]}),[]);
 assert.deepEqual(availableProjectAreas({areas:['Áreas comunes','Áreas comunes',' ',null]}),['Áreas comunes']);
});
const actor={id:'admin-demo',name:'Administración demo'};
const team=[{project_id:'p1',user_id:'admin-demo',role:'admin',name:'Administración demo'},
 {project_id:'p1',user_id:'tecnico',role:'technician',name:'Técnico'},
 {project_id:'p1',user_id:'viewer',role:'viewer',name:'Consulta'},
 {project_id:'p2',user_id:'other',role:'admin',name:'Otro conjunto'}];
const props={project:{id:'p1',areas:['Ascensores','Áreas comunes']},members:team,user:actor,role:'admin',date:'2026-11-19',
 priorities:['Baja','Media','Alta','Urgente'],requestId:'case-qa',photoMarkup:'<label>Fotografías<input name="photos" type="file"></label>'};
test('only permitted team members appear; own actor is safely preselected',()=>{
 assert.deepEqual(availableAssignees(team,'p1').map(m=>m.id).sort(),['admin-demo','tecnico']);
 const html=renderEasyCaseForm(props);
 assert.match(html,/id="new-case" class="adphor-simple-form" novalidate/);
 assert.match(html,/<option value="admin-demo" selected>Yo · Administración demo/);
 assert.ok(!html.includes('value="viewer"'));
 assert.ok(!html.includes('value="other"'));
 assert.ok(html.includes('name="area" required'));
 assert.ok(html.includes('option value="Ascensores"'));
 assert.ok(html.includes('name="photos"'));
 assert.ok(html.includes('«Media» es el valor inicial'));
});
test('empty server data blocks saving instead of submitting imaginary choices',()=>{
 const html=renderEasyCaseForm({...props,project:{id:'p1',areas:[]},members:[]});
 assert.ok(html.includes('No hay áreas disponibles'));
 assert.ok(html.includes('No hay responsables operativos'));
 assert.ok(html.includes('class="btn primary" disabled'));
 assert.ok(!html.includes('value="Áreas comunes"'));
});
test('prevents user-supplied HTML injection into option text',()=>{
 const html=renderEasyCaseForm({...props,project:{id:'p1',areas:['<img src=x onerror=alert(1)>']},
 members:[{project_id:'p1',user_id:'admin-demo',role:'admin',name:'<script>alert(2)</script>'}]});
 assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('<script'));
 assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('&lt;script'));
});
test('technician can only create under own identity, other actors are never offered',()=>{
 const html=renderEasyCaseForm({...props,user:{id:'tecnico',name:'Técnico'},role:'technician'});
 assert.ok(html.includes('name="assignee" required disabled'));
 assert.ok(html.includes('<option value="tecnico" selected>Técnico</option>'));
 assert.ok(!html.includes('<option value="admin-demo"'));
});
test('error targeting matches plain-language requirements',()=>{
 for(const [msg,field] of [
 ['Selecciona un área de esta copropiedad.','area'],
 ['Escribe un título','title'],['Indica la ubicación exacta','location'],
 ['Selecciona un responsable','assignee'],['El plazo debe ser hoy','due_date'],
 ['Solo se permiten fotografías','photos']])assert.equal(locateFormError(msg),field);
 assert.equal(locateFormError('Error de red'),'');
});
test('PGlite: QA migration only fills empty arrays and cannot replace approved areas',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 try{
  await db.exec("CREATE SCHEMA qa_identity_private; CREATE TABLE public.qa_task_catalog_candidates(id uuid); CREATE TABLE public.qa_meeting_events(id text); CREATE TABLE public.projects(id text primary key,areas text[] not null);");
  await db.exec("INSERT INTO public.projects VALUES ('p1',ARRAY[]::text[]),('p2',ARRAY['Área aprobada']),('p3',ARRAY[]::text[]);");
  const sql=readFileSync(new URL('../supabase/migrations/20261119213000_qa_empty_project_area_options.sql',import.meta.url),'utf8');
  assert.match(sql,/WHERE areas IS NOT NULL AND cardinality\(areas\)=0/);
  for(const area of QA_PROVISIONAL_AREAS)assert.ok(sql.includes("'"+area+"'"));
  await db.exec(sql);await db.exec(sql);
  const q=await db.query('SELECT id,areas FROM public.projects ORDER BY id');
  assert.equal(q.rows[0].areas.length,9);
  assert.deepEqual(q.rows[1].areas,['Área aprobada']);
  assert.equal(q.rows[2].areas.length,9);
 }finally{await db.close();}
});
test('existing application maintains server validation and audited save',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('renderEasyCaseForm('));
 assert.ok(app.includes('validateInput(payload, project(), team())'));
 assert.ok(app.includes('repo.save(action, payload)'));
 assert.ok(app.includes('locateFormError(error.message)'));
 assert.ok(app.includes("target.focus()"));
});
