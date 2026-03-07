# OracleSettler — Demo Video Script (~5 min)

> **How to use this script**: Text in `「quote blocks」` is what you say out loud. Text in `[brackets]` is what you do on screen. Read the quotes exactly — they're written to flow naturally.

---

## 1. HOOK (0:00 – 0:20)

[Screen: Markets page with StatsBar visible, 8 markets showing]

「Polymarket does 500 million dollars in daily volume. But every single market is settled by a handful of people behind closed doors. If they get it wrong, or if they're biased, you have zero recourse.」

[Pause 1 second]

「OracleSettler fixes this. Fully autonomous settlement — powered by Chainlink CRE. No humans in the loop, no admin keys, no trust required.」

---

## 2. PLATFORM OVERVIEW (0:20 – 0:50)

[Screen: Scroll slowly through Markets page, showing all 8 market cards + StatsBar at top]

「Right now we have 8 live markets on Sepolia. Six of them are price markets — BTC, ETH, SOL, DOGE, LINK, and AVAX — and two are event markets: GPT-5 release and Apple Vision Pro.」

[Point cursor to StatsBar numbers]

「The stats bar up here pulls real on-chain data — total markets, total volume, settled count. And notice: settlement is permissionless. Anyone can trigger it. But only the CRE workflow determines the outcome. The caller cannot influence the result. This eliminates admin-only resolution as a single point of failure.」

[Click to About page, let CRE capabilities grid load]

「And on the About page, you can see all 16 CRE capabilities we're using — 5 different trigger types, including cross-contract parlay orchestration, which I'll show you in a minute.」

---

## 3. AI MARKET CREATION (0:50 – 1:15)

[Navigate to Create Market page]

「Creating a market is effortless. You don't need to fill out any forms. Just type a question in plain English.」

[Click the AI input field, type: "bitcoin 150k by end of year"]

「I'll type: bitcoin 150k by end of year.」

[Wait for Gemini to parse — fields auto-fill]

「Gemini AI parses the input — it identifies that the asset is Bitcoin, extracts the price target of 150 thousand dollars, and generates a clean prediction question. All the fields fill in automatically.」

[Gesture at the filled form]

「Any question, any asset. One sentence in, one click to deploy on-chain.」

---

## 4. SETTLEMENT REPLAY (1:15 – 1:55)

[Navigate back to Markets page → click on a settled BTC market → scroll down to Settlement Explorer section]

「Now let's look at how settlement actually works. This BTC market has already been settled. I can replay exactly how CRE resolved it, step by step.」

[Click "▶ Replay Settlement" button — let animation run]

「Watch — CRE reads the market parameters from the smart contract...」

[Animation shows price fetching steps]

「...then fetches the BTC price from two independent sources — CoinGecko and CryptoCompare. This is dual-source price consensus. It cross-validates the prices — divergence is under 2 percent, so the sources agree.」

[Animation shows AI step]

「Now, the price is 2.7 percent below target — that's within the 5 percent borderline threshold. So CRE routes to Gemini AI for the final judgment.」

[Animation shows verdict]

「AI says NO, with 75 percent confidence. Consensus is signed by multiple CRE nodes, and the result is written to chain. Every single decision is visible and auditable. Full transparency.」

---

## 5. EVENT MARKET — THE OTHER PATH (1:55 – 2:25)

[Navigate to GPT-5 event market]

「Now here's the second resolution path. This market asks: Will GPT-5 be released before July 2026? There's no price feed for this — it's a real-world event.」

[Point cursor to "Event Market" badge on the card]

「CRE detects that the target price is zero — meaning this is a non-price market — and routes to a completely different pipeline. Instead of fetching price data, it calls Gemini AI with Google Search grounding. The AI researches real-world news, analyzes the evidence, and returns YES or NO with a confidence score.」

[Pause briefly]

