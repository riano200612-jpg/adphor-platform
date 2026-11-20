import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEasyCaseForm} from '../src/js/ui-easy-case-form.js';

const base={
 project:{id:'p1',name:'Edificio Mares',areas:['Áreas comunes']},
 members:[{project_id:'p1',user_id:'u1',role:'admin',name:'Administradora QA'},
 {project_id:'p2',user_id:'u2',role:'admin',name:'Sin acceso a este edificio'}],
 user:{id:'u1',name:'Administradora QA'},role:'admin',
 date:'2026-11-20',priorities:['Baja','Media','Alta','Urgente'],
 requestId:'qa-only',photoMarkup:''
};
test('task form identifies the current building without changing responsible or save contract',()=>{
 const html=renderEasyCaseForm(base);
 assert.match(html,/data-active-building>Estás trabajando en: <strong>Edificio Mares<\/strong>/);
 assert.match(html,/id="new-case"/);
 assert.match(html,/name="assignee" required/);
 assert.match(html,/name="priority"/);
 assert.match(html,/>Guardar novedad<\/button>/);
 assert.doesNotMatch(html,/value="u2"/);
});
test('untrusted building labels are HTML-escaped in the task form',()=>{
 const html=renderEasyCaseForm({...base,project:{...base.project,name:'<img src=x onerror=alert(1)>'}});
 assert.ok(!html.includes('<img'));
 assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('data-active-building'));
});
test('absence of a verified building name does not invent a property',()=>{
 const html=renderEasyCaseForm({...base,project:{id:'p1',areas:['Áreas comunes']}});
 assert.match(html,/Estás trabajando en: <strong>Copropiedad seleccionada<\/strong>/);
});
