import { useState, useEffect } from "react";

export interface PriceData {
  asset: string;
  coingecko: number | null;
  coincap: number | null;
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

const COINCAP_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
};

export function usePriceData(assets: string[]): PriceData[] {
  const [prices, setPrices] = useState<PriceData[]>(
    assets.map((a) => ({ asset: a, coingecko: null, coincap: null, loading: true, error: null }))
  );

  useEffect(() => {
    if (assets.length === 0) return;

    const fetchPrices = async () => {
      const geckoIds = assets
        .map((a) => COINGECKO_IDS[a.toLowerCase()] || a.toLowerCase())
        .filter((v, i, arr) => arr.indexOf(v) === i);

      // Fetch both sources in parallel
      const [geckoData, capData] = await Promise.all([
        fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(",")}&vs_currencies=usd`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        Promise.all(
          assets.map(async (asset) => {
            const id = COINCAP_IDS[asset.toLowerCase()] || asset.toLowerCase();
            try {
              const resp = await fetch(`https://api.coincap.io/v2/assets/${id}`);
              if (!resp.ok) return { asset, price: null };
              const data = await resp.json();
              return { asset, price: parseFloat(data.data?.priceUsd) || null };
            } catch {
              return { asset, price: null };
            }
          })
        ),
      ]);

      setPrices(
        assets.map((asset) => {
          const geckoId = COINGECKO_IDS[asset.toLowerCase()] || asset.toLowerCase();
          const geckoPrice = geckoData?.[geckoId]?.usd ?? null;
          const capEntry = capData.find((c) => c.asset === asset);
          const capPrice = capEntry?.price ?? null;

          return {
            asset,
            coingecko: geckoPrice,
            coincap: capPrice,
            loading: false,
            error: geckoPrice === null && capPrice === null ? "No data" : null,
          };
        })
      );
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [assets.join(",")]);

  return prices;
}
