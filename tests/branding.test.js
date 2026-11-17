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
