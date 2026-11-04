import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const target=JSON.parse(await readFile(new URL('./integration-target.json',import.meta.url),'utf8'));
export function assertReleaseContext(env){
 if(env.GITHUB_REPOSITORY!==target.repository||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!==`refs/heads/${target.branch}`)throw Error('QA_RELEASE_BLOCKED: repository, event or branch mismatch');
 if(!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''))throw Error('QA_RELEASE_BLOCKED: commit SHA missing');
 if(env.ADPHOR_QA_DEPLOY_ENABLED!=='true'||env.ADPHOR_QA_ACCESS_VERIFIED!=='true')throw Error('QA_RELEASE_BLOCKED: deployment and Access approval required');
 if(env.ADPHOR_QA_URL!==target.qaUrl||env.CLOUDFLARE_ACCOUNT_ID!==target.cloudflareAccountId)throw Error('QA_RELEASE_BLOCKED: exact target mismatch');
 if(env.VITE_SUPABASE_URL!==`https://${target.supabaseRef}.supabase.co`)throw Error('QA_RELEASE_BLOCKED: isolated QA database required');
 if(!env.VITE_SUPABASE_ANON_KEY?.startsWith('sb_publishable_'))throw Error('QA_RELEASE_BLOCKED: a publishable QA key is required');
 if(!env.CLOUDFLARE_API_TOKEN)throw Error('QA_RELEASE_BLOCKED: Cloudflare credential unavailable');
}
export function assertAccessRedirect(status,location){
 if(![302,303,307].includes(status)||!location)throw Error('QA_RELEASE_BLOCKED: anonymous request was not redirected to Access');
 let url;try{url=new URL(location);}catch{throw Error('QA_RELEASE_BLOCKED: invalid Access redirect');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.cloudflareaccess.com')||!url.pathname.startsWith('/cdn-cgi/access/login/'))throw Error('QA_RELEASE_BLOCKED: redirect is not Cloudflare Access');
}
export async function preflight(env=process.env,request=fetch){
 assertReleaseContext(env);
 const response=await request(`https://api.cloudflare.com/client/v4/accounts/${target.cloudflareAccountId}/pages/projects/${target.pagesProject}`,{
  headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('QA_RELEASE_BLOCKED: cannot read Pages configuration');
 const body=await response.json();const project=body.result;
 const production=project?.production_branch||project?.source?.config?.production_branch;
 if(body.success!==true||project?.name!==target.pagesProject||!production||production===target.branch)throw Error('QA_RELEASE_BLOCKED: target is missing or QA would target production');
 const access=await request(target.qaUrl,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
 assertAccessRedirect(access.status,access.headers.get('location'));
 console.log('QA preflight passed for the configured preview target. Human Access allow/deny tests remain a release prerequisite.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await preflight();}catch(error){console.error(error.message);process.exitCode=1;}
}
