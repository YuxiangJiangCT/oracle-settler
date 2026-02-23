import type { Market } from "./contract";
import { usePriceData } from "./hooks/usePriceData";

interface PriceComparisonProps {
  markets: { id: number; data: Market }[];
}

function formatUsd(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${price.toFixed(2)}`;
}

export function PriceComparison({ markets }: PriceComparisonProps) {
  // Get unique assets from settled markets
  const settledMarkets = markets.filter((m) => m.data.settled);
  const assets = [...new Set(settledMarkets.map((m) => m.data.asset))];
  const prices = usePriceData(assets);

  if (settledMarkets.length === 0) {
    return (
      <div className="comparison-section">
        <h2 className="comparison-title">Cross-Platform Price Verification</h2>
        <p className="comparison-subtitle">No settled markets to compare yet.</p>
      </div>
    );
  }

  return (
    <div className="comparison-section">
      <h2 className="comparison-title">Cross-Platform Price Verification</h2>
      <p className="comparison-subtitle">
        Comparing CRE oracle settlements against live CoinGecko data. Our decentralized
        oracle reaches the same conclusions independently — without relying on any centralized platform.
      </p>

      <div className="comparison-grid">
        {settledMarkets.map((m) => {
          const priceData = prices.find((p) => p.asset === m.data.asset);
          const settledPriceUsd = Number(m.data.settledPrice) / 1e6;
          const targetPriceUsd = Number(m.data.targetPrice) / 1e6;
          const geckoPrice = priceData?.coingecko ?? null;
          const capPrice = priceData?.coincap ?? null;

          // Source divergence
          const sourceDivergence = geckoPrice !== null && capPrice !== null
            ? Math.abs(geckoPrice - capPrice) / geckoPrice * 100
            : null;

          // CRE outcome
          const creOutcome = m.data.outcome === 0 ? "YES" : "NO";

          // What live prices would suggest
          let liveOutcome: string | null = null;
          if (geckoPrice !== null && targetPriceUsd > 0) {
            liveOutcome = geckoPrice >= targetPriceUsd ? "YES" : "NO";
          }

          const agrees = liveOutcome !== null && liveOutcome === creOutcome;

          return (
            <div key={m.id} className="comparison-card">
              <div className="comp-header">
                <span className="comp-asset">{m.data.asset.toUpperCase()}</span>
                <span className="comp-market">Market #{m.id}</span>
              </div>

              <div className="comp-question">{m.data.question}</div>

              <div className="comp-table">
                <div className="comp-row">
                  <span className="comp-label">Target Price</span>
                  <span className="comp-value">{formatUsd(targetPriceUsd)}</span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">CRE Settlement Price</span>
                  <span className="comp-value highlight-blue">{formatUsd(settledPriceUsd)}</span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">CoinGecko Live</span>
                  <span className="comp-value">
                    {priceData?.loading
                      ? "Loading..."
                      : geckoPrice !== null
                      ? formatUsd(geckoPrice)
                      : "N/A"}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">CoinCap Live</span>
                  <span className="comp-value">
                    {priceData?.loading
                      ? "Loading..."
                      : capPrice !== null
                      ? formatUsd(capPrice)
                      : "N/A"}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">Source Divergence</span>
                  <span className={`comp-value ${sourceDivergence !== null && sourceDivergence < 2 ? "highlight-green" : sourceDivergence !== null ? "highlight-yellow" : ""}`}>
                    {sourceDivergence !== null
                      ? `${sourceDivergence.toFixed(2)}% ${sourceDivergence < 2 ? "(within 2% threshold)" : "(above 2% threshold)"}`
                      : "N/A"}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">CRE Outcome</span>
                  <span className={`comp-value ${m.data.outcome === 0 ? "highlight-green" : "highlight-red"}`}>
                    {creOutcome}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">Live Verification</span>
                  <span className={`comp-value ${agrees ? "highlight-green" : liveOutcome ? "highlight-yellow" : ""}`}>
                    {liveOutcome === null
                      ? "N/A"
                      : agrees
                      ? "Agrees"
                      : `Now suggests ${liveOutcome} (price moved)`}
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-label">Confidence</span>
                  <span className="comp-value">{(m.data.confidence / 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="comparison-note">
        Note: Live prices may differ from settlement prices because markets have already been
        settled. The CRE oracle captured the price at settlement time via Confidential HTTP.
      </div>
    </div>
  );
}
