import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLocalMeeting} from '../src/js/services/demo-meeting-rules.js';
test('QA meeting evaluation proposes managerial review for emergencies',()=>{
 const x=assessLocalMeeting({subject:'Emergencia de seguridad en portería'});
 assert.equal(x.priority_level,'alto');assert.equal(x.requires_management,true);assert.equal(x.booking_authorized,false);
});
test('QA meeting ordinary topics remain advisory',()=>{
 const x=assessLocalMeeting({subject:'Asamblea ordinaria'});
 assert.equal(x.priority_level,'bajo');assert.equal(x.requires_management,false);
});
test('QA meeting can request management and rejects empty subject',()=>{
 assert.equal(assessLocalMeeting({subject:'Reunión ordinaria',management_requested:true}).requires_management,true);
 assert.throws(()=>assessLocalMeeting({subject:' '}));
});
