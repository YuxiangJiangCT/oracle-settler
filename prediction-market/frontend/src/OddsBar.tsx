import { ethers } from "ethers";

interface OddsBarProps {
  yesPool: bigint;
  noPool: bigint;
}

export function OddsBar({ yesPool, noPool }: OddsBarProps) {
  const totalPool = yesPool + noPool;

  // Parimutuel odds: percentage = pool / totalPool
  const yesPercent =
    totalPool > 0n
      ? Number((yesPool * 10000n) / totalPool) / 100
      : 50;
  const noPercent = totalPool > 0n ? 100 - yesPercent : 50;

  return (
    <div className="odds-section">
      <div className="odds-labels">
        <span className="yes-label">YES {yesPercent.toFixed(1)}%</span>
        <span className="pool-total">
          {ethers.formatEther(totalPool)} ETH
        </span>
        <span className="no-label">NO {noPercent.toFixed(1)}%</span>
      </div>
      <div className="odds-bar">
        <div className="odds-yes" style={{ width: `${yesPercent}%` }} />
        <div className="odds-no" style={{ width: `${noPercent}%` }} />
      </div>
    </div>
  );
}
