import { ethers } from "ethers";
import type { Market } from "./contract";

interface StatsBarProps {
  markets: { id: number; data: Market }[];
}

export function StatsBar({ markets }: StatsBarProps) {
  if (markets.length === 0) return null;

  const totalMarkets = markets.length;
  const settledMarkets = markets.filter((m) => m.data.settled).length;
  const activeMarkets = totalMarkets - settledMarkets;

  let totalVolume = 0n;
  for (const m of markets) {
    totalVolume += m.data.totalYesPool + m.data.totalNoPool;
  }

  const volumeStr = ethers.formatEther(totalVolume);
  const volumeDisplay =
    parseFloat(volumeStr) < 0.001
      ? "< 0.001"
      : parseFloat(volumeStr).toFixed(4);

  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-value">{totalMarkets}</span>
        <span className="stat-label">Markets</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value">{activeMarkets}</span>
        <span className="stat-label">Active</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value">{settledMarkets}</span>
        <span className="stat-label">Settled</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value">{volumeDisplay}</span>
        <span className="stat-label">Volume (ETH)</span>
      </div>
    </div>
  );
}
