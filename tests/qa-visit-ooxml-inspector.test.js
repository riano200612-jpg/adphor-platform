import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {syntheticVisitOfficeBytes} from '../src/js/services/qa-visit-synthetic-office.js';
import {validateQaVisitOfficePackage} from '../src/js/services/qa-visit-ooxml-inspector.js';

const u16=(bytes,at)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(at,true);
const u32=(bytes,at)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(at,true);
const encoder=new TextEncoder();
function rebuildWithDeflate(original){
 const members=[];let pos=0;
 while(pos+30<original.length&&u32(original,pos)===0x04034b50){
  const n=u16(original,pos+26),extra=u16(original,pos+28),length=u32(original,pos+18);
  const name=original.slice(pos+30,pos+30+n);
  const data=original.slice(pos+30+n+extra,pos+30+n+extra+length);
  const compressed=new Uint8Array(deflateRawSync(data));
  members.push({name,data,compressed,crc:u32(original,pos+14)});
  pos+=30+n+extra+length;
 }
 assert.ok(members.length>=3);
 const blocks=[],central=[];let offset=0,centralLength=0;
 function rec(length){const b=new Uint8Array(length);return {b,v:new DataView(b.buffer)};}
 for(const m of members){
  const h=rec(30);
  h.v.setUint32(0,0x04034b50,true);h.v.setUint16(4,20,true);
  h.v.setUint16(8,8,true);h.v.setUint32(14,m.crc,true);
  h.v.setUint32(18,m.compressed.length,true);h.v.setUint32(22,m.data.length,true);
  h.v.setUint16(26,m.name.length,true);
  const b=new Uint8Array(h.b.length+m.name.length+m.compressed.length);
  b.set(h.b);b.set(m.name,30);b.set(m.compressed,30+m.name.length);
  blocks.push(b);
  const c=rec(46);c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);
  c.v.setUint16(6,20,true);c.v.setUint16(10,8,true);c.v.setUint32(16,m.crc,true);
  c.v.setUint32(20,m.compressed.length,true);c.v.setUint32(24,m.data.length,true);
  c.v.setUint16(28,m.name.length,true);c.v.setUint32(42,offset,true);
  const cbytes=new Uint8Array(46+m.name.length);cbytes.set(c.b);cbytes.set(m.name,46);
  central.push(cbytes);offset+=b.length;centralLength+=cbytes.length;
 }
 const end=rec(22);end.v.setUint32(0,0x06054b50,true);
 end.v.setUint16(8,members.length,true);end.v.setUint16(10,members.length,true);
 end.v.setUint32(12,centralLength,true);end.v.setUint32(16,offset,true);
 const all=[...blocks,...central,end.b],out=new Uint8Array(all.reduce((n,b)=>n+b.length,0));
 let at=0;for(const chunk of all){out.set(chunk,at);at+=chunk.length;}
 return out;
}
test('Office ZIP inspection confirms package type and is compatible with ordinary deflated OOXML',async()=>{
 for(const kind of ['docx','xlsx']){
  assert.equal(await validateQaVisitOfficePackage(syntheticVisitOfficeBytes(kind),kind),true);
  assert.equal(await validateQaVisitOfficePackage(rebuildWithDeflate(syntheticVisitOfficeBytes(kind)),kind),true);
 }
});
test('Office ZIP inspection rejects spoofed archives, type confusion, corruption and unsafe ZIP flags',async()=>{
 for(const kind of ['docx','xlsx']){
  const b=syntheticVisitOfficeBytes(kind);
  await assert.rejects(validateQaVisitOfficePackage(b,kind==='docx'?'xlsx':'docx'),/no válido/);
  await assert.rejects(validateQaVisitOfficePackage(b.slice(0,32),kind),/no válido/);
  const corrupted=b.slice();const marker=encoder.encode('DOCUMENTO SINTETICO');
  const at=corrupted.findIndex((_,i)=>marker.every((v,j)=>corrupted[i+j]===v));
  assert.ok(at>=0);
  corrupted[at]=0x58;
  await assert.rejects(validateQaVisitOfficePackage(corrupted,kind),/no válido/);
  const central=b.slice();const end=central.length-22;const pos=u32(central,end+16);
  central[pos+8]|=1; // encrypted flag in central directory
  await assert.rejects(validateQaVisitOfficePackage(central,kind),/no válido/);
  const oversize=b.slice();new DataView(oversize.buffer).setUint32(end+16,0xffffffff,true);
  await assert.rejects(validateQaVisitOfficePackage(oversize,kind),/no válido/);
 }
 const b=syntheticVisitOfficeBytes('docx');
 await assert.rejects(validateQaVisitOfficePackage(b,'xls'),/no válido/);
});
