// prediction-market/my-workflow/logCallback.ts
// Log Trigger: Handles SettlementRequested events for on-demand market settlement.

import {
  type Runtime,
  type EVMLog,
  bytesToHex,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
} from "viem";
import { type Config, settleMarket } from "./settlementLogic";

/** ABI for the SettlementRequested event */
const EVENT_ABI = parseAbi([
  "event SettlementRequested(uint256 indexed marketId, string question)",
]);

/**
 * Handles Log Trigger events for settling prediction markets.
 *
 * Flow:
 * 1. Decode the SettlementRequested event
 * 2. Delegate to shared settlement logic (read → price → outcome → write)
 */
export function onLogTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Log Trigger - Settle Market");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // Step 1: Decode the event log
    const topics = log.topics.map((t: Uint8Array) => bytesToHex(t)) as [
      `0x${string}`,
      ...`0x${string}`[]
    ];
    const data = bytesToHex(log.data);

    const decodedLog = decodeEventLog({ abi: EVENT_ABI, data, topics });
    const marketId = decodedLog.args.marketId as bigint;
    const question = decodedLog.args.question as string;

    runtime.log(`[Log] Settlement requested for Market #${marketId}`);
    runtime.log(`[Log] Question: "${question}"`);

    // Step 2: Settle the market using shared logic
    const txHash = settleMarket(runtime, marketId);

    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return `Settled: ${txHash}`;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] ${msg}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw err;
  }
}
