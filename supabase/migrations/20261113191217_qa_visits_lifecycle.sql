-- QA ONLY. Prepared for review; do not apply to production.
-- Existing qa_visits remains the sole visit record. No operational seed data.
begin;
alter table public.qa_visits
 add column status text not null default 'programada'
   check(status in ('programada','en_ejecucion','completada','cancelada')),
 add column version integer not null default 1 check(version > 0),
 add column started_at timestamptz,
 add column finished_at timestamptz,
 add column observations text not null default '' check(length(observations)<=4000),
 add column activities text not null default '' check(length(activities)<=4000),
 add column conclusions text not null default '' check(length(conclusions)<=4000),
 add column commitments text not null default '' check(length(commitments)<=4000),
 add column cancellation_reason text not null default '' check(length(cancellation_reason)<=1000),
 add constraint qa_visits_finite_schedule check(isfinite(scheduled_at)),
 add constraint qa_visits_lifecycle_consistent check(
   (status='programada' and started_at is null and finished_at is null) or
   (status='en_ejecucion' and started_at is not null and finished_at is null) or
   (status='completada' and started_at is not null and finished_at is not null and finished_at>=started_at and length(btrim(conclusions))>0) or
   (status='cancelada' and finished_at is not null and (started_at is null or finished_at>=started_at) and length(btrim(cancellation_reason))>0)
 );

create table public.qa_visit_history (
 project_id text not null,
 request_id uuid not null,
 version integer not null,
 operation_id uuid not null,
 action text not null check(action in ('create','baseline','edit','start','progress','finish','cancel')),
 payload jsonb not null,
 snapshot jsonb not null,
 actor_id uuid not null references auth.users(id),
 occurred_at timestamptz not null default clock_timestamp(),
 primary key(project_id,request_id,version),
 unique(project_id,request_id,operation_id),
 foreign key(project_id,request_id) references public.qa_visits(project_id,request_id)
);
alter table public.qa_visit_history enable row level security;
revoke all on public.qa_visit_history from public,anon,authenticated;
grant select on public.qa_visit_history to authenticated;
create policy qa_visit_history_read on public.qa_visit_history for select to authenticated
 using(qa_identity_private.current_principal() is not null and (select auth.jwt()->>'aal')='aal2'
   and public.project_role(project_id) is not null);

-- A baseline records existing rows, not invented lifecycle events.
insert into public.qa_visit_history(project_id,request_id,version,operation_id,action,payload,snapshot,actor_id,occurred_at)
 select project_id,request_id,version,request_id,'baseline','{}',to_jsonb(v),created_by,created_at
 from public.qa_visits v;

-- Narrow insert privilege: caller-supplied creation timestamps/actor IDs and
-- lifecycle columns are prohibited. Both created_at and created_by are set
-- exclusively by PostgreSQL defaults (now() and auth.uid()).
-- The existing security-invoker qa_create_visit RPC inserts only these five
-- caller-supplied fields, so it remains compatible with this grant.
revoke insert on public.qa_visits from authenticated;
grant insert(project_id,request_id,responsible_id,motive,scheduled_at)
 on public.qa_visits to authenticated;
create function qa_identity_private.audit_visit_creation() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into public.qa_visit_history(project_id,request_id,version,operation_id,action,payload,snapshot,actor_id)
 values(new.project_id,new.request_id,new.version,new.request_id,'create','{}',to_jsonb(new),new.created_by);
 return new;
end;$$;
revoke all on function qa_identity_private.audit_visit_creation() from public,anon,authenticated;
create trigger qa_visit_created after insert on public.qa_visits
 for each row execute function qa_identity_private.audit_visit_creation();

-- Deliberately narrow SECURITY DEFINER API: no UPDATE/DELETE grants on visit or
-- history tables. Explicit principal, AAL2, membership and scope checks precede
-- every row read; row lock + version prevent lost updates. search_path is empty.
create function public.qa_transition_visit(p_project text,p_request uuid,p_operation uuid,
 p_version integer,p_action text,p_payload jsonb default '{}') returns public.qa_visits
 language plpgsql security definer set search_path='' as $$
