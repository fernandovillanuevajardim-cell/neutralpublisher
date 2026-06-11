# Production Runbook

This runbook turns the local prototype into a production-ready web platform.

## 1. Choose Hosting

Recommended options:

- Firebase Hosting
- Vercel
- Netlify
- Cloudflare Pages

All must run with HTTPS enabled.

The repository includes:

- `firebase.json`
- `vercel.json`
- `netlify.toml`
- `public/_headers`

## 2. Configure Environment

Copy:

```text
.env.production.example
```

Set:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_BUCKET=media
VITE_ENABLE_CLOUD_UPLOAD=true
VITE_BASE_PATH=/
```

Never use the Supabase service role key in this frontend app.

## 3. Configure Supabase

1. Create a Supabase project.
2. Create a public Storage bucket named `media`.
3. Run `backend/supabase/schema.sql`.
4. Run `backend/supabase/storage-policies.sql`.
5. Disable anonymous signups unless you have an approval flow.
6. Create admin users in Supabase Auth.

## 4. Build And Deploy

```bash
npm install
npm run build
npm run lint
npm audit --audit-level=low
```

Deploy the `dist` folder through your hosting provider.

If deploying to the current GitHub Pages repository URL, set:

```text
VITE_BASE_PATH=/neutralpublisher/
```

## 5. First Admin Setup

1. Open `/admin`.
2. Sign in with Supabase Auth.
3. Upload media to Supabase.
4. Add remote media to the playlist.
5. Publish playlist JSON.
6. Set `URL base para TV` to the production domain.
7. Enable `Modo kiosk`.
8. Scan or copy the generated TV URL.

## 6. TV Setup

For Chromecast with Google TV:

1. Open Chrome or a kiosk browser.
2. Open the generated `/display?...&kiosk=1` URL.
3. Use fullscreen mode where available.
4. Keep the device connected to power and stable Wi-Fi.

## 7. Release Checklist

- HTTPS works.
- Domain is not flagged in Google Safe Browsing.
- `npm audit` reports 0 vulnerabilities.
- Supabase upload requires login.
- Anonymous Storage upload is blocked.
- TV display URL uses the production domain.
- QR code does not use `localhost`, `127.0.0.1`, or private IP for production.
- Test one image and one video.
- Test offline/reload behavior.
