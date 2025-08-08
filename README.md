# Glide

A minimal, responsive arcade dodger with a local leaderboard. No backend. Built with HTML/CSS/JS.

## Run locally

```bash
# any static server works
python3 -m http.server 5173
# open http://localhost:5173
```

## Deploy to Vercel

This repo is deploy-ready for Vercel as a static site.

- via CLI:

```bash
npm i -g vercel
vercel login
vercel --prod
```

- via Dashboard:
  - Import the repo at vercel.com, Framework Preset: “Other”.
  - Build Command: none
  - Output Directory: . (project root)

`vercel.json` config sets long cache for JS/CSS and no-store for HTML.

## Files
- `index.html`, `styles.css`, `script.js`: the game
- `404.html`: friendly not-found
- `vercel.json`: static deploy configuration

## Notes
- Scores are saved in browser localStorage on each device.
- Works on desktop and mobile. Use A/D or ←/→ keys; drag to move on touch. 