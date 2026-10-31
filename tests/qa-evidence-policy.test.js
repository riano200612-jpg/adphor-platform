import test from 'node:test';import assert from 'node:assert/strict';
import {validateQaEvidence,QA_EVIDENCE_TYPES,QA_EVIDENCE_MAX_BYTES} from '../src/js/services/qa-evidence-policy.js';
test('accepts QA evidence types within limits',()=>{
 for(const type of QA_EVIDENCE_TYPES)assert.equal(validateQaEvidence([{name:'evidence',type,size:100}]).length,1);
});
test('rejects invalid MIME, zero bytes, oversized files and excessive count',()=>{
 for(const item of [{type:'application/x-msdownload',size:2},{type:'image/png',size:0},{type:'image/png',size:QA_EVIDENCE_MAX_BYTES+1},{type:'image/png',size:NaN}])assert.throws(()=>validateQaEvidence([item]));
 assert.throws(()=>validateQaEvidence(Array.from({length:6},()=>({type:'image/png',size:1}))));
});
