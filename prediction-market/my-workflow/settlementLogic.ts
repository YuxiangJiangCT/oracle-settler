// prediction-market/my-workflow/settlementLogic.ts
// Shared settlement logic used by both Log Trigger and Cron Trigger

import {
  cre,
  ok,
  consensusIdenticalAggregation,
  type Runtime,
  type HTTPSendRequester,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem";
import { askGemini } from "./gemini";

// ===========================
// Shared Types
// ===========================

export type Config = {
  geminiModel: string;
  evms: Array<{
    marketAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

export interface Market {
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

export const GET_MARKET_ABI = [
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

export const GET_NEXT_MARKET_ID_ABI = [
  {
    name: "getNextMarketId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const SETTLEMENT_PARAMS = parseAbiParameters("uint256 marketId, uint8 outcome, uint16 confidence, uint256 settledPrice");

// ===========================
// Core Settlement Logic
// ===========================

/**
 * Reads market data from the contract.
 */
export function readMarket(
  runtime: Runtime<Config>,
  marketId: bigint
): Market {
  const evmConfig = runtime.config.evms[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);
  }

  const client = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const callData = encodeFunctionData({
    abi: GET_MARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
  });

  const readResult = client
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmConfig.marketAddress as `0x${string}`,
        data: callData,
      })
    })
    .result();

  return decodeFunctionResult({
    abi: GET_MARKET_ABI,
    functionName: "getMarket",
    data: bytesToHex(readResult.data),
  }) as unknown as Market;
}

/**
 * Fetches current price from CoinGecko and determines settlement outcome.
 * Returns outcome (0=YES, 1=NO), confidence (0-10000), and settled price in 6 decimals.
 */
export function determineOutcome(
  runtime: Runtime<Config>,
  market: Market,
  question: string
): { outcomeValue: number; confidence: number; settledPrice6Dec: bigint; currentPriceUsd: number } {
  // Fetch real price from CoinGecko
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

  const settledPrice6Dec = BigInt(Math.round(currentPriceUsd * 1e6));
  const targetPriceUsd = Number(market.targetPrice) / 1e6;
  const priceDiff = Math.abs(currentPriceUsd - targetPriceUsd) / targetPriceUsd;

  runtime.log(`  Price: $${currentPriceUsd.toLocaleString()} | Target: $${targetPriceUsd.toLocaleString()} | Diff: ${(priceDiff * 100).toFixed(1)}%`);

  let outcomeValue: number;
  let confidence: number;

  if (priceDiff > 0.05) {
    // Clear result (>5% away from target) — no AI needed
    outcomeValue = currentPriceUsd >= targetPriceUsd ? 0 : 1;
    confidence = 10000;
    runtime.log(`  Direct: ${outcomeValue === 0 ? "YES" : "NO"} (100% confidence)`);
  } else {
    // Ambiguous (within 5%) — ask Gemini AI
    runtime.log(`  Within 5% threshold — consulting Gemini AI...`);

    const geminiResult = askGemini(runtime,
      `${question}\n\nIMPORTANT CONTEXT: The current ${market.asset} price is $${currentPriceUsd.toLocaleString()} and the target is $${targetPriceUsd.toLocaleString()}. The price is ${(priceDiff * 100).toFixed(2)}% ${currentPriceUsd >= targetPriceUsd ? "above" : "below"} the target.`
    );

    const jsonMatch = geminiResult.geminiResponse.match(/\{[\s\S]*"result"[\s\S]*"confidence"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not find JSON in AI response: ${geminiResult.geminiResponse}`);
    }
    const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;

    if (!["YES", "NO"].includes(parsed.result)) {
      throw new Error(`Cannot settle: AI returned ${parsed.result}`);
    }

    outcomeValue = parsed.result === "YES" ? 0 : 1;
    confidence = Math.min(Math.max(parsed.confidence, 0), 10000);
    runtime.log(`  AI: ${parsed.result} (${confidence / 100}% confidence)`);
  }

  return { outcomeValue, confidence, settledPrice6Dec, currentPriceUsd };
}

/**
 * Writes settlement report to the contract via CRE signed report.
 */
export function writeSettlement(
  runtime: Runtime<Config>,
  marketId: bigint,
  outcomeValue: number,
  confidence: number,
  settledPrice6Dec: bigint
): string {
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
    return bytesToHex(writeResult.txHash || new Uint8Array(32));
  }

  throw new Error(`Transaction failed: ${writeResult.txStatus}`);
}

/**
 * Full settlement flow for a single market: read → price → outcome → write.
 */
export function settleMarket(
  runtime: Runtime<Config>,
  marketId: bigint
): string {
  const market = readMarket(runtime, marketId);

  if (market.settled) {
    runtime.log(`  Market #${marketId} already settled, skipping`);
    return "already settled";
  }

  if (market.creator === "0x0000000000000000000000000000000000000000") {
    runtime.log(`  Market #${marketId} does not exist, skipping`);
    return "does not exist";
  }

  runtime.log(`  Market #${marketId}: "${market.question}" [${market.asset}]`);

  const { outcomeValue, confidence, settledPrice6Dec, currentPriceUsd } =
    determineOutcome(runtime, market, market.question);

  const txHash = writeSettlement(runtime, marketId, outcomeValue, confidence, settledPrice6Dec);
  const targetPriceUsd = Number(market.targetPrice) / 1e6;

  runtime.log(`  Settled: ${outcomeValue === 0 ? "YES" : "NO"} @ $${currentPriceUsd} (target: $${targetPriceUsd}) tx: ${txHash}`);
  return txHash;
}

// ===========================
// CoinGecko Price Fetcher
// ===========================

export const buildCoinGeckoRequest =
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
