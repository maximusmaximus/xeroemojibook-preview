# Xero Emoji: V1.0.0 Specimen Guide · book preview

A static preview of the Xero Emoji book by Max Infeld: the cover, the first six pages and five pages from across the book (rendered from the approved interior proof v3), with a click-to-enlarge lightbox. Links: [xeroemoji.grok.me](https://xeroemoji.grok.me) · [github.com/maximusmaximus/xeroemoji](https://github.com/maximusmaximus/xeroemoji).

The site is plain static files in `public/` (no build step, no server code). Images are WebP at 432/864/1600 px.

## Deploy

- **GitHub Pages:** the included workflow (`.github/workflows/pages.yml`) publishes `public/` on every push to `main` (Settings → Pages → Source: GitHub Actions).
- **Cloudflare Pages:** create a Pages project, no build command, output directory `public`. Or with Wrangler: `npx wrangler pages deploy public --project-name xeroemojibook`.
- **Cloudflare Workers (static assets):** `npx wrangler deploy` uses `wrangler.toml` (no route set; add a `routes` entry with `custom_domain = true` for your domain).
- **Anything else:** upload the contents of `public/` to any static host.

## Test

```bash
npm install
npx wrangler dev --port 8788 --ip 127.0.0.1   # local server (Playwright starts it if not running)
npm test                                       # Playwright (load, links/images, lightbox, mobile, no-checkout) + Lighthouse
```

Screenshots from the last run are in `screens/`.

## archive-checkout/

Parked, never-deployed Stripe (test mode) + print-on-demand webhook Worker code from an earlier draft. Contains no keys; all secrets were meant to be set as Worker secrets. Not used by the site.

Book artwork © Max Infeld.
