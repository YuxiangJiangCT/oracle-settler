import { useState, useEffect } from "react";

interface PriceData {
  asset: string;
  coingecko: number | null;
  loading: boolean;
  error: string | null;
}

const COINGECKO_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
};

export function usePriceData(assets: string[]): PriceData[] {
  const [prices, setPrices] = useState<PriceData[]>(
    assets.map((a) => ({ asset: a, coingecko: null, loading: true, error: null }))
  );

  useEffect(() => {
    if (assets.length === 0) return;

    const fetchPrices = async () => {
      const ids = assets
        .map((a) => COINGECKO_IDS[a.toLowerCase()] || a.toLowerCase())
        .filter((v, i, arr) => arr.indexOf(v) === i);

      try {
        const resp = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`
        );

        if (!resp.ok) throw new Error(`CoinGecko HTTP ${resp.status}`);

        const data = await resp.json();

        setPrices(
          assets.map((asset) => {
            const id = COINGECKO_IDS[asset.toLowerCase()] || asset.toLowerCase();
            const price = data[id]?.usd ?? null;
            return {
              asset,
              coingecko: price,
              loading: false,
              error: price === null ? "Not found" : null,
            };
          })
        );
      } catch (err: any) {
        setPrices(
          assets.map((a) => ({
            asset: a,
            coingecko: null,
            loading: false,
            error: err.message,
          }))
        );
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [assets.join(",")]);

  return prices;
}
