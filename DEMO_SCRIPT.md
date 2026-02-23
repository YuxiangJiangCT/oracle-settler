# OracleSettler Demo Video Script (~3.5 min)

## INTRO (0:00 - 0:30)

**Screen**: Landing page with logo

**Script**:
> "OracleSettler is a trustless prediction market platform that settles automatically using real price data and AI — all orchestrated by Chainlink CRE."
>
> "The problem: existing prediction markets rely on manual resolution — slow, biased, and centralized. OracleSettler fixes this with dual-source price consensus and AI-powered judgment, executed entirely through CRE workflows."

---

## ARCHITECTURE (0:30 - 1:15)

**Screen**: Navigate to About page

**Script**:
> "Let's look at the architecture. We use 10 CRE capabilities across 3 trigger types."
>
> *(Scroll through capabilities grid)*
>
> "Three triggers: HTTP for market creation, Log for on-demand settlement when users request it, and Cron for automatic 6-hour sweeps."
>
> "The settlement flow: CRE reads market data from chain, fetches prices from CoinGecko AND CoinCap via Confidential HTTP, cross-validates them — if they diverge more than 2%, we reject for safety."
>
> "For clear outcomes — more than 5% from target — we settle instantly at 100% confidence. For borderline cases, Gemini AI analyzes the data and provides a confidence score."
>
> *(Scroll to 6-step flow)*
>
> "Everything goes through CRE consensus before writing back on-chain. No single party can manipulate the result."

---

## LIVE DEMO (1:15 - 2:45)

### Show Settled Market (1:15 - 1:45)

**Screen**: Markets page → Click on a settled market (e.g., BTC #0)

**Script**:
> "Here's a live market that's already been settled. BTC was above $50,000 at the target — outcome YES, 100% confidence."
>
> *(Scroll to Settlement Explorer)*
>
> "The Settlement Explorer shows exactly how CRE processed this — step by step. You can see the dual price sources, the threshold check, and the final consensus report. Full transparency."

### Create New Market (1:45 - 2:15)

**Screen**: Navigate to Create page

**Script**:
> "Let's create a new market. I'll use the ETH preset — 'Will Ethereum exceed $5,000?'"
>
> *(Click preset, submit)*
>
> "Transaction sent to Sepolia... confirmed. The market is now live on-chain."

### Place Prediction (2:15 - 2:30)

**Screen**: Click into the new market

**Script**:
> "Now I'll place a prediction — I'll bet NO with 0.01 ETH."
>
> *(Click NO, enter amount, submit)*
>
> "Prediction confirmed. The odds bar updates in real-time."

### Request Settlement (2:30 - 2:45)

**Screen**: Click "Request CRE Settlement"

**Script**:
> "And here's the key part — requesting settlement. This emits a SettlementRequested event on-chain, which the CRE Log Trigger picks up automatically."
>
> *(Click button, show tx)*
>
> "CRE will now fetch real prices, validate them, determine the outcome, and settle the market — all without any manual intervention."

---

## CODE WALKTHROUGH (2:45 - 3:30)

### Smart Contract (2:45 - 3:00)

**Screen**: Show PredictionMarket.sol in editor

**Script**:
> "The contract is 240 lines of clean Solidity. Market creation, predictions, CRE-based settlement, and proportional payouts."
>
> *(Highlight `_processReport` routing)*
>
> "The key is `_processReport` — it routes CRE reports based on a prefix byte. No prefix creates a market, 0x01 prefix settles one."

### Settlement Logic (3:00 - 3:15)

**Screen**: Show settlementLogic.ts

**Script**:
> "The CRE workflow code handles dual-source consensus. We fetch from CoinGecko and CoinCap, check for divergence, apply the threshold logic, and optionally call Gemini AI for borderline cases."

### Tests (3:15 - 3:30)

**Screen**: Terminal running `forge test -vvv`

**Script**:
> "22 Foundry tests cover every public function — creation, predictions, settlement via CRE, claims with proportional payouts, and all error cases. 100% passing."
>
> *(Show test output scrolling)*

---

## CLOSE (3:30 - 3:45)

**Screen**: Back to Markets page

**Script**:
> "OracleSettler — trustless prediction markets, powered by dual-source price consensus and AI, orchestrated entirely by Chainlink CRE."
>
> "Check out the code on GitHub. Thanks for watching."

**Screen**: GitHub URL + logo fade

---

## Recording Tips

- Use 1920x1080, dark theme
- Chrome DevTools → disable cache for fresh loads
- Pre-create markets so the demo page isn't empty
- Have MetaMask on Sepolia with some test ETH ready
- Record in one take per section, edit together
- Add subtle background music (royalty-free lo-fi)
