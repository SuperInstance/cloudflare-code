#!/bin/bash

# ClaudeFlare Initial Setup Script
# This script helps you get started with ClaudeFlare

set -e

echo "🚀 ClaudeFlare Initial Setup"
echo "============================"
echo ""

# Check prerequisites
echo "1️⃣ Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed"
  echo "Please install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js version must be 20 or higher"
  echo "Current version: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v)"

if ! command -v npm &> /dev/null; then
  echo "❌ npm is not installed"
  exit 1
fi

echo "✅ npm $(npm -v)"

if ! command -v git &> /dev/null; then
  echo "❌ git is not installed"
  exit 1
fi

echo "✅ git $(git --version)"

echo ""

# Install dependencies
echo "2️⃣ Installing dependencies..."
npm install

echo ""

# Copy environment file
echo "3️⃣ Setting up environment variables..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env file from .env.example"
  echo "⚠️  Please edit .env and add your Cloudflare credentials"
else
  echo "ℹ️  .env file already exists"
fi

echo ""

# Check for Wrangler
echo "4️⃣ Checking Wrangler installation..."
if ! command -v wrangler &> /dev/null; then
  echo "Installing Wrangler globally..."
  npm install -g wrangler
else
  echo "✅ Wrangler $(wrangler --version)"
fi

echo ""

# Prompt for Cloudflare authentication
echo "5️⃣ Cloudflare Authentication"
echo "Please authenticate with Cloudflare:"
echo ""
wrangler login

echo ""

# Create .wrangler directory
echo "6️⃣ Setting up Wrangler configuration..."
mkdir -p .wrangler

echo ""

# Run tests
echo "7️⃣ Running initial tests..."
npm run typecheck || echo "⚠️  TypeScript check has issues (expected on first run)"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Cloudflare credentials"
echo "2. Create Cloudflare resources (KV, R2, D1)"
echo "3. Update wrangler.toml with resource IDs"
echo "4. Run 'npm run dev' to start development"
echo ""
echo "For detailed instructions, see README-DEPLOYMENT.md"
