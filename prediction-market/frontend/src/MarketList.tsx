import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  PREDICTION_MARKET_ABI,
  CONTRACT_ADDRESS,
  SEPOLIA,
} from "./contract";
import type { Market } from "./contract";
import { MarketCard } from "./MarketCard";
import { MarketDetail } from "./MarketDetail";
import { StatsBar } from "./StatsBar";
import { MOCK_MARKETS } from "./mockData";

interface MarketListProps {
  provider: ethers.BrowserProvider | null;
  account: string | null;
}

export function MarketList({ provider, account }: MarketListProps) {
  const [markets, setMarkets] = useState<{ id: number; data: Market }[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);

  useEffect(() => {
    loadMarkets();
  }, [provider]);

  const loadMarkets = async () => {
    setLoading(true);
    setUsingMockData(false);

    try {
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
              deadline: Number(m[3]),
              settled: m[4],
              confidence: Number(m[5]),
              outcome: Number(m[6]),
              totalYesPool: m[7],
              totalNoPool: m[8],
              question: m[9],
              asset: m[10],
              targetPrice: m[11],
              settledPrice: m[12],
            },
          });
        } catch (err) {
          console.warn(`Failed to load market #${i}:`, err);
        }
      }

      setMarkets(loaded);
    } catch (err: any) {
      console.error("Failed to load markets, falling back to cached data:", err);
      setMarkets(MOCK_MARKETS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  // Detail view
  if (selectedMarketId !== null) {
    const selected = markets.find((m) => m.id === selectedMarketId);
    if (selected) {
      return (
        <MarketDetail
          market={selected.data}
          marketId={selected.id}
          provider={provider}
          account={account}
          onBack={() => setSelectedMarketId(null)}
          onUpdate={loadMarkets}
        />
      );
    }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Loading markets from Sepolia...</p>
      </div>
    );
  }

  if (markets.length === 0 && !loading) {
    return <div className="no-markets">No markets found on-chain</div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Prediction Markets</h1>
        <span className="market-count">{markets.length} market{markets.length !== 1 ? "s" : ""}</span>
      </div>
      {usingMockData && (
        <div className="mock-data-banner">
          RPC unavailable — showing cached market data.{" "}
          <button onClick={loadMarkets} className="mock-retry-btn">Retry</button>
        </div>
      )}
      <StatsBar markets={markets} />
      <div className="market-grid">
        {markets.map((m) => (
          <MarketCard
            key={m.id}
            market={m.data}
            marketId={m.id}
            onClick={() => setSelectedMarketId(m.id)}
          />
        ))}
      </div>
    </>
  );
}
