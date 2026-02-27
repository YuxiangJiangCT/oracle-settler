# OracleSettler Demo Video Script (~4.5 min)

## INTRO (0:00 - 0:30)

**Screen**: Landing page with logo

**Script**:
> "OracleSettler is a trustless prediction market platform that settles automatically using real price data and AI — all orchestrated by Chainlink CRE."
>
> "The problem: existing prediction markets rely on manual resolution — slow, biased, and centralized. And once settled, there's no recourse if the outcome is wrong."
>
> "OracleSettler fixes this with dual-source price consensus, AI-powered event resolution, and a dispute arbitration protocol — all executed through CRE workflows."

---

## ARCHITECTURE (0:30 - 1:15)

**Screen**: Navigate to About page

**Script**:
> "Let's look at the architecture. We use 12 CRE capabilities across 4 trigger types."
>
> *(Scroll through capabilities grid)*
>
> "Four triggers: HTTP for market creation, two Log Triggers — one for settlement, one for disputes — and Cron for automatic 6-hour sweeps."
>
> "The settlement flow: CRE reads market data from chain. For price markets, it fetches from CoinGecko AND CoinCap via Confidential HTTP and cross-validates — if they diverge more than 2%, we reject for safety."
>
> "For event markets — like 'Will GPT-5 launch?' — CRE routes to Gemini AI with Google Search instead of price feeds."
>
> "For clear price outcomes — more than 5% from target — we settle instantly at 100% confidence. For borderline cases, Gemini AI analyzes and provides a confidence score."
>
> *(Scroll to flow diagram)*
>
> "After settlement, there's a 1-hour dispute window. If challenged, CRE re-verifies with stricter thresholds. Everything goes through CRE consensus. No single party can manipulate the result."

---

## LIVE DEMO — Part 1: Price Market Settlement (1:15 - 2:00)

### Show Settled Market (1:15 - 1:45)

**Screen**: Markets page → Click on settled BTC market (#0)

**Script**:
> "Here's a live BTC market that's been settled by CRE. The outcome and confidence are determined entirely by on-chain data and dual-source price verification."
>
> *(Scroll to Settlement Explorer)*
>
> "The Settlement Explorer shows exactly how CRE processed this — step by step. You can see the dual price sources, the threshold check, and the final consensus report. Full transparency."

### Place Prediction & Request Settlement (1:45 - 2:00)

**Screen**: Click into ETH market (#1) → Predict → Request Settlement

**Script**:
> "I'll bet NO on ETH exceeding $5,000, then request settlement. This emits a SettlementRequested event that CRE's Log Trigger picks up automatically."
>
> *(Click button, show tx)*

---

## LIVE DEMO — Part 2: Event Market (2:00 - 2:30)

**Screen**: Navigate to GPT-5 event market (#2)

**Script**:
> "Now here's what makes OracleSettler unique — event markets. This one asks 'Will GPT-5 be released before July 2026?' There's no price feed for this."
>
> *(Point to "Event Market" badge)*
>
> "CRE detects this is a non-price market and routes to a completely different path — Gemini AI with Google Search. The AI researches the question, analyzes current information, and provides a YES/NO verdict with a confidence score."
>
> "Same trustless settlement, but for any verifiable question — not just price targets."

---

## LIVE DEMO — Part 3: Dispute Arbitration (2:30 - 3:15)

**Screen**: Navigate to a recently settled market showing "Dispute Window" tag

**Script**:
> "After settlement, there's a 1-hour dispute window. See the countdown timer in the Dispute Panel."
>
> *(Show DisputePanel with countdown)*
>
> "If you believe the outcome is wrong, you can file a dispute with a 0.001 ETH stake."
>
> *(Click "File Dispute" button, confirm tx)*
>
> "This emits a DisputeFiled event. CRE's second Log Trigger picks it up and re-runs the entire verification — but in strict mode. The confidence threshold is 70% — higher than initial settlement."
>
> "If CRE confirms the original outcome, the stake is forfeited. If overturned, the stake is returned and the outcome flips. This is all trustless — no human arbitrator needed."
>
> *(Show resolved dispute status)*

---

## CODE WALKTHROUGH (3:15 - 4:15)

### Smart Contract (3:15 - 3:35)

**Screen**: Show PredictionMarket.sol in editor

**Script**:
> "The contract is 468 lines of Solidity with IR optimizer. The key function is `_processReport` — it routes CRE reports based on a prefix byte."
>
> *(Highlight `_processReport` routing)*
>
> "No prefix creates a market, `0x01` settles one, and `0x02` resolves a dispute. Three report types, one unified entry point."

### CRE Workflow (3:35 - 3:55)

**Screen**: Show main.ts → disputeCallback.ts

**Script**:
> "The CRE workflow has 4 handlers. Here's the dispute callback — it re-runs verification in strict mode. If the new confidence is below 70%, the original outcome stands. This prevents frivolous disputes from overturning legitimate settlements."

### Tests (3:55 - 4:15)

**Screen**: Terminal running `forge test --summary`

**Script**:
> "62 Foundry tests across 2 suites — 47 unit tests covering every function including 8 dispute scenarios, plus 15 end-to-end demo tests that run complete market lifecycles."
>
> *(Show test output: 62 passed, 0 failed)*
>
> "Price markets, event markets, disputes confirmed, disputes overturned, timing edge cases, fuzz testing — all covered."

---

## CLOSE (4:15 - 4:30)

**Screen**: Back to Markets page showing all 3 market types

**Script**:
> "OracleSettler — trustless prediction markets with three resolution paths: dual-source price consensus, AI event judgment, and dispute arbitration. All orchestrated by Chainlink CRE with 12 capabilities across 4 triggers."
>
> "Check out the code on GitHub. Thanks for watching."

**Screen**: GitHub URL + logo fade

---

## Recording Tips

- Use 1920x1080, dark theme
- Chrome DevTools → disable cache for fresh loads
- Pre-create markets so the demo page isn't empty (3 markets already seeded on V5 contract)
- Have MetaMask on Sepolia with some test ETH ready
- Record in one take per section, edit together
- Add subtle background music (royalty-free lo-fi)
- Three-part demo progression: Price Settlement → Event AI → Dispute Arbitration
- Total target: ~4.5 minutes (judges prefer concise but comprehensive)
