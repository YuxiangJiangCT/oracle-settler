# OracleSettler — Demo Script (~3:05 narration, ~4:00–4:30 with operations)

> `「引号」` = 逐字朗读台词。`[方括号]` = 屏幕操作。
>
> **关键原则**：所有 API 等待（Gemini 解析、AI Advisor）**提前预加载好**，录制时展示结果，不现场等。Parlay **提前创建好**，只展示已有的。

---

## 1. HOOK + OVERVIEW (0:00 – 0:20)

[Screen: Markets 页，8 个市场卡片 + StatsBar 可见，缓慢向下滚动]

「Polymarket does 500 million in daily volume — but every market is settled by a handful of people behind closed doors. OracleSettler fixes this. 8 live markets on Sepolia, fully autonomous settlement powered by Chainlink CRE. No humans in the loop.」

---

## 2. AI CREATE + WORLD ID (0:20 – 0:40)

[点击 Create 页 — 表单已经预填好（提前输入过 "bitcoin 150k by end of year"，Gemini 已解析完成）]

「Creating a market — just type a natural language question. Gemini AI parses it, identifies the asset, extracts the price target, auto-fills every field. One sentence in, one click to deploy on-chain.」

[指向 World ID 按钮]

「Market creation also supports World ID — zero-knowledge proof of humanness. Sybil resistance without sacrificing privacy.」

---

## 3. SETTLE PREVIEW + AI ADVISOR (0:40 – 1:10)

[点击 Markets → 点击 #3 SOL → 滚到 Settle Preview（已可见）]

「Before settlement, users preview the outcome in real time. Settle Preview fetches prices from CoinGecko and CryptoCompare — the same dual-source consensus CRE uses. Both sources agree, divergence under 2 percent.」

[滚到 AI Advisor — 结果已预加载好，直接可见]

「The AI Advisor goes further — Gemini compares market odds with its own estimate. Market says 60 percent YES, AI says 85 — a 25 percent edge. Mispricing detected. The advisor says: BET YES.」

---

## 4. SETTLEMENT REPLAY (1:10 – 1:45)

[点击 Back → 点击 #0 BTC (Settled) → 滚到 Settlement Explorer]

「This BTC market has been settled. Let me replay how CRE resolved it.」

[点击 "▶ Replay Settlement"，动画播放，边播边讲]

「CRE reads the market on-chain... fetches BTC price from two sources — dual-source consensus. Cross-validates, divergence under 2 percent. Price is below target but within the borderline threshold, so Gemini AI makes the final call. NO, 75 percent confidence. Signed by CRE nodes, written to chain.」

---

## 5. DISPUTE (1:45 – 2:10)

[留在 #0 BTC 详情页 → 滚到 Dispute 面板]

「After settlement, there's a 1-hour dispute window.」

[点击 "⚡ Simulate Dispute"，动画播放]

「Dispute filed with 0.001 ETH stake. CRE re-verifies in strict mode — re-fetches both sources, AI threshold raised to 70 percent. Original settlement confirmed. Stake forfeited — anti-spam. No human arbitrator. Fully trustless.」

---

## 6. EVENT MARKET (2:10 – 2:20)

[点击 Back → 点击 #6 Apple Vision Pro]

「Second resolution path — event markets. No price feed. CRE routes to Gemini AI with Google Search grounding. Same trustless pipeline, automatically selected by market type.」

---

## 7. PARLAYS (2:20 – 2:45)

[点击 Parlays tab → 展示已创建好的 parlay]

「Parlays — combine up to 5 predictions into a single combo bet with multiplied odds.」

[指向 My Parlays 中的 parlay 详情]

「This is the CRE showcase — settling a parlay requires cross-contract orchestration. CRE reads parlay state from ParlayEngine, cross-reads each leg from PredictionMarket, verifies disputes resolved, writes the report. Contract A reads, Contract B writes. Fully autonomous.」

---

## 8. CODE + CLOSE (2:45 – 3:05)

[快切编辑器：PredictionMarket.sol `_processReport` 函数]

「Two Solidity contracts. One function — processReport — routes all CRE reports by a prefix byte. Create, settle, dispute, parlay. Same entry point.」

[快切终端：84 tests passing]

「84 Foundry tests. All green.」

[切回 Markets 页]

「OracleSettler — 16 CRE capabilities, 5 trigger types, 8 live markets. Zero backend servers. The entire backend is a CRE workflow on Chainlink's decentralized oracle network. Try it at oracle-settler.vercel.app. Thanks for watching.」

[GitHub URL + Vercel URL + logo fade]

---

## Pre-Recording Setup

### 必须提前准备好的状态：
1. **Create 页**：提前输入 "bitcoin 150k by end of year"，让 Gemini 解析完，表单已填好（不要提交）
2. **AI Advisor**：提前在 #3 SOL 详情页点过 "Ask AI Advisor"，结果已缓存显示
3. **Parlay**：提前在 Parlays 页创建好一个 3-leg parlay（如 SOL YES + DOGE NO + LINK YES）
4. **编辑器**：VS Code 打开 PredictionMarket.sol，光标在 `_processReport` 函数
5. **终端**：提前跑好 `forge test --summary`，结果留在屏幕上

### Recording Checklist
- **Resolution**: 1920×1080, dark theme, browser zoom 100%
- **Browser**: Chrome, DevTools → Network → Disable cache
- **Wallet**: MetaMask on Sepolia with test ETH
- **Pacing**: Replay/Dispute animations ~1200ms/step — let them play, narrate alongside
- **Tool**: QuickTime / Loom / OBS
- **Audio**: Clear voiceover, quiet room
- **Upload**: YouTube (unlisted) → hackathon submission + README
- **Target**: under 5 minutes (narration ~3:05)

### 5 moments judges will remember
1. "One sentence in, one click to deploy" — AI auto-fills (0:20)
2. "25 percent edge, mispricing detected" — AI Advisor (0:40)
3. Settlement Replay step-by-step animation (1:10)
4. "Stake forfeited, no human arbitrator" — Dispute (1:45)
5. "Zero backend servers" — closing punch (2:45)

---

## Fallback Plan

If Sepolia RPC is down:
- Settlement Explorer and Dispute Simulator are client-side animations — work without RPC
- Pre-record a backup clip of the live flow

---

## Q&A (for live judging)

**Q: "Can someone front-run settlement?"**

「No. CRE reports are signed by multi-node consensus via KeystoneForwarder. Only the registered forwarder can submit reports. Predictions are locked before settlement starts, so knowing the outcome early doesn't help.」

**Q: "Why two price sources instead of Chainlink Data Feeds?"**

「CRE is designed for custom workflows — we wanted to demonstrate Confidential HTTP, which Data Feeds don't showcase. And dual-source consensus with a 2 percent divergence check supports any CoinGecko-listed asset, not just assets with Chainlink feeds.」

**Q: "What about cross-contract read consistency in parlay settlement?"**

「CRE execution is atomic — all contract reads happen in the same block context. Plus ParlayEngine does an on-chain re-check before accepting the report.」
