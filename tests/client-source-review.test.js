import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProjectMeetings} from '../src/js/ui-client-source-review.js';

test('visor QA separa copropiedades y no convierte historial en citas nuevas',()=>{
 const records=[
  {source_project_id:1,event_date:'2026-11-03',historical_only:true,status_source:'Confirmada'},
  {source_project_id:2,event_date:'2026-11-03',historical_only:true,status_source:'Confirmada'},
  {source_project_id:1,event_date:'2026-11-03',historical_only:false,status_source:'Confirmada'},
  {source_project_id:1,event_date:'no-fecha',historical_only:true,status_source:'Confirmada'}
 ];
 assert.equal(selectProjectMeetings(records,1).length,1);
 assert.equal(selectProjectMeetings(records,2).length,1);
 assert.equal(selectProjectMeetings(records,3).length,0);
});
