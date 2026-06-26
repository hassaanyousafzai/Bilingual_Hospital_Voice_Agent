# Deploying Shifa Health

**Use two hosts: Railway for the backend, Vercel for the frontend.**

Vercel can't host the backend because the realtime voice uses a persistent **WebSocket**
(`/api/voice/live`), and Vercel's serverless functions don't support long-lived WebSockets.
Railway (or Render/Fly) runs the FastAPI app as a normal process that can.

```
Vercel (Next.js)  ──REST /api/* (proxied)──►  Railway (FastAPI)
        └──────── wss:// realtime voice ───────┘   └── Gemini Live
```

---

## 1) Backend → Railway

1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo**.
3. Set the service **Root Directory** to `backend`.
   Railway auto-detects the `Dockerfile` (or `Procfile`) and runs `uvicorn` on `$PORT`.
4. Add **Variables**:
   - `GEMINI_API_KEY` = your Google AI Studio key (powers the voice + brain)
   - `GROQ_API_KEY` = *(optional fallback only)*
   - `CORS_ORIGINS` = `https://YOUR-APP.vercel.app` (fill in after step 2; comma-separate for multiple)
5. Deploy, then copy the public URL, e.g. `https://shifa-backend.up.railway.app`.

> SQLite lives on the container's disk, which **resets on each redeploy**. That's fine for a demo
> (it re-seeds on boot). For persistence, attach a Railway **Volume** mounted where `hospital_demo.db` lives.

---

## 2) Frontend → Vercel

1. Vercel → **New Project** → import the repo.
2. Set **Root Directory** to `frontend` (framework auto-detected as Next.js).
3. Add **Environment Variables**:
   - `BACKEND_URL` = `https://shifa-backend.up.railway.app`  (server-side REST proxy)
   - `NEXT_PUBLIC_BACKEND_WS` = `wss://shifa-backend.up.railway.app`  (client-side realtime voice)
4. Deploy. Copy the Vercel URL, e.g. `https://shifa-health.vercel.app`.

---

## 3) Connect them

- Go back to Railway → set `CORS_ORIGINS` to your Vercel URL → redeploy.
- Open the Vercel URL in **Chrome** and allow the microphone (HTTPS is required for the mic — Vercel
  provides it automatically).

That's it. REST calls flow Vercel → Railway via the proxy; the voice call connects browser → Railway
over `wss://` directly.

---

## Notes
- **Mic needs HTTPS** — works on the deployed Vercel domain and on `localhost`, but not on a plain
  `http://` IP.
- **Gemini free tier** has per-minute/day limits; heavy concurrent use can hit a quota 429. Enable
  billing on the Google AI key for production traffic.
- For a single-host alternative, you can run the backend on Render or Fly.io the same way (both support
  WebSockets) and still host the frontend on Vercel.
