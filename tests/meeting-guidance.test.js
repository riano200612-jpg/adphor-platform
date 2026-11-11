import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingGuidance} from '../src/js/ui-meeting-assessment.js';

const ready={subject:'Consejo',start:'2026-11-12T10:00',accompaniment:true,canCheck:true};

test('meeting guidance prioritizes the first missing field',()=>{
 assert.match(meetingGuidance({...ready,subject:'  '}),/asunto/);
 assert.match(meetingGuidance({...ready,start:''}),/fecha/);
 assert.match(meetingGuidance({...ready,accompaniment:false}),/Sin acompañamiento requerido/);
});

test('meeting guidance distinguishes errors, conflicts and informational review',()=>{
 assert.match(meetingGuidance({...ready,availability:'CONSULTA_FALLIDA'}),/Reintenta/);
 assert.match(meetingGuidance({...ready,availability:'OCUPADO'}),/30 minutos/);
 assert.match(meetingGuidance({...ready,availability:'DISPONIBLE'}),/no crea una reunión/);
 assert.match(meetingGuidance({...ready,canCheck:false}),/no está habilitada/);
});
