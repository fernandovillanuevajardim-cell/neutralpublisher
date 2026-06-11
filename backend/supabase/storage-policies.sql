-- Run this after creating a public bucket named `media`.
-- These policies allow public reads, but uploads/updates/deletes only inside
-- the authenticated user's own top-level folder: {auth.uid()}/...

alter table storage.objects enable row level security;

drop policy if exists "media public read" on storage.objects;
drop policy if exists "media authenticated upload own folder" on storage.objects;
drop policy if exists "media authenticated update own folder" on storage.objects;
drop policy if exists "media authenticated delete own folder" on storage.objects;

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
