# NeutralPublisher Architecture

NeutralPublisher has four surfaces:

1. Web admin
2. Mobile admin app
3. Native Android TV player
4. Web display fallback

The current repository implements the web admin and web display fallback. The app already uses the same core concepts the backend will use later: media assets, ordered playlist, playback settings, transitions, and fullscreen display.

## Target Flow

```text
Admin Web / Mobile App
        |
        v
Backend API + Database + Storage/CDN
        |
        v
Android TV Player / Web Display Fallback
```

## Why Keep The Web Fallback

The web display is important because some branches may have TVs or devices where installing the Android TV app is not possible. In those cases, the branch can open a URL directly and still run signage.

The fallback should support:

- Browser fullscreen
- PWA install mode where supported
- Local cache for the app shell
- Remote media URLs from a CDN
- Remote JSON playlists for static/CDN publishing
- A simple admin path for emergency edits

## Android TV Player

The native Android TV player should become the primary production player. It should add:

- Pairing code shown on first launch
- Assigned playlist download
- Local media cache
- Offline playback
- Heartbeat and screen health status
- Device resolution reporting
- Auto-start on boot when supported by deployment policy

## Mobile App

The mobile app should focus on fast field operations:

- Upload images and videos from the phone
- Assign content to a branch or screen
- Reorder playlists
- Activate/deactivate campaigns
- Check whether a TV is online

## Backend Modules

- Organizations: customer/account boundary.
- Branches: physical locations.
- Screens: each TV/player device.
- Media assets: uploaded images and videos.
- Playlists: ordered playback configuration.
- Playlist items: media order and optional scheduling.
- Screen events: heartbeats, playback errors, cache status, app version.

## 4K Media Rules

- Images: store original 3840x2160 when available.
- Videos: store MP4 H.264 as the default compatibility format.
- Generate preview thumbnails for admin lists.
- Keep CDN URLs stable, because players may cache aggressively.
- Avoid transforming 4K media on the TV device during playback.
