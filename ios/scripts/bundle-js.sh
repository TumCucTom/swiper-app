#!/bin/bash

# Script to automatically bundle JavaScript for offline use
# This should be run as an Xcode Build Phase before "Copy Bundle Resources"
# Usage: bash "${SRCROOT}/scripts/bundle-js.sh"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine project root - handle both direct execution and Xcode build phase
if [ -n "$SRCROOT" ]; then
    # Running from Xcode build phase
    PROJECT_ROOT="$SRCROOT/.."
else
    # Running directly - go up from scripts/ directory
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

BUNDLE_OUTPUT="$PROJECT_ROOT/ios/main.jsbundle"
BUNDLE_DIR="$(dirname "$BUNDLE_OUTPUT")"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}📦 Bundling JavaScript for offline use...${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

# Check if node_modules exists
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${RED}❌ Error: node_modules not found.${NC}"
    echo -e "${YELLOW}   Run 'npm install' in: $PROJECT_ROOT${NC}"
    exit 1
fi

# Check if index.js exists
if [ ! -f "$PROJECT_ROOT/index.js" ]; then
    echo -e "${RED}❌ Error: index.js not found.${NC}"
    exit 1
fi

cd "$PROJECT_ROOT"

# Create bundle directory if it doesn't exist
mkdir -p "$BUNDLE_DIR"

# Use npx to ensure we get the correct React Native CLI version
echo -e "${YELLOW}📦 Running React Native bundle command...${NC}"

if npx --yes react-native bundle \
    --platform ios \
    --dev false \
    --entry-file index.js \
    --bundle-output "$BUNDLE_OUTPUT" \
    --assets-dest "$BUNDLE_DIR" \
    --minify true; then
    
    echo -e "${GREEN}✅ JavaScript bundle created successfully!${NC}"
    
    # Check bundle size and existence
    if [ -f "$BUNDLE_OUTPUT" ]; then
        BUNDLE_SIZE=$(du -h "$BUNDLE_OUTPUT" | cut -f1)
        BUNDLE_LINES=$(wc -l < "$BUNDLE_OUTPUT" | tr -d ' ')
        echo -e "${GREEN}📊 Bundle size: $BUNDLE_SIZE${NC}"
        echo -e "${GREEN}📊 Bundle lines: $BUNDLE_LINES${NC}"
        echo -e "${GREEN}📁 Location: $BUNDLE_OUTPUT${NC}"
    else
        echo -e "${RED}⚠️  Warning: Bundle file not found after creation${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Error: Failed to create JavaScript bundle${NC}"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════${NC}"

