#!/bin/bash
# Start both backend and frontend in development mode

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🎵 Starting Guess The Song (Development Mode)..."
echo ""

# Pick up MONGODB_URI/PORT from the shared .env if present, so the messages
# below and the local-mongod check match whatever's actually configured.
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi
BACKEND_PORT="${PORT:-4000}"

# Only try to start a local MongoDB if MONGODB_URI actually points at
# localhost - this repo's default .env uses a remote (e.g. Atlas) URI, which
# needs no local mongod at all.
if [[ -z "$MONGODB_URI" || "$MONGODB_URI" == *"localhost"* || "$MONGODB_URI" == *"127.0.0.1"* ]]; then
    if ! pgrep -x mongod > /dev/null; then
        echo "⚠️  MongoDB is not running. Starting MongoDB..."
        sudo systemctl start mongodb
        sleep 2
    fi
fi

# Start backend in background
echo "🚀 Starting backend on http://localhost:$BACKEND_PORT..."
cd "$PROJECT_ROOT/backend"
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend in background
echo "🚀 Starting frontend on http://localhost:3000..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers started!"
echo ""
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Trap Ctrl+C and kill both processes
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

