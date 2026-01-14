#!/bin/bash

# ClaudeFlare VS Code Extension Build Script

set -e

echo "🔨 Building ClaudeFlare VS Code Extension..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Compile TypeScript
echo "📝 Compiling TypeScript..."
npm run compile

# Copy resources
echo "📦 Copying resources..."
mkdir -p dist/resources
cp -r resources/* dist/resources/ 2>/dev/null || true

# Check if build succeeded
if [ -d "dist" ]; then
  echo "✅ Build completed successfully!"
  echo "📊 Build statistics:"
  echo "   - Files: $(find dist -type f | wc -l)"
  echo "   - Size: $(du -sh dist | cut -f1)"
  echo ""
  echo "🚀 To install the extension, run:"
  echo "   code --install-extension ."
else
  echo "❌ Build failed!"
  exit 1
fi
