-- Demostración aislada. Nombres públicos: https://adphor.com/clientes/
-- Primero crear en Authentication el usuario demo-adphor@example.invalid,
-- con contraseña temporal y Auto Confirm User. No publicar la contraseña.
-- Ejecutar en SQL Editor. Se puede repetir sin duplicar casos ni reiniciar cambios.
begin;
alter table public.projects add column if not exists is_demo boolean not null default false;
do $$
declare demo_user uuid; p record; sample record; ticket_id uuid; moment timestamptz := now();
begin
  select id into demo_user from auth.users where lower(email) = 'demo-adphor@example.invalid';
  if demo_user is null then raise exception 'Crea primero demo-adphor@example.invalid en Authentication > Users.'; end if;
  if exists(select 1 from public.memberships m join public.projects existing_project on existing_project.id=m.project_id where m.user_id=demo_user and not existing_project.is_demo) then
    raise exception 'La cuenta demo tiene acceso a propiedades operativas. Revisa sus membresías antes de continuar.';
  end if;
  insert into public.profiles(id,name) values(demo_user,'Cliente demo') on conflict(id) do nothing;
  for p in select * from (values
    ('demo-adphor-01', 'Brisas del Mar'),
    ('demo-adphor-02', 'Portomarine'),
    ('demo-adphor-03', 'Palmetto Beach'),
    ('demo-adphor-04', 'Palmeto Eliptic'),
    ('demo-adphor-05', 'Castellón de Santa Clara'),
    ('demo-adphor-06', 'Luna del Mar'),
    ('demo-adphor-07', 'C.C. Centro Uno'),
    ('demo-adphor-08', 'San Lazaro Distrito y Arte'),
    ('demo-adphor-09', 'Bari Club House'),
    ('demo-adphor-10', 'Mares'),
    ('demo-adphor-11', 'Aquanova'),
    ('demo-adphor-12', 'Murano Beach House'),
    ('demo-adphor-13', 'Mistral'),
    ('demo-adphor-14', 'Parque Centenario'),
    ('demo-adphor-15', 'Zinnia Club House'),
    ('demo-adphor-16', 'Conjunto Residencial Porto Castello')
  ) as catalog(id,name) loop
    if exists(select 1 from public.projects where id=p.id and not is_demo) then
      raise exception 'Identificador ocupado por una propiedad operativa: %', p.id;
    end if;
    insert into public.projects(id,name,type,location,areas,is_demo)
    values(p.id,p.name,'Demostración','Ubicaciones internas de ejemplo',array['Zonas comunes (ejemplo)','Equipos (ejemplo)','Jardines (ejemplo)'],true)
    on conflict(id) do nothing;
    insert into public.memberships(project_id,user_id,role) values(p.id,demo_user,'coordinator')
    on conflict(project_id,user_id) do nothing;
    for sample in select * from (values
      (1,'PRUEBA — Revisión de iluminación','Pendiente'),
      (2,'PRUEBA — Inspección de equipo','En proceso'),
      (3,'PRUEBA — Revisión de zona común','Por verificar'),
      (4,'PRUEBA — Mantenimiento completado','Cerrada')
    ) as examples(n,title,status) loop
      ticket_id := md5(p.id || ':sample:' || sample.n::text)::uuid;
      insert into public.tickets(id,project_id,title,description,location,area,priority,assignee,due_date,status,created_by,history)
      values(ticket_id,p.id,sample.title,'Caso ficticio para explorar ADPHOR. No representa una incidencia ni un trabajo real.','Sector de ejemplo','Zonas comunes (ejemplo)','Media',demo_user,(now() at time zone 'America/Bogota')::date + 7,sample.status,demo_user,
        jsonb_build_array(jsonb_build_object('action','demo_seed','actor','Sistema de demostración','at',moment,'status',sample.status,'note','Estado precargado para demostración; sin intervención ni evidencia real. Los casos nuevos recorren el flujo normal con fotografía obligatoria.','evidence','[]'::jsonb)))
      on conflict(id) do nothing;
    end loop;
  end loop;
end;
$$;
commit;
select p.name,m.role,p.is_demo from public.projects p
join public.memberships m on m.project_id=p.id
join auth.users u on u.id=m.user_id where u.email='demo-adphor@example.invalid'
order by p.name;
