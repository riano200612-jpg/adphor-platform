-- QA Integral only; strictly private mapping from authenticated QA users to
-- existing corporate staff portraits. Login/MFA/credentials are unchanged.
begin;
create table qa_identity_private.qa_account_staff_photo_links(
  user_id uuid primary key references auth.users(id) on delete cascade,
  staff_id text not null unique references public.qa_staff_members(id),
  verified_at timestamptz not null default now()
);
alter table qa_identity_private.qa_account_staff_photo_links enable row level security;
revoke all on qa_identity_private.qa_account_staff_photo_links from public,anon,authenticated;

create function public.qa_my_corporate_avatar_path()
returns text
language plpgsql stable security definer set search_path=''
as $$
declare
  out_path text;
begin
  if (select auth.uid()) is null
    or (select auth.jwt()->>'aal') is distinct from 'aal2'
  then
    raise exception 'Se requiere sesión propia y MFA AAL2.'
      using errcode='42501';
  end if;
  select s.photo_path into out_path
    from qa_identity_private.qa_account_staff_photo_links link
    join public.qa_staff_members s on s.id=link.staff_id
    where link.user_id=(select auth.uid())
      and s.active
      and s.photo_path ~ '^delegate-[0-9]+/[a-f0-9]{64}[.](jpg|jpeg|png|webp)$'
    limit 1;
  return out_path;
end;
$$;
revoke all on function public.qa_my_corporate_avatar_path() from public,anon,authenticated;
grant execute on function public.qa_my_corporate_avatar_path() to authenticated;
commit;
