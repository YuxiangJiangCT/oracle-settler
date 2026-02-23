# OracleSettler: Real-Data + AI Prediction Market Resolution on CRE

Automated prediction market settlement using **real price data from CoinGecko**, **AI judgment from Gemini**, and **Chainlink Runtime Environment (CRE)** for trustless, on-chain execution.

## What Makes This Different

Most prediction market systems rely on either manual resolution (slow, biased) or pure AI (hallucination-prone). OracleSettler combines both approaches:

- **Real price data** from CoinGecko API as ground truth — not pure AI guessing
- **Two-tier resolution**: >5% price difference = instant settlement, <5% = Gemini AI with confidence scoring
- **Three CRE trigger types**: HTTP (create markets), Log (on-demand settlement), Cron (scheduled auto-settlement)
- **Confidential HTTP** protects API keys inside CRE's WASM sandbox
- **Multi-asset support**: Works with any CoinGecko-listed asset (BTC, ETH, SOL, etc.)
- **On-chain verifiability**: Settled price stored on-chain for transparency

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
│         Confidential HTTP: CoinGecko real price                 │
│                    │                                            │
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

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast)
- [Bun](https://bun.sh/) v1.0+
- [CRE CLI](https://docs.chain.link/cre) (`curl -sSL https://cre.chain.link/install.sh | sh`)
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

Three markets deployed and settled on Sepolia with real CoinGecko prices:

| Market | Asset | Question | Target | Actual Price | Outcome | Confidence |
|--------|-------|----------|--------|-------------|---------|-----------|
| #0 | BTC | Will BTC be above $50,000? | $50,000 | $65,389 | YES | 100% |
| #1 | ETH | Will ETH be above $10,000? | $10,000 | $1,883 | NO | 100% |
| #2 | SOL | Will SOL be above $100? | $100 | $79 | NO | 100% |

**Contract (Sepolia)**: [`0x204173d93b41D76c467D6A75856Ba03A3412B10d`](https://sepolia.etherscan.io/address/0x204173d93b41D76c467D6A75856Ba03A3412B10d)

## CRE Capabilities Used

| Capability | Purpose |
|-----------|---------|
| **HTTP Trigger** | Market creation via webhook |
| **Log Trigger** | Event-driven on-demand settlement |
| **Cron Trigger** | Scheduled auto-settlement every 6 hours |
| **EVM Read** | Read market data (asset, targetPrice, pools) |
| **EVM Write** | Write signed settlement report to contract |
| **Confidential HTTP** | CoinGecko price API + Gemini AI (API keys protected in WASM) |
| **Consensus Aggregation** | Distributed agreement on price data |

## Files Modified from Bootcamp Template

| File | Changes | Why |
|------|---------|-----|
| `contracts/src/PredictionMarket.sol` | Added `asset`, `targetPrice`, `settledPrice` to Market struct; added `getNextMarketId()` | Support multi-asset markets with on-chain price verification |
| `my-workflow/logCallback.ts` | Refactored to use shared settlement logic | Clean architecture, code reuse with Cron trigger |
| `my-workflow/cronCallback.ts` | **New** — Scheduled market scanner | Auto-settle expired markets without manual intervention |
| `my-workflow/settlementLogic.ts` | **New** — Shared price fetch + threshold + AI + write | DRY principle across Log and Cron triggers |
| `my-workflow/main.ts` | Added Cron trigger registration | Three trigger types for comprehensive automation |
| `my-workflow/httpCallback.ts` | Updated for asset + targetPrice params | Support new market creation schema |

## How It Works

1. **Market Creation**: User calls `createMarket("Will BTC be above $50K?", "bitcoin", 50000e6)` specifying the CoinGecko asset ID and target price in 6 decimals
2. **Prediction**: Users bet YES or NO by sending ETH to `predict(marketId, prediction)`
3. **Settlement Request**: Anyone calls `requestSettlement(marketId)` which emits a `SettlementRequested` event
4. **CRE Catches Event**: The Log Trigger picks up the event and initiates settlement
5. **Price Verification**: CRE makes a confidential HTTP call to CoinGecko to get the real asset price
6. **Outcome Determination**:
   - If price is >5% away from target: instant settlement (no AI needed)
   - If price is within 5%: Gemini AI analyzes with full context and provides confidence score
7. **On-Chain Settlement**: CRE signs and writes the settlement report to the smart contract
8. **Auto-Settlement**: Cron trigger runs every 6 hours to catch and settle any expired markets

## Tech Stack

- **Smart Contract**: Solidity 0.8.24 (Foundry)
- **CRE Workflow**: TypeScript (Bun + CRE SDK)
- **Price Oracle**: CoinGecko API (via Confidential HTTP)
- **AI**: Google Gemini 2.0 Flash (via Confidential HTTP)
- **Network**: Ethereum Sepolia Testnet
- **CRE Forwarder**: `0x15fc6ae953e024d975e77382eeec56a9101f9f88`
