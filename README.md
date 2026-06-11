# NeutralPublisher

NeutralPublisher is a digital signage project for TVs, branches, and Android TV devices.

The first implementation is a web fallback that works without a backend:

- Admin panel for images, videos, ordering, transitions, and playback settings.
- Fullscreen display mode for a TV browser.
- Local file storage through IndexedDB, so large media is not pushed into localStorage.
- Remote URL support for CDN-hosted images and videos.
- Remote JSON playlist import/sync.
- Optional Supabase Storage upload.
- Six transitions: fade, horizontal slide, vertical slide, zoom, flip, and blur.
- PWA app shell cache for a stronger web fallback.

## Run locally

```bash
npm install
npm run dev
```

For testing from another device on the same network:

```bash
npm run dev:host -- --port 5174
```

Open the admin:

```text
http://localhost:5173/#/admin
```

Open the launcher:

```text
http://localhost:5173/#/home
```

Local network admin example:

```text
http://192.168.1.13:5174/#/admin
```

Use the `Demo` button to load the bundled sample playlist and generate a TV-ready link/QR.

If the QR starts with `127.0.0.1` or `localhost`, it will only work on the same computer. In the `Enlace para TV` panel, set `URL base para TV` to the PC network URL, for example:

```text
http://192.168.1.13:5174
```

The QR will then be generated for the phone/TV on the same Wi-Fi network.

For a cleaner TV display, enable `Modo kiosk` in the TV link panel. The generated display URL will include:

```text
kiosk=1
```

That hides the small fullscreen/admin controls in the player.

Open the TV display:

```text
http://localhost:5173/#/display
```

## Remote JSON playlist

The admin can import/export a remote playlist JSON. This is useful for branches that only need a direct web fallback, or for publishing a playlist to a CDN/static host before the full backend exists.

Local demo URL:

```text
http://localhost:5173/sample-playlist.json
```

Direct TV display URL:

```text
http://localhost:5173/#/display?playlist=http%3A%2F%2Flocalhost%3A5173%2Fsample-playlist.json
```

In production, replace the playlist value with the encoded URL of the JSON published to your CDN or Supabase bucket.

The admin also shows a TV link panel with:

- QR code for the final display URL.
- Copy button.
- Open display button.

Each playlist item can also define `durationSeconds`; if it is omitted, the global slide duration is used. When a single video is the only playlist item, the web display loops it continuously.

Playlist shape:

```json
{
  "version": 1,
  "name": "NeutralPublisher Demo",
  "settings": {
    "slideSeconds": 8,
    "transition": "fade",
    "fitMode": "cover",
    "showClock": true,
    "showBadge": false,
    "videoMuted": true
  },
  "items": [
    {
      "name": "Imagen",
      "kind": "image",
      "url": "https://cdn.example.com/image.jpg",
      "mimeType": "image/jpeg"
    },
    {
      "name": "Video",
      "kind": "video",
      "url": "https://cdn.example.com/video.mp4",
      "mimeType": "video/mp4"
    }
  ]
}
```

## Build

```bash
npm run build
```

## Current scope

This web app is the backup/universal player. It is useful for TVs with browsers, other operating systems, or branches that need a direct link.

For production signage, the planned platform should add:

- Shared backend with organizations, branches, screens, campaigns, playlists, and schedules.
- Cloud storage/CDN for 4K images and videos.
- Mobile app to upload and manage content from a phone.
- Native Android TV app with fullscreen playback, local cache, pairing code, offline mode, and screen health checks.

## Recommended media

- 4K landscape images: 3840x2160.
- Preferred image formats: WebP or high-quality JPG.
- Preferred video format: MP4, H.264, optimized for the target TV/device.
- Keep videos short and compressed enough for stable playback.

## Architecture target

```text
Web Admin / Mobile App
        |
        v
Backend API + Database + Storage/CDN
        |
        v
Android TV App / Web Display Fallback
```

The web fallback already matches the future player model: ordered media, playback settings, transitions, and display mode. The next step is replacing local-only storage with synced campaigns from the backend.

## Project structure

```text
src/                    Web admin and display fallback
backend/supabase/       Initial SQL schema for the synced platform
docs/                   Architecture and implementation notes
```

Read:

- `docs/architecture.md`
- `docs/implementation-plan.md`
- `docs/supabase-setup.md`
- `docs/security-checklist.md`
- `docs/production-runbook.md`
- `docs/external-access-needed.md`
- `backend/supabase/schema.sql`
- `backend/supabase/storage-policies.sql`

## Production deployment

Included deployment config:

- `firebase.json`
- `vercel.json`
- `netlify.toml`
- `public/_headers`
- `.github/workflows/deploy-pages.yml`

For the current GitHub Pages URL, use the deployed path in lowercase:

```text
VITE_BASE_PATH=/neutralpublisher/
```

For a custom domain or root hosting, keep:

```text
VITE_BASE_PATH=/
```
