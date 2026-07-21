import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
MOCK_MODE = not api_key

model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

SYSTEM_PROMPT = """You are PulsePlate AI, a friendly nutrition assistant that gives people a \
personalized daily nutrition starting point based on their profile.

For an initial profile, respond with markdown using this shape:
## Your daily estimate
A short calorie estimate and a rough macro split (protein/carbs/fat), explained in one or two sentences.

## Sample day
A realistic sample day of meals (breakfast, lunch, dinner, one snack) that fits their dietary \
preference, restrictions, and goal. Use **Meal name** — description format, one per line.

## Habit tip
One concrete, small habit suggestion tied to their goal.

Always strictly respect any allergy, intolerance, or medical note the person lists — never suggest \
something that conflicts with it. Keep the whole response concise and skimmable. Do not give medical \
advice or specific medical treatment recommendations; if the person mentions a medical condition, \
keep suggestions general and encourage checking with a doctor or dietitian.

For follow-up questions, respond conversationally in a few short markdown paragraphs or a small list, \
adjusting the specific thing they asked about rather than repeating the whole plan."""

app = FastAPI(title="PulsePlate AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlanRequest(BaseModel):
    age: Optional[str] = None
    body_stats: Optional[str] = None
    activity_level: Optional[str] = None
    dietary_preference: Optional[str] = None
    restrictions: Optional[str] = None
    goal: Optional[str] = None
    notes: Optional[str] = None
    followup: Optional[str] = None
    message_history: List[dict] = []


def sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def build_profile_text(req: PlanRequest) -> str:
    return (
        f"Age: {req.age}; Body stats: {req.body_stats}; Activity: {req.activity_level}; "
        f"Diet: {req.dietary_preference}; Restrictions: {req.restrictions or 'none'}; "
        f"Goal: {req.goal}; Notes: {req.notes or 'none'}"
    )


MOCK_PLAN = """## Your daily estimate
Roughly **2,000 kcal/day**, split about 120g protein / 220g carbs / 65g fat (mock estimate — add your API key for numbers tuned to your actual profile).

## Sample day
**Breakfast** — Greek yogurt with berries and a spoon of granola
**Lunch** — Grilled chicken bowl with quinoa, mixed greens, and olive oil
**Dinner** — Baked salmon, roasted sweet potato, steamed broccoli
**Snack** — A small handful of almonds or a piece of fruit

## Habit tip
Anchor your protein target at breakfast first — it tends to curb cravings for the rest of the day.

*This is a mock response. Add GROQ_API_KEY to your backend's .env to get a real plan personalized to what you entered.*"""

MOCK_FOLLOWUP = """Got it — that's a reasonable swap. In mock mode I can't tailor this to your actual numbers yet, but once a real API key is added, follow-ups like this will adjust the specific meal or macro you're asking about instead of repeating the whole plan.

*Add GROQ_API_KEY to your backend's .env for real, personalized follow-ups.*"""


async def mock_stream(is_followup: bool):
    text = MOCK_FOLLOWUP if is_followup else MOCK_PLAN
    # simulate token-ish streaming so the UI's typing effect still works
    chunk_size = 12
    for i in range(0, len(text), chunk_size):
        await asyncio.sleep(0.02)
        yield sse({"text": text[i : i + chunk_size]})
    yield sse({"done": True})


async def groq_stream(messages: list):
    from groq import AsyncGroq

    client = AsyncGroq(api_key=api_key)
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    try:
        stream = await client.chat.completions.create(
            model=model,
            max_completion_tokens=1200,
            messages=full_messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield sse({"text": delta})
        yield sse({"done": True})
    except Exception as exc:
        yield sse({"error": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok", "mock_mode": MOCK_MODE}


@app.post("/api/plan")
async def plan(req: PlanRequest):
    is_followup = req.followup is not None

    if is_followup:
        messages = req.message_history + [{"role": "user", "content": req.followup}]
    else:
        messages = req.message_history + [{"role": "user", "content": build_profile_text(req)}]

    generator = mock_stream(is_followup) if MOCK_MODE else groq_stream(messages)

    return StreamingResponse(generator, media_type="text/event-stream")


# Serve the PulsePlate frontend from the same origin.
# Mounted last so it never shadows the /api/plan and /health routes above.