「So the system has two resolution paths. For price markets: dual-source consensus with CoinGecko and CryptoCompare. For event markets: AI plus Google Search. Same trustless CRE pipeline, but different data sources — automatically routed based on the market type.」

---

## 6. SETTLE PREVIEW + AI ADVISOR (2:25 – 3:00)

[Navigate to an active price market like BTC or ETH → scroll down to Settle Preview panel]

「Before settlement even happens, users can preview the outcome in real time. This is the Settle Preview panel. It fetches live prices from CoinGecko and CryptoCompare right now, runs the same dual-source consensus check that the CRE workflow uses, and shows what the outcome would be if the market were settled at this moment.」

[Point cursor to the live prices, consensus bar, and predicted verdict]

「Both sources agree, divergence is under 2 percent. Predicted outcome: YES.」

[Scroll down to AI Market Advisor panel → click "Ask AI Advisor"]

「And below that — the AI Market Advisor. Let me click Ask AI Advisor.」

[Wait for Gemini result to appear, showing edge bars and recommendation]

「Gemini analyzes the market data, compares it with the current betting odds, and estimates the true probability of YES. It then calculates the edge — the difference between what the market says and what the AI thinks.」

[Point to the edge comparison bars and recommendation badge]

「Here, the market says 60 percent YES, but AI estimates 85 percent. That's a plus-25-percent edge — mispricing detected. The advisor recommends: BET YES. This is AI working proactively for traders, not just at settlement time.」

---

## 7. DISPUTE SIMULATION (3:00 – 3:35)

[Navigate back to the settled BTC market → scroll down to the Dispute Panel]

「After settlement, there's a 1-hour dispute window. What happens if someone thinks the result is wrong? Let me simulate a dispute.」

[Click "⚡ Simulate Dispute" button — let animation play]

「A dispute is filed with a 0.001 ETH stake. CRE kicks into strict re-verification mode — it re-fetches both price sources, re-runs the consensus check, and this time the AI threshold is raised to 70 percent confidence. A higher bar for overturning.」

[Wait for result to appear]

「Result: original settlement confirmed. The dispute stake is forfeited — that's the anti-spam mechanism. But if the re-check had found a different result, the outcome would flip and the stake would be refunded. Fully trustless dispute resolution. No human arbitrator, no DAO vote, no appeals committee.」

---

## 8. PARLAY — CROSS-CONTRACT ORCHESTRATION (3:35 – 4:05)

[Navigate to Parlays tab]

「Now the most advanced CRE feature — parlays. You can combine two to five market predictions into a single combo bet with multiplied odds.」

[In Parlay Builder: select BTC YES, ETH NO, SOL YES]

「I'll pick three markets — BTC YES, ETH NO, SOL YES. The combined multiplier updates in real time as I add legs.」

[Point to the multiplier and payout calculation]

「This is a house-pool model. Your stake goes into the ParlayEngine contract, and if all three legs hit, you get the multiplied payout.」

[Scroll to My Parlays section, point to a settled parlay]

「Here's the key part for CRE — settling a parlay requires cross-contract orchestration. The CRE workflow reads parlay state from ParlayEngine, then cross-reads each leg's outcome from the PredictionMarket contract. It verifies that all disputes are resolved, and writes a settlement report back to ParlayEngine. Contract A reads, Contract B writes — fully autonomous, zero human intervention. This is one of the most sophisticated uses of CRE in this hackathon.」

---

## 9. SETTLEMENT VERIFICATION (4:05 – 4:20)

[Navigate to Verification page]

「And for full transparency — the Verification page. Price markets show CoinGecko, CryptoCompare, and CRE settlement results side by side, with source divergence percentages. Event markets show the AI verdict and confidence score. Any user can independently verify that every settlement was fair and accurate.」

---

## 10. WORLD ID + CODE (4:20 – 4:50)

[Navigate to Create page, point to World ID button]

