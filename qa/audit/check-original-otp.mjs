// Read-only reproduction. Pass the PRIVATE original MFA.js path; never commit that file.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.argv[2],'utf8');
const start=source.indexOf('function validarOTP('),end=source.indexOf('\n/**',start);
assert.ok(start>=0 && end>start,'Original function not found');
const row=Array(16).fill('');row[0]='synthetic-user';
const sheet={getDataRange:()=>({getValues:()=>[[],row]}),getRange:()=>({setValue:()=>{}})};
const context={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet})}};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context,{timeout:1000});
const result=vm.runInContext("validarOTP('synthetic-user','')",context,{timeout:1000});
assert.equal(result.success,true,'Reported defect not reproduced; reassess original version');
console.log('DEFECT REPRODUCED: original OTP function accepts empty code and timestamp. Synthetic in-memory fixture; no real login attempted.');
