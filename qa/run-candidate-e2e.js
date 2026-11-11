import {spawn} from 'node:child_process';
import {totalmem} from 'node:os';
import {fileURLToPath} from 'node:url';
// Prepared execution only: does not upload, deploy or use credentials.
if(process.platform!=='linux'||process.arch!=='x64'||totalmem()<4*1024**3){
 console.error('BLOCKED: use an authorized Linux x64 QA host with at least 4 GiB RAM. Do not emulate on Crostini ARM64.');
 process.exitCode=1;
}else{
 const clean={};
 for(const key of ['PATH','HOME','TMPDIR','LANG','PLAYWRIGHT_BROWSERS_PATH'])if(process.env[key])clean[key]=process.env[key];
 Object.assign(clean,{CI:'1',VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:'',VITE_AGENTS_API_URL:'',ADPHOR_QA_AGENTS_API_URL:'',VITE_PORTO_QA_ENABLED:'false',VITE_REQUIRE_MFA:'true'});
 const root=fileURLToPath(new URL('../',import.meta.url));
 const args=['node_modules/@playwright/test/cli.js','test','--config','qa/playwright-isolated.config.js'];
 if(process.argv.includes('--list'))args.push('--list');
 const child=spawn(process.execPath,args,{cwd:root,env:clean,stdio:'inherit'});
 child.once('error',error=>{console.error(error.message);process.exitCode=1;});
 child.once('exit',(code)=>{process.exitCode=code??1;});
}
