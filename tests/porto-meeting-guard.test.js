import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingGate, formatManagementAlert } from '../src/js/components/porto-meeting-guard.js';

const now = new Date('2026-11-03T12:00:00Z');
const gate = (offsetHours, rest={}) => meetingGate({
  start:new Date(now.getTime() + offsetHours*3600000).toISOString(),now,...rest
});

test('24 horas exactas no es ventana inferior a 24h',()=>{
  assert.equal(gate(24).allowed,true);
});
test('menos de 24h genera excepción y bloquea',()=>{
  const result=gate(23.99);
  assert.equal(result.allowed,false);
  assert.equal(result.requestException,true);
});
test('colisiones siempre bloquean aun si hay aprobación',()=>{
  const result=gate(48,{conflicts:[{meeting_id:'a'}],hasApproval:true});
  assert.equal(result.allowed,false);
  assert.equal(result.suggestAlternatives,true);
});
test('reprogramación crítica requiere aprobación',()=>{
  assert.equal(gate(50,{action:'reschedule',isCritical:true}).allowed,false);
  assert.equal(gate(50,{action:'reschedule',isCritical:true,hasApproval:true}).allowed,true);
});
test('notificación de gerencia conserva tenant',()=>{
  const alert=formatManagementAlert({
    project_id:22,meeting_id:'a',requested_by:'u',
    requested_slot:{start:'2026-11-03T13:00:00Z'},reason:'urgente'
  });
  assert.equal(alert.project_id,22);
  assert.equal(alert.status,'pending');
});
