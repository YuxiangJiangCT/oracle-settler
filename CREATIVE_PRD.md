# OracleSettler — Creative Features PRD

> **PM**: Lux | **Implementer**: AI coding agent
> **Priority**: Feature 1 > Feature 2 > Feature 3
> **Deadline**: Before demo video recording (March 8, 2026 hackathon deadline)

---

## Feature 1: Natural Language Market Creation (NL Create)

### The "Why"
Right now CreateMarket.tsx has manual form fields (question, asset, targetPrice) and some hardcoded presets. This is a **developer experience**, not a user experience. Every other hackathon prediction market project will have the same thing.

We want: user types a plain English question → AI parses it → form auto-fills → one click to create. This turns OracleSettler into "ask anything" — the prediction market equivalent of ChatGPT's text box.

**This is the #1 feature that will make judges remember the project.**

### Spec

**Location**: Modify `prediction-market/frontend/src/CreateMarket.tsx`

**UI Changes**:
1. Add a prominent text input at the TOP of the Create Market section, above the existing presets
2. Style: large input, placeholder text "Ask anything... e.g. 'Will Bitcoin hit $150K by June?'"
3. Add a "✨ AI Parse" button next to it (or trigger on Enter)
4. When AI is processing: show a loading spinner + "AI is analyzing your question..."
5. When AI responds: auto-fill the 3 form fields (question, asset, targetPrice) with a subtle highlight/glow animation to show they were AI-filled
6. User reviews the auto-filled form, then clicks "Create Market" or "Create with World ID" as normal

**AI Integration**:
- Call Gemini API directly from frontend (the API key is already used in the CRE workflow — for the demo, a frontend call is fine. Alternatively, use a free proxy or hardcode a demo key.)
- **Better approach**: Use a lightweight serverless function or just call the Gemini REST API directly from the browser with a restricted key. For a hackathon demo, this is acceptable.
- Prompt to Gemini:

```
You are a prediction market parser. Given a user's natural language question, extract:
1. "question" — a clean YES/NO prediction market question
2. "asset" — the CoinGecko asset ID (e.g., "bitcoin", "ethereum", "solana") or a descriptive slug for event markets (e.g., "gpt5-release")
3. "targetPrice" — USD price target as a number, or 0 for event/non-price markets

Respond with ONLY a JSON object: {"question": "...", "asset": "...", "targetPrice": ...}

Examples:
- "BTC 150K by summer" → {"question": "Will Bitcoin exceed $150,000 by August 2026?", "asset": "bitcoin", "targetPrice": 150000}
- "Will Apple release Vision Pro 2?" → {"question": "Will Apple release Vision Pro 2 in 2026?", "asset": "apple-vision-pro-2", "targetPrice": 0}
- "ETH flippening" → {"question": "Will Ethereum market cap exceed Bitcoin market cap by 2027?", "asset": "ethereum", "targetPrice": 0}
```

**Edge Cases**:
- If Gemini returns invalid JSON → show error "Couldn't parse that. Try being more specific."
- If user types gibberish → Gemini will still return something; let the user review before submitting
- If API fails → fall back to manual entry with a toast "AI unavailable, please fill manually"

**API Key Handling**:
- For hackathon: use an environment variable `VITE_GEMINI_API_KEY` in `.env` (gitignored)
- The key is already available in the project's `.env` as `GEMINI_API_KEY_VAR`
- Create a small helper: `src/aiParser.ts` that wraps the Gemini REST call

**New Files**:
- `src/aiParser.ts` — Gemini API wrapper, exports `parseMarketQuestion(input: string): Promise<{question: string, asset: string, targetPrice: number}>`

**Modified Files**:
- `src/CreateMarket.tsx` — add NL input section above presets, integrate aiParser

**Expected Demo Effect**: 
User types "will doge hit a dollar?" → fields auto-fill with "Will Dogecoin exceed $1.00 by [date]?", asset "dogecoin", target $1.00 → user clicks Create → done. **30 seconds in the demo, instant wow factor.**

---

## Feature 2: Live Settlement Replay Animation

### The "Why"
SettlementExplorer currently shows a static list of 7 steps with checkmarks. It's informative but not memorable. Judges scroll past it. 

A **step-by-step animated replay** makes CRE's value viscerally obvious — you SEE data flowing in, being validated, consensus forming. This is the difference between reading about a process and watching it happen.

### Spec

**Location**: Modify `prediction-market/frontend/src/SettlementExplorer.tsx` + `App.css`

**UI Changes**:
1. Add a "▶ Replay Settlement" button at the top of the explorer section
2. When clicked, ALL steps reset to "pending" state (grey dots, hidden details)
3. Steps animate in one-by-one with a 800ms delay between each:
   - Step dot transitions from grey → spinning/pulsing (active) → green checkmark (complete)
   - Step detail text fades in with a typewriter or slide-up effect
   - For price fetch steps: show the price number "counting up" to the final value (like a slot machine)
   - For the divergence check: show a brief red/green flash (red if divergence was close to threshold, green for clearly safe)
   - For AI analysis: show a brief "thinking" animation (3 dots pulsing) before the verdict appears
   - For CRE consensus: show a "signing" animation (lock icon clicking shut)
4. After all steps complete, the summary panel slides in with a subtle glow
5. Button changes to "↺ Replay" after completion

**Technical Approach**:
- Use React state to track `currentStep` (number) and `isReplaying` (boolean)
- `useEffect` with `setTimeout` chain or `setInterval` to advance steps
- CSS transitions/animations for each state change (pending → active → complete)
- No external animation library needed — pure CSS transitions + React state

**CSS Classes to Add**:
```css
.step-dot.pending { background: var(--text-tertiary); }
.step-dot.active { background: var(--accent-secondary); animation: pulse 0.6s infinite; }
.step-dot.complete { background: var(--color-success); }
.step-detail.hidden { opacity: 0; max-height: 0; }
.step-detail.revealing { animation: slideUp 0.4s ease-out forwards; }
.price-counting { font-variant-numeric: tabular-nums; }

@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 var(--glow-secondary); }
  50% { transform: scale(1.3); box-shadow: 0 0 12px 4px var(--glow-secondary); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Price Counter Animation** (for price fetch step):
- Start from $0, count up to the actual settled price over ~600ms
- Use `requestAnimationFrame` with easing (ease-out)
- Format with `toLocaleString()` so commas appear naturally

**Modified Files**:
- `src/SettlementExplorer.tsx` — add replay state machine, animated step rendering
- `src/App.css` — add animation keyframes and transition classes

**Expected Demo Effect**:
In the video, click "Replay Settlement" on a BTC market → watch CoinGecko price fly in ($97,340), CryptoCompare cross-validate, divergence check flash green, AI thinking dots, consensus lock click, on-chain write confirmed. **Takes 6-8 seconds, extremely visual, judges immediately understand CRE's pipeline.** This is worth 30 seconds of demo time.

---

## Feature 3: Dispute Simulation Mode

### The "Why"
The dispute system is one of the most technically interesting parts of OracleSettler, but in a demo you can't easily show it — you'd need to settle a market, wait for the window, file a dispute, wait for CRE to re-verify, etc. Too slow for a 4-minute video.

A "What-If Simulator" lets the user explore the dispute flow instantly without any on-chain transactions.

### Spec

**Location**: Modify `prediction-market/frontend/src/DisputePanel.tsx` + `App.css`

**UI Changes**:
1. Add a "⚡ Simulate Dispute" button in the DisputePanel for ANY settled market (even if the dispute window is closed)
2. When clicked, open a modal/overlay that shows a simulated dispute flow:

```
┌─────────────────────────────────────────────────┐
│  ⚡ Dispute Simulation — Market #0              │
│                                                   │
│  Current Settlement: NO (75% confidence)          │
│                                                   │
│  ▸ Step 1: Dispute Filed (0.001 ETH stake)    ✓  │
│  ▸ Step 2: CRE Strict Re-verification         ✓  │
│    → CoinGecko: $97,340  |  CryptoCompare: $97,215     │
│    → Strict threshold: 70% confidence             │
│  ▸ Step 3: AI Re-analysis (strict mode)        ✓  │
│    → Gemini verdict: NO (78% confidence)          │
│  ▸ Step 4: Dispute Resolution                  ✓  │
│    → 78% > 70% threshold                         │
│    → Original settlement CONFIRMED                │
│    → Stake FORFEITED                              │
│                                                   │
│  [Close]                                          │
└─────────────────────────────────────────────────┘
```

3. The simulation animates step-by-step (similar to Feature 2's replay, ~500ms per step)
4. For the "resolution" step, show a brief dramatic pause, then reveal the result with color:
   - CONFIRMED → green text, "Stake forfeited"
   - OVERTURNED → red/amber text, "Outcome corrected, stake refunded"
5. The simulated result should be **deterministic based on current data**: if confidence > 70%, show "confirmed"; if ≤ 70%, show "overturned". This matches the actual contract logic.

**Technical Approach**:
- Pure frontend — no API calls or blockchain transactions
- Compute simulated result from existing market data (confidence, settledPrice, targetPrice)
- Use a modal component (can be a simple div overlay, no library needed)
- Step animation: same pattern as Feature 2 (currentStep state + setTimeout)

**Simulation Logic**:
```typescript
// Simulate dispute outcome based on existing data
const simulateDispute = (market: Market) => {
  const confidence = market.confidence / 100;
  const STRICT_THRESHOLD = 70;
  
  // If current confidence > strict threshold → original confirmed
  // If current confidence ≤ strict threshold → would be overturned
  const confirmed = confidence >= STRICT_THRESHOLD;
  
  // For the narrative, slightly adjust the "re-verified" confidence
  // to make it feel like a real re-check (±2% random variance)
  const reVerifiedConfidence = confidence + (Math.random() * 4 - 2);
  
  return {
    confirmed,
    reVerifiedConfidence: Math.min(100, Math.max(0, reVerifiedConfidence)),
    originalOutcome: market.outcome === 0 ? "YES" : "NO",
  };
};
```

**New Files**: None (all in existing DisputePanel.tsx)

**Modified Files**:
- `src/DisputePanel.tsx` — add simulation button, modal, step animation
- `src/App.css` — modal overlay styles, animation classes

**Expected Demo Effect**:
In the video: "Let me show you what happens if someone disputes this settlement" → click Simulate → watch the re-verification flow animate → "The original outcome is confirmed. The disputer's stake would be forfeited." **Shows the entire dispute system in 10 seconds without waiting for any blockchain transactions.**

---

## Implementation Order

1. **NL Market Creation** (~2h) — highest impact, judges remember "that AI-powered create market"
2. **Settlement Replay** (~2h) — second highest, makes CRE visually obvious
3. **Dispute Simulator** (~1h) — fastest to build, great demo polish

## Style Guide

- Match existing glassmorphism aesthetic (see CSS `:root` variables)
- Use `var(--accent-primary)` (#6366f1 indigo) for primary actions
- Use `var(--accent-secondary)` (#06b6d4 cyan) for data/info highlights  
- Use `var(--accent-tertiary)` (#8b5cf6 violet) for AI-related elements
- Font: Inter for body, Syne for display headings
- All animations should be smooth (use `ease-out` or `cubic-bezier`)
- Dark theme only, no light mode
- Responsive: test at 1920x1080 (demo) and 768px (mobile)

## Files Reference

All frontend code is in:
`prediction-market/frontend/src/`

Key files:
- `App.tsx` — main shell, routing, wallet connection
- `App.css` — ALL styles (2079 lines, single CSS file)
- `contract.ts` — ABI, types, contract address
- `CreateMarket.tsx` — market creation form (Feature 1 target)
- `SettlementExplorer.tsx` — settlement visualization (Feature 2 target)
- `DisputePanel.tsx` — dispute UI (Feature 3 target)
- `MarketDetail.tsx` — market detail page (imports Settlement + Dispute)
- `MarketList.tsx` — market grid
- `MarketCard.tsx` — individual market card

## Verification

After each feature, run:
```bash
cd prediction-market/frontend && npx vite build
```
Must build with zero errors. Chunk size warning is acceptable.

Then `git add -A && git commit` with a descriptive message.
