import test from 'node:test';
import assert from 'node:assert/strict';
import {mapClientPropertyRow,mapAuthorizedPropertyRows} from '../src/js/services/client-property-mapping.js';
const make=()=>{const r=Array(19).fill('');r[0]='c-100';r[1]='Torre Porto';r[2]='delegado-5';r[5]='foto-restringida';r[6]='Cartagena';r[11]=24;r[15]=40;r[17]=12;return r;};
test('adapts all indexed columns and preserves non-numeric missing values',()=>{
 const value=mapClientPropertyRow(make());assert.equal(value.name,'Torre Porto');assert.equal(value.delegateId,'delegado-5');assert.equal(value.units.residential,24);assert.equal(value.units.total,40);assert.equal(value.floors,12);assert.equal(value.constructionYear,null);
});
test('only explicitly authorized IDs are returned, never isAdmin from browser',()=>{
 const a=make(),b=make();b[0]='c-200';b[1]='Otra';
 const rows=[Array(19).fill('encabezado'),a,b];
 assert.deepEqual(mapAuthorizedPropertyRows(rows,{authorizedSourceIds:new Set(['c-100'])}).map(x=>x.sourceId),['c-100']);
 assert.throws(()=>mapAuthorizedPropertyRows(rows,{isAdmin:true}),/autorizados/);
});
test('invalid identifiers cannot become imported property records',()=>{const r=make();r[0]='';assert.throws(()=>mapClientPropertyRow(r));});
