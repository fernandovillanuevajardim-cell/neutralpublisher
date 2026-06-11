# Implementation Plan

## Phase 1: Web Fallback

Status: started.

- Admin web for local content.
- Fullscreen web display.
- Local IndexedDB media storage.
- Remote media URL support.
- PWA app shell cache.
- Basic playback settings.
- Export/import remote playlist JSON.
- Remote JSON playlist sync.
- Fullscreen request button for TV browsers.
- Optional Supabase Storage upload.
- TV display link with QR code.
- Per-item playback duration.
- Display error recovery and next-media preload.

Next improvements:

- Screen pairing flow.

## Phase 2: Backend Sync

- Create Supabase/Firebase project.
- Add authentication.
- Create organization, branch, screen, playlist, and media tables.
- Write uploaded media records to database.
- Store public/CDN media URLs.
- Sync playlists into the web display.
- Keep local fallback for offline playback.

## Phase 3: Mobile Admin

- Build Android-first mobile app.
- Login and select organization.
- Upload media from camera/gallery.
- Manage playlists and assigned screens.
- View screen online/offline status.

## Phase 4: Android TV Player

- Native Kotlin app.
- Pairing code flow.
- Fullscreen playback.
- Local media cache.
- Offline playback.
- Heartbeat and event reporting.
- Device resolution detection.

## Phase 5: Production Hardening

- Role-based permissions.
- Branch-level access.
- Media validation and compression pipeline.
- CDN cache strategy.
- Playback analytics.
- App update strategy.
- Monitoring dashboard.
