import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeChromiumHandshake} from '../qa/chromium-handshake-evidence.js';
test('CDP evidence distinguishes sent requests, matching responses and incomplete handshake',()=>{
 const trace=`pw:protocol SEND ► {"id":1,"method":"Browser.getVersion","params":{}}
pw:protocol ◀ RECV {"id":999,"result":{}}
pw:protocol SEND ► {"id":2,"method":"Target.setAutoAttach","params":{}}
pw:protocol ◀ RECV {"id":1,"result":{"product":"HeadlessChrome"}}
pw:protocol ◀ RECV {broken}`;
 assert.deepEqual(summarizeChromiumHandshake(trace),[
  {id:1,method:'Browser.getVersion',sent:true,received:true,error:null},
  {id:2,method:'Target.setAutoAttach',sent:true,received:false}
 ]);
 assert.deepEqual(summarizeChromiumHandshake('<launched> pid=29366'),[]);
});
