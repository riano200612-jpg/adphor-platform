import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseProject, searchProjects, projectPreference} from '../src/js/ui-project-selector.js';
const projects=Array.from({length:40},(_,i)=>({id:`qa-${i+1}`,name:`Copropiedad Ficticia ${String(i+1).padStart(2,'0')}`}));
test('40 dynamic projects: search and retained selection',()=>{
 assert.equal(searchProjects(projects,'FICTICIA').length,40);
 assert.equal(searchProjects(projects,'40')[0].id,'qa-40');
 assert.equal(chooseProject(projects,'qa-40'),'qa-40');
 assert.equal(searchProjects([{id:'qa',name:'Jardín sintético'}],'jardin').length,1);
});
test('revoked or forged selection cannot add a property',()=>{
 assert.equal(chooseProject(projects.slice(0,2),'qa-40'),'qa-1');
 assert.equal(chooseProject([],'qa-1'),'');
 assert.equal(searchProjects(projects,'not present').length,0);
});
test('preferences isolated per user, never treated as authorization',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 projectPreference(storage,'user-a','qa-40');
 assert.equal(projectPreference(storage,'user-b'),'');
 assert.equal(chooseProject(projects.slice(0,1),projectPreference(storage,'user-a')),'qa-1');
});
test('unavailable browser storage does not break navigation',()=>{
 const storage={getItem(){throw Error('disabled')},setItem(){throw Error('quota')}};
 assert.equal(projectPreference(storage,'qa-user'),'');
 assert.equal(projectPreference(storage,'qa-user','qa-1'),'');
});
