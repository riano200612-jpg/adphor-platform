import {readFileSync} from 'node:fs';
export const diagnosticPerson='00000000-0000-0000-0000-000000000001';
export async function bootstrapDiagnosticSql(db){
 await db.exec(`create role authenticated;
 create schema auth; grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select '${diagnosticPerson}'::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select '{"aal":"aal2"}'::jsonb $$;
 create table memberships(project_id text,user_id uuid,role text,primary key(project_id,user_id));
 grant select on memberships to authenticated;
 insert into memberships values ('p1',auth.uid(),'admin');`);
 await db.exec(readFileSync(new URL('./visit-persistence-prototype.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
}
