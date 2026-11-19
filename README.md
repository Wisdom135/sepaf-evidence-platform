# SEPAF Evidence Bank

A responsive, one-page website built from the supplied South-East PBAT achievements document.

## Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

No package installation is required; the local development server uses Node.js built-ins only.

## Content

- 94 source-backed achievements across 9 themes
- 10 headline impact figures
- 10 on-record statements
- Search, theme filters, status filters and detailed source modals
- Official SEPAF logo and logo-derived South-East map artwork
- Scroll reveals, animated routes, staggered cards and responsive motion

The normalized content lives in `data/evidence.json`. To rebuild it from the original attachment:

```bash
node scripts/extract-evidence.mjs "C:\path\to\LATEST - SouthEast - PBAT Achievements.html"
```

The original supplied logo is preserved in `assets/sepaf-official-logo.png`; the page uses a cropped, transparent copy alongside the isolated map watermark.

Run the content integrity check with:

```bash
npm run check
```
