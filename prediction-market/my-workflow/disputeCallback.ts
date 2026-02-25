// prediction-market/my-workflow/disputeCallback.ts
// Log Trigger: Handles DisputeFiled events for dispute re-verification.

import {
  type Runtime,
  type EVMLog,
  bytesToHex,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
} from "viem";
import {
  type Config,
  readMarket,
  isPriceMarket,
  determineOutcome,
  determineEventOutcome,
  writeDisputeResolution,
} from "./settlementLogic";

/** ABI for the DisputeFiled event */
const DISPUTE_EVENT_ABI = parseAbi([
  "event DisputeFiled(uint256 indexed marketId, address indexed disputer, uint256 stake)",
]);

/**
 * Handles DisputeFiled log events — triggers stricter CRE re-verification.
 *
 * Flow:
 * 1. Decode the DisputeFiled event to get marketId
 * 2. Re-read market data from chain
 * 3. Re-run price/event verification (same dual-source + AI pipeline)
 * 4. Strict mode: if new confidence < 70%, keep original outcome (anti-flip protection)
 * 5. Write dispute resolution via 0x02 prefixed report
 */
export function onDisputeTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Dispute Trigger - Re-verify Settlement");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // Step 1: Decode the event log
    const topics = log.topics.map((t: Uint8Array) => bytesToHex(t)) as [
      `0x${string}`,
      ...`0x${string}`[]
    ];
    const data = bytesToHex(log.data);

    const decodedLog = decodeEventLog({ abi: DISPUTE_EVENT_ABI, data, topics });
    const marketId = decodedLog.args.marketId as bigint;
    const disputer = decodedLog.args.disputer as string;

    runtime.log(`[Dispute] Dispute filed for Market #${marketId} by ${disputer}`);

    // Step 2: Read current market state
    const market = readMarket(runtime, marketId);
    runtime.log(`[Dispute] Original outcome: ${market.outcome === 0 ? "YES" : "NO"} (${market.confidence / 100}% confidence)`);

    // Step 3: Re-run verification
    const isPrice = isPriceMarket(market);
    runtime.log(`[Dispute] Market type: ${isPrice ? "PRICE" : "EVENT"} — re-verifying...`);

    let result = isPrice
      ? determineOutcome(runtime, market, market.question)
      : determineEventOutcome(runtime, market, market.question);

    runtime.log(`[Dispute] Re-verification result: ${result.outcomeValue === 0 ? "YES" : "NO"} (${result.confidence / 100}% confidence)`);

    // Step 4: Strict mode — low confidence re-verification keeps original outcome
    // This prevents AI micro-fluctuations from flipping settled markets
    if (result.confidence < 7000) {
      runtime.log(`[Dispute] STRICT MODE: New confidence ${result.confidence / 100}% < 70% threshold — keeping original outcome`);
      result = {
        outcomeValue: market.outcome,
        confidence: market.confidence,
        settledPrice6Dec: market.settledPrice,
        currentPriceUsd: Number(market.settledPrice) / 1e6,
      };
    }

    // Step 5: Write dispute resolution
    const txHash = writeDisputeResolution(
      runtime,
      marketId,
      result.outcomeValue,
      result.confidence,
      result.settledPrice6Dec
    );

    const overturned = result.outcomeValue !== market.outcome;
    runtime.log(`[Dispute] Resolution: ${overturned ? "OVERTURNED" : "CONFIRMED"} → ${result.outcomeValue === 0 ? "YES" : "NO"} (${result.confidence / 100}%)`);
    runtime.log(`[Dispute] tx: ${txHash}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return `Dispute resolved: ${overturned ? "overturned" : "confirmed"} — ${txHash}`;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] Dispute resolution failed: ${msg}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw err;
  }
}
