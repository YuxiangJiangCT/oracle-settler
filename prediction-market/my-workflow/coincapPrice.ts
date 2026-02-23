// prediction-market/my-workflow/coincapPrice.ts
// Second price source for dual-source consensus

import {
  ok,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import type { Config } from "./settlementLogic";

// CoinGecko ID → CoinCap ID mapping
const COINGECKO_TO_COINCAP: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  cardano: "cardano",
  dogecoin: "dogecoin",
  polkadot: "polkadot",
  avalanche: "avalanche-2",
  chainlink: "chainlink",
  matic: "polygon",
  litecoin: "litecoin",
};

interface CoinCapAsset {
  data: {
    id: string;
    priceUsd: string;
  };
}

/**
 * Fetches price from CoinCap API (second independent source).
 * Used for dual-source price consensus.
 */
export const buildCoinCapRequest =
  (assetId: string) =>
  (sendRequester: HTTPSendRequester, _config: Config): { price: number } => {
    const coinCapId = COINGECKO_TO_COINCAP[assetId] || assetId;

    const req = {
      url: `https://api.coincap.io/v2/assets/${coinCapId}`,
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
      throw new Error(`CoinCap API error: ${resp.statusCode} - ${bodyText}`);
    }

    const data = JSON.parse(bodyText) as CoinCapAsset;
    const priceStr = data.data?.priceUsd;

    if (!priceStr) {
      throw new Error(`CoinCap returned no price for ${coinCapId}: ${bodyText}`);
    }

    return { price: parseFloat(priceStr) };
  };
