-- ADPHOR: apply once to a new Supabase project using the SQL editor or CLI.
begin;
create table public.projects (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  type text not null default '',
  location text not null default '',
  areas text[] not null
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120)
);
create table public.memberships (
  project_id text references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','coordinator','technician','viewer')),
  primary key(project_id,user_id)
);
create table public.tickets (
  id uuid primary key,
  project_id text not null references public.projects(id),
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null check (length(trim(description)) between 1 and 2000),
  location text not null check (length(trim(location)) between 1 and 180),
  area text not null,
  priority text not null check (priority in ('Baja','Media','Alta','Urgente')),
  assignee uuid not null,
  due_date date not null,
  status text not null default 'Pendiente' check (status in ('Pendiente','En proceso','Por verificar','Cerrada')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  history jsonb not null default '[]'::jsonb,
  foreign key(project_id,assignee) references public.memberships(project_id,user_id)
);
create index tickets_project_created on public.tickets(project_id,created_at desc);
create index memberships_user on public.memberships(user_id);

create function public.project_role(project text) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.memberships where project_id = project and user_id = (select auth.uid());
$$;
create function public.visible_profile(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target = (select auth.uid()) or exists (
    select 1 from public.memberships mine join public.memberships theirs using (project_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = target
  );
$$;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.tickets enable row level security;
revoke all on public.projects,public.profiles,public.memberships,public.tickets from anon,authenticated;
grant select on public.projects,public.profiles,public.memberships,public.tickets to authenticated;
create policy project_read on public.projects for select to authenticated using (public.project_role(id) is not null);
create policy profile_read on public.profiles for select to authenticated using (public.visible_profile(id));
create policy membership_read on public.memberships for select to authenticated using (public.project_role(project_id) is not null);
create policy ticket_read on public.tickets for select to authenticated using (public.project_role(project_id) is not null);
revoke all on function public.project_role(text),public.visible_profile(uuid) from public,anon;
grant execute on function public.project_role(text),public.visible_profile(uuid) to authenticated;

-- All mutations go through this transaction. Clients cannot forge history, actors or closures.
create function public.ticket_command(command text, payload jsonb) returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  actor_role text;
  project text;
  target_id uuid := (payload->>'id')::uuid;
  row public.tickets;
  note text := trim(coalesce(payload->>'note',''));
  evidence jsonb := coalesce(payload->'evidence','[]'::jsonb);
  photo jsonb;
  manager boolean;
  writable boolean;
  moment timestamptz := now();
  local_today date := (now() at time zone 'America/Bogota')::date;
  event jsonb;
begin
  if actor is null then raise exception 'Inicia sesión.'; end if;
  select name into actor_name from public.profiles where id = actor;
  if actor_name is null then raise exception 'Tu cuenta no tiene un perfil asignado.'; end if;
  if command = 'create' then
    project := payload->>'project_id';
    -- Serializes retries with the same ID before looking for an existing ticket.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_id::text,0));
  end if;
  select * into row from public.tickets where id = target_id for update;
  if command <> 'create' then
    if row.id is null then raise exception 'El caso no existe o no está disponible.'; end if;
    project := row.project_id;
  end if;
  actor_role := public.project_role(project);
  if actor_role is null or actor_role = 'viewer' then raise exception 'No tienes permiso para modificar esta copropiedad.'; end if;
  manager := actor_role in ('admin','coordinator');
  if command = 'create' and row.id is not null then
    if row.project_id <> project or row.created_by <> actor then raise exception 'El identificador ya está en uso.'; end if;
    return row;
  end if;
  if command <> 'create' and (payload->>'version')::integer is distinct from row.version then
    raise exception 'Otra persona actualizó el caso. Actualiza la lista y revisa los cambios.';
  end if;
  if length(note) > 2000 then raise exception 'La observación supera los 2000 caracteres.'; end if;
  if jsonb_typeof(evidence) <> 'array' or jsonb_array_length(evidence) > 3 then raise exception 'Adjunta como máximo tres fotografías.'; end if;
  if command not in ('create','submit') and jsonb_array_length(evidence) > 0 then raise exception 'Esta acción no admite archivos.'; end if;
  for photo in select value from jsonb_array_elements(evidence) loop
    if photo->>'path' is null or photo->>'name' is null or length(photo->>'name') > 255
      or split_part(photo->>'path','/',1) <> project
      or split_part(photo->>'path','/',2) <> actor::text
      or split_part(photo->>'path','/',3) <> target_id::text
      or not exists(select 1 from storage.objects where bucket_id = 'evidence' and name = photo->>'path') then
      raise exception 'La evidencia no pertenece al caso o no terminó de cargarse.';
    end if;
  end loop;
  if command in ('create','assign') then
    if (payload->>'due_date') is null or (payload->>'due_date')::date < local_today then raise exception 'Selecciona un plazo desde hoy.'; end if;
    if not exists(select 1 from public.memberships where project_id = project and user_id = (payload->>'assignee')::uuid and role in ('admin','coordinator','technician')) then
      raise exception 'El responsable no pertenece al equipo operativo de esta copropiedad.';
    end if;
  end if;
  if command = 'create' then
    if not manager and (payload->>'assignee')::uuid <> actor then raise exception 'Solo un coordinador puede asignar a otra persona.'; end if;
    if not exists(select 1 from public.projects where id = project and payload->>'area' = any(areas)) then raise exception 'Área no válida.'; end if;
    insert into public.tickets(id,project_id,title,description,location,area,priority,assignee,due_date,created_by)
    values(target_id,project,trim(payload->>'title'),trim(payload->>'description'),trim(payload->>'location'),payload->>'area',payload->>'priority',(payload->>'assignee')::uuid,(payload->>'due_date')::date,actor) returning * into row;
    note := row.description;
  else
    writable := manager or (actor_role = 'technician' and row.assignee = actor);
    if command in ('submit','close','reopen','comment') and note = '' then raise exception 'Describe la intervención, verificación u observación.'; end if;
    case command
      when 'assign' then
        if not manager or row.status = 'Cerrada' then raise exception 'No puedes reasignar este caso.'; end if;
        row.assignee := (payload->>'assignee')::uuid; row.due_date := (payload->>'due_date')::date;
      when 'start' then
        if not writable or row.status <> 'Pendiente' then raise exception 'No puedes iniciar este caso.'; end if;
        row.status := 'En proceso';
      when 'submit' then
        if not writable or row.status <> 'En proceso' or jsonb_array_length(evidence) = 0 then raise exception 'Registra la intervención y adjunta evidencia antes de solicitar verificación.'; end if;
        row.status := 'Por verificar';
      when 'close' then
        if not manager or row.status <> 'Por verificar' then raise exception 'Solo un coordinador puede verificar y cerrar.'; end if;
        row.status := 'Cerrada';
      when 'reopen' then
        if not manager or row.status not in ('Por verificar','Cerrada') then raise exception 'No puedes devolver este caso.'; end if;
        row.status := 'En proceso';
      when 'comment' then
        if row.status = 'Cerrada' then raise exception 'El caso está cerrado. Reábrelo para añadir observaciones.'; end if;
      else raise exception 'Acción no válida.';
    end case;
    row.version := row.version + 1;
  end if;
  event := jsonb_build_object('action',command,'note',note,'actor',actor_name,'actor_id',actor,'at',moment,'status',row.status,'assignee',row.assignee,'due_date',row.due_date,'evidence',evidence);
  update public.tickets set status = row.status,assignee = row.assignee,due_date = row.due_date,version = row.version,updated_at = moment,history = row.history || jsonb_build_array(event)
  where id = target_id returning * into row;
  return row;
end;
$$;
revoke all on function public.ticket_command(text,jsonb) from public,anon;
grant execute on function public.ticket_command(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('evidence','evidence',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy evidence_read on storage.objects for select to authenticated
using(bucket_id = 'evidence' and public.project_role(split_part(name,'/',1)) is not null);
create policy evidence_upload on storage.objects for insert to authenticated
with check(bucket_id = 'evidence' and split_part(name,'/',2) = (select auth.uid())::text
  and public.project_role(split_part(name,'/',1)) in ('admin','coordinator','technician'));
-- No UPDATE/DELETE policy: historical evidence cannot be replaced/deleted by clients.
commit;
