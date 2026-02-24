#!/bin/bash
# Tenderly Virtual TestNet Demo Script
# Demonstrates the full market lifecycle on a Tenderly VTestNet fork of Sepolia

set -e

# --- Config ---
VTESTNET_RPC="https://virtual.sepolia.eu.rpc.tenderly.co/ecc3255b-c39b-493d-8a69-d5de40ab7a82"
PUBLIC_RPC="https://virtual.sepolia.eu.rpc.tenderly.co/03dfcf31-07ae-4204-879a-8f0c2a9ad16f"
CONTRACT="0x51CC15B53d776b2B7a76Fa30425e8f9aD2aec1a5"
EXPLORER="https://dashboard.tenderly.co/ryanJ/project/testnet/oracle-settler-sepolia"

echo "================================================"
echo "  OracleSettler — Tenderly Virtual TestNet Demo"
echo "================================================"
echo ""
echo "Contract: $CONTRACT"
echo "Admin RPC: $VTESTNET_RPC"
echo "Public RPC: $PUBLIC_RPC"
echo "Explorer: $EXPLORER"
echo ""

# Check if private key is available
if [ -z "$CRE_ETH_PRIVATE_KEY" ]; then
  echo "Loading .env..."
  set -a && source "$(dirname $0)/../.env" && set +a
fi

echo "--- Step 1: Fund wallet with 100 ETH ---"
curl -s -X POST "$VTESTNET_RPC" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tenderly_setBalance",
    "params": [["0x9b50ED6a40e98215b2d2da5CE2E948c28AB7eCF5"], "0x56BC75E2D63100000"],
    "id": 1
  }' | python3 -c "import json,sys; r=json.load(sys.stdin); print('Funded!' if 'result' in r else 'Error:', r)"

echo ""
echo "--- Step 2: Read market count ---"
NEXT_ID=$(cast call --rpc-url $VTESTNET_RPC $CONTRACT "getNextMarketId()(uint256)" 2>/dev/null)
echo "Markets on VTestNet: $NEXT_ID"

echo ""
echo "--- Step 3: Check World ID integration ---"
WORLD_ID=$(cast call --rpc-url $VTESTNET_RPC $CONTRACT "worldId()(address)" 2>/dev/null)
echo "World ID Router: $WORLD_ID"

echo ""
echo "================================================"
echo "  VTestNet running at: $PUBLIC_RPC"
echo "  Anyone can read contract state via Public RPC"
echo "================================================"
