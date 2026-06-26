# 🏥 Shifa Health — Bilingual Hospital Voice Agent (Demo)

A premium, **bilingual (English + Arabic)** hospital voice-agent demo. One AI voice
assistant powers two workflows:

1. **Appointment booking** — describe symptoms by voice → get a (non-diagnostic) specialty
   recommendation → pick a doctor → check availability → book, with a confirmation + reference.
2. **Post-appointment feedback** — a simulated follow-up call that asks a few questions and
   produces structured analysis (rating, sentiment, issues, categories, summary, priority),
   feeding a live insights dashboard.

> This is a **demo**. All doctors, departments, slots, patients and feedback are **mock data**.
> No real hospital systems, phone calls, payments or medical advice are involved. The agent
> never diagnoses and routes urgent symptoms to emergency services.

---

## ✨ Highlights

- 🎙️ **Voice in & out** in the browser — speech recognition (Web Speech API) + speech synthesis,
  with automatic language detection and an always-available text fallback.
- 🌍 **True bilingual** — the agent detects English vs Arabic and replies in kind; full **RTL** UI.
- 🧠 **Tool-driven agent** — the LLM understands symptoms and talks naturally, but **all booking
  data comes from the backend** (the model can never invent doctors, slots or references).
- 🛡️ **Emergency safety check** — urgent symptoms stop the booking flow with an emergency notice.
- 📊 **Insights dashboard** — sentiment, rating, issue-category, trend and doctor-satisfaction charts.
- 💸 **Zero budget** — runs locally; uses the **free Groq API** (optional). Works even with **no API
  key** thanks to a built-in rule-based fallback agent.
- 🎨 **Premium UI** — Next.js + Tailwind + Framer Motion, designed to feel like a private healthcare
  product, not an admin panel.

---

## 🧱 Architecture

```
Next.js (App Router, TS, Tailwind)        →  premium UI, voice I/O in the browser
        │  /api/* proxied to backend
        ▼
FastAPI backend                            →  agent orchestration + tools
        │
        ├─ Booking agent (tool-calling loop)
        ├─ Feedback agent (questions + analysis)
        ▼
SQLite (SQLAlchemy)                        →  departments, doctors, availability, appointments,
                                              feedback sessions / answers / analysis, scenarios
        ▲
Groq  →  Llama 3.3 (LLM + tools) + Whisper (speech-to-text)   [optional, free tier]
```

The browser handles **text-to-speech** (free, bilingual `SpeechSynthesis`) and, when available,
**speech-to-text** (free `SpeechRecognition`, best in Chrome). The Groq API key stays on the
backend and is never exposed to the frontend.

---

## ✅ Prerequisites

- **Python 3.11+**
- **Node.js 18+** (Node 20+ recommended)
- **Google Chrome** is recommended for the best in-browser voice recognition.
- *(Optional)* a free **Groq API key** → https://console.groq.com/keys (no credit card needed).

---

## 🚀 Quick start

### Option A — one command (recommended)

```bash
./run.sh
```

This sets up the Python venv + installs deps, installs frontend packages, and starts both servers.
Then open **http://localhost:3000**.

### Option B — manual (two terminals)

**1) Backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional: add your GROQ_API_KEY inside
python -m uvicorn main:app --reload --port 8000
```

**2) Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

### Option C — Docker

```bash
GROQ_API_KEY=your_key docker compose up --build
```

---

## 🔑 Adding the Groq key (optional but recommended)

Without a key the demo runs on a **rule-based fallback agent** — fully functional, scripted replies.

With a key, conversations become genuinely smart (natural understanding, follow-ups, LLM feedback
analysis) and you also get **Groq Whisper** server-side transcription as a fallback for browsers
without speech recognition.

Add it to `backend/.env`:
```
GROQ_API_KEY=gsk_...
```
Restart the backend. The Demo Data page shows whether the AI agent is active.

### Premium human-like voice (one-time step)

The call uses **Groq Orpheus neural TTS** for a natural, human voice. Groq gates these models
behind a one-time **terms acceptance**: sign in at https://console.groq.com, open the model pages
for `canopylabs/orpheus-v1-english` and `canopylabs/orpheus-arabic-saudi`, and accept the terms.
Until then the app automatically falls back to the browser's built-in voice (more robotic).

The call also supports **barge-in** — just start talking and the agent stops to listen. For the
cleanest experience use **headphones** (prevents the mic from hearing the agent through speakers).

---

## 🎬 Demo script (for a presentation)

1. **Home** → choose a flow.
2. **Book Appointment** → click *Start Voice Session*, then say (or type):
   *“I have chest discomfort and palpitations.”* → the agent recommends **Cardiology**.
   - Say *“yes, find me a doctor”* → doctor cards appear.
   - Click *Select Doctor* → pick a slot in the drawer → *Confirm* → confirmation card (`HSP-2048…`).
   - Try *“Can I see a cardiologist tomorrow at 10:30 AM?”* to demo the **nearest-slot** fallback.
   - Try Arabic: *“لدي ألم في الصدر وخفقان”* → the agent replies in Arabic and the UI flips to RTL.
   - Try an emergency phrase to see the safety stop.
3. **Follow-Up Call** → pick a completed appointment → answer the questions → see the analysis.
4. **Feedback Insights** → dashboards update with every completed call.
5. **Demo Data** → reset / reseed / create a mock appointment / load a scenario before each run.

> 💡 Tip: click the 🔊 icon to mute the agent voice during a quiet demo; the text fallback always works.

---

## 🗂️ Project structure

```
hospital-voice-agent/
├── backend/
│   ├── app/
│   │   ├── api/         # voice, appointments, feedback, demo routers
│   │   ├── agents/      # booking + feedback agents, tool schemas
│   │   ├── services/    # groq, booking, feedback, specialty rules
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── database/    # engine + seeding
│   │   ├── prompts/     # system prompts
│   │   └── utils/       # date/time parsing
│   ├── seed_data/       # mock departments, doctors, feedback, scenarios
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── app/             # home, appointment, follow-up, insights, demo-data
│   ├── components/      # voice, appointment, feedback, dashboard, ui, layout
│   ├── hooks/           # useVoice (TTS + STT)
│   ├── lib/             # api client, i18n, helpers
│   ├── store/           # zustand (language, voice)
│   └── types/
├── docker-compose.yml
├── run.sh
└── README.md
```

---

## 🧰 Troubleshooting

- **No voice recognition / mic does nothing** → use **Chrome**, allow the microphone, or just type.
  (Speech recognition isn't available in all browsers; the text input always works.)
- **No agent voice** → check the 🔊 toggle isn't muted and your system volume is up. Arabic voices
  depend on the OS; install an Arabic system voice for best pronunciation.
- **“Couldn’t start session”** → the backend isn’t running. Start it on port 8000.
- **CORS errors** → ensure `CORS_ORIGINS` in `backend/.env` includes `http://localhost:3000`.
- **Reset the demo** → Demo Data page → *Reset All Demo Data*, or delete `backend/hospital_demo.db`.

---

## 📋 Acceptance criteria coverage

English & Arabic voice ✓ · language-matched replies ✓ · symptom intake ✓ · non-diagnostic specialty
recommendation ✓ · doctor selection ✓ · mock availability check ✓ · nearest-slot suggestion ✓ ·
SQLite booking ✓ · confirmation screen ✓ · feedback voice flow ✓ · rating/sentiment/summary/issues/
categories ✓ · live dashboard updates ✓ · client-ready polish ✓ · one-click demo reset ✓

---

*Built as a zero-budget, client-facing demo. Not a production medical system; no medical accuracy implied.*
