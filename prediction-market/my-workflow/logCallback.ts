// prediction-market/my-workflow/logCallback.ts

import {
  cre,
  ok,
  consensusIdenticalAggregation,
  type Runtime,
  type EVMLog,
  type HTTPSendRequester,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem";
import { askGemini } from "./gemini";

// Inline types
type Config = {
  geminiModel: string;
  evms: Array<{
    marketAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

interface Market {
  creator: string;
  createdAt: number;       // uint48 → number in viem
  settledAt: number;       // uint48 → number in viem
  settled: boolean;
  confidence: number;
  outcome: number; // 0 = Yes, 1 = No
  totalYesPool: bigint;
  totalNoPool: bigint;
  question: string;
  asset: string;           // CoinGecko ID (e.g., "bitcoin")
  targetPrice: bigint;     // Target price in 6 decimals
  settledPrice: bigint;    // Actual price at settlement
}

interface GeminiResult {
  result: "YES" | "NO" | "INCONCLUSIVE";
  confidence: number; // 0-10000
}

interface CoinGeckoPrice {
  [id: string]: { usd: number };
}

// ===========================
// Contract ABIs
// ===========================

/** ABI for the SettlementRequested event */
const EVENT_ABI = parseAbi([
  "event SettlementRequested(uint256 indexed marketId, string question)",
]);

/** ABI for reading market data (includes asset, targetPrice, settledPrice) */
const GET_MARKET_ABI = [
  {
    name: "getMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint48" },
          { name: "settledAt", type: "uint48" },
          { name: "settled", type: "bool" },
          { name: "confidence", type: "uint16" },
          { name: "outcome", type: "uint8" },
          { name: "totalYesPool", type: "uint256" },
          { name: "totalNoPool", type: "uint256" },
          { name: "question", type: "string" },
          { name: "asset", type: "string" },
          { name: "targetPrice", type: "uint256" },
          { name: "settledPrice", type: "uint256" },
        ],
      },
    ],
  },
] as const;

/** ABI parameters for settlement report (includes settledPrice for verifiability) */
const SETTLEMENT_PARAMS = parseAbiParameters("uint256 marketId, uint8 outcome, uint16 confidence, uint256 settledPrice");

// ===========================
// Log Trigger Handler
// ===========================

/**
 * Handles Log Trigger events for settling prediction markets.
 *
 * Flow:
 * 1. Decode the SettlementRequested event
 * 2. Read market details from the contract (EVM Read)
 * 3. Query Gemini AI for the outcome (HTTP)
 * 4. Write the settlement report to the contract (EVM Write)
 *
 * @param runtime - CRE runtime with config and capabilities
 * @param log - The EVM log event data
 * @returns Success message with transaction hash
 */
