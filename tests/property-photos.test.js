import test from 'node:test';
import assert from 'node:assert/strict';
import {propertyPhotoPath,signedPropertyPhoto} from '../src/js/services/property-photos.js';

test('accepts only scoped private image paths',()=>{
 assert.equal(propertyPhotoPath('porto-castello','fachada.webp'),'porto-castello/fachada.webp');
 for(const filename of ['../private.jpg','http://example.com/a.jpg','a.svg','x/y.jpg','']){
  assert.throws(()=>propertyPhotoPath('porto-castello',filename));
 }
 assert.throws(()=>propertyPhotoPath('../otro','foto.jpg'));
});
test('rejects projects outside the authorized portfolio before accessing storage',async()=>{
 let called=false;
 const storage={from(){called=true;throw Error('must not call');}};
 await assert.rejects(signedPropertyPhoto(storage,[{id:'a'}],'b','foto.jpg'),/autorizado/);
 assert.equal(called,false);
});
test('requests a five-minute signed URL from private storage',async()=>{
 let request;
 const storage={from(bucket){request={bucket};return {createSignedUrl:async(path,seconds)=>{
  request.path=path;request.seconds=seconds;
  return {data:{signedUrl:'https://signed.example.invalid/image'}};
 }}}};
 const url=await signedPropertyPhoto(storage,[{id:'porto-castello'}],'porto-castello','fachada.jpg');
 assert.equal(url,'https://signed.example.invalid/image');
 assert.deepEqual(request,{bucket:'property-photos',path:'porto-castello/fachada.jpg',seconds:300});
});
