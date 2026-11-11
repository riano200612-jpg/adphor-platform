import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createSimulatedAgenda} from './agenda-simulated-service.js';
import {createIsolatedAgendaJournal} from './agenda-journal-isolated.js';

const [socket, phase] = process.argv.slice(2);
assert.match(socket, /^\/tmp\/adphor-agenda\.[A-Za-z0-9]+$/);
assert.ok(['write', 'recover'].includes(phase));
const file = join(socket, 'calendar.json');
const db = {
  async query(statement, params) {
    const args = params.flatMap((value, index) => ['-v', 'p'+(index+1)+'='+value]);
    const query = statement.replace(/\$(\d+)/g, (_, index) => ":'p"+index+"'");
    const input = /^select /i.test(query)
      ? "select coalesce(json_agg(t),'[]') from ("+query+") t;"
      : query+';';
    const output = execFileSync('psql', ['-XqAt','-v','ON_ERROR_STOP=1','-h',socket,
      '-U','postgres','-d','postgres',...args], {input,encoding:'utf8'});
    return {rows:output.trim() ? JSON.parse(output) : []};
  }
};
const journal = createIsolatedAgendaJournal(db);
const get = async () => JSON.parse(readFileSync(file,'utf8'));
const calendar = {
  get,
  available: async () => true,
  async update(_project, id, version, patch) {
    const event = await get();
    assert.equal(event.id,id);
    assert.equal(event.version,version);
    const changed = {...event,...patch,version:'2',writes:event.writes+1};
    writeFileSync(file,JSON.stringify(changed));
    return changed;
  }
};
const request = {actor:{id:'a',aal:'aal2'},projectId:'p',eventId:'e',version:'1',
  requestId:'restart',action:'reschedule',start:'2026-11-14T15:00:00Z',
  end:'2026-11-14T16:00:00Z',confirmed:true};
const authorize = async (actor,project) => actor==='a' && project==='p';
if (phase==='write') {
  writeFileSync(file,JSON.stringify({id:'e',projectId:'p',version:'1',writes:0}));
  const service=createSimulatedAgenda({calendar,authorize,journal:{...journal,
    confirm:async()=>{throw Error('Simulated lost SQL confirmation');}}});
  assert.equal((await service.run(request)).state,'reconcile');
  console.log('PASS: remote change persisted, SQL confirmation withheld');
} else {
  const service=createSimulatedAgenda({calendar,authorize,journal});
  assert.equal((await service.run(request)).state,'confirmed');
  assert.equal((await get()).writes,1);
  await assert.rejects(service.run({...request,action:'cancel'}),/Idempotency conflict/);
  const {rows}=await db.query('select count(*)::int as count from isolated_agenda_operations where result is not null',[]);
  assert.equal(rows[0].count,1);
  console.log('PASS: native PostgreSQL restart, independent Node process, one remote change');
}