declare v public.qa_visits; prior public.qa_visit_history; next_status text;
begin
 if auth.uid() is null or qa_identity_private.current_principal() is null
  or (auth.jwt()->>'aal') is distinct from 'aal2'
  or coalesce(public.project_role(p_project),'') not in ('admin','coordinator') then
  raise exception 'Visita no autorizada' using errcode='42501';
 end if;
 if p_operation is null or p_version is null or p_version<1 or p_action is null
  or p_action not in ('edit','start','progress','finish','cancel')
  or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
  raise exception 'Solicitud de visita inválida' using errcode='22023';
 end if;
 select * into v from public.qa_visits where project_id=p_project and request_id=p_request for update;
 if not found then raise exception 'Visita no disponible' using errcode='42501';end if;
 select * into prior from public.qa_visit_history
  where project_id=p_project and request_id=p_request and operation_id=p_operation;
 if found then
  if prior.actor_id is distinct from auth.uid() or prior.action is distinct from p_action
   or prior.payload is distinct from jsonb_build_object('version',p_version,'data',p_payload) then
   raise exception 'Conflicto de reintento' using errcode='23505';
  end if;
  return jsonb_populate_record(null::public.qa_visits,prior.snapshot);
 end if;
 if v.version<>p_version then raise exception 'La visita cambió; vuelve a consultarla' using errcode='40001';end if;
 if v.status in ('completada','cancelada') then raise exception 'Visita cerrada' using errcode='22023';end if;
 next_status:=v.status;
 case p_action
 when 'edit' then
  if v.status<>'programada' or (p_payload - array['responsible_id','motive','scheduled_at'])<>'{}'::jsonb
   or not (p_payload ?& array['responsible_id','motive','scheduled_at'])
   or jsonb_typeof(p_payload->'responsible_id') is distinct from 'string'
   or jsonb_typeof(p_payload->'motive') is distinct from 'string'
   or jsonb_typeof(p_payload->'scheduled_at') is distinct from 'string'
   or (p_payload->>'scheduled_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
   raise exception 'Edición no válida' using errcode='22023';end if;
  v.responsible_id:=(p_payload->>'responsible_id')::uuid;
  v.motive:=btrim(p_payload->>'motive');v.scheduled_at:=(p_payload->>'scheduled_at')::timestamptz;
 when 'start' then
  if v.status<>'programada' or p_payload<>'{}'::jsonb then raise exception 'Ingreso no válido' using errcode='22023';end if;
  next_status:='en_ejecucion';v.started_at:=clock_timestamp();
 when 'progress','finish' then
  if v.status<>'en_ejecucion' or (p_payload - array['observations','activities','conclusions','commitments'])<>'{}'::jsonb
   or not (p_payload ?& array['observations','activities','conclusions','commitments']) then
   raise exception 'Seguimiento no válido' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(p_payload) e where jsonb_typeof(e.value)<>'string') then
   raise exception 'Resultados no válidos' using errcode='22023';end if;
  v.observations:=btrim(p_payload->>'observations');v.activities:=btrim(p_payload->>'activities');
  v.conclusions:=btrim(p_payload->>'conclusions');v.commitments:=btrim(p_payload->>'commitments');
  if p_action='finish' then next_status:='completada';v.finished_at:=clock_timestamp();end if;
 when 'cancel' then
  if (p_payload - 'reason')<>'{}'::jsonb or jsonb_typeof(p_payload->'reason') is distinct from 'string'
   or length(btrim(p_payload->>'reason'))=0 then raise exception 'Motivo de cancelación requerido' using errcode='22023';end if;
  next_status:='cancelada';v.cancellation_reason:=btrim(p_payload->>'reason');v.finished_at:=clock_timestamp();
 end case;
 update public.qa_visits set status=next_status,version=v.version+1,responsible_id=v.responsible_id,
  motive=v.motive,scheduled_at=v.scheduled_at,started_at=v.started_at,finished_at=v.finished_at,
  observations=v.observations,activities=v.activities,conclusions=v.conclusions,commitments=v.commitments,
  cancellation_reason=v.cancellation_reason
 where project_id=p_project and request_id=p_request returning * into v;
 insert into public.qa_visit_history(project_id,request_id,version,operation_id,action,payload,snapshot,actor_id)
 values(p_project,p_request,v.version,p_operation,p_action,jsonb_build_object('version',p_version,'data',p_payload),to_jsonb(v),auth.uid());
 return v;
