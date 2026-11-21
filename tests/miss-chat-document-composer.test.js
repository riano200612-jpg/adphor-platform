import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requireMissDocumentScope,sameMissDocumentScope} from '../src/js/ui-miss-chat-document-composer.js';

const authorized={userId:'user-1',project:{id:'source-1'},projectId:'source-1',
 mode:'cloud',role:'viewer'};
test('Miss ADPHOR permits an assigned user regardless of business role',()=>{
 for(const role of ['viewer','technician','coordinator','admin']){
  const scoped=requireMissDocumentScope(()=>({...authorized,role}));
  assert.equal(scoped.projectId,'source-1');
  assert.equal(scoped.role,role);
 }
});
test('Miss ADPHOR refuses demo, anonymous and mismatched property',()=>{
 for(const context of [null,{...authorized,userId:''},{...authorized,mode:'demo'},
  {...authorized,projectId:'source-2'},{...authorized,projectId:'bad/another'},
  {...authorized,project:null}])
  assert.throws(()=>requireMissDocumentScope(()=>context),/copropiedad autorizada/);
});
test('Miss upload result is not shown after actor, project or role switch',()=>{
 const current=requireMissDocumentScope(()=>authorized);
 assert.equal(sameMissDocumentScope(current,()=>authorized),true);
 for(const alternate of [{...authorized,projectId:'source-2',project:{id:'source-2'}},
  {...authorized,userId:'user-2'},{...authorized,role:'admin'},
  {...authorized,mode:'demo'}])
  assert.equal(sameMissDocumentScope(current,()=>alternate),false);
});
test('chat feature is gated from real QA repository, not demo, and never uses a Google token',()=>{
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 const chat=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
 const composer=readFileSync(new URL('../src/js/ui-miss-chat-document-composer.js',import.meta.url),'utf8');
 assert.match(app,/documentsEnabled:repo.mode==='cloud'&&repo.missDocumentsEnabled===true/);
 assert.match(chat,/const composer=documentsEnabled\?mountMissChatDocumentComposer/);
 assert.match(composer,/No se descargó el archivo de Drive/);
 assert.doesNotMatch(composer,/service_role|access_token|google\.accounts|oauth/i);
});
