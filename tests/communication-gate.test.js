import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOutboundAuthorized} from '../src/js/services/communication-gate.js';
test('no test emails, WhatsApp or SMS may be sent from QA',()=>{
 assert.throws(()=>assertOutboundAuthorized({adminApproved:true,providerConfigured:true,environment:'qa'}),/bloqueado/);
});
test('production delivery requires explicit approval and configured provider',()=>{
 assert.throws(()=>assertOutboundAuthorized({adminApproved:false,providerConfigured:true,environment:'production'}));
 assert.throws(()=>assertOutboundAuthorized({adminApproved:true,providerConfigured:false,environment:'production'}));
 assert.equal(assertOutboundAuthorized({adminApproved:true,providerConfigured:true,environment:'production'}),true);
});
