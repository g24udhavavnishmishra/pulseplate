# PulsePlate AI — React frontend

Same features as the original vanilla `index.html` / `script.js` /
`style.css` version, rebuilt in React with Framer Motion animation.

## Same features, all preserved

- Profile form (age, weight & height, activity level, dietary
  preference, goal, restrictions, notes)
- Streams the plan in from `POST /api/plan` over SSE, rendering the
  same lightweight markdown (headings, bold, bullet lists, paragraphs)
- Follow-up box appears once the first plan finishes streaming, and
  keeps sending the running conversation (`message_history`) so
  follow-ups stay in context
- Same status readout (READY / SYNCING / mock vs error states), same
  dark palette, same fonts (Space Grotesk / Inter / JetBrains Mono)

## What's new: animation

- Header and both panels fade/slide in on load, staggered
- The heartbeat logo draws itself in on mount, and flickers gently
  with a coral glow while a request is in flight
- Form fields stagger in one after another instead of appearing all
  at once
- Inputs get a soft coral glow on focus; the submit button scales
  slightly on hover/tap
- The output panel gets a subtle pulsing glow while streaming
- Each new plan/follow-up block fades and slides up into place as
  it's added, instead of appearing instantly
- The follow-up bar animates open (height + fade) instead of just
  toggling visibility
- Reduced-motion is respected — the pulse/glow/flicker animations
  turn off automatically if the user's OS asks for less motion

## Setup

```bash
npm install
cp env.example .env
```

`.env`:
```env
VITE_API_URL=http://localhost:8000
```

## Run

Make sure the backend is running first:
```bash
# in pulseplate-backend/
uvicorn main:app --reload --port 8000
```

Then, in this folder:
```bash
npm run dev
```

Open `http://localhost:5173`. The backend's `.env` already has
`ALLOWED_ORIGINS=*`, so CORS from the Vite dev server just works.

## Build for production

```bash
npm run build
```

Outputs static files to `dist/`. Set `VITE_API_URL` to your deployed
backend's URL before building if you're hosting the frontend
separately (e.g. Vercel) from the backend.

## Note on how this differs structurally from the original

The original vanilla version was served *by* the backend itself
(same-origin, `API_BASE = ""`). This React version runs on its own
dev server (Vite, port 5173) and talks to the backend across origins
via `VITE_API_URL`, which is the normal setup for a React app. If you
want this version served by the backend too, run `npm run build` and
point the backend's static file mount at this project's `dist/`
folder instead of the original `public/` folder.
