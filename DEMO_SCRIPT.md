# OracleSettler — Demo Script (~3:50)

> `「引号」` = 你直接读的台词。`[方括号]` = 屏幕操作。

---

## 1. HOOK (0:00 – 0:15)

[Screen: Markets 页，8 个市场卡片 + StatsBar 可见]

「Polymarket does 500 million in daily volume — but every market is settled by a handful of people behind closed doors. OracleSettler fixes this. Fully autonomous settlement, powered by Chainlink CRE. No humans in the loop.」

---

## 2. OVERVIEW (0:15 – 0:30)

[缓慢滚动 Markets 页，展示所有市场卡片 + 顶部 StatsBar]

「8 live markets on Sepolia — 6 price markets and 2 event markets. The stats bar pulls real on-chain data. Settlement is permissionless — anyone can trigger it, but only CRE determines the outcome. The caller cannot influence the result.」

---

## 3. AI CREATE + WORLD ID (0:30 – 0:55)

[点击 Create 页]

「Creating a market is effortless. Just type a question.」

[在 AI 输入框输入 "bitcoin 150k by end of year"，等 Gemini 解析，表单自动填充]

「Gemini AI parses the input — identifies the asset, extracts the price target, generates a clean prediction question. All fields fill automatically. One sentence in, one click to deploy on-chain.」

[指向 World ID 按钮]

「Market creation also supports World ID — zero-knowledge proof of unique humanness. Sybil resistance without sacrificing privacy.」

---

## 4. SETTLE PREVIEW + AI ADVISOR (0:55 – 1:20)

[点击 Markets 回到列表 → 点击 #3 SOL → 滚到 Settle Preview 面板]

「Before settlement happens, users can preview the outcome in real time. Settle Preview fetches live prices from CoinGecko and CryptoCompare, runs the same dual-source consensus check that CRE uses, and shows the predicted outcome right now.」

[指向实时价格和预测结果]

「Both sources agree, divergence under 2 percent.」

[滚到 AI Advisor → 点击 "Ask AI Advisor"，等结果出现]

「The AI Advisor takes it further — Gemini compares market odds with its own probability estimate and calculates the edge. Here, the market says 60 percent YES, AI estimates 85 — that's a 25 percent edge. Mispricing detected. The advisor recommends: BET YES. AI working proactively for traders, not just at settlement.」

---

## 5. SETTLEMENT REPLAY (1:20 – 1:55)

[点击 Back → 回到 Markets → 点击 #0 BTC (Settled) → 滚到 Settlement Explorer]

「This BTC market has been settled. Let me replay exactly how CRE resolved it.」

[点击 "▶ Replay Settlement"，让动画播放]

「CRE reads the market from the smart contract... fetches BTC price from CoinGecko and CryptoCompare — dual-source consensus. Cross-validates — divergence under 2 percent, sources agree. Price is 2.7 percent below target, within the borderline threshold, so Gemini AI makes the final call.」

[动画显示 verdict]

「NO, 75 percent confidence. Consensus signed by multiple CRE nodes. Written to chain. Every decision visible and auditable.」

---

## 6. DISPUTE (1:55 – 2:25)

[留在 #0 BTC 详情页 → 滚到 Dispute 面板]

「After settlement, there's a 1-hour dispute window. Let me simulate a challenge.」

[点击 "⚡ Simulate Dispute"，让动画播放]

「Dispute filed with 0.001 ETH stake. CRE re-verifies in strict mode — re-fetches both sources, re-runs consensus, and this time the AI threshold is raised to 70 percent. A higher bar.」

[等结果出现]

「Original settlement confirmed. Stake forfeited — anti-spam. If the re-check had found a different result, the outcome would flip and the stake is refunded. No human arbitrator. No DAO vote. Fully trustless.」

---

## 7. EVENT MARKET (2:25 – 2:45)

[点击 Back → 回到 Markets → 点击 #6 Apple Vision Pro]

「Now the second resolution path. This is an event market — no price feed. CRE detects the target price is zero and routes to a different pipeline: Gemini AI with Google Search grounding. The AI researches real-world evidence and returns YES or NO with a confidence score.」

「Two paths, same trustless pipeline. Price markets use dual-source consensus. Event markets use AI plus Google Search. Automatically routed by market type.」

---

## 8. PARLAYS (2:45 – 3:15)

[点击 Parlays tab]

「The most advanced CRE feature — parlays. Combine 2 to 5 predictions into a single combo bet with multiplied odds.」

[在 Parlay Builder 选择 BTC YES, ETH NO, SOL YES]

「Three markets, three directions. The combined multiplier updates in real time.」

[指向 My Parlays 中的已结算 parlay]

「Here's what makes this a CRE showcase — settling a parlay requires cross-contract orchestration. CRE reads parlay state from ParlayEngine, cross-reads each leg's outcome from PredictionMarket, verifies all disputes are resolved, and writes the settlement report. Contract A reads, Contract B writes. Fully autonomous.」

---

## 9. CODE + CLOSE (3:15 – 3:50)

[快切到编辑器：Solidity 合约代码]

「Two Solidity contracts — PredictionMarket and ParlayEngine. The processReport function routes CRE reports by prefix byte: 0x00 creates, 0x01 settles, 0x02 resolves disputes, 0x03 settles parlays.」

[快切到终端：测试结果]

「84 Foundry tests. All passing.」

[切回 Markets 页，所有 8 个市场可见]

「OracleSettler — 16 CRE capabilities, 5 trigger types, 84 tests, 8 live markets. Zero backend servers. No Express. No PostgreSQL. No cron jobs. The entire backend is a CRE workflow on Chainlink's decentralized oracle network.」

「Try it at oracle-settler.vercel.app. Code on GitHub. Thanks for watching.」

[GitHub URL + Vercel URL + logo fade]

---

## Recording Checklist

- **Resolution**: 1920×1080, dark theme, browser zoom 100%
- **Browser**: Chrome, DevTools → Network → Disable cache
- **Wallet**: MetaMask on Sepolia with test ETH
- **Pre-check**: Test AI Creation + AI Advisor before recording (verify Gemini key)
- **Pacing**: Replay/Dispute animations ~1200ms/step — let them play, narrate alongside
- **Tool**: QuickTime / Loom / OBS
- **Audio**: Clear voiceover, quiet room
- **Upload**: YouTube (unlisted) → hackathon submission + README
- **Target**: under 4 minutes

### 5 moments judges will remember
1. "bitcoin 150k" → AI auto-fills (0:30)
2. AI Advisor: "mispricing detected, +25% edge" (0:55)
3. Settlement Replay step-by-step (1:20)
4. Dispute: "stake forfeited, no human arbitrator" (1:55)
5. "Zero backend servers" closing punch (3:15)

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
