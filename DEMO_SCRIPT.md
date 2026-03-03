# OracleSettler Demo Video Script — FINAL (~4.5 min)

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
> "12 CRE capabilities, 4 trigger types."

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
> "CRE reads the market... fetches BTC price from CoinGecko AND CoinCap... cross-validates — divergence under 2%, sources agree... price is 2.7% below target, within 5% threshold, so Gemini AI is consulted..."
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

## CROSS-PLATFORM VERIFICATION (3:00 - 3:15)

**Screen**: Navigate to Compare page

**Script**:
> "The Compare page — CoinGecko price, CoinCap price, CRE's settled price, all side by side with source divergence. Any user can independently verify that the settlement was fair."

---

## WORLD ID + CODE (3:15 - 3:45)

### World ID (3:15 - 3:25)

**Screen**: Create page, show World ID button

**Script**:
> "Market creation supports World ID — zero-knowledge proof of unique humanness. Sybil resistance without sacrificing privacy."

### Quick Code Flash (3:25 - 3:45)

**Screen**: Quick cuts — contract + workflow + terminal

**Script**:
> "468-line Solidity contract. `_processReport` routes CRE reports by prefix byte — `0x00` creates, `0x01` settles, `0x02` resolves disputes. 62 Foundry tests, all passing."

---

## CLOSE (3:45 - 4:10)

**Screen**: Markets page with all 8 markets visible

**Script**:
> "OracleSettler — trustless prediction markets with three resolution paths: dual-source price consensus, AI event judgment, and dispute arbitration."
>
> "12 CRE capabilities. 4 triggers. 62 tests. 8 live markets. Zero backend servers."
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
- **Target**: ~4-4.5 minutes
- **The 4 moments judges will remember**:
  1. "will dogecoin hit a dollar" → AI auto-fills (0:50)
  2. Settlement Replay animation (1:15)
  3. Dispute simulation (2:25)
  4. "Zero backend" closing punch (3:45)
