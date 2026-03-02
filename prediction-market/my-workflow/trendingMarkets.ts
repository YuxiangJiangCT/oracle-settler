// prediction-market/my-workflow/trendingMarkets.ts
// Auto-generate prediction markets from trending crypto events via Gemini AI.
// Called by the Cron Trigger to create new markets autonomously.

import {
  cre,
  type Runtime,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  ok,
  consensusIdenticalAggregation,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import type { Config } from "./settlementLogic";

// ABI params for market creation (no prefix = create market route)
const CREATE_MARKET_PARAMS = parseAbiParameters(
  "string question, string asset, uint256 targetPrice"
);

interface MarketSuggestion {
  question: string;
  asset: string;
  targetPrice: number;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

const SUGGEST_SYSTEM_PROMPT = `
You are a prediction market creator that suggests timely, interesting crypto prediction markets.

OUTPUT FORMAT (CRITICAL):
- You MUST respond with a SINGLE JSON object with this exact structure:
  {"question": "<yes/no question>", "asset": "<coingecko-id>", "targetPrice": <number or 0>}

RULES:
- Output MUST be valid JSON. No markdown, no backticks, no code fences, no prose.
- Output MUST be MINIFIED (one line).
- "question" must be a clear YES/NO question that can be resolved within 7 days.
- "asset" must be a valid CoinGecko asset ID (e.g., "bitcoin", "ethereum", "solana").
  For event markets, use a descriptive slug (e.g., "eth-etf-approval").
- "targetPrice" is the USD price target. Set to 0 for event/non-price markets.
- Focus on CURRENT trending topics in crypto (price milestones, protocol upgrades, regulatory events, token launches).
- Make questions specific with clear resolution criteria.
- Do NOT suggest markets about past events.

EXAMPLES:
{"question":"Will Bitcoin exceed 110000 USD by next week?","asset":"bitcoin","targetPrice":110000}
{"question":"Will Ethereum complete the Pectra upgrade this month?","asset":"eth-pectra-upgrade","targetPrice":0}
`;

const SUGGEST_USER_PROMPT = `Based on current crypto market trends and news, suggest ONE prediction market question that would be interesting to trade right now. The market should resolve within the next 7 days. Respond with ONLY the JSON object.`;

/**
 * Ask Gemini AI to suggest a trending prediction market.
 */
function suggestMarket(
  runtime: Runtime<Config>
): MarketSuggestion | null {
  runtime.log("[TrendingMarkets] Asking Gemini for market suggestion...");

  const geminiApiKey = runtime.getSecret({ id: "GEMINI_API_KEY" }).result();
  const httpClient = new cre.capabilities.HTTPClient();

  try {
    const result = httpClient
      .sendRequest(
        runtime,
        buildSuggestRequest(geminiApiKey.value),
        consensusIdenticalAggregation<MarketSuggestion>()
      )(runtime.config)
      .result();

    if (!result.question || !result.asset) {
      runtime.log("[TrendingMarkets] Invalid suggestion from Gemini");
      return null;
    }

    runtime.log(`[TrendingMarkets] Suggestion: "${result.question}" (${result.asset}, $${result.targetPrice})`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[TrendingMarkets] Gemini suggestion failed: ${msg}`);
    return null;
  }
}

const buildSuggestRequest =
  (apiKey: string) =>
  (sendRequester: HTTPSendRequester, config: Config): MarketSuggestion => {
    const requestData = {
      system_instruction: {
        parts: [{ text: SUGGEST_SYSTEM_PROMPT }],
      },
      tools: [{ google_search: {} }],
      contents: [
        {
          parts: [{ text: SUGGEST_USER_PROMPT }],
        },
      ],
    };

    const bodyBytes = new TextEncoder().encode(JSON.stringify(requestData));
    const body = Buffer.from(bodyBytes).toString("base64");

    const req = {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`,
      method: "POST" as const,
      body,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      cacheSettings: {
        store: true,
        maxAge: "300s",
      },
    };

    const resp = sendRequester.sendRequest(req).result();
    const bodyText = new TextDecoder().decode(resp.body);

    if (!ok(resp)) {
      throw new Error(`Gemini API error: ${resp.statusCode} - ${bodyText}`);
    }

    const apiResponse = JSON.parse(bodyText) as GeminiApiResponse;
    const text = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Malformed Gemini response");
    }

    // Parse the JSON response, stripping any markdown fences
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    return JSON.parse(cleaned) as MarketSuggestion;
  };

/**
 * Create a market on-chain from a suggestion.
 * Uses the same CRE report() → writeReport() pattern as httpCallback.
 */
function createMarketOnChain(
  runtime: Runtime<Config>,
  suggestion: MarketSuggestion
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

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  // Encode market creation data (no prefix = create route in contract)
  const targetPrice6Dec = BigInt(Math.round(suggestion.targetPrice * 1e6));
  const reportData = encodeAbiParameters(CREATE_MARKET_PARAMS, [
    suggestion.question,
    suggestion.asset,
    targetPrice6Dec,
  ]);

  runtime.log(`[TrendingMarkets] Signing CRE report for market creation...`);

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
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`[TrendingMarkets] Market created: ${txHash}`);
    return txHash;
  }

  throw new Error(`Market creation tx failed: ${writeResult.txStatus}`);
}

/**
 * Main entry: suggest and create a trending market.
 * Called from cronCallback after settling expired markets.
 * Returns a description of what was created, or null if skipped.
 */
export function createTrendingMarket(
  runtime: Runtime<Config>,
  activeMarketCount: number
): string | null {
  // Only create new markets if there are fewer than 12 active markets
  if (activeMarketCount >= 12) {
    runtime.log("[TrendingMarkets] Enough active markets, skipping");
    return null;
  }

  const suggestion = suggestMarket(runtime);
  if (!suggestion) return null;

  try {
    const txHash = createMarketOnChain(runtime, suggestion);
    return `Created "${suggestion.question}" (${suggestion.asset}) — tx: ${txHash}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`[TrendingMarkets] Creation failed: ${msg}`);
    return null;
  }
}