end;$$;
revoke all on function public.qa_transition_visit(text,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.qa_transition_visit(text,uuid,uuid,integer,text,jsonb) to authenticated;
-- ADPHOR QA: private Visit evidence is separate from PQRS/recorridos.
-- No production storage, no public URLs, no new Supabase project.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('qa-visit-evidence','qa-visit-evidence',false,20971520,
 array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']);

create table public.qa_visit_evidence(
 id uuid primary key,
 project_id text not null,
 request_id uuid not null,
 storage_bucket text not null default 'qa-visit-evidence'
  check(storage_bucket='qa-visit-evidence'),
 storage_path text not null unique,
 media_type text not null check(media_type in
  ('image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf')),
 file_bytes bigint not null check(file_bytes between 1 and 20971520),
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(project_id,request_id) references public.qa_visits(project_id,request_id),
 constraint qa_visit_evidence_exact_path check(
  storage_path=project_id||'/visitas/'||request_id::text||'/'||uploaded_by::text||'/'||id::text||'.'||
  (case media_type
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
    when 'image/webp' then 'webp' when 'video/mp4' then 'mp4'
    when 'video/webm' then 'webm' when 'application/pdf' then 'pdf'
   end)
 )
);
create index qa_visit_evidence_scoped on public.qa_visit_evidence(project_id,request_id,created_at,id);
alter table public.qa_visit_evidence enable row level security;
revoke all on public.qa_visit_evidence from public,anon,authenticated;
grant select on public.qa_visit_evidence to authenticated;
-- Metadata timestamps are always database-owned, not user-controlled.
grant insert(id,project_id,request_id,storage_bucket,storage_path,media_type,file_bytes,uploaded_by)
 on public.qa_visit_evidence to authenticated;

create policy qa_visit_evidence_aal2 on public.qa_visit_evidence as restrictive
 for all to authenticated
 using (qa_identity_private.current_principal() is not null
    and (select auth.jwt()->>'aal')='aal2')
 with check (qa_identity_private.current_principal() is not null
    and (select auth.jwt()->>'aal')='aal2');
create policy qa_visit_evidence_read on public.qa_visit_evidence
 for select to authenticated using(
  public.project_role(project_id) in ('admin','coordinator','technician')
 );
create policy qa_visit_evidence_insert on public.qa_visit_evidence
 for insert to authenticated with check(
   uploaded_by=(select auth.uid())
   and public.project_role(project_id) in ('admin','coordinator')
   and exists (
     select 1 from storage.objects o
     where o.bucket_id='qa-visit-evidence' and o.name=storage_path
       and o.owner_id=(select auth.uid())::text
   )
 );

-- RLS for the dedicated private Storage bucket: no anonymous reads or writes,
-- no cross-property records, no other visit path, no updates/deletions.
create policy qa_visit_object_upload on storage.objects
 for insert to authenticated with check(
   bucket_id='qa-visit-evidence'
   and qa_identity_private.current_principal() is not null
   and (select auth.jwt()->>'aal')='aal2'
   and public.project_role(split_part(name,'/',1)) in ('admin','coordinator')
   and split_part(name,'/',2)='visitas'
   and split_part(name,'/',4)=(select auth.uid())::text
   and array_length(string_to_array(name,'/'),1)=5
   and split_part(name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and split_part(name,'/',5) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp|mp4|webm|pdf)$'
   and exists(
     select 1 from public.qa_visits v
     where v.project_id=split_part(name,'/',1)
       and v.request_id::text=split_part(name,'/',3)
   )
 );
create policy qa_visit_object_read on storage.objects
 for select to authenticated using(
   bucket_id='qa-visit-evidence'
   and qa_identity_private.current_principal() is not null
   and (select auth.jwt()->>'aal')='aal2'
   and public.project_role(split_part(name,'/',1)) in ('admin','coordinator','technician')
   and split_part(name,'/',2)='visitas'
   and exists(
     select 1 from public.qa_visits v
     where v.project_id=split_part(name,'/',1)
       and v.request_id::text=split_part(name,'/',3)
   )
 );
commit;