export function onLogTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Log Trigger - Settle Market");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // ─────────────────────────────────────────────────────────────
    // Step 1: Decode the event log
    // ─────────────────────────────────────────────────────────────
    const topics = log.topics.map((t: Uint8Array) => bytesToHex(t)) as [
      `0x${string}`,
      ...`0x${string}`[]
    ];
    const data = bytesToHex(log.data);

    const decodedLog = decodeEventLog({ abi: EVENT_ABI, data, topics });
    const marketId = decodedLog.args.marketId as bigint;
    const question = decodedLog.args.question as string;

    runtime.log(`[Step 1] Settlement requested for Market #${marketId}`);
    runtime.log(`[Step 1] Question: "${question}"`);

    // ─────────────────────────────────────────────────────────────
    // Step 2: Read market details from contract (EVM Read)
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 2] Reading market details from contract...");

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

    const callData = encodeFunctionData({
      abi: GET_MARKET_ABI,
      functionName: "getMarket",
      args: [marketId],
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

    runtime.log(`[Step 2] Market creator: ${market.creator}`);
    runtime.log(`[Step 2] Already settled: ${market.settled}`);
    runtime.log(`[Step 2] Yes Pool: ${market.totalYesPool}`);
    runtime.log(`[Step 2] No Pool: ${market.totalNoPool}`);

    if (market.settled) {
      runtime.log("[Step 2] Market already settled, skipping...");
      return "Market already settled";
    }

    const targetPriceUsd = Number(market.targetPrice) / 1e6;
    runtime.log(`[Step 2] Asset: ${market.asset}`);
    runtime.log(`[Step 2] Target Price: $${targetPriceUsd.toLocaleString()}`);

    // ─────────────────────────────────────────────────────────────
    // Step 3: Fetch real price from CoinGecko (Confidential HTTP)
    // ─────────────────────────────────────────────────────────────
    runtime.log(`[Step 3] Fetching ${market.asset} price from CoinGecko...`);

    const httpClient = new cre.capabilities.HTTPClient();
    const assetId = market.asset;

    const priceResult = httpClient
      .sendRequest(
        runtime,
        buildCoinGeckoRequest(assetId),
        consensusIdenticalAggregation<{ price: number }>()
      )(runtime.config)
      .result();

    const currentPriceUsd = priceResult.price;

    if (!currentPriceUsd) {
      throw new Error(`CoinGecko returned no price for ${market.asset}`);
    }

    // Convert to 6 decimals for on-chain storage
    const settledPrice6Dec = BigInt(Math.round(currentPriceUsd * 1e6));
    runtime.log(`[Step 3] Current ${market.asset} price: $${currentPriceUsd.toLocaleString()}`);

    // ─────────────────────────────────────────────────────────────
    // Step 4: Determine outcome — price check first, AI if ambiguous
    // ─────────────────────────────────────────────────────────────
    const priceDiff = Math.abs(currentPriceUsd - targetPriceUsd) / targetPriceUsd;
    let outcomeValue: number;
    let confidence: number;

    if (priceDiff > 0.05) {
      // Clear result (>5% away from target) — no AI needed
      outcomeValue = currentPriceUsd >= targetPriceUsd ? 0 : 1;
      confidence = 10000; // Maximum confidence
      runtime.log(`[Step 4] Price clearly ${currentPriceUsd >= targetPriceUsd ? "above" : "below"} target (${(priceDiff * 100).toFixed(1)}% diff)`);
      runtime.log(`[Step 4] Direct settlement: ${outcomeValue === 0 ? "YES" : "NO"} with 100% confidence`);
    } else {
      // Ambiguous (within 5%) — ask Gemini AI for confidence scoring
      runtime.log(`[Step 4] Price within 5% of target (${(priceDiff * 100).toFixed(1)}% diff) — consulting AI...`);

      const geminiResult = askGemini(runtime,
        `${question}\n\nIMPORTANT CONTEXT: The current ${market.asset} price is $${currentPriceUsd.toLocaleString()} and the target is $${targetPriceUsd.toLocaleString()}. The price is ${(priceDiff * 100).toFixed(2)}% ${currentPriceUsd >= targetPriceUsd ? "above" : "below"} the target.`
      );

      const jsonMatch = geminiResult.geminiResponse.match(/\{[\s\S]*"result"[\s\S]*"confidence"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Could not find JSON in AI response: ${geminiResult.geminiResponse}`);
      }
      const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;

      if (!["YES", "NO"].includes(parsed.result)) {
        throw new Error(`Cannot settle: AI returned ${parsed.result}. Only YES or NO can settle a market.`);
      }
      if (parsed.confidence < 0 || parsed.confidence > 10000) {
        throw new Error(`Invalid confidence: ${parsed.confidence}`);
      }

      outcomeValue = parsed.result === "YES" ? 0 : 1;
      confidence = parsed.confidence;
      runtime.log(`[Step 4] AI Result: ${parsed.result} (${confidence / 100}% confidence)`);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 5: Write settlement report to contract (EVM Write)
    // ─────────────────────────────────────────────────────────────
    runtime.log("[Step 5] Generating settlement report...");
    runtime.log(`[Step 5] Outcome: ${outcomeValue === 0 ? "YES" : "NO"}, Confidence: ${confidence}, Settled Price: $${currentPriceUsd}`);

    // Encode settlement data (includes settledPrice for on-chain verifiability)
    const settlementData = encodeAbiParameters(SETTLEMENT_PARAMS, [
      marketId,
      outcomeValue,
      confidence,
      settledPrice6Dec,
    ]);

    // Prepend 0x01 prefix so contract routes to _settleMarket
    const reportData = ("0x01" + settlementData.slice(2)) as `0x${string}`;

    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    runtime.log(`[Step 5] Writing to contract: ${evmConfig.marketAddress}`);

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: evmConfig.marketAddress,
        report: reportResponse,
        gasConfig: {
          gasLimit: evmConfig.gasLimit,
        },
      })
      .result();

    if (writeResult.txStatus === TxStatus.SUCCESS) {
      const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
      runtime.log(`[Step 5] ✓ Settlement successful: ${txHash}`);
      runtime.log(`[Step 5] Settled ${market.asset} market at $${currentPriceUsd} (target: $${targetPriceUsd})`);
      runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return `Settled: ${txHash}`;
    }

    throw new Error(`Transaction failed: ${writeResult.txStatus}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[ERROR] ${msg}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    throw err;
  }
}

// ===========================
// CoinGecko Price Fetcher
// ===========================

/**
 * Builds a CoinGecko price request using the CRE HTTPClient pattern.
 * Follows the same builder pattern as gemini.ts for consistency.
 */
const buildCoinGeckoRequest =
  (assetId: string) =>
  (sendRequester: HTTPSendRequester, _config: Config): { price: number } => {
    const req = {
      url: `https://api.coingecko.com/api/v3/simple/price?ids=${assetId}&vs_currencies=usd`,
      method: "GET" as const,
      headers: {
        "Accept": "application/json",
      },
      cacheSettings: {
        store: true,
        maxAge: '30s',
      },
    };

    const resp = sendRequester.sendRequest(req).result();
    const bodyText = new TextDecoder().decode(resp.body);

    if (!ok(resp)) {
      throw new Error(`CoinGecko API error: ${resp.statusCode} - ${bodyText}`);
    }

    const data = JSON.parse(bodyText) as CoinGeckoPrice;
    const price = data[assetId]?.usd;

    if (!price) {
      throw new Error(`CoinGecko returned no price for ${assetId}: ${bodyText}`);
    }

    return { price };
  };