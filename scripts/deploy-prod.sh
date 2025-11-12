#!/bin/bash
# Production deployment script

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Deploying Guess The Song (Production)..."
echo ""

# Build backend
echo "[1/4] Building backend..."
cd "$PROJECT_ROOT/backend"
npm install --production=false
npm run build

# Build frontend
echo "[2/4] Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm install --production=false
npm run build

# Setup PM2
echo "[3/4] Configuring PM2..."
pm2 delete guess-backend 2>/dev/null || true
pm2 delete guess-frontend 2>/dev/null || true

cd "$PROJECT_ROOT/backend"
pm2 start dist/index.js --name guess-backend --env production

cd "$PROJECT_ROOT/frontend"
pm2 start npm --name guess-frontend -- start

pm2 save

echo "[4/4] Setting up PM2 startup..."
pm2 startup

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Check status with: pm2 status"
echo "View logs with: pm2 logs"
echo "Restart with: pm2 restart all"

