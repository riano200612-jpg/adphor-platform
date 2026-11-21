import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePortoFile } from '../src/js/components/porto-media.js';

test('valida formatos multimedia permitidos', () => {
  for(const [type, expected] of [
    ['image/png','image'],['image/jpeg','image'],['image/webp','image'],
    ['video/mp4','video'],['video/quicktime','video'],
    ['audio/mpeg','audio'],['audio/wav','audio'],['audio/mp4','audio'],
    ['application/pdf','pdf'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','office'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','office'],
  ]) assert.equal(validatePortoFile({type,size:1024}),expected);
});
test('rechaza tipo desconocido', () => {
  assert.throws(() => validatePortoFile({type:'text/html',size:8}),/Formato no permitido/);
});
test('rechaza archivo vacío', () => {
  assert.throws(() => validatePortoFile({type:'image/png',size:0}),/vacío/);
});
test('rechaza archivo de más de 50 MB', () => {
  assert.throws(() => validatePortoFile({type:'video/mp4',size:50*1024*1024+1}),/supera/);
});
