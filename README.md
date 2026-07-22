# PulsePlate AI

A personalized nutrition starting point, tuned to how you actually live.

PulsePlate AI takes a short profile — age, body stats, activity level, dietary
preference, goal, and any allergies/restrictions — and streams back a
calorie/macro estimate, a sample day of meals, and a habit tip, powered by an
LLM. You can then ask follow-up questions ("swap the breakfast for something
without dairy") and it keeps the conversation in context.

> ⚠️ This is a course/portfolio project offering general educational
> guidance, **not medical or dietetic advice**. Speak with a registered
> dietitian or doctor before making significant changes.

---

## Live demo

- **Frontend:** [→ Open the live app](http://pulseplate-react-udhav.s3-website.eu-north-1.amazonaws.com)
- **Backend API:** running on AWS EC2

---

## How it's built

```
┌─────────────────────┐        ┌──────────────────────┐
│   React frontend      │        │   FastAPI backend      │
│   (Framer Motion)      │  ───▶  │   Groq (LLM inference)  │
│   Hosted on S3 +       │  SSE   │   Hosted on AWS EC2     │
│   CloudFront (HTTPS)   │ stream │                        │
└─────────────────────┘        └──────────────────────┘
```

- **Frontend** — React + Vite, animated with Framer Motion. Calls the
  backend's `/api/plan` endpoint and streams the response in live, token by
  token, rendering a small custom markdown parser as it goes.
- **Backend** — FastAPI. Exposes `/api/plan` (Server-Sent Events streaming)
  and `/health`. Talks to **Groq's** OpenAI-compatible `chat.completions`
  API for inference — free tier, fast, no card required.
- **Mock mode** — if no `GROQ_API_KEY` is set, the backend automatically
  streams a canned placeholder plan instead, so the whole app (UI, streaming,
  follow-ups) can be built and tested with zero API cost.

---

## Project structure

```
pulseplate/
├── backend/
│   ├── main.py              # FastAPI app, /api/plan streaming endpoint
│   ├── requirements.txt
│   ├── env.example
│   ├── public/               # (optional) vanilla HTML/CSS/JS version
│   └── README.md
└── frontend-react/
    ├── src/
    │   ├── App.jsx           # main UI + streaming logic
    │   ├── App.css
    │   └── markdown.js       # tiny markdown renderer
    ├── package.json
    ├── env.example
    └── README.md
```

---

## Features

- Profile form: age, weight & height, activity level, dietary preference,
  goal, allergies/restrictions, notes
- Streams the plan in live over Server-Sent Events, with a typing-cursor
  effect
- Renders a lightweight markdown subset (headings, bold, bullet lists,
  paragraphs)
- Follow-up box appears once the first plan finishes, and keeps sending the
  running conversation so follow-ups stay in context
- Status readout (READY / SYNCING / ERROR)
- Animated UI — entrance transitions, a heartbeat logo that draws itself in,
  streaming glow, staggered form fields
- Runs fully in **mock mode** with no API key — good for development,
  demos, and grading without burning API credits
- Always respects listed allergies/intolerances in the system prompt; keeps
  any medical-condition mentions general rather than prescriptive

---

## Getting started locally

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env
```

Get a free key at [console.groq.com](https://console.groq.com) → **API
Keys** → **Create API Key**, then paste it into `.env`:
```env
GROQ_API_KEY=gsk_your-key-here
GROQ_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=*
```

Run it:
```bash
uvicorn main:app --reload --port 8000
```

Leave `GROQ_API_KEY` blank to run in mock mode — no key needed to develop.

### 2. Frontend
```bash
cd frontend-react
npm install
cp env.example .env
```
```env
VITE_API_URL=http://localhost:8000
```
```bash
npm run dev
```
Open `http://localhost:5173`.

---

## Deployment

This project is deployed with frontend and backend fully separated:

| Piece | Where | Notes |
|---|---|---|
| Backend (FastAPI) | AWS EC2 (t3.micro) | Runs as a `systemd` service behind Nginx |
| Frontend (React build) | AWS S3 static website hosting | `npm run build` → upload `dist/` contents |
| HTTPS | AWS CloudFront | Sits in front of the S3 website endpoint |

### Backend on EC2
1. Launch an EC2 instance (Amazon Linux 2023, t3.micro)
2. Security group: allow SSH (22), HTTP (80), HTTPS (443)
3. `git clone` this repo, `cd backend`, set up the venv and `.env` as above
4. Run it permanently via `systemd` (see `backend/README.md` for the unit
   file) and reverse-proxy it through Nginx
5. Set `ALLOWED_ORIGINS` in `.env` to your deployed frontend's URL

### Frontend on S3 + CloudFront
1. `npm run build` locally — this produces `dist/`
2. Create an S3 bucket, enable **Static website hosting**, set a public
   read bucket policy, and upload the contents of `dist/` (not the folder
   itself) to the bucket root
3. Put a **CloudFront** distribution in front of the S3 website endpoint
   (not the bucket's REST endpoint) for free HTTPS — set **Viewer protocol
   policy** to "Redirect HTTP to HTTPS" and **Default root object** to
   `index.html`
4. Update `VITE_API_URL` to the backend's EC2 address, rebuild, and re-upload

---

## Tech stack

- **Frontend:** React, Vite, Framer Motion
- **Backend:** FastAPI, Uvicorn, Python
- **LLM inference:** Groq (OpenAI-compatible API)
- **Infra:** AWS EC2, S3, CloudFront, Nginx, systemd
