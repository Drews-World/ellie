# World Ops floor — embedding OSIRIS

The **World Ops** floor (`/world-ops`) embeds the standalone
[OSIRIS](https://github.com/simplifaisoul/osiris) OSINT dashboard (a separate
Next.js app) in a full-bleed `<iframe>`. ELLIE and OSIRIS stay separate
deployments — different stacks (Vite/React 18 vs Next 16/React 19), so OSIRIS
runs as its own app and we frame it.

## One-time setup

### 1. Deploy OSIRIS to its own Vercel project
- Vercel → **New Project** → import `simplifaisoul/osiris`.
- No env vars are required — OSIRIS runs fully on public keyless feeds. (Only
  the RECON port-scanner needs `SCANNER_URL`/`SCANNER_KEY`; leave them unset to
  simply disable that one tab.)
- Note the production URL, e.g. `https://osiris-xxxx.vercel.app`.

### 2. Allow ELLIE to frame OSIRIS  (REQUIRED — edit in the osiris repo)
OSIRIS currently sends `X-Frame-Options: SAMEORIGIN`, which blocks cross-origin
framing. In **osiris** `next.config.ts`, inside `async headers()`, replace the
security headers with:

```ts
// REMOVE this line entirely:
// { key: 'X-Frame-Options', value: 'SAMEORIGIN' },

// CHANGE the CSP to add a frame-ancestors directive that allows ELLIE:
{
  key: 'Content-Security-Policy',
  value:
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:; " +
    "frame-ancestors 'self' https://ellie-two.vercel.app https://*.vercel.app http://localhost:5173;",
},
```

`frame-ancestors` is the modern, origin-scoped replacement for
`X-Frame-Options` — it permits framing only from ELLIE's origins (prod, Vercel
previews, and local dev). Commit + push osiris → Vercel redeploys.

### 3. Point ELLIE at the deployment
Set `VITE_OSIRIS_URL` to the OSIRIS URL in **both** places:
- Local: `webapp/frontend/.env`
- Vercel (ellie project) → Settings → Environment Variables → `VITE_OSIRIS_URL`

Redeploy ELLIE. The World Ops floor now renders OSIRIS live. Until the var is
set, the floor shows a friendly "not connected yet" placeholder.
