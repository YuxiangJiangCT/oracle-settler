import { ethers } from "ethers";

interface OddsBarProps {
  yesPool: bigint;
  noPool: bigint;
  settled?: boolean;
  outcome?: number; // 0 = YES, 1 = NO
}

export function OddsBar({ yesPool, noPool, settled, outcome }: OddsBarProps) {
  const totalPool = yesPool + noPool;

  // Parimutuel odds: percentage = pool / totalPool
  const yesPercent =
    totalPool > 0n
      ? Number((yesPool * 10000n) / totalPool) / 100
      : 50;
  const noPercent = totalPool > 0n ? 100 - yesPercent : 50;

  const yesWon = settled && outcome === 0;
  const noWon = settled && outcome === 1;

  return (
    <div className="odds-section">
      <div className="odds-labels">
        <span className="yes-label">
          {yesWon && <span className="winner-icon">✓ </span>}
          YES {yesPercent.toFixed(1)}%
        </span>
        <span className="pool-total">
          {ethers.formatEther(totalPool)} ETH
        </span>
        <span className="no-label">
          NO {noPercent.toFixed(1)}%
          {noWon && <span className="winner-icon"> ✓</span>}
        </span>
      </div>
      <div className="odds-bar">
        <div className="odds-yes" style={{ width: `${yesPercent}%` }} />
        <div className="odds-no" style={{ width: `${noPercent}%` }} />
      </div>
      {settled && (
        <div className="odds-caption">Pool distribution — outcome shown above</div>
      )}
    </div>
  );
}
