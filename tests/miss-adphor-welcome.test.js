import assert from 'node:assert/strict';
import test from 'node:test';
import {MISS_WELCOME_VIDEO_PATH,MISS_WELCOME_SESSION_KEY,shouldOfferMissWelcome,mountMissAdphorWelcome} from '../src/js/ui-miss-adphor-welcome.js';
test('enabled only on the canonical QA Integral host',()=>{
  assert.equal(shouldOfferMissWelcome({enabled:true,hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev'}),true);
  for(const host of ['adphor-platform.pages.dev','qa-pqrs-carrusel-integracion.adphor-platform.pages.dev','localhost','example.com']){
    assert.equal(shouldOfferMissWelcome({enabled:true,hostname:host}),false);
  }
  assert.equal(shouldOfferMissWelcome({enabled:false,hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev'}),false);
});
test('assets are first party and mounting without login elements does nothing',()=>{
  assert.equal(MISS_WELCOME_VIDEO_PATH,'/assets/branding/miss-adphor-bienvenida-qa.mp4');
  assert.ok(MISS_WELCOME_SESSION_KEY.startsWith('adphor.qa.'));
  assert.equal(typeof mountMissAdphorWelcome(null),'function');
  assert.equal(typeof mountMissAdphorWelcome({querySelector(){return null;}}),'function');
});
