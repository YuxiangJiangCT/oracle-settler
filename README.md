# OracleSettler: Real-Data + AI Prediction Market Resolution on CRE

Automated prediction market settlement using **dual-source price verification (CoinGecko + CoinCap)**, **AI judgment from Gemini**, and **Chainlink Runtime Environment (CRE)** for trustless, on-chain execution.

**Live Frontend**: [oracle-settler.vercel.app](https://oracle-settler.vercel.app) (deploy pending)

## What Makes This Different

Most prediction market systems rely on either manual resolution (slow, biased) or pure AI (hallucination-prone). OracleSettler combines both approaches with dual-source price consensus:

- **Dual-source price verification**: CoinGecko + CoinCap cross-validated (>2% divergence = settlement rejected)
- **Two-tier resolution**: >5% price difference = instant settlement, <5% = Gemini AI with confidence scoring
- **Three CRE trigger types**: HTTP (create markets), Log (on-demand settlement), Cron (scheduled auto-settlement)
- **Confidential HTTP** protects API keys inside CRE's WASM sandbox
- **Multi-asset support**: Works with any CoinGecko-listed asset (BTC, ETH, SOL, etc.)
- **Settlement Explorer**: Frontend visualizes the entire CRE pipeline for each settled market
- **Cross-platform comparison**: Live price verification against multiple sources

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRE Workflow Orchestration                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP Trigger ──→ Create Market on-chain                        │
│                                                                 │
│  Log Trigger  ──→ SettlementRequested event caught              │
│                    │                                            │
│  Cron Trigger ──→ Every 6h: scan all markets for expiry         │
│                    │                                            │
│                    ▼                                            │
│              EVM Read: market data (asset, targetPrice)          │
│                    │                                            │
│                    ▼                                            │
│    Dual-Source Confidential HTTP: CoinGecko + CoinCap           │
│         │                    │                                  │
│         └──── Divergence >2%? → REJECT settlement               │
│                    │ ✓ <2%                                      │
│                    ▼                                            │
│            Price Threshold Check                                │
│           ┌───────┴───────┐                                     │
│       >5% diff         <5% diff                                 │
│     Direct result    Gemini AI analysis                         │
│    confidence=100%   confidence=variable                        │
│           └───────┬───────┘                                     │
│                   ▼                                             │
│         CRE Signed Report → EVM Write → _settleMarket()        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend

The React frontend provides a full prediction market experience:

- **Market List**: Browse all on-chain markets with odds bars and status
- **Market Detail**: Place YES/NO predictions, request settlements, claim winnings
- **Settlement Explorer**: Step-by-step visualization of how CRE settled each market
- **Price Comparison**: Cross-platform verification (CRE vs CoinGecko vs CoinCap live)
- **Create Market**: Deploy new prediction markets with preset templates

### Running the Frontend

```bash
cd prediction-market/frontend
npm install
npm run dev    # http://localhost:5173
```

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast)
- [Bun](https://bun.sh/) v1.0+
- [CRE CLI](https://docs.chain.link/cre) (`curl -sSL https://cre.chain.link/install.sh | sh`)
- [Node.js](https://nodejs.org/) v18+ (for frontend)
- Sepolia ETH ([faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia))
- [Gemini API key](https://aistudio.google.com/apikey) (free)

### Setup

```bash
# Clone and install
git clone https://github.com/YuxiangJiangCT/oracle-settler.git
cd oracle-settler/prediction-market

# Configure environment
cp .env.example .env
# Edit .env with your private key and Gemini API key

# Install workflow dependencies
cd my-workflow && bun install && cd ..

# Compile contracts
cd contracts && forge build && cd ..

# Install and run frontend
cd frontend && npm install && npm run dev
```

### Deploy

```bash
forge create --broadcast \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key $YOUR_PRIVATE_KEY \
  --root contracts \
  src/PredictionMarket.sol:PredictionMarket \
  --constructor-args 0x15fc6ae953e024d975e77382eeec56a9101f9f88
```

Update `my-workflow/config.staging.json` with the deployed contract address.

### Create Markets & Settle

```bash
CONTRACT=0x204173d93b41D76c467D6A75856Ba03A3412B10d
RPC=https://ethereum-sepolia-rpc.publicnode.com

# Create a BTC market
cast send --rpc-url $RPC --private-key $PK $CONTRACT \
  "createMarket(string,string,uint256)" \
  "Will BTC be above 50000 USD by March 1 2026?" "bitcoin" 50000000000

# Request settlement
cast send --rpc-url $RPC --private-key $PK $CONTRACT \
  "requestSettlement(uint256)" 0

# Run CRE workflow to settle (simulation)
cre workflow simulate my-workflow --non-interactive --trigger-index 1 \
  --evm-tx-hash <SETTLEMENT_TX_HASH> --evm-event-index 0

# Run with broadcast to settle on-chain
cre workflow simulate my-workflow --non-interactive --trigger-index 1 \
  --evm-tx-hash <SETTLEMENT_TX_HASH> --evm-event-index 0 --broadcast
```

## Demo: Multi-Asset Settlement

Three markets deployed and settled on Sepolia with real CoinGecko + CoinCap prices:

| Market | Asset | Question | Target | Actual Price | Outcome | Confidence |
|--------|-------|----------|--------|-------------|---------|-----------|
| #0 | BTC | Will BTC be above $50,000? | $50,000 | $65,389 | YES | 100% |
| #1 | ETH | Will ETH be above $10,000? | $10,000 | $1,883 | NO | 100% |
| #2 | SOL | Will SOL be above $100? | $100 | $79 | NO | 100% |

**Contract (Sepolia)**: [`0x204173d93b41D76c467D6A75856Ba03A3412B10d`](https://sepolia.etherscan.io/address/0x204173d93b41D76c467D6A75856Ba03A3412B10d)

## CRE Capabilities Used (8+)

| # | Capability | Purpose |
|---|-----------|---------|
| 1 | **HTTP Trigger** | Market creation via webhook |
| 2 | **Log Trigger** | Event-driven on-demand settlement |
| 3 | **Cron Trigger** | Scheduled auto-settlement every 6 hours |
| 4 | **EVM Read** | Read market data (asset, targetPrice, pools) |
| 5 | **EVM Write** | Write signed settlement report to contract |
| 6 | **Confidential HTTP (CoinGecko)** | Primary price oracle (API key in WASM) |
| 7 | **Confidential HTTP (CoinCap)** | Secondary price oracle for dual-source consensus |
| 8 | **Confidential HTTP (Gemini AI)** | AI judgment for borderline cases |
| 9 | **Consensus Aggregation** | Multi-node agreement on price data |
| 10 | **Custom Compute** | Price threshold logic + source divergence check |

## Files Modified from Bootcamp Template

| File | Changes | Why |
|------|---------|-----|
| `contracts/src/PredictionMarket.sol` | Added `asset`, `targetPrice`, `settledPrice` to Market struct; added `getNextMarketId()` | Support multi-asset markets with on-chain price verification |
| `my-workflow/logCallback.ts` | Refactored to use shared settlement logic | Clean architecture, code reuse with Cron trigger |
| `my-workflow/cronCallback.ts` | **New** — Scheduled market scanner | Auto-settle expired markets without manual intervention |
| `my-workflow/settlementLogic.ts` | **New** — Dual-source price fetch + threshold + AI + write | DRY principle across triggers with dual-source consensus |
| `my-workflow/coincapPrice.ts` | **New** — CoinCap price fetcher | Second independent price source for consensus |
| `my-workflow/main.ts` | Added Cron trigger registration | Three trigger types for comprehensive automation |
| `my-workflow/httpCallback.ts` | Updated for asset + targetPrice params | Support new market creation schema |
| `frontend/` | **New** — React + TypeScript + ethers.js | Full market UI with Settlement Explorer |

## How It Works

1. **Market Creation**: User calls `createMarket("Will BTC be above $50K?", "bitcoin", 50000e6)` specifying the CoinGecko asset ID and target price in 6 decimals
2. **Prediction**: Users bet YES or NO by sending ETH to `predict(marketId, prediction)`
3. **Settlement Request**: Anyone calls `requestSettlement(marketId)` which emits a `SettlementRequested` event
4. **CRE Catches Event**: The Log Trigger picks up the event and initiates settlement
5. **Dual-Source Price Fetch**: CRE fetches from CoinGecko AND CoinCap via Confidential HTTP
6. **Source Consensus**: If sources diverge >2%, settlement is rejected for safety
7. **Outcome Determination**:
   - If price is >5% away from target: instant settlement (no AI needed)
   - If price is within 5%: Gemini AI analyzes with full context and provides confidence score
8. **On-Chain Settlement**: CRE signs and writes the settlement report to the smart contract
9. **Auto-Settlement**: Cron trigger runs every 6 hours to catch and settle any expired markets

## Tech Stack

- **Smart Contract**: Solidity 0.8.24 (Foundry)
- **CRE Workflow**: TypeScript (Bun + CRE SDK)
- **Price Oracles**: CoinGecko + CoinCap (dual-source via Confidential HTTP)
- **AI**: Google Gemini 2.0 Flash (via Confidential HTTP)
- **Frontend**: React + TypeScript + Vite + ethers.js v6
- **Network**: Ethereum Sepolia Testnet
- **CRE Forwarder**: `0x15fc6ae953e024d975e77382eeec56a9101f9f88`
