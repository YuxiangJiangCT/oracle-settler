// prediction-market/my-workflow/main.ts

import { cre, Runner, getNetwork } from "@chainlink/cre-sdk";
import { keccak256, toHex } from "viem";
import { onHttpTrigger } from "./httpCallback";
import { onLogTrigger } from "./logCallback";
import { onCronTrigger } from "./cronCallback";
import { onDisputeTrigger } from "./disputeCallback";
import { onParlayTrigger } from "./parlayCallback";

// Config type (matches config.staging.json structure)
type Config = {
  geminiModel: string;
  evms: Array<{
    marketAddress: string;
    parlayAddress?: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

const SETTLEMENT_REQUESTED_SIGNATURE = "SettlementRequested(uint256,string)";
const DISPUTE_FILED_SIGNATURE = "DisputeFiled(uint256,address,uint256)";
const PARLAY_SETTLEMENT_SIGNATURE = "ParlaySettlementRequested(uint256)";

const initWorkflow = (config: Config) => {
  // Initialize HTTP capability
  const httpCapability = new cre.capabilities.HTTPCapability();
  const httpTrigger = httpCapability.trigger({});

  // Get network for Log Trigger
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.evms[0].chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Network not found: ${config.evms[0].chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const eventHash = keccak256(toHex(SETTLEMENT_REQUESTED_SIGNATURE));
  const disputeEventHash = keccak256(toHex(DISPUTE_FILED_SIGNATURE));

  // Initialize Cron capability for scheduled auto-settlement
  const cronCapability = new cre.capabilities.CronCapability();

  const handlers = [
    // HTTP Trigger - Market Creation via webhook
    cre.handler(httpTrigger, onHttpTrigger),

    // Log Trigger - Event-Driven Settlement (on-demand)
    cre.handler(
      evmClient.logTrigger({
        addresses: [config.evms[0].marketAddress],
        topics: [{ values: [eventHash] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onLogTrigger
    ),

    // Log Trigger - Dispute Re-verification (on DisputeFiled)
    cre.handler(
      evmClient.logTrigger({
        addresses: [config.evms[0].marketAddress],
        topics: [{ values: [disputeEventHash] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onDisputeTrigger
    ),

    // Cron Trigger - Scheduled Auto-Settlement (every 6 hours)
    cre.handler(
      cronCapability.trigger({ schedule: "0 */6 * * *" }),
      onCronTrigger
    ),
  ];

  // Log Trigger - Parlay Settlement (cross-contract orchestration)
  if (config.evms[0].parlayAddress) {
    const parlayEventHash = keccak256(toHex(PARLAY_SETTLEMENT_SIGNATURE));
    handlers.push(
      cre.handler(
        evmClient.logTrigger({
          addresses: [config.evms[0].parlayAddress],
          topics: [{ values: [parlayEventHash] }],
          confidence: "CONFIDENCE_LEVEL_FINALIZED",
        }),
        onParlayTrigger
      )
    );
  }

  return handlers;
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
