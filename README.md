# React Lemmings Clone

A small React + Vite game inspired by the 1990s classic **Lemmings**.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

If you publish this project at `https://<user>.github.io/lemmings/`, you must deploy the Vite build output (`dist/`) instead of the raw source files.

Why your current page is blank:
- `index.html` in source mode loads `/src/main.jsx` directly.
- Browsers cannot run React bare-module imports from source without Vite dev server/bundling.
- GitHub Pages is static hosting only, so it needs built assets.

This repo includes `.github/workflows/deploy.yml` to build and deploy `dist` automatically.

Required settings:
1. GitHub repo → **Settings** → **Pages**.
2. Under **Build and deployment**, choose **Source: GitHub Actions**.
3. Push to your default branch and wait for the **Deploy to GitHub Pages** workflow to finish.

For project pages, Vite `base` is configured to `/lemmings/` in `vite.config.js`.

## Goal

Rescue at least 55% of lemmings by guiding them to the exit.

## Controls

- Pick a skill from the toolbar.
- Click a lemming in the arena to apply the selected skill.
- Skills:
  - **Blocker**: stops and turns around nearby walkers
  - **Builder**: places stair segments while moving
  - **Floater**: survives high falls
  - **Digger**: removes floor sections
