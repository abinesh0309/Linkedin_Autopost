# Venpa Connections - frontend

React + Vite app for the topic -> caption + video -> review -> LinkedIn pipeline. It talks to the
FastAPI backend that runs in the Kaggle notebook (`Final_backend_process.ipynb`) through an ngrok URL.
With no backend URL set it runs in **demo mode** with simulated data, so a fresh deployment is always usable.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build on :4173
```

## Deploy to Vercel

1. Push this project to GitHub. If the repo root is the parent folder, that is fine - you choose the folder below.
2. On vercel.com: **Add New > Project**, import the repo.
3. Set **Root Directory** to `frontend`. Framework Preset should auto-detect **Vite**
   (`vercel.json` already sets install `npm ci`, build `npm run build`, output `dist`).
4. Environment variables are optional (see below). Click **Deploy**.

CLI alternative: `cd frontend && npx vercel --prod`.

`vercel.json` also adds long-term caching for `/assets/*`, security headers and a Content-Security-Policy.
If you later call a backend on a non-https, non-localhost origin, add it to `connect-src` there.

## Connecting the backend

1. Run the notebook's sections 1-5 once, then the API cell (section 6). Copy the printed **Public API URL**.
2. In the app: **Settings > paste URL > Test connection > Save**. Stored in the browser, no rebuild.
3. The URL changes when Kaggle restarts - paste the new one. **Settings > Copy connection link** gives a
   link (`https://your-site.vercel.app/?api=<url>`) that connects another device or reviewer in one click.

Optional Vercel env vars (Project Settings > Environment Variables):

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Default backend URL for first-time visitors (e.g. a reserved ngrok domain). Leave blank for a demo-mode site. |
| `VITE_MOCK_MODE` | `true` forces demo mode even when a URL is set. |

Vite bakes these in at build time, so redeploy after changing them.

## What the app does

- **New Post** - enter a topic, watch live progress, review caption + video, accept to publish.
  A refresh mid-generation resumes the running job. Dropped requests retry instead of failing the run.
- **Schedule** - monthly calendar of planned topics (add one, or paste a list and spread it across dates).
  Connected to a backend, the plan is stored there, so every device and browser sees the same one.
  Due items show on New Post; **Generate now** loads the topic. **Export .ics** downloads phone/calendar reminders.
  In demo mode the plan lives in this browser only. Optional **Automation** (needs the updated notebook):
  *Prepare for review* has the backend generate each post at its scheduled time and wait for your approval
  (**Review** button); *Auto-post* also publishes it. Runs only while the Kaggle notebook is running.
- **History** - posts published by the backend, with retry if the backend is unreachable.
- **Settings** - backend URL, connection test, shareable connection link.

## Pre-demo checklist

- [ ] Kaggle notebook running, API cell printed a Public API URL
- [ ] Settings > Test connection shows the GPU name
- [ ] LinkedIn secrets (`LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN`) set in Kaggle
- [ ] One full run: generate -> review -> post

## Structure

```
src/App.jsx            flow state machine, polling, resume, schedule wiring
src/services/api.js    backend client (timeouts, retry-tolerant polling, demo mode)
src/services/schedule.js  schedule storage, calendar maths, .ics export
src/components/        one file per screen
src/styles/            tokens.css (design tokens), app.css (layout + responsive)
```
