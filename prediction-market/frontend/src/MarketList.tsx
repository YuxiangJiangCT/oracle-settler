import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  PREDICTION_MARKET_ABI,
  CONTRACT_ADDRESS,
  SEPOLIA,
} from "./contract";
import type { Market } from "./contract";
import { MarketCard } from "./MarketCard";

interface MarketListProps {
  provider: ethers.BrowserProvider | null;
}

export function MarketList({ provider }: MarketListProps) {
  const [markets, setMarkets] = useState<{ id: number; data: Market }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMarkets();
  }, [provider]);

  const loadMarkets = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use provider if available, otherwise fallback to public RPC
      const rpcProvider =
        provider || new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        PREDICTION_MARKET_ABI,
        rpcProvider
      );

      const nextId = await contract.getNextMarketId();
      const count = Number(nextId);

      const loaded: { id: number; data: Market }[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const m = await contract.getMarket(i);
          loaded.push({
            id: i,
            data: {
              creator: m[0],
              createdAt: Number(m[1]),
              settledAt: Number(m[2]),
              settled: m[3],
              confidence: Number(m[4]),
              outcome: Number(m[5]),
              totalYesPool: m[6],
              totalNoPool: m[7],
              question: m[8],
              asset: m[9],
              targetPrice: m[10],
              settledPrice: m[11],
            },
          });
        } catch (err) {
          console.warn(`Failed to load market #${i}:`, err);
        }
      }

      setMarkets(loaded);
    } catch (err: any) {
      console.error("Failed to load markets:", err);
      setError(err.message || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Loading markets from Sepolia...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-state">
        <p>Error: {error}</p>
        <button className="connect-btn" onClick={loadMarkets} style={{ marginTop: 16 }}>
          Retry
        </button>
      </div>
    );
  }

  if (markets.length === 0) {
    return <div className="no-markets">No markets found on-chain</div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Prediction Markets</h1>
        <span className="market-count">{markets.length} market{markets.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="market-grid">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m.data} marketId={m.id} />
        ))}
      </div>
    </>
  );
}
