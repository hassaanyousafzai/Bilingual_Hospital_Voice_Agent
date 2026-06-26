#!/usr/bin/env bash
# One-command local launcher for the Bilingual Hospital Voice Agent demo.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Setting up backend…"
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env

echo "▶ Setting up frontend…"
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start both servers and clean up on exit.
cleanup() {
  echo
  echo "▶ Stopping servers…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "▶ Starting backend on http://localhost:8000"
cd "$ROOT/backend"
source .venv/bin/activate
python -m uvicorn main:app --port 8000 &
BACKEND_PID=$!

echo "▶ Starting frontend on http://localhost:3000"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo
echo "✅ Open http://localhost:3000  (Chrome recommended for voice)"
echo "   Press Ctrl+C to stop."
wait
