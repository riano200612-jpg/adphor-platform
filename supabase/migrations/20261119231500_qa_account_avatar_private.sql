-- QA Integral only. No modification of existing users, staff media, or property images.
-- Legacy permissive storage policies permit non-property buckets: restrictive
-- guards are essential to prevent cross-user access to these private photos.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('qa-account-avatars','qa-account-avatars',false,1048576,array['image/webp'])
on conflict(id) do nothing;

do $$begin
  if not exists(select 1 from storage.buckets where id='qa-account-avatars'
    and public is false and file_size_limit=1048576
    and allowed_mime_types=array['image/webp']::text[]) then
    raise exception 'Account avatar bucket must be private, WebP-only, <=1MB';
  end if;
end$$;

create policy qa_account_avatar_select on storage.objects
 for select to authenticated
 using(bucket_id='qa-account-avatars'
   and name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2');
create policy qa_account_avatar_select_guard on storage.objects
 as restrictive for select to authenticated
 using(bucket_id<>'qa-account-avatars' or
  (name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2'));

create policy qa_account_avatar_insert on storage.objects
 for insert to authenticated
 with check(bucket_id='qa-account-avatars'
   and name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2');
create policy qa_account_avatar_insert_guard on storage.objects
 as restrictive for insert to authenticated
 with check(bucket_id<>'qa-account-avatars' or
  (name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2'));

create policy qa_account_avatar_update on storage.objects
 for update to authenticated
 using(bucket_id='qa-account-avatars'
   and name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2')
 with check(bucket_id='qa-account-avatars'
   and name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2');
create policy qa_account_avatar_update_guard on storage.objects
 as restrictive for update to authenticated
 using(bucket_id<>'qa-account-avatars' or
  (name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2'))
 with check(bucket_id<>'qa-account-avatars' or
  (name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2'));

create policy qa_account_avatar_delete on storage.objects
 for delete to authenticated
 using(bucket_id='qa-account-avatars'
   and name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2');
create policy qa_account_avatar_delete_guard on storage.objects
 as restrictive for delete to authenticated
 using(bucket_id<>'qa-account-avatars' or
  (name=(select auth.uid())::text||'/avatar.webp'
   and (select auth.jwt()->>'aal')='aal2'));
commit;
