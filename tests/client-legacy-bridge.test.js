import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAppsScriptExecUrl,clientServiceUrl} from '../src/js/ui-client-legacy-bridge.js';
const url='https://script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec';
test('bridge accepts only Google Apps Script /exec and normalizes query data',()=>{
 assert.equal(normalizeAppsScriptExecUrl(url+'?page=form&secret=sensitive'),url);
 assert.equal(clientServiceUrl(url,'form'),url+'?page=form');
 assert.equal(clientServiceUrl(url,'status'),url+'?page=status');
 assert.throws(()=>clientServiceUrl(url,'evil'));
});
test('bridge blocks /dev, fake hosts, credentials and non-https schemes',()=>{
 for(const candidate of [
   url.replace('/exec','/dev'),
   url.replace('script.google.com','script.google.com.evil.org'),
   url.replace('https:','http:'),
   'javascript:alert(1)',
   'https://user:pass@script.google.com/macros/s/AKfycbxw64JyydOaye-GksILdtYO4KvshS3OrNW6lXAKmq_Q/exec'
 ]) assert.throws(()=>normalizeAppsScriptExecUrl(candidate));
});
