#!/bin/bash

# === ABSOLUTE PATHS ===
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REACT_DIR="$PROJECT_ROOT/src/static/js/video-markup"
STATIC_DIR="$PROJECT_ROOT/src/static"
TEMPLATES_DIR="$PROJECT_ROOT/src/templates"

# === SAFETY CHECKS ===
if [ ! -d "$REACT_DIR" ]; then
  echo "❌ React directory not found at: $REACT_DIR"
  exit 1
fi

# === STEP 1: Build React ===
echo "🚀 Building React frontend..."
cd "$REACT_DIR" || exit 1
npm run build || { echo "❌ React build failed"; exit 1; }
cd "$PROJECT_ROOT" || exit 1

# === STEP 2: Copy Build Output ===
echo "🗂️  Syncing React build → Flask"

rm -rf "$STATIC_DIR"
rm -rf "$TEMPLATES_DIR"
mkdir -p "$STATIC_DIR"
mkdir -p "$TEMPLATES_DIR"

cp -r "$REACT_DIR/build/static" "$STATIC_DIR/"
cp "$REACT_DIR/build/index.html" "$TEMPLATES_DIR/index.html"

echo "✅ Done. Flask static and templates updated."
