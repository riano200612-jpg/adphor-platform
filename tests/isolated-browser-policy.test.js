import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedBrowserUrlAllowed} from '../qa/isolated-browser-policy.js';
test('isolated browser permits only the exact local QA server origin',()=>{
 assert.equal(isolatedBrowserUrlAllowed('http://127.0.0.1:8000/adphor-platform/visits-isolated-fixture'),true);
 for(const url of ['https://qfctnnnnltghepwujpdm.supabase.co','https://oqizvirqjwbbhyyjpthq.supabase.co','https://www.googleapis.com/calendar/v3/calendars','http://127.0.0.1:8001','http://127.0.0.1:8000.evil.test/','http://127.0.0.1:8000@evil.test/','invalid'])assert.equal(isolatedBrowserUrlAllowed(url),false);
});
