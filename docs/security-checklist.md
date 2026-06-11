# Security Checklist

## Current Local Audit

- `npm audit --audit-level=low`: 0 vulnerabilities.
- No `dangerouslySetInnerHTML`.
- No `eval`.
- Cloud upload is disabled by default.
- Cloud upload requires:
  - `VITE_ENABLE_CLOUD_UPLOAD=true`
  - Supabase URL/key
  - Authenticated Supabase user session
  - Server-side Storage policies

## Required Before Production

### 1. Use HTTPS

Do not publish the production admin/player over plain HTTP.

Use one of:

- GitHub Pages with HTTPS enforcement.
- Vercel/Netlify/Cloudflare Pages.
- Firebase Hosting.
- Any host with TLS/SSL certificate enabled.

GitHub Pages supports HTTPS and HTTPS enforcement for correctly configured sites, including custom domains.

### 2. Protect Uploads With Supabase Auth

Create admin users in Supabase Auth. Do not allow anonymous signups unless you add an approval process.

Recommended:

- Disable public signup.
- Create users manually from Supabase dashboard.
- Use strong passwords.
- Enable MFA when available.

### 3. Apply Storage Policies

Run:

```text
backend/supabase/storage-policies.sql
```

Uploads must be allowed only for authenticated users and only inside their own folder.

Never create a policy that allows `anon` uploads to the `media` bucket.

### 4. Keep Reads Public, Writes Private

For signage, public read URLs are practical because TVs need direct media access.

Safe pattern:

- Public read for media.
- Authenticated insert/update/delete only.
- No anonymous upload.

### 5. Validate Media

At minimum:

- Accept images and MP4/WebM videos only.
- Set file size limits in Supabase bucket.
- Keep file names sanitized.
- Store uploaded files under `{user_id}/...`.

### 6. Do Not Expose Secrets

The Supabase anon key is allowed in frontend apps, but the service role key is not.

Never put these in `.env.local`, GitHub Pages, or frontend code:

- Supabase service role key.
- Database password.
- Private API keys.

### 7. Avoid Browser Warnings

To avoid "dangerous site" warnings:

- Use HTTPS.
- Use a real domain or trusted hosting domain.
- Do not serve malware, deceptive downloads, or unknown executables.
- Do not embed suspicious third-party scripts.
- Keep dependencies audited.
- Check the domain in Google Safe Browsing Site Status.

Google Safe Browsing provides a Site Status tool to check whether a site is currently flagged.

### 8. Admin Access

This static admin UI is not security by itself. Real protection is enforced by Supabase Auth + RLS/Storage policies.

The UI login is useful for workflow, but server-side policies are what stop attackers.
