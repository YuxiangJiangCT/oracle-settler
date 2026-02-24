import type { Market } from "./contract";
import { OddsBar } from "./OddsBar";

interface MarketCardProps {
  market: Market;
  marketId: number;
  onClick?: () => void;
}

function formatPrice(price: bigint): string {
  const num = Number(price) / 1e6;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${num.toLocaleString()}`;
}

function timeAgo(timestamp: number): string {
  if (timestamp === 0) return "";
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function MarketCard({ market, marketId, onClick }: MarketCardProps) {
  const outcomeLabel = market.outcome === 0 ? "YES" : "NO";
  const outcomeClass = market.outcome === 0 ? "yes-wins" : "no-wins";
  const confidence = market.confidence / 100; // stored as basis points (e.g. 10000 = 100%)

  return (
    <div className="market-card" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      {/* Header: ID + Status */}
      <div className="card-header">
        <span className="market-id">#{marketId}</span>
        <span className={`market-status ${market.settled ? "settled" : "active"}`}>
          {market.settled ? "Settled" : "Active"}
        </span>
      </div>

      {/* Question */}
      <div className="card-question">{market.question}</div>

      {/* Asset & Price Info */}
      <div className="card-asset-info">
        <span className="asset-tag">{market.asset}</span>
        <span className="price-tag">Target: {formatPrice(market.targetPrice)}</span>
        {market.settled && market.settledPrice > 0n && (
          <span className="price-tag settled-price">
            Settled: {formatPrice(market.settledPrice)}
          </span>
        )}
      </div>

      {/* Odds Bar */}
      <OddsBar yesPool={market.totalYesPool} noPool={market.totalNoPool} />

      {/* Settlement Result (if settled) */}
      {market.settled && (
        <div className={`settlement-result ${outcomeClass}`}>
          <span>
            Outcome: <strong>{outcomeLabel}</strong>
          </span>
          <span className="confidence-badge">{confidence.toFixed(0)}% confidence</span>
        </div>
      )}

      {/* Footer */}
      <div className="card-footer">
        <span>Creator: {market.creator.slice(0, 6)}...{market.creator.slice(-4)}</span>
        <span>
          {market.settled
            ? `Settled ${timeAgo(market.settledAt)}`
            : `Created ${timeAgo(market.createdAt)}`}
        </span>
      </div>
    </div>
  );
}
