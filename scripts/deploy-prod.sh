#!/bin/bash
# Production deployment script

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Deploying Guess The Song (Production)..."
echo ""

# The preprocessed audio (backend/preprocessed/) is gitignored - it has to
# already be on this machine (rsynced/copied separately) before seeding.
# See scripts/setup.sh step 3 for how to (re)generate it if it's missing.
if [ ! -d "$PROJECT_ROOT/backend/preprocessed" ] || [ -z "$(ls -A "$PROJECT_ROOT/backend/preprocessed" 2>/dev/null)" ]; then
    echo "❌ backend/preprocessed/ is missing or empty."
    echo "   Copy it onto this machine, or see scripts/setup.sh step 3 to rebuild it"
    echo "   from getting_the_data/kaggle_level_pipeline.ipynb's output."
    exit 1
fi

# Build backend
echo "[1/5] Building backend..."
cd "$PROJECT_ROOT/backend"
npm install --production=false
npm run build

# Build frontend
echo "[2/5] Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm install --production=false
npm run build

# Seed the database from getting_the_data/combined_songs_with_links.csv.
# Safe to re-run on every deploy: it only replaces the Song catalog, never
# touches User accounts/points/stats.
echo "[3/5] Seeding database..."
cd "$PROJECT_ROOT/backend"
npm run seed

# Setup PM2
echo "[4/5] Configuring PM2..."
pm2 delete guess-backend 2>/dev/null || true
pm2 delete guess-frontend 2>/dev/null || true

cd "$PROJECT_ROOT/backend"
pm2 start dist/index.js --name guess-backend --env production

cd "$PROJECT_ROOT/frontend"
pm2 start npm --name guess-frontend -- start

pm2 save

echo "[5/5] Setting up PM2 startup..."
pm2 startup

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Check status with: pm2 status"
echo "View logs with: pm2 logs"
echo "Restart with: pm2 restart all"

