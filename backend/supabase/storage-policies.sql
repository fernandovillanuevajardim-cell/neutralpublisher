-- Run this after creating a public bucket named `media`.
-- These policies allow public reads, but uploads/updates/deletes only inside
-- the authenticated user's own top-level folder: {auth.uid()}/...
-- Do not run ALTER TABLE on storage.objects. Supabase owns that internal table
-- and already manages RLS for Storage.

drop policy if exists "media public read" on storage.objects;
drop policy if exists "media authenticated upload own folder" on storage.objects;
drop policy if exists "media authenticated update own folder" on storage.objects;
drop policy if exists "media authenticated delete own folder" on storage.objects;
drop policy if exists "media authenticated upload tv channel" on storage.objects;
drop policy if exists "media authenticated update tv channel" on storage.objects;
drop policy if exists "media authenticated delete tv channel" on storage.objects;
drop policy if exists "media authenticated upload organization folder" on storage.objects;
drop policy if exists "media authenticated update organization folder" on storage.objects;
drop policy if exists "media authenticated delete organization folder" on storage.objects;

create or replace function public.storage_object_org_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);

  if array_length(parts, 1) < 2 or parts[1] <> 'orgs' then
    return null;
  end if;

  return parts[2]::uuid;
exception when others then
  return null;
end;
$$;

create policy "media public read"
on storage.objects
for select
using (bucket_id = 'media');

create policy "media authenticated upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media authenticated update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media authenticated delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media authenticated upload tv channel"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'channels'
);

create policy "media authenticated update tv channel"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'channels'
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'channels'
);

create policy "media authenticated delete tv channel"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'channels'
);

create policy "media authenticated upload organization folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and public.can_manage_org(public.storage_object_org_id(name))
);

create policy "media authenticated update organization folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and public.can_manage_org(public.storage_object_org_id(name))
)
with check (
  bucket_id = 'media'
  and public.can_manage_org(public.storage_object_org_id(name))
);

create policy "media authenticated delete organization folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and public.can_manage_org(public.storage_object_org_id(name))
);
