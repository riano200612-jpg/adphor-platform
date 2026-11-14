// Isolated PostgreSQL engine + synthetic identities. Never a Supabase certification.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
export const visitMigration='supabase/migrations/20261113191217_qa_visits_lifecycle.sql';
export const visitUsers={admin:'00000000-0000-0000-0000-000000000001',coord:'00000000-0000-0000-0000-000000000002',viewer:'00000000-0000-0000-0000-000000000003',other:'00000000-0000-0000-0000-000000000004',inactive:'00000000-0000-0000-0000-000000000005'};
export async function createVisitFixture(){
 const db=new PGlite();await db.waitReady;
 await initializeVisitFixture(db);
 // A transaction owns synthetic claims for its entire duration, including failures.
 async function as(user,aal,sql,params=[]){
  return db.transaction(async tx=>{
   await tx.query("select set_config('test.uid',$1,true),set_config('test.aal',$2,true)",[user??'',aal]);
   await tx.exec('set local role authenticated');
   return tx.query(sql,params);
  });
 }
 const create=(id,overrides={},user=visitUsers.admin,aal='aal2')=>as(user,aal,'select * from qa_create_visit($1,$2,$3,$4,$5)',['p1',id,visitUsers.admin,'Inspección sintética','2026-11-14T10:00:00-05:00'].map((v,i)=>Object.hasOwn(overrides,i)?overrides[i]:v));
 const transition=({requestId,operationId,version=1,action,values={},projectId='p1'},user=visitUsers.admin,aal='aal2')=>as(user,aal,'select * from qa_transition_visit($1,$2,$3,$4,$5,$6)',[projectId,requestId,operationId,version,action,values]);
 return {db,as,create,transition};
}
export async function initializeVisitFixture(db){
 await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
 grant usage on schema auth to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert on storage.objects to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/202610190001_workflow.sql','utf8'));
 await db.exec(readFileSync('qa/database/supabase/migrations/20261105144315_qa_authorized_principals.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261111133108_qa_shared_visits_scheduled_contract.sql','utf8'));
 await db.exec(readFileSync(visitMigration,'utf8'));
 await db.exec("insert into projects(id,name,areas) values('p1','Fixture 1',array['Zona']),('p2','Fixture 2',array['Zona']);");
 for(const [key,id] of Object.entries(visitUsers)){
  await db.query('insert into auth.users values($1,$2,now())',[id,key+'@fixture.invalid']);
  await db.query('insert into profiles(id,name) values($1,$2)',[id,key]);
  await db.query('insert into memberships(project_id,user_id,role) values($1,$2,$3)',[key==='other'?'p2':'p1',id,key==='viewer'?'viewer':key==='admin'?'admin':'coordinator']);
  await db.query('insert into qa_identity_private.principals(email,display_name,application_role,membership_role,active) values($1,$2,$3,$4,$5)',[key+'@fixture.invalid',key,key==='admin'?'technical_admin':'functional_admin_auditor',key==='admin'?'admin':'coordinator',key!=='inactive']);
 }
}

// Supabase transport substitute for isolated tests; queries/RPCs execute the real
// SQL migrations. Authentication claims are synthetic, never production tokens.
export function visitSqlClient(f,user=visitUsers.admin){
 const answer=async operation=>{try{return {data:JSON.parse(JSON.stringify((await operation()).rows))};}catch(error){return {error:{message:error.message,code:error.code}};}};
 return {
  auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})},getUser:async()=>({data:{user:{id:user}}})},
  rpc(name,p){
   if(name==='qa_create_visit')return answer(()=>f.as(user,'aal2','select * from qa_create_visit($1,$2,$3,$4,$5)',[p.p_project,p.p_request,p.p_responsible,p.p_motive,p.p_scheduled]));
   if(name==='qa_transition_visit')return answer(()=>f.transition({projectId:p.p_project,requestId:p.p_request,operationId:p.p_operation,version:p.p_version,action:p.p_action,values:p.p_payload},user));
   throw Error('Unknown fixture RPC');
  },
  from(table){
   if(!['memberships','qa_visits','qa_visit_history'].includes(table))throw Error('Unknown fixture table');
   const filters=[],params=[];
   const query=(offset,size)=>answer(()=>f.as(user,'aal2',`select * from ${table} where ${filters.join(' and ')} order by ${table==='qa_visit_history'?'version':table==='qa_visits'?'scheduled_at,request_id':'user_id'} limit ${size} offset ${offset}`,params));
   return {select(){return this;},eq(field,value){if(!['project_id','request_id','user_id'].includes(field))throw Error('Unknown fixture filter');params.push(value);filters.push(`${field}=$${params.length}`);return this;},order(){return this;},limit(size){return query(0,size);},range(a,b){return query(a,b-a+1);}};
  }
 };
}
