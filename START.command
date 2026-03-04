#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  ◈ DEGEN COMMAND CENTER ◈"
echo "  Starting up..."
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "  ⚠ Node.js not found!"
    echo "  Download it from: https://nodejs.org"
    echo "  (Get the LTS version, install, then double-click this again)"
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies (first time only)..."
    npm install
fi

echo "  🚀 Launching battlefield..."
echo "  Opening browser in 3 seconds..."
echo ""

# Open browser after short delay
(sleep 3 && open http://localhost:5173) &

# Start dev server
npm run dev
