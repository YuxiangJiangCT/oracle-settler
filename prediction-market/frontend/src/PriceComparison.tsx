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
  const settledMarkets = markets.filter((m) => m.data.settled);
  const priceMarkets = settledMarkets.filter((m) => m.data.targetPrice > 0n);
  const eventMarkets = settledMarkets.filter((m) => m.data.targetPrice === 0n);

  // Only fetch price data for price markets
  const assets = [...new Set(priceMarkets.map((m) => m.data.asset))];
  const prices = usePriceData(assets);

  if (settledMarkets.length === 0) {
    return (
      <div className="comparison-section">
        <h2 className="comparison-title">Settlement Verification</h2>
        <p className="comparison-subtitle">No settled markets to verify yet.</p>
      </div>
    );
  }

  return (
    <div className="comparison-section">
      <h2 className="comparison-title">Settlement Verification</h2>
      <p className="comparison-subtitle">
        Verify CRE oracle settlements independently. Price markets are cross-checked against
        live CoinGecko and CoinCap data. Event markets show the AI verdict and confidence score.
      </p>

      {/* Price Markets Section */}
      {priceMarkets.length > 0 && (
        <>
          <h3 className="comparison-section-heading">Price Markets — Dual-Source Verification</h3>
          <div className="comparison-grid">
            {priceMarkets.map((m) => {
              const priceData = prices.find((p) => p.asset === m.data.asset);
              const settledPriceUsd = Number(m.data.settledPrice) / 1e6;
              const targetPriceUsd = Number(m.data.targetPrice) / 1e6;
              const geckoPrice = priceData?.coingecko ?? null;
              const capPrice = priceData?.coincap ?? null;

              const sourceDivergence = geckoPrice !== null && capPrice !== null
                ? Math.abs(geckoPrice - capPrice) / geckoPrice * 100
                : null;

              const creOutcome = m.data.outcome === 0 ? "YES" : "NO";

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
                          : <span title="CoinGecko API did not return data">N/A</span>}
                      </span>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">CoinCap Live</span>
                      <span className="comp-value">
                        {priceData?.loading
                          ? "Loading..."
                          : capPrice !== null
                          ? formatUsd(capPrice)
                          : <span title="CoinCap API unavailable">N/A</span>}
                      </span>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">Source Divergence</span>
                      <span className={`comp-value ${sourceDivergence !== null && sourceDivergence < 2 ? "highlight-green" : sourceDivergence !== null ? "highlight-yellow" : ""}`}>
                        {sourceDivergence !== null
                          ? `${sourceDivergence.toFixed(2)}% ${sourceDivergence < 2 ? "(within 2% threshold)" : "(above 2% threshold)"}`
                          : <span title="Requires both CoinGecko and CoinCap data">N/A</span>}
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
                          ? <span title="No live price data available">N/A</span>
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
        </>
      )}

      {/* Event Markets Section */}
      {eventMarkets.length > 0 && (
        <>
          <h3 className="comparison-section-heading">Event Markets — AI + Google Search Verification</h3>
          <div className="comparison-grid">
            {eventMarkets.map((m) => {
              const creOutcome = m.data.outcome === 0 ? "YES" : "NO";

              return (
                <div key={m.id} className="comparison-card">
                  <div className="comp-header">
                    <span className="comp-asset">{m.data.asset.toUpperCase().replace(/-/g, " ")}</span>
                    <span className="comp-market">Market #{m.id}</span>
                  </div>

                  <div className="comp-question">{m.data.question}</div>

                  <div className="comp-table">
                    <div className="comp-row">
                      <span className="comp-label">Settlement Method</span>
                      <span className="comp-value highlight-blue">AI + Google Search</span>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">CRE Outcome</span>
                      <span className={`comp-value ${m.data.outcome === 0 ? "highlight-green" : "highlight-red"}`}>
                        {creOutcome}
                      </span>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">AI Confidence</span>
                      <span className="comp-value">{(m.data.confidence / 100).toFixed(0)}%</span>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">Data Source</span>
                      <span className="comp-value">Gemini AI with Google Search grounding</span>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">Verification</span>
                      <span className="comp-value">
                        AI researched real-world evidence to determine outcome
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="comparison-note">
        {priceMarkets.length > 0 && (
          <>Note: Live prices may differ from settlement prices because markets have already been
          settled. The CRE oracle captured the price at settlement time via Confidential HTTP. </>
        )}
        {eventMarkets.length > 0 && (
          <>Event markets are settled by Gemini AI with Google Search grounding — a completely different
          CRE pipeline that analyzes real-world news and evidence.</>
        )}
      </div>
    </div>
  );
}
