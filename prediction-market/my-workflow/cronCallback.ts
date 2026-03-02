// prediction-market/my-workflow/cronCallback.ts
// Cron Trigger: Periodically checks all markets and auto-settles expired ones.

import {
  cre,
  type Runtime,
  type CronPayload,
  getNetwork,
  bytesToHex,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem";
import {
  type Config,
  GET_NEXT_MARKET_ID_ABI,
  GET_MARKET_ABI,
  type Market,
  settleMarket,
} from "./settlementLogic";
import { createTrendingMarket } from "./trendingMarkets";

// Fallback expiry: 24 hours after creation (used if deadline == 0)
const MARKET_EXPIRY_SECONDS = 24 * 60 * 60;

/**
 * Cron Trigger handler — runs on a schedule (e.g., every 6 hours).
 * Scans all markets and auto-settles any that are:
 * 1. Not yet settled
 * 2. Past their expiry time (createdAt + 24h)
 */
export function onCronTrigger(runtime: Runtime<Config>, _payload: CronPayload): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Cron Trigger - Auto-Settle Expired Markets");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const evmConfig = runtime.config.evms[0];
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: evmConfig.chainSelectorName,
      isTestnet: true,
    });

    if (!network) {
      throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);
    }

    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

    // Step 1: Read total number of markets
    const nextIdCallData = encodeFunctionData({
      abi: GET_NEXT_MARKET_ID_ABI,
      functionName: "getNextMarketId",
    });

    const nextIdResult = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: evmConfig.marketAddress as `0x${string}`,
          data: nextIdCallData,
        })
      })
      .result();

    const totalMarkets = decodeFunctionResult({
      abi: GET_NEXT_MARKET_ID_ABI,
      functionName: "getNextMarketId",
      data: bytesToHex(nextIdResult.data),
    }) as unknown as bigint;

    runtime.log(`[Cron] Total markets: ${totalMarkets}`);

    if (totalMarkets === 0n) {
      runtime.log("[Cron] No markets to check");
      runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return "No markets";
    }

    // Step 2: Check each market
    const currentTime = Math.floor(Date.now() / 1000);
    let settledCount = 0;
    const results: string[] = [];

    for (let i = 0n; i < totalMarkets; i++) {
      // Read market data
      const callData = encodeFunctionData({
        abi: GET_MARKET_ABI,
        functionName: "getMarket",
        args: [i],
      });

      const readResult = evmClient
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: evmConfig.marketAddress as `0x${string}`,
            data: callData,
          })
        })
        .result();

      const market = decodeFunctionResult({
        abi: GET_MARKET_ABI,
        functionName: "getMarket",
        data: bytesToHex(readResult.data),
      }) as unknown as Market;

      // Skip if already settled or doesn't exist
      if (market.settled) {
        runtime.log(`[Cron] Market #${i}: already settled`);
        continue;
      }

      if (market.creator === "0x0000000000000000000000000000000000000000") {
        continue;
      }

      // Check if market has expired (use on-chain deadline, fallback to createdAt + 24h)
      const expiryTime = market.deadline > 0 ? market.deadline : market.createdAt + MARKET_EXPIRY_SECONDS;
      const isExpired = currentTime >= expiryTime;

      if (!isExpired) {
        const remainingHours = ((expiryTime - currentTime) / 3600).toFixed(1);
        runtime.log(`[Cron] Market #${i}: "${market.question}" — ${remainingHours}h remaining`);
        continue;
      }

      // Market is expired and unsettled — auto-settle it
      runtime.log(`[Cron] Market #${i}: EXPIRED — auto-settling...`);

      const txHash = settleMarket(runtime, i);
      if (txHash !== "already settled" && txHash !== "does not exist") {
        settledCount++;
        results.push(`Market #${i}: ${txHash}`);
      }
    }

    runtime.log(`[Cron] Settled ${settledCount} expired market(s)`);

    // ─────────────────────────────────────────────────────────────
    // Phase 2: Auto-create trending markets via Gemini AI
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Cron] Phase 2: Checking for trending market opportunities...");

    // Count active (unsettled) markets
    let activeCount = 0;
    for (let i = 0n; i < totalMarkets; i++) {
      const callData = encodeFunctionData({
        abi: GET_MARKET_ABI,
        functionName: "getMarket",
        args: [i],
      });
      const readResult = evmClient
        .callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: evmConfig.marketAddress as `0x${string}`,
            data: callData,
          })
        })
        .result();
      const m = decodeFunctionResult({
        abi: GET_MARKET_ABI,
        functionName: "getMarket",
        data: bytesToHex(readResult.data),
      }) as unknown as Market;
      if (!m.settled && m.creator !== "0x0000000000000000000000000000000000000000") {
        activeCount++;
      }
    }

    const trendingResult = createTrendingMarket(runtime, activeCount);
    if (trendingResult) {
      results.push(trendingResult);
    }

    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const parts: string[] = [];
    if (settledCount > 0) parts.push(`Settled ${settledCount} markets`);
    if (trendingResult) parts.push("Created 1 trending market");
    return parts.length > 0 ? parts.join(" | ") : "No actions taken";

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] ${msg}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw err;
  }
}
