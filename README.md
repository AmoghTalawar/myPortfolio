# Amogh Talawar: Portfolio

Personal portfolio built as a static site: Vite + TypeScript, Three.js, GSAP + ScrollTrigger and Lenis.
Every sound is synthesized with the Web Audio API, so there are no audio files.

## Commands

```bash
npm install        # once
npm run dev        # local dev server at http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally at http://localhost:4173
```

Requires Node 20 or newer.

## Project layout

```
index.html            all portfolio content (semantic HTML, works without JS)
404.html              custom 404 page that doubles as the Orbit Run launcher
public/               favicon.svg, og.png, robots.txt (copied as-is)
src/main.ts           boot → smooth scroll → UI → lazy 3D deck
src/styles/main.css   tokens, three themes, every component
src/core/             settings (localStorage), DOM helpers
src/audio/sound.ts    Web Audio synth: hover ticks, blips, deck hum, game sfx
src/ui/               boot, cursor, palette, reveals, projects arc, timeline, contact
src/scene/hero.ts      hero 3D canvas (lazy chunk): renders the clay workstation
src/scene/character.ts clay workstation: desk, monitor, hobby shelf
src/scene/person.ts    the inked character at the desk: sculpted head, hair locks, typing at the monitor
src/game/             Orbit Run (lazy chunk) + overlay launcher
_original/index.html  your previous single-file site, kept for reference (not deployed)
```

Content lives in `index.html`. Edit text there and every view (3D arc, dialog, skill graph, fallback) picks it up.

## How it loads

- Initial JS is about 57 KB gzipped (GSAP, Lenis and the app). Three.js (about 138 KB gzipped) loads during the boot screen for the hero desk scene, only when WebGL is available and reduced motion is off. The hero canvas stops rendering whenever it is scrolled off screen.
- Orbit Run is a separate chunk, loaded the first time the game opens.
- With `prefers-reduced-motion`, or without WebGL, the hero 3D scene is skipped. All content stays the same.
- The hero 3D and the game stop rendering when the tab is hidden. The game also pauses when the window loses focus.

## Deploy to S3 + CloudFront

The steps below use the AWS CLI. Replace `YOUR-BUCKET`, `YOUR-REGION` and `DIST_ID`.

### 1. One-time setup

1. **Create a private bucket.** Leave "Block all public access" on.
   ```bash
   aws s3 mb s3://YOUR-BUCKET --region YOUR-REGION
   ```
2. **Create a CloudFront distribution** in the console:
   - Origin: the bucket's REST endpoint (`YOUR-BUCKET.s3.YOUR-REGION.amazonaws.com`), not the website endpoint.
   - Origin access: **Origin access control (OAC)**. Create a new OAC, then apply the bucket policy CloudFront gives you to the bucket.
   - Viewer protocol policy: Redirect HTTP to HTTPS.
   - Default root object: `index.html`.
   - Compression: on (the "CachingOptimized" policy already compresses).
3. **Custom error pages** (Distribution → Error pages → Create custom error response). With OAC, S3 returns **403** for missing files, so map both codes:
   | HTTP error code | Response page path | HTTP response code |
   |---|---|---|
   | 403 | `/404.html` | 404 |
   | 404 | `/404.html` | 404 |
4. **Contact form CORS.** Make sure the API Gateway behind `https://8zrznsk3a2.execute-api.ap-south-1.amazonaws.com/messages` allows your CloudFront domain (and custom domain, if any) in `Access-Control-Allow-Origin`.

### 2. Every release

```bash
npm run build

# fingerprinted assets: cache for a year
aws s3 sync dist/assets s3://YOUR-BUCKET/assets --delete \
  --cache-control "public,max-age=31536000,immutable"

# HTML: always revalidate so new releases show up immediately
aws s3 cp dist/ s3://YOUR-BUCKET/ --recursive --exclude "*" --include "*.html" \
  --cache-control "no-cache"

# favicon, og image, robots: short cache
aws s3 sync dist/ s3://YOUR-BUCKET/ --exclude "assets/*" --exclude "*.html" \
  --cache-control "public,max-age=86400"

# refresh the HTML at the edge
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/" "/index.html" "/404.html"
```

On Windows PowerShell, replace the trailing `\` line continuations with a backtick, or put each command on one line.

### 3. Optional: custom domain

Request an ACM certificate in **us-east-1** for your domain, add it to the distribution as an alternate domain name, and point a Route 53 alias (or CNAME) at the distribution. Then fill in the canonical and Open Graph URLs (see placeholders below).

## Placeholders to fill in

| Where | What |
|---|---|
| `src/scene/character.ts`, `SHELF_LABELS` | Hover labels for the hero shelf objects (books, cricket, controller, clapperboard, sketchpad, in that order; the plant has no label). Keep them in step with the About hobbies. To change an object's model, edit the matching entry in `builders` in the same file. |
| `index.html` `<head>` | Once you have a domain, add `<link rel="canonical">` and `og:url`, and make `og:image`/`twitter:image` absolute (`https://YOUR-DOMAIN/og.png`). There's a comment marking the spot. |
| `public/og.png` | A generated 1200×630 preview image. Replace it with your own if you like. |

## Keyboard shortcuts

| Key | Action |
|---|---|
| Ctrl K or ⌘ K | Command palette |
| ? | Shortcut help |
| M | Sound on or off |
| G | Play Orbit Run (also via the Konami code, the hub console and the 404 page) |
| Esc | Close a dialog or pause the game |
