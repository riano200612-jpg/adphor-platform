import test from 'node:test';
import assert from 'node:assert/strict';
import {pqrsDraftGuidance} from '../src/js/ui-pqrs.js';

test('PQRS guide identifies missing fields before suggesting review',()=>{
 const form=(subject,description)=>({elements:{subject:{value:subject},description:{value:description}}});
 assert.match(pqrsDraftGuidance(form('  ','Detalle')),/asunto/);
 assert.match(pqrsDraftGuidance(form('Solicitud',' ')),/Describe/);
 assert.match(pqrsDraftGuidance(form('Solicitud','Detalle')),/Espera un radicado confirmado/);
});
