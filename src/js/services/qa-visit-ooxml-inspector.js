// Inspect an Office OpenXML package before it reaches private Storage.
// Client-side defense in depth; server-side AAL2, RLS and bucket controls remain authoritative.
const MAX_ENTRIES=2048,MAX_UNPACKED=256*1024*1024,MAX_XML=16*1024*1024;
const bad=()=>{throw Error('Documento Office no válido, incompleto o potencialmente inseguro.');};
const crc32=bytes=>{
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
};
function parseZip(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<54||bytes.length>20971520)bad();
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=i=>i>=0&&i+2<=bytes.length?v.getUint16(i,true):bad();
 const u32=i=>i>=0&&i+4<=bytes.length?v.getUint32(i,true):bad();
 if(u32(0)!==0x04034b50)bad();
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){end=i;break;}
 }
 if(end<0||u16(end+4)!==0||u16(end+6)!==0)bad();
 const count=u16(end+10),directorySize=u32(end+12),directoryStart=u32(end+16);
 if(count!==u16(end+8)||count<3||count>MAX_ENTRIES||directoryStart===0xffffffff||
    directorySize===0xffffffff||directoryStart+directorySize!==end)bad();
 const entries=new Map();let pos=directoryStart,expanded=0;
 const decoder=new TextDecoder('utf-8',{fatal:true});
 for(let i=0;i<count;i++){
  if(pos+46> end||u32(pos)!==0x02014b50)bad();
  const flags=u16(pos+8),method=u16(pos+10),checksum=u32(pos+16),
   compressed=u32(pos+20),unpacked=u32(pos+24);
  const nameLen=u16(pos+28),extraLen=u16(pos+30),commentLen=u16(pos+32);
  const local=u32(pos+42);
  if((flags&0x41)!==0||![0,8].includes(method)||compressed===0xffffffff||
    unpacked===0xffffffff||!nameLen||nameLen>1024||
    pos+46+nameLen+extraLen+commentLen>end||local+30>directoryStart||
    u16(pos+34)!==0)bad();
  let name;
  try{name=decoder.decode(bytes.subarray(pos+46,pos+46+nameLen));}catch{bad();}
  if(name.includes('\\')||name.startsWith('/')||name.includes('\0')||
    name.split('/').some(part=>part==='.'||part==='..')||
    entries.has(name)||/^([a-z]:|\/\/)/i.test(name)||
    /(^|\/)vbaProject\.bin$/i.test(name)||/(^|\/)activeX\//i.test(name))bad();
  if(u32(local)!==0x04034b50||u16(local+8)!==method||
    u16(local+6)!==flags)bad();
  const localNameLen=u16(local+26),localExtraLen=u16(local+28);
  const dataOffset=local+30+localNameLen+localExtraLen;
  if(localNameLen!==nameLen||dataOffset+compressed>directoryStart||
    decoder.decode(bytes.subarray(local+30,local+30+localNameLen))!==name||
    (method===0&&compressed!==unpacked))bad();
  if((flags&8)===0&&(u32(local+14)!==checksum||
    u32(local+18)!==compressed||u32(local+22)!==unpacked))bad();
  expanded+=unpacked;
  if(expanded>MAX_UNPACKED)bad();
  entries.set(name,{start:dataOffset,compressed,unpacked,method,checksum});
  pos+=46+nameLen+extraLen+commentLen;
 }
 if(pos!==end)bad();
 return entries;
}
async function readXml(bytes,entry){
 if(!entry||entry.unpacked<20||entry.unpacked>MAX_XML)bad();
 const packed=bytes.subarray(entry.start,entry.start+entry.compressed);
 let unpacked=packed;
 if(entry.method===8){
  if(typeof DecompressionStream!=='function')bad();
  try{
   const reader=new Blob([packed]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw')).getReader();
   const chunks=[];let length=0;
   while(true){
    const {value,done}=await reader.read();
    if(done)break;
    length+=value.length;
    if(length>entry.unpacked||length>MAX_XML){await reader.cancel();bad();}
    chunks.push(value);
   }
   unpacked=new Uint8Array(length);
   let index=0;for(const chunk of chunks){unpacked.set(chunk,index);index+=chunk.length;}
  }catch{bad();}
 }
 if(unpacked.length!==entry.unpacked||crc32(unpacked)!==entry.checksum)bad();
 let xml;
 try{xml=new TextDecoder('utf-8',{fatal:true}).decode(unpacked);}catch{bad();}
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))bad();
 return xml;
}
export async function validateQaVisitOfficePackage(bytes,kind){
 if(kind!=='docx'&&kind!=='xlsx')bad();
 const entries=parseZip(bytes);
 const main=kind==='docx'?'word/document.xml':'xl/workbook.xml';
 if(!entries.has('[Content_Types].xml')||!entries.has('_rels/.rels')||
    !entries.has(main))bad();
 if(kind==='xlsx'&&(!entries.has('xl/_rels/workbook.xml.rels')||
   !Array.from(entries.keys()).some(x=>/^xl\/worksheets\/[^/]+\.xml$/.test(x))))bad();
 const types=await readXml(bytes,entries.get('[Content_Types].xml'));
 const rels=await readXml(bytes,entries.get('_rels/.rels'));
 const body=await readXml(bytes,entries.get(main));
 if(!/<(?:\w+:)?Types\b/.test(types)||!/<(?:\w+:)?Relationships\b/.test(rels)||
   !/officeDocument/.test(rels)||!types.includes('/'+main))bad();
 if(kind==='docx'){
  if(!/wordprocessingml\.document\.main\+xml/.test(types)||
     !/<(?:\w+:)?document\b/.test(body)||!/wordprocessingml/.test(body))bad();
 }else{
  if(!/spreadsheetml\.sheet\.main\+xml/.test(types)||
     !/<(?:\w+:)?workbook\b/.test(body)||!/spreadsheetml/.test(body))bad();
  const relationships=await readXml(bytes,entries.get('xl/_rels/workbook.xml.rels'));
  if(!/relationships\/worksheet/.test(relationships))bad();
 }
 return true;
}
