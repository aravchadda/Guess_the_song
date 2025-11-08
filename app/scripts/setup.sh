#!/bin/bash
# Setup script for Guess The Song
# Run this on a fresh Ubuntu 24.04 system

set -e

echo "🎵 Setting up Guess The Song..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Ubuntu
if [[ ! -f /etc/os-release ]] || ! grep -q "Ubuntu" /etc/os-release; then
    echo -e "${YELLOW}Warning: This script is designed for Ubuntu 24.04${NC}"
fi

# Update system
echo -e "${GREEN}[1/6] Updating system...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo -e "${GREEN}[2/6] Installing Node.js 20 LTS...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install pnpm
echo -e "${GREEN}[3/6] Installing pnpm...${NC}"
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
else
    echo "pnpm already installed: $(pnpm --version)"
fi

# Install MongoDB
echo -e "${GREEN}[4/6] Installing MongoDB...${NC}"
if ! command -v mongod &> /dev/null; then
    sudo apt install -y mongodb
    sudo systemctl enable mongodb
    sudo systemctl start mongodb
else
    echo "MongoDB already installed"
fi

# Install FFmpeg
echo -e "${GREEN}[5/6] Installing FFmpeg...${NC}"
if ! command -v ffmpeg &> /dev/null; then
    sudo apt install -y ffmpeg
else
    echo "FFmpeg already installed: $(ffmpeg -version | head -n 1)"
fi

# Install PM2 (optional)
echo -e "${GREEN}[6/6] Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "PM2 already installed: $(pm2 --version)"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Install dependencies:"
echo "     cd ~/guess-song/app/backend && pnpm install"
echo "     cd ~/guess-song/app/frontend && pnpm install"
echo "     cd ~/guess-song/app/scripts && pnpm install"
echo ""
echo "  2. Configure environment variables:"
echo "     cp ~/guess-song/app/backend/.env.example ~/guess-song/app/backend/.env"
echo "     # Edit .env with your settings"
echo ""
echo "  3. Place separated stems in ~/guess-song/separated/"
echo ""
echo "  4. Preprocess audio:"
echo "     cd ~/guess-song/app/scripts && npm run preprocess"
echo ""
echo "  5. Seed database:"
echo "     cd ~/guess-song/app/backend && npm run seed"
echo ""
echo "  6. Start servers:"
echo "     cd ~/guess-song/app/backend && npm run dev"
echo "     cd ~/guess-song/app/frontend && npm run dev"
echo ""
echo "Visit http://localhost:3000 to play!"

