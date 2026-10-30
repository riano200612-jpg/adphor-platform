import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingDurationHours,expectedMeetMode} from '../src/js/services/client-meeting-mapping.js';
test('Client durations default to Assembly 5h, Committee 3h and remaining 4h',()=>{
 assert.equal(meetingDurationHours('Asamblea'),5);
 assert.equal(meetingDurationHours('Comité de convivencia'),3);
 assert.equal(meetingDurationHours('Consejo'),4);
 assert.equal(meetingDurationHours('Consejo',1.5),1.5);
 assert.throws(()=>meetingDurationHours('Consejo',0));
});
test('Meet conference is only proposed when virtual or mixed AND confirmed',()=>{
 assert.equal(expectedMeetMode('Virtual','Confirmada'),true);
 assert.equal(expectedMeetMode('Mixta','Confirmado'),true);
 assert.equal(expectedMeetMode('Presencial','Confirmada'),false);
 assert.equal(expectedMeetMode('Virtual','Pendiente'),false);
});
