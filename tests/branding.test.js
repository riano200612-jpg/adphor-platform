import test from 'node:test';import assert from 'node:assert/strict';
import {approvedAvatarPath,loginAvatarMarkup} from '../src/js/services/branding.js';
test('accepts only vetted same-origin ADPHOR branding assets',()=>{
 assert.equal(approvedAvatarPath('/assets/branding/miss-adphor.webp'),'/assets/branding/miss-adphor.webp');
 for(const x of ['https://drive.google.com/personal.jpg','//example.com/x.png','/assets/../private.png','/assets/branding/x.svg','/assets/branding/x.png?token=abc'])assert.equal(approvedAvatarPath(x),'');
});
test('fallback is neutral until client avatar is authorized',()=>{
 assert.match(loginAvatarMarkup(''),/AD/);
 assert.doesNotMatch(loginAvatarMarkup(''),/https?:/);
 assert.match(loginAvatarMarkup('/assets/branding/miss-adphor.webp'),/<img/);
});

test('original corporate portrait is a real bundled WebP asset',async()=>{
 const {readFileSync}=await import('node:fs');
 const photo=readFileSync(new URL('../public/assets/branding/miss-adphor.webp',import.meta.url));
 assert.equal(photo.subarray(0,4).toString(),'RIFF');
 assert.equal(photo.subarray(8,12).toString(),'WEBP');
 const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
 const match=app.match(/VITE_ADPHOR_AVATAR_PATH\s*\|\|\s*'([^']+)'/);
 assert.ok(match,'App must declare a default corporate avatar');
 const current=match[1];
 assert.equal(approvedAvatarPath(current),current,'Current avatar path must remain same-origin and vetted');
 const bundled=readFileSync(new URL('../public'+current,import.meta.url));
 assert.equal(bundled.subarray(0,4).toString(),'RIFF');
 assert.equal(bundled.subarray(8,12).toString(),'WEBP');
});


test('QA integral uses original-preserving corporate embroidery portrait in both entrances',async()=>{
  const {readFileSync}=await import('node:fs');
  const {createHash}=await import('node:crypto');
  const edited=readFileSync(new URL('../public/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp',import.meta.url));
  const original=readFileSync(new URL('../public/assets/branding/miss-adphor-qa-integral(4).webp',import.meta.url));
  assert.equal(edited.subarray(0,4).toString(),'RIFF');
  assert.equal(edited.subarray(8,12).toString(),'WEBP');
  assert.ok(edited.length>100_000,'Corrected portrait must be a real asset, not a placeholder');
  assert.notEqual(createHash('sha256').update(edited).digest('hex'),createHash('sha256').update(original).digest('hex'));
  const app=readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
  const chat=readFileSync(new URL('../src/js/ui-miss-adphor-chat.js',import.meta.url),'utf8');
  assert.ok(app.includes("VITE_ADPHOR_AVATAR_PATH || '/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp'"));
  assert.ok(chat.includes("const img='/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp'"));
  assert.equal(approvedAvatarPath('/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp'),'/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp');
});
