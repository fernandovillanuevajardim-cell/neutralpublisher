# Supabase Setup

NeutralPublisher can run without Supabase. When Supabase is configured, the admin can upload media to cloud storage and add the generated public URLs to the playlist.

## Environment

Copy `.env.example` to `.env.local` and fill:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_BUCKET=media
VITE_ENABLE_CLOUD_UPLOAD=true
```

Restart the dev server after changing environment variables.

## Storage Bucket

Create a bucket named `media`.

For the current MVP, the bucket must serve public files because the web fallback and Android TV player need direct media URLs.

Recommended bucket rules for the first prototype:

- Public read.
- Authenticated upload.
- File size limit based on your plan/device needs.
- Allowed MIME types: images and MP4/WebM videos.

Run the Storage policies:

```text
backend/supabase/storage-policies.sql
```

Do not allow anonymous uploads.

## SQL Schema

The initial platform schema is in:

```text
backend/supabase/schema.sql
```

It includes organizations, branches, screens, media assets, playlists, playlist items, and screen events.

## Current MVP Behavior

When cloud upload is configured:

1. The admin signs in with Supabase Auth.
2. The admin uploads selected files to Supabase Storage.
3. Each file is stored under `{user_id}/...`.
4. Each file gets a public URL.
5. NeutralPublisher adds those URLs as remote playlist items.
6. The playlist JSON can be published to Supabase Storage from the admin.
7. The TV display can open a direct URL with `#/display?playlist=ENCODED_JSON_URL`.

Later, the admin should write uploaded media records into `media_assets` and playlist changes into `playlists` / `playlist_items`.
