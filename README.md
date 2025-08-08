Glide

A minimal browser dodge game with a local leaderboard. Static files only; no backend required. Optimized for Vercel and offline use via a Service Worker.

Deploy on Vercel (CLI)

1. Install Vercel CLI: npm i -g vercel
2. Login: vercel login
3. From the project folder, deploy: vercel --prod

Deploy on Vercel (Dashboard)

1. Import the project at vercel.com
2. Framework Preset: Other
3. Build Command: (leave empty)
4. Output Directory: .

Update the live site

1. Edit files in your project folder
2. To ensure clients get the newest assets immediately, either:
   - increment CACHE_VERSION in sw.js, or
   - add a version query to assets in index.html (e.g., styles.css?v=20250808, script.js?v=20250808)
3. Deploy again: vercel --prod

Files

- index.html
- styles.css
- script.js
- sw.js
- vercel.json
- 404.html 