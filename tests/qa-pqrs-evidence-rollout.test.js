import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qaPrivatePqrsEvidenceAllowed} from '../src/js/services/qa-pqrs-evidence-rollout.js';
import {QA_URL,QA_REF,QA_INTEGRAL_HOST,publicQaBuildConfig} from '../src/js/services/qa-auth-policy.js';

const opts={
 url:QA_URL,qaFlag:'true',portoEnabled:'true',
 stagingRef:QA_REF,hostname:QA_INTEGRAL_HOST
};

test('only the official Access-protected QA Integral origin can enable PQRS private files',()=>{
 assert.equal(qaPrivatePqrsEvidenceAllowed(opts),true);
 const negative=[
  {...opts,hostname:'qa-pqrs-carrusel-integracion.adphor-platform.pages.dev'},
  {...opts,hostname:'localhost'},
  {...opts,hostname:'adphor-platform.pages.dev'},
  {...opts,hostname:'other.adphor-platform.pages.dev'},
  {...opts,url:'https://other.supabase.co'},
  {...opts,qaFlag:'false'},
  {...opts,qaFlag:undefined},
  {...opts,portoEnabled:'false'},
  {...opts,stagingRef:'oqizvirqjwbbhyyjpthq'}
 ];
 for(const variant of negative)assert.equal(qaPrivatePqrsEvidenceAllowed(variant),false,JSON.stringify({...variant,stagingRef:variant.stagingRef==='oqizvirqjwbbhyyjpthq'?'nonqa':'qa'}));
});

test('QA auth build signal is explicitly configuration-only and not a fake successful upload',()=>{
 const env={
  VITE_SUPABASE_URL:QA_URL,VITE_SUPABASE_ANON_KEY:'synthetic-publishable',
  VITE_REQUIRE_MFA:'true',VITE_PORTO_QA_ENABLED:'true',
  VITE_PORTO_STAGING_REF:QA_REF,VITE_QA_EVIDENCE_UPLOAD_ENABLED:'true'
 };
 const current=publicQaBuildConfig(env,{branch:'qa/integral-claude-reviewed-20261111'});
 assert.equal(current.pqrsEvidenceUploadConfigured,true);
 assert.equal(current.buildConfigurationOnly,true);
 const historic=publicQaBuildConfig(env,{branch:'qa/pqrs-carrusel-integracion-20261104'});
 assert.equal(historic.pqrsEvidenceUploadConfigured,false);
 assert.equal(publicQaBuildConfig({...env,VITE_QA_EVIDENCE_UPLOAD_ENABLED:'false'},
  {branch:'qa/integral-claude-reviewed-20261111'}).pqrsEvidenceUploadConfigured,false);
});

test('repository wires private evidence without fallback to an unverified agent backend',()=>{
 const s=readFileSync(new URL('../src/js/services/supabase.js',import.meta.url),'utf8');
 assert.match(s,/qaPrivatePqrsEvidenceAllowed\(/);
 assert.match(s,/evidence=evidenceEnabled\s*\?createQaCaseEvidenceRepository/);
 assert.match(s,/:isEvidenceQa\?null:createEvidenceApiRepository/);
 assert.match(s,/porto\.uploadEvidence=evidence\.uploadEvidence/);
 const q=readFileSync(new URL('../src/js/ui-pqrs.js',import.meta.url),'utf8');
 assert.match(q,/if\(typeof repository\.uploadEvidence!=='function'\)\{/);
 assert.match(q,/evidenceInput\.disabled=true/);
 assert.match(q,/Radicado: \$\{saved\.id\}\. Evidencias incompletas/);
 assert.match(q,/const saved=pendingCase\|\|await repository\.create/);
 const evidence=readFileSync(new URL('../src/js/services/qa-case-evidence.js',import.meta.url),'utf8');
 for(const name of ['getAuthenticatorAssuranceLevel','createSignedUrl','upsert:false','metadata_linked:true'])
  assert.ok(evidence.includes(name),name);
});
