# OracleSettler Demo Video Script — FINAL (~4.5 min, 16 CRE capabilities)

## HOOK (0:00 - 0:20)

**Screen**: Markets page with StatsBar visible (8 markets, volume, settled count)

**Script**:
> "Polymarket does $500 million in daily volume — but every single market is settled by a handful of people behind closed doors. If they get it wrong, you have zero recourse."
>
> "OracleSettler fixes this. Fully autonomous settlement using Chainlink CRE — no humans in the loop."

---

## PLATFORM OVERVIEW (0:20 - 0:50)

**Screen**: Scroll through Markets page showing 8 markets + StatsBar

**Script**:
> "8 live markets on Sepolia — 6 price markets covering BTC, ETH, SOL, DOGE, LINK, AVAX, plus 2 event markets: GPT-5 release and Apple Vision Pro."
>
> *(Point to StatsBar)*
>
> "Stats bar pulls real on-chain data. And settlement is permissionless by design — anyone can trigger it, but only CRE determines the outcome. The caller can't influence the result. This eliminates admin-only resolution as a single point of failure."
>
> *(Quick click to About page, flash CRE capabilities grid)*
>
> "16 CRE capabilities, 5 trigger types — including cross-contract parlay orchestration."

---

## AI MARKET CREATION (0:50 - 1:15) ⭐

**Screen**: Navigate to Create Market page

**Script**:
> "You don't need to fill out forms. Just type a question."
>
> *(Type: "will dogecoin hit a dollar by summer?")*
>
> "Gemini AI parses it — identifies the asset, extracts the price target, fills everything automatically."
>
> *(Show fields auto-filling)*
>
> "Any question, any asset. One click to deploy on-chain."

---

## SETTLEMENT REPLAY (1:15 - 1:55) ⭐

**Screen**: Markets page → Click settled BTC market → scroll to Settlement Explorer

**Script**:
> "This BTC market has been settled. Let me replay exactly how CRE did it."
>
> *(Click "▶ Replay Settlement" — let animation run, narrate lightly as it plays)*
>
> "CRE reads the market... fetches BTC price from CoinGecko AND CryptoCompare... cross-validates — divergence under 2%, sources agree... price is 2.7% below target, within 5% threshold, so Gemini AI is consulted..."
>
> *(AI thinking animation → verdict)*
>
> "NO, 75% confidence. Consensus signed. Written to chain. Full transparency — every decision visible and auditable."

---

## EVENT MARKET — THE OTHER PATH (1:55 - 2:25)

**Screen**: Navigate to GPT-5 event market

**Script**:
> "Now here's the second resolution path — event markets. 'Will GPT-5 be released before July 2026?' There's no price feed for this."
>
> *(Point to "Event Market" badge)*
>
> "CRE detects this is non-price and routes to a completely different pipeline — Gemini AI with Google Search grounding. The AI researches real-world news, analyzes evidence, and returns YES or NO with a confidence score."
>
> "Two resolution paths: dual-source price consensus for price markets, AI + Google Search for event markets. Same trustless CRE pipeline, different data sources."

---

## DISPUTE SIMULATION (2:25 - 3:00) ⭐

**Screen**: Back to settled BTC market → scroll to Dispute Panel

**Script**:
> "After settlement, there's a 1-hour dispute window. Let me show you what happens if someone challenges the result."
>
> *(Click "⚡ Simulate Dispute" — let animation play)*
>
> "Dispute filed with 0.001 ETH stake... CRE re-verifies in strict mode... AI re-analyzes with a higher 70% confidence threshold..."
>
> *(Result appears)*
>
> "Original settlement confirmed. Stake forfeited — that's anti-spam. If the re-check had found a different result, the outcome flips and the stake is refunded. Fully trustless — no human arbitrator, no DAO vote."

---

## PARLAY — CROSS-CONTRACT ORCHESTRATION (3:00 - 3:30) ⭐

**Screen**: Navigate to Parlays tab

**Script**:
> "Now the most advanced CRE feature — parlays. Combine 2 to 5 market predictions into a single combo bet with multiplied odds."
>
> *(Show Parlay Builder — select BTC YES, ETH NO, SOL YES)*
>
> "Select three markets, pick your directions — the combined multiplier updates in real-time. This is a house-pool model: your stake goes into ParlayEngine, and if all legs hit, you get the multiplied payout."
>
> *(Point to My Parlays section — show a settled parlay)*
>
> "Here's the key: settlement requires CRE to orchestrate across two contracts. It reads parlay state from ParlayEngine, then cross-reads each leg's outcome from PredictionMarket, verifies all disputes are resolved, and writes a settlement report back to ParlayEngine. Contract A reads, Contract B writes — fully autonomous, zero human intervention."

---

## SETTLEMENT VERIFICATION (3:30 - 3:45)

**Screen**: Navigate to Verification page

**Script**:
> "The Verification page — price markets show CoinGecko, CryptoCompare, and CRE settlement side by side with source divergence. Event markets show the AI verdict and confidence score. Any user can independently verify that the settlement was fair."

---

## WORLD ID + CODE (3:45 - 4:15)

### World ID (3:45 - 3:55)

**Screen**: Create page, show World ID button

**Script**:
> "Market creation supports World ID — zero-knowledge proof of unique humanness. Sybil resistance without sacrificing privacy."

### Quick Code Flash (3:55 - 4:15)

**Screen**: Quick cuts — contract + workflow + terminal

**Script**:
> "Two Solidity contracts — PredictionMarket and ParlayEngine. `_processReport` routes CRE reports by prefix byte — `0x00` creates, `0x01` settles, `0x02` resolves disputes, `0x03` settles parlays. 84 Foundry tests, all passing."

---

## CLOSE (4:15 - 4:30)

**Screen**: Markets page with all 8 markets visible

**Script**:
> "OracleSettler — trustless prediction markets with four resolution paths: dual-source price consensus, AI event judgment, dispute arbitration, and cross-contract parlay settlement."
>
> "16 CRE capabilities. 5 triggers. 84 tests. 8 live markets. Zero backend servers."
>
> "No Express. No PostgreSQL. No cron jobs. The entire backend is a CRE workflow running on Chainlink's decentralized oracle network."
>
> "Try it live at oracle-settler.vercel.app. Code on GitHub. Thanks for watching."

**Screen**: GitHub URL + Vercel URL + logo fade

---

## Recording Tips

- **Resolution**: 1920x1080, dark theme
- **Browser**: Chrome, disable cache via DevTools
- **Wallet**: MetaMask on Sepolia with test ETH
- **Pacing**: Settlement Replay and Dispute Sim animations are 1200ms/step — let them breathe, narrate alongside
- **NL Creation**: pre-test that Gemini API key works in frontend before recording
- **Recording tool**: QuickTime / Loom / OBS
- **Audio**: Clear voiceover, minimal background noise. Optional subtle lo-fi during intro/outro only.
- **Upload**: YouTube unlisted → update README + hackathon submission
- **Target**: ~4.5 minutes
- **The 5 moments judges will remember**:
  1. "will dogecoin hit a dollar" → AI auto-fills (0:50)
  2. Settlement Replay animation (1:15)
  3. Dispute simulation (2:25)
  4. Parlay cross-contract orchestration (3:00)
  5. "Zero backend" closing punch (4:15)

---

## Likely Q&A (Prepare These)

**Q1: "Can't someone just read the settlement report data before it's written on-chain and front-run it?"**

> No. CRE reports are signed by multi-node consensus via KeystoneForwarder. The `_processReport` function verifies the CRE signature — only the registered forwarder address can submit reports. An attacker can see the pending transaction, but they can't forge a settlement report because they don't control the CRE oracle network. And predictions are locked before settlement starts, so knowing the outcome early doesn't help.

**Q2: "Why two price sources instead of just Chainlink Data Feeds?"**

> Two reasons. First, CRE is designed for custom workflows — we wanted to demonstrate Confidential HTTP fetching real-world APIs, which is a differentiated CRE capability that Data Feeds don't showcase. Second, the dual-source consensus pattern (reject if >2% divergence) is more robust for arbitrary assets — we support any CoinGecko-listed asset, not just assets with Chainlink feeds. The divergence check itself is a safety mechanism that doesn't exist in single-feed systems.

**Q3: "The parlay settlement reads from two different contracts — what if the PredictionMarket state changes between reads?"**

> CRE workflow execution is atomic within a single invocation. All `callContract` reads happen in the same block context. So the PredictionMarket state CRE reads is consistent. Additionally, ParlayEngine's `_settleParlay` does an on-chain re-check — it verifies all leg markets are actually settled before accepting the CRE report. Even if CRE somehow got stale data, the contract-level guard catches it.

---

## Fallback Plan

If Sepolia RPC is down during recording:
- Frontend has **mock data fallback** — shows cached market data with amber banner
- Pre-record a backup clip of the live demo (screen recording of full flow working)
- Settlement Explorer and Dispute Simulator are client-side animations, they work without RPC
