# Architecture Deep Dive

## System Overview

OracleSettler is a **zero-backend prediction market** where Chainlink CRE replaces the entire server stack. Two Solidity contracts handle all on-chain logic; a CRE workflow handles all off-chain orchestration.

```
┌─────────────┐     ┌─────────────────────────────────────────────┐
│   Frontend   │     │           CRE Workflow (5 triggers)         │
│   (React)    │     │                                             │
│              │     │  HTTP ──→ createMarket via 0x00 report      │
│  ethers.js ──┼──→  │  Log  ──→ settlement via 0x01 report       │
│              │     │  Log  ──→ dispute re-verify via 0x02 report │
│              │     │  Cron ──→ auto-settle + auto-create         │
│              │     │  Log  ──→ parlay settlement via 0x03 report │
└──────┬───────┘     └──────────────────┬──────────────────────────┘
       │                                │
       │ tx / call                      │ writeReport()
       ▼                                ▼
┌──────────────────────────────────────────────────────┐
│                  Sepolia Contracts                    │
│                                                      │
│  PredictionMarket (0x51CC...c1a5)                    │
│  ├── createMarket / createMarketVerified (World ID)  │
│  ├── predict (YES/NO + ETH stake)                    │
│  ├── _processReport: 0x00 create, 0x01 settle,       │
│  │                   0x02 resolveDispute              │
│  ├── disputeMarket + 0.001 ETH stake                 │
│  ├── claim / refund                                  │
│  └── getMarket / getDispute (view)                   │
│                                                      │
│  ParlayEngine (0x6981...dC2B)                        │
│  ├── createParlay([markets], [predictions]) payable  │
│  ├── requestParlaySettlement(parlayId)               │
│  ├── _processReport: 0x03 → _settleParlay            │
│  ├── claimParlayWinnings(parlayId)                   │
│  └── getParlay / getParlayLegs (view)                │
└──────────────────────────────────────────────────────┘
```

## Report Routing

Both contracts inherit `ReceiverTemplate` and override `_processReport(bytes)`. The first byte determines the action:

| Prefix | Target | Action |
|--------|--------|--------|
| `0x00` | PredictionMarket | Create market on-chain (from HTTP/Cron trigger) |
| `0x01` | PredictionMarket | Settle market with outcome + confidence + price |
| `0x02` | PredictionMarket | Resolve dispute (confirm or overturn) |
| `0x03` | ParlayEngine | Settle parlay (won/voided/lost + payout) |

CRE's `writeReport()` `receiver` parameter controls which contract receives the report. Same forwarder address, different receivers.

## Price Consensus Algorithm

```
fetch CoinGecko price (Confidential HTTP)
fetch CoinCap price  (Confidential HTTP)

if |coingecko - coincap| / avg > 2%:
    REJECT (source disagreement — too risky)

avg_price = (coingecko + coincap) / 2
diff = |avg_price - targetPrice| / targetPrice

if diff > 5%:
    DIRECT settlement (confidence = 100%)
    outcome = avg_price > targetPrice ? YES : NO

if diff <= 5%:
    call Gemini AI with full context (prices, target, market question)
    AI returns: { outcome: YES/NO, confidence: 0-100% }
    if confidence >= 60%: settle
    else: reject (too uncertain)
```

## Event Market Resolution

For markets with `targetPrice = 0` (event markets):

```
CRE detects asset is not a price feed
→ skip CoinGecko/CoinCap entirely
→ call Gemini AI with Google Search grounding
→ AI researches real-world news/evidence
→ returns YES/NO + confidence score
→ if confidence >= 60%: settle
```

## Dispute Flow

```
settlement occurs → 1-hour window opens
                  → user calls disputeMarket(id) + 0.001 ETH
                  → emits DisputeFiled event
                  → CRE Log Trigger fires
                  → re-runs FULL verification in strict mode
                  → strict mode: confidence threshold = 70% (vs 60% normal)
                  → if outcome differs AND confidence >= 70%:
                      OVERTURN (flip outcome, return stake)
                  → else:
                      CONFIRM (keep outcome, forfeit stake)
```

