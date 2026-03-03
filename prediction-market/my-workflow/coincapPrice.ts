// prediction-market/my-workflow/coincapPrice.ts
// Second price source for dual-source consensus (CryptoCompare)

import {
  ok,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import type { Config } from "./settlementLogic";

// CoinGecko ID → CryptoCompare ticker symbol mapping
const COINGECKO_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  cardano: "ADA",
  dogecoin: "DOGE",
  polkadot: "DOT",
  "avalanche-2": "AVAX",
  chainlink: "LINK",
  matic: "MATIC",
  litecoin: "LTC",
};

interface CryptoCompareResponse {
  USD?: number;
}

/**
 * Fetches price from CryptoCompare API (second independent source).
 * Used for dual-source price consensus.
 * Replaces CoinCap which is no longer reachable.
 */
export const buildCoinCapRequest =
  (assetId: string) =>
  (sendRequester: HTTPSendRequester, _config: Config): { price: number } => {
    const symbol = COINGECKO_TO_SYMBOL[assetId] || assetId.toUpperCase();

    const req = {
      url: `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`,
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
      throw new Error(`CryptoCompare API error: ${resp.statusCode} - ${bodyText}`);
    }

    const data = JSON.parse(bodyText) as CryptoCompareResponse;
    const price = data.USD;

    if (price === undefined || price === null) {
      throw new Error(`CryptoCompare returned no price for ${symbol}: ${bodyText}`);
    }

    return { price };
  };