「One more thing — market creation supports World ID integration. That's zero-knowledge proof of unique humanness. Sybil resistance without sacrificing privacy.」

[Quick cut to: Solidity contract code in editor]

「Under the hood — two Solidity contracts: PredictionMarket and ParlayEngine.」

[Quick cut to: _processReport function]

「The processReport function routes CRE reports by a prefix byte. 0x00 creates markets, 0x01 settles them, 0x02 resolves disputes, 0x03 settles parlays. One function, four actions.」

[Quick cut to: terminal showing test results]

「84 Foundry tests. All passing.」

---

## 11. CLOSE (4:50 – 5:05)

[Screen: Markets page with all 8 markets visible]

「OracleSettler. Trustless prediction markets with four resolution paths: dual-source price consensus, AI event judgment, dispute arbitration, and cross-contract parlay settlement.」

[Pause half a second]

「16 CRE capabilities. 5 trigger types. 84 tests. 8 live markets. Zero backend servers.」

[Pause half a second]

「No Express. No PostgreSQL. No cron jobs. The entire backend is a CRE workflow running on Chainlink's decentralized oracle network.」

[Pause]

「Try it live at oracle-settler.vercel.app. Code is on GitHub. Thanks for watching.」

[Screen: GitHub URL + Vercel URL + logo fade out]

---

## Recording Checklist

- **Resolution**: 1920×1080, dark theme, browser zoom 100%
- **Browser**: Chrome, disable cache via DevTools (Network → Disable cache)
- **Wallet**: MetaMask on Sepolia with test ETH
- **Pre-check**: Verify Gemini API key works (test AI Creation + AI Advisor before recording)
- **Pacing**: Settlement Replay and Dispute animations are ~1200ms/step — let them breathe, narrate alongside
- **Recording tool**: QuickTime / Loom / OBS
- **Audio**: Clear voiceover, quiet room. Optional subtle lo-fi for intro/outro only
- **Upload**: YouTube (unlisted) → paste link in hackathon submission + README
- **Target length**: ~5 minutes

### The 6 moments judges will remember
1. "bitcoin 150k by end of year" → AI auto-fills the form (0:50)
2. Settlement Replay step-by-step animation (1:15)
3. AI Advisor edge detection: "mispricing detected" (2:25)
4. Dispute simulation with anti-spam stake (3:00)
5. Parlay cross-contract orchestration (3:35)
6. "Zero backend servers" closing punch (4:50)

---

## Fallback Plan

If Sepolia RPC is down during recording:
- Frontend has mock data fallback — shows cached market data with amber banner
- Settlement Explorer and Dispute Simulator are client-side animations — they work without RPC
- Pre-record a backup clip of the full flow working, just in case

---

## Likely Q&A (Prepare for live judging)

**Q: "Can someone front-run settlement by reading the CRE report before it's on-chain?"**

「No. CRE reports are signed by multi-node consensus via KeystoneForwarder. The processReport function verifies the CRE signature — only the registered forwarder address can submit reports. An attacker can see the pending transaction, but they can't forge a settlement. And predictions are locked before settlement starts, so knowing the outcome early doesn't help.」

**Q: "Why two price sources instead of Chainlink Data Feeds?"**

「Two reasons. First, CRE is designed for custom workflows — we wanted to demonstrate Confidential HTTP fetching from real-world APIs, which is a differentiated CRE capability that Data Feeds don't showcase. Second, dual-source consensus with a 2 percent divergence check is more robust for arbitrary assets. We support any CoinGecko-listed asset, not just assets that have Chainlink feeds.」

**Q: "What if PredictionMarket state changes between the cross-contract reads in parlay settlement?"**

「CRE execution is atomic within a single invocation — all contract reads happen in the same block context. And ParlayEngine's settleParlay function does an on-chain re-check: it verifies that all leg markets are actually settled before accepting the CRE report. Even if CRE somehow got stale data, the contract-level guard catches it.」
