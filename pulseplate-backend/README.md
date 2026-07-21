# PulsePlate AI — backend

FastAPI backend for the PulsePlate frontend. Serves the frontend itself
(same-origin, so `script.js`'s `API_BASE = ""` just works) and streams
plan responses over Server-Sent Events at `POST /api/plan`.

Runs on **Groq** — free, fast inference on open models (Llama, GPT-OSS,
Qwen), OpenAI-compatible API.

Runs in **mock mode** automatically when `GROQ_API_KEY` is empty — the
UI, streaming, and follow-up flow all work end-to-end with a
placeholder plan until you add a real key.

## Setup

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

`.env` is included with an empty key, so mock mode is on by default.

## Getting a free Groq API key

1. Go to [console.groq.com](https://console.groq.com) and sign in
2. Go to **API Keys** in the sidebar
3. Click **Create API Key**, copy it (shown once)
4. Paste it into `.env`:

```env
GROQ_API_KEY=gsk_your-real-key-here
GROQ_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=*
```

Free tier gives you a generous daily request/token budget — plenty for
building and testing this project. No card required.

## Run

```bash
uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000** — the frontend is served directly from
the backend, no separate dev server needed.

## How it's wired to script.js

- `POST /api/plan` accepts either:
  - an initial profile (`age`, `body_stats`, `activity_level`,
    `dietary_preference`, `restrictions`, `goal`, `notes`,
    `message_history: []`), or
  - a follow-up (`followup`, `message_history`) — the running
    conversation the frontend already accumulated.
- The response is `text/event-stream`. Each event is
  `data: {"text": "..."}\n\n` as tokens arrive, then
  `data: {"done": true}\n\n`, or `data: {"error": "..."}\n\n` on failure —
  exactly what `script.js`'s reader loop expects.
- In mock mode, a canned markdown plan streams in small chunks so the
  typing-cursor effect still looks right.
- With a real key, requests go to Groq's OpenAI-compatible
  `chat.completions` endpoint with `stream=True`, and each token delta
  is forwarded as an SSE `text` event.

## Changing the model

`GROQ_MODEL` in `.env` controls which model answers. Defaults to
`openai/gpt-oss-120b` — a strong general-purpose model on Groq's free
tier. Other options worth trying:

| Model | Notes |
|---|---|
| `openai/gpt-oss-120b` | Best quality, default |
| `openai/gpt-oss-20b` | Faster, lighter, still solid |
| `qwen/qwen3.6-27b` | Alternative flagship-tier option |

Check console.groq.com/docs/models for the current full list — Groq
deprecates and replaces models over time, so it's worth a glance if
something stops working.

## Deploying

If you deploy frontend and backend on different origins later, set
`ALLOWED_ORIGINS` in `.env` to that frontend's URL, and change
`API_BASE` in `script.js` from `""` to your backend's full URL.
