#!/bin/bash

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║         ChaosProbeX — Setup & Run        ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Check node
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi

echo "  → Installing root dependencies..."
npm install --silent

echo "  → Installing backend dependencies..."
cd backend && npm install --silent && cd ..

echo "  → Installing frontend dependencies..."
cd frontend && npm install --silent && cd ..

echo ""
echo "  ✓ All dependencies installed"
echo ""
echo "  Starting servers..."
echo "  Backend  → http://localhost:4000"
echo "  Frontend → http://localhost:3000"
echo ""

npm run dev