## Cross-Contract Parlay Settlement

This is the most advanced CRE pattern — reading from Contract A, writing to Contract B:

```
User creates parlay on ParlayEngine (2-5 legs, each referencing a PredictionMarket ID)
  → odds snapshot locked at creation (pool ratios → multiplier BPS)
  → stake held by ParlayEngine

All leg markets settle independently on PredictionMarket (via normal CRE flow)

User calls requestParlaySettlement(parlayId) on ParlayEngine
  → emits ParlaySettlementRequested(parlayId)

CRE Log Trigger fires:
  1. readParlay(parlayId)         ← EVM Read on ParlayEngine
  2. readParlayLegs(parlayId)     ← EVM Read on ParlayEngine
  3. for each leg:
     a. readMarket(leg.marketId)  ← EVM Read on PredictionMarket (cross-contract)
     b. readDispute(leg.marketId) ← EVM Read on PredictionMarket (cross-contract)
     c. verify: market.settled == true
     d. verify: dispute.resolved or no dispute filed
     e. compare leg.prediction vs market.outcome
  4. determine: won (all legs hit) / voided (any cancelled) / lost
  5. calculate payout from stored multipliers
  6. encode 0x03 + abi.encode(parlayId, won, voided, payout)
  7. writeReport(receiver: ParlayEngine) ← EVM Write on ParlayEngine
```

## CRE Capabilities (16 total)

| # | Category | Capability | Module |
|---|----------|-----------|--------|
| 1 | Trigger | HTTP Trigger | httpCallback.ts |
| 2 | Trigger | Log Trigger (Settlement) | logCallback.ts |
| 3 | Trigger | Log Trigger (Dispute) | disputeCallback.ts |
| 4 | Trigger | Cron Trigger | cronCallback.ts |
| 5 | Trigger | Log Trigger (Parlay) | parlayCallback.ts |
| 6 | Read | EVM Read (Market) | settlementLogic.ts |
| 7 | Write | EVM Write (Settlement) | settlementLogic.ts |
| 8 | HTTP | Confidential HTTP (CoinGecko) | settlementLogic.ts |
| 9 | HTTP | Confidential HTTP (CoinCap) | coincapPrice.ts |
| 10 | HTTP | Confidential HTTP (Gemini AI) | settlementLogic.ts |
| 11 | Compute | Custom Compute (threshold) | settlementLogic.ts |
| 12 | Compute | Strict Compute (dispute 70%) | disputeCallback.ts |
| 13 | Consensus | Consensus Aggregation | CRE runtime |
| 14 | Read | EVM Read (Parlay State) | parlayCallback.ts |
| 15 | Read | EVM Read (Cross-Contract) | parlayCallback.ts |
| 16 | Write | EVM Write (Parlay Report) | parlayCallback.ts |

## Security Model

- **CRE Forwarder**: Only `0x15fc6ae953e...` can call `onReport()` — verified by `ReceiverTemplate`
- **Dual-source consensus**: >2% divergence = reject, prevents single-source manipulation
- **Dispute anti-spam**: 0.001 ETH stake forfeited on frivolous disputes
- **Parlay safety**: `MAX_PAYOUT = 0.5 ETH`, `MIN_POOL_SIZE = 0.005 ETH`, balance check at creation
- **On-chain re-check**: ParlayEngine `_settleParlay` verifies all legs settled even after CRE report
- **World ID**: Optional ZK proof for sybil-resistant market creation

## Known Limitations

1. **Creator = Forwarder for CRE-created markets**: When CRE creates markets via HTTP/Cron trigger, `msg.sender` is the forwarder, not a user. This is documented and expected.
2. **Dispute window is time-based**: 1-hour window uses `block.timestamp`, which has ~15s granularity on Sepolia.
3. **Parlay house pool**: ParlayEngine needs pre-funding. If pool drains, new parlays with high payouts will revert.
4. **Event market subjectivity**: AI judgment is inherently subjective. The confidence threshold (60%/70%) mitigates but doesn't eliminate this.
