import {readFileSync} from 'node:fs';
import {runBootstrapCheck,validateConfig} from './private-worker-bootstrap-core.mjs';
const phase=process.argv[2];
try {
  validateConfig(JSON.parse(readFileSync(new URL('../../backend/wrangler.qa.jsonc',import.meta.url),'utf8')));
  const result=await runBootstrapCheck(phase);
  process.stdout.write(result+'\n');
}catch(err) {
  // No provider responses or tokens are emitted.
  process.stderr.write('ERROR: '+(err instanceof Error?err.message:'QA bootstrap check failed')+'\n');
  process.exitCode=1;
}
