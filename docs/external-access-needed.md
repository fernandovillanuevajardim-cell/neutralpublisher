# External Access Needed

The repository is ready, but these production actions require real external accounts and credentials.

Do not paste passwords into chat. Use provider dashboards, temporary access, or environment variables/secrets.

## Supabase

Needed:

- Supabase account access.
- Project owner/admin permission.
- Project URL.
- Public anon key.
- Admin user email to create in Supabase Auth.
- Storage bucket name, recommended: `media`.

Actions:

1. Create Supabase project.
2. Create public Storage bucket `media`.
3. Run `backend/supabase/schema.sql`.
4. Run `backend/supabase/storage-policies.sql`.
5. Disable anonymous signup unless an invite flow exists.
6. Create admin user in Supabase Auth.
7. Add production environment variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_BUCKET=media
VITE_ENABLE_CLOUD_UPLOAD=true
VITE_BASE_PATH=/
```

## Hosting

Choose one:

- Firebase Hosting
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Needed:

- Hosting account access.
- Domain name, if using custom domain.
- DNS access for the domain.

Actions:

1. Connect repository or upload `dist`.
2. Set environment variables.
3. Enable HTTPS.
4. Configure custom domain.
5. Confirm security headers.
6. Open `/home`, `/admin`, and `/display`.

## Domain And HTTPS

Needed:

- Domain registrar or DNS provider access.

Actions:

1. Point domain to hosting provider.
2. Wait for DNS propagation.
3. Enable HTTPS certificate in hosting provider.
4. Verify production URL uses `https://`.
5. Check the domain in Google Safe Browsing Site Status.

## Verification Commands

After setting production env vars:

```bash
npm run audit:prod
npm run build
npm run lint
npm run check:prod
```

## What Cannot Be Done Without Access

- Creating your Supabase project.
- Creating Auth users.
- Changing DNS records.
- Enabling a real HTTPS certificate.
- Adding hosting provider secrets.
- Checking a production domain before it exists.
