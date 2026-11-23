# Static Dashboard hosting

Render Static Site can build this public repo without GitHub write permission. Use a reviewed commit and do not deploy mock mode as the connected test.

- Node version: 22
- Environment: `API_BASE_URL` is the actual HTTPS backend origin.
- Build: `npm ci && node scripts/configure-hosting.mjs && npm run build`
- Publish directory: `dist/moonlight-dashboard/browser`
- SPA rewrite: `/*` to `/index.html`, status 200.
- Backend CORS: allow this site's exact HTTPS origin.

No secrets belong in Angular environment files; API_BASE_URL is public. The script rejects missing, non-HTTPS and credential-bearing URLs rather than silently building a localhost target. Do not commit the generated environment file after a local deployment build. Free-tier bandwidth/build quotas still apply.

This does not provision the API or database and does not itself prove login/booking works.
