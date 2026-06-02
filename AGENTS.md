# Agent guidance (Stack)

## Security & privacy

### Secrets & env

- Never commit `.env`, API keys, `DATABASE_URL`, session secrets, Hackatime/Airtable/CDN credentials, or OAuth tokens.
- Keep secrets in server `process.env` only; never expose them in client bundles, logs, or JSON responses.
- `.env.example` may list variable **names** only, not real values.

### API exposure

- **Admin / staff routes** (`/api/admin/*`, review approve/reject, user PII, journal CSV) must use `requireFullAdmin`, `requireStaffReview`, or `requireSuperAdmin` — never public.
- **User routes** must use `requireUser` and scope data to `req.session.userId`.
- Prefer whitelisted DTOs (`toPublicProject`, `toPublicUser`) over spreading DB rows to JSON.
- Gate dev/debug endpoints behind production checks or admin auth.
- Third-party calls (Hackatime, Airtable, CDN) stay **server-side**; tokens must not be sent to the browser.

### Errors & logging

- Production 500 responses: generic message only (`clientErrorMessage` in `server/security.js`).
- Do not log access tokens, refresh tokens, sync secrets, or full OAuth responses.

### Client

- Admin `fetch` calls must use `credentials: "include"`.
- Do not embed private API keys in `client/` code.
