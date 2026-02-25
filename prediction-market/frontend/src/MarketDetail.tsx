import { ethers } from "ethers";
import type { Market } from "./contract";
import { OddsBar } from "./OddsBar";
import { BetPanel } from "./BetPanel";
import { ClaimPanel } from "./ClaimPanel";
import { RequestSettlement } from "./RequestSettlement";
import { SettlementExplorer } from "./SettlementExplorer";
import { DisputePanel } from "./DisputePanel";

interface MarketDetailProps {
  market: Market;
  marketId: number;
  provider: ethers.BrowserProvider | null;
  account: string | null;
  onBack: () => void;
  onUpdate: () => void;
}

function formatPrice(price: bigint): string {
  const num = Number(price) / 1e6;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${num.toLocaleString()}`;
}

export function MarketDetail({ market, marketId, provider, account, onBack, onUpdate }: MarketDetailProps) {
  const totalPool = market.totalYesPool + market.totalNoPool;
  const isActive = !market.settled;

  return (
    <div className="market-detail">
      {/* Back button */}
      <button className="back-btn" onClick={onBack}>
        ← Back to Markets
      </button>

      {/* Market Header */}
      <div className="detail-header">
        <div className="detail-header-row">
          <span className="market-id">Market #{marketId}</span>
          <span className={`market-status ${market.settled ? "settled" : "active"}`}>
            {market.settled ? "Settled" : "Active"}
          </span>
        </div>
        <h2 className="detail-question">{market.question}</h2>

        <div className="detail-tags">
          <span className="asset-tag">{market.asset}</span>
          {market.targetPrice > 0n ? (
            <span className="price-tag">Target: {formatPrice(market.targetPrice)}</span>
          ) : (
            <span className="price-tag event-tag">Event Market</span>
          )}
          {market.settled && market.settledPrice > 0n && (
            <span className="price-tag settled-price">
              Settled: {formatPrice(market.settledPrice)}
            </span>
          )}
          <span className="price-tag">Pool: {ethers.formatEther(totalPool)} ETH</span>
        </div>
      </div>

      {/* Odds Bar */}
      <OddsBar yesPool={market.totalYesPool} noPool={market.totalNoPool} />

      {/* Settlement Result */}
      {market.settled && (
        <div className={`settlement-result ${market.outcome === 0 ? "yes-wins" : "no-wins"}`}>
          <span>
            Outcome: <strong>{market.outcome === 0 ? "YES" : "NO"}</strong>
          </span>
          <span className="confidence-badge">{(market.confidence / 100).toFixed(0)}% confidence</span>
        </div>
      )}

      {/* Action Panels */}
      {provider && account && (
        <div className="detail-actions">
          {/* Bet Panel (active markets only) */}
          <BetPanel
            provider={provider}
            marketId={marketId}
            isActive={isActive}
            onUpdate={onUpdate}
          />

          {/* Request Settlement (active markets only) */}
          <RequestSettlement
            provider={provider}
            marketId={marketId}
            market={market}
            onUpdate={onUpdate}
          />

          {/* Dispute Panel (settled markets) */}
          <DisputePanel
            provider={provider}
            marketId={marketId}
            market={market}
            onUpdate={onUpdate}
          />

          {/* Claim Panel (settled markets with user prediction) */}
          <ClaimPanel
            provider={provider}
            account={account}
            marketId={marketId}
            market={market}
            onUpdate={onUpdate}
          />
        </div>
      )}

      {!provider && !market.settled && (
        <div className="connect-notice">
          Connect your wallet to place predictions and request settlements.
        </div>
      )}

      {/* Settlement Explorer (settled markets) */}
      <SettlementExplorer market={market} marketId={marketId} />
    </div>
  );
}
