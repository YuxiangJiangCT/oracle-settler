# OracleSettler Frontend

React + TypeScript + Vite frontend for the OracleSettler prediction market platform.

## Components

| Component | Description |
|-----------|-------------|
| **MarketList** | Grid of all on-chain markets with status badges |
| **MarketCard** | Individual market card with odds bar and metadata |
| **MarketDetail** | Full market view with betting, claims, and settlement |
| **BetPanel** | YES/NO prediction placement with ETH amount input |
| **ClaimPanel** | Winner payout claiming after dispute window closes |
| **RequestSettlement** | Trigger CRE settlement via on-chain event |
| **SettlementExplorer** | Step-by-step visualization of CRE settlement process |
| **DisputePanel** | File disputes with countdown timer and stake management |
| **PriceComparison** | Dual-source price display (CoinGecko vs CryptoCompare) |
| **CreateMarket** | Market creation form (price markets + event markets) |
| **About** | Architecture overview, CRE capabilities grid, how it works |

## Setup

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # Production build
```

## Configuration

Contract address and ABI are in `src/contract.ts`. The app connects to Sepolia via public RPC and requires MetaMask for transactions.

## Deployment

Deployed on Vercel with auto-deploy from GitHub: [oracle-settler.vercel.app](https://oracle-settler.vercel.app)
