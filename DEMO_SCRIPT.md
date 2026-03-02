# OracleSettler Demo Video Script (~4.5 min)

## HOOK (0:00 - 0:25)

**Screen**: Markets page with StatsBar visible (8 markets, volume, settled count)

**Script**:
> "Polymarket does $500 million in daily volume — but every single market is settled by a handful of people behind closed doors. If they get it wrong, you have zero recourse."
>
> "OracleSettler fixes this. Fully autonomous settlement using Chainlink CRE — dual-source price verification, AI judgment for borderline cases, and a dispute protocol that can overturn wrong outcomes. No humans in the loop."

---

## PLATFORM OVERVIEW (0:25 - 0:55)

**Screen**: Scroll through Markets page showing 8 markets + StatsBar

**Script**:
> "We have 8 live markets on Sepolia — 6 price markets covering BTC, ETH, SOL, DOGE, LINK, and AVAX, plus 2 event markets: GPT-5 release and Apple Vision Pro sales."
>
> *(Point to StatsBar)*
>
> "The stats bar shows real on-chain data — total markets, active, settled, and trading volume. Everything reads directly from the contract."
>
> *(Click into About page, quickly show CRE capabilities grid)*
>
> "Under the hood: 12 CRE capabilities across 4 trigger types. HTTP, Log, Cron, and a second Log Trigger just for disputes."

---

## LIVE DEMO — Part 1: Price Market Settlement (0:55 - 1:45)

### Show Settled Market (0:55 - 1:20)

**Screen**: Click on a settled BTC market

**Script**:
> "This BTC market has been settled by CRE. Let me show you exactly how."
>
> *(Click "Replay Settlement" — watch 7-step animation)*
>
> "Step by step: CRE reads the market from chain, fetches prices from CoinGecko AND CoinCap, cross-validates them — if they diverge more than 2%, it rejects for safety. Then it checks if the price is more than 5% from the target — if yes, instant settlement at 100% confidence. If it's borderline, Gemini AI analyzes and scores confidence."
>
> *(Point to Settlement Explorer summary)*
>
> "Full transparency. You can see the outcome, confidence score, settled price, settlement method, and which data sources were used. No black box."

### Place Prediction (1:20 - 1:45)

**Screen**: Click into an active market (e.g., LINK or SOL) → Place prediction

**Script**:
> "Let me place a prediction on this active market. I'll bet YES with 0.01 ETH."
>
> *(Click YES, enter amount, submit tx)*
>
> "Done. The odds bar updates in real-time based on the parimutuel pool. When this market is ready, anyone can request settlement — or CRE's cron trigger auto-settles every 6 hours."

---

## LIVE DEMO — Part 2: Event Markets + AI (1:45 - 2:15)

**Screen**: Navigate to GPT-5 event market

**Script**:
> "Here's what sets OracleSettler apart — event markets. 'Will GPT-5 be released before July 2026?' There's no price feed for this."
>
> *(Point to "Event Market" badge)*
>
> "CRE detects this is a non-price market and routes to a completely different path — Gemini AI with Google Search grounding. The AI researches current news, analyzes the evidence, and returns a YES or NO verdict with a confidence score."
>
> "Same trustless settlement pipeline, but for any verifiable real-world question — not just crypto prices."

---

## LIVE DEMO — Part 3: Dispute Arbitration (2:15 - 3:00)

**Screen**: Navigate to a settled market showing dispute window

**Script**:
> "After settlement, there's a 1-hour dispute window. See the countdown timer."
>
> *(Point to DisputePanel with countdown)*
>
> "If you believe the outcome is wrong, you stake 0.001 ETH to file a dispute. This triggers CRE's second Log Trigger — it re-runs the entire verification in strict mode, with a higher 70% confidence threshold."
>
> *(Click "Simulate Dispute" to show the 4-step flow)*
>
> "Watch: dispute filed, CRE strict re-verification, AI re-analysis, then resolution. If CRE confirms the original outcome, the stake is forfeited — that's anti-spam. If overturned, the stake is returned and the outcome flips."
>
> "This is fully trustless. No human arbitrator, no DAO vote, no waiting weeks. CRE handles it in minutes."

---

## CROSS-PLATFORM VERIFICATION (3:00 - 3:15)

**Screen**: Navigate to Compare page

**Script**:
> "The Compare page lets you verify CRE's settlement against live market data. CoinGecko price, CoinCap price, CRE's settled price — all side by side with source divergence percentage."
>
> "This is radical transparency. Any user can independently verify that the settlement was fair."

---

## WORLD ID + CODE (3:15 - 3:50)

### World ID (3:15 - 3:30)

**Screen**: Navigate to Create page, show World ID button

**Script**:
> "Market creation supports World ID verification — zero-knowledge proof that you're a unique human. This prevents sybil attacks on market creation without sacrificing privacy."

### Quick Code Flash (3:30 - 3:50)

**Screen**: Show contract + workflow in editor (quick cuts)

**Script**:
> "468-line Solidity contract with IR optimizer. The key is `_processReport` — it routes CRE reports by prefix byte. `0x00` creates markets, `0x01` settles, `0x02` resolves disputes."
>
> *(Quick flash of terminal)*
>
> "62 Foundry tests — 47 unit tests covering every function, plus 15 end-to-end demo tests. Fuzz testing on payout calculations. All passing."

---

## CLOSE (3:50 - 4:15)

**Screen**: Back to Markets page with all 8 markets visible

**Script**:
> "OracleSettler — trustless prediction markets with three resolution paths: dual-source price consensus, AI event judgment, and dispute arbitration."
>
> "12 CRE capabilities. 4 trigger types. 62 tests. 8 live markets. Zero backend servers."
>
> "The entire backend is a CRE workflow. No Express, no PostgreSQL, no cron jobs. Just Chainlink."
>
> "Check out the code on GitHub and try it live at oracle-settler.vercel.app. Thanks for watching."

**Screen**: GitHub URL + Vercel URL + logo fade

---

## Recording Tips

- **Resolution**: 1920x1080, dark theme (already set)
- **Browser**: Chrome, disable cache via DevTools for fresh loads
- **Wallet**: MetaMask on Sepolia with test ETH ready
- **Markets**: 8 markets already seeded on V5 contract (`0x51CC15B53d776b2B7a76Fa30425e8f9aD2aec1a5`)
  - 6 price markets (BTC, ETH, SOL, DOGE, LINK, AVAX)
  - 2 event markets (GPT-5, Apple Vision Pro)
  - Mix of active + settled states
- **Pacing**: Pause 1-2 seconds on each Settlement Explorer step (interval is 1200ms)
- **Recording tool**: QuickTime / Loom / OBS
- **Audio**: Clear voiceover, no background music during demo sections
- **Upload**: YouTube unlisted → add link to README + hackathon submission
- **Target**: ~4.5 minutes (concise but comprehensive — judges see hundreds of videos)
- **Key moments to emphasize**:
  1. Settlement Explorer 7-step replay (the "wow" moment)
  2. Event market AI path (differentiation)
  3. Dispute simulation (unique feature)
  4. "62 tests, zero backend" (closing punch)
