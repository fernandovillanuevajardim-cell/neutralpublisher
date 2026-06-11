# Security Policy

## Supported Version

NeutralPublisher is currently pre-1.0. Keep deployments updated from the main repository.

## Reporting A Vulnerability

Report security issues privately to the project owner. Do not publish exploit details publicly until a fix is available.

## Production Rules

- Use HTTPS only.
- Do not expose Supabase service role keys in frontend code.
- Keep `VITE_ENABLE_CLOUD_UPLOAD=false` unless Supabase Auth and Storage policies are configured.
- Run `backend/supabase/storage-policies.sql`.
- Run `backend/supabase/schema.sql`.
- Disable anonymous upload policies.
- Create admin users manually or with an approved invite flow.
- Run `npm audit --audit-level=low` before each release.
