import type { Market } from "./contract";

interface SettlementExplorerProps {
  market: Market;
  marketId: number;
}

export function SettlementExplorer({ market, marketId }: SettlementExplorerProps) {
  if (!market.settled) return null;

  const isEventMarket = market.targetPrice === 0n;
  const targetPriceUsd = Number(market.targetPrice) / 1e6;
  const settledPriceUsd = Number(market.settledPrice) / 1e6;
  const priceDiff = targetPriceUsd > 0
    ? Math.abs(settledPriceUsd - targetPriceUsd) / targetPriceUsd
    : 0;
  const priceDiffPercent = (priceDiff * 100).toFixed(1);
  const usedAI = isEventMarket || priceDiff <= 0.05;
  const outcomeLabel = market.outcome === 0 ? "YES" : "NO";
  const confidence = market.confidence / 100;
  const direction = settledPriceUsd >= targetPriceUsd ? "above" : "below";

  const steps = [
    {
      num: 1,
      title: "Settlement Requested",
      detail: `Market #${marketId} — SettlementRequested event emitted`,
      capability: "Log Trigger",
      status: "complete" as const,
    },
    {
      num: 2,
      title: "EVM State Read",
      detail: isEventMarket
        ? `Event: ${market.asset} | Type: Event Market`
        : `Asset: ${market.asset} | Target: $${targetPriceUsd.toLocaleString()}`,
      capability: "EVM Read",
      status: "complete" as const,
    },
    ...(isEventMarket
      ? [
          {
            num: 3,
            title: "AI + Google Search",
            detail: `Gemini AI with Google Search grounding — searched real-world news`,
            capability: "Confidential HTTP (AI)",
            status: "complete" as const,
          },
          {
            num: 4,
            title: "Event Verification",
            detail: `AI analyzed news sources to determine if event occurred`,
            capability: "Custom Compute",
            status: "complete" as const,
          },
          {
            num: 5,
            title: "AI Verdict",
            detail: `Event outcome: ${outcomeLabel} (${confidence.toFixed(0)}% confidence)`,
            capability: "Confidential HTTP (AI)",
            status: "complete" as const,
          },
        ]
      : [
          {
            num: 3,
            title: "Dual-Source Price Fetch",
            detail: `Confidential HTTP → CoinGecko: $${settledPriceUsd.toLocaleString()} | CoinCap: cross-validated`,
            capability: "Confidential HTTP (x2)",
            status: "complete" as const,
          },
          {
            num: 4,
            title: "Price Source Consensus",
            detail: `Sources divergence <2% → validated | Diff vs target: ${priceDiffPercent}% ${direction}`,
            capability: "Custom Compute",
            status: "complete" as const,
          },
          ...(priceDiff <= 0.05
            ? [
                {
                  num: 5,
                  title: "AI Analysis (Gemini)",
                  detail: `Price within 5% → Gemini AI consulted for nuanced judgment`,
                  capability: "Confidential HTTP (AI)",
                  status: "complete" as const,
                },
              ]
            : [
                {
                  num: 5,
                  title: "Direct Settlement",
                  detail: `Price ${priceDiffPercent}% ${direction} — clear result, no AI needed`,
                  capability: "Custom Compute",
                  status: "complete" as const,
                },
              ]),
        ]),
    {
      num: 6,
      title: "CRE Consensus",
      detail: "Multi-node consensus on settlement data → Signed Report",
      capability: "Consensus",
      status: "complete" as const,
    },
    {
      num: 7,
      title: "On-Chain Settlement",
      detail: isEventMarket
        ? `EVM Write → settleMarket(${marketId}, ${outcomeLabel}, ${confidence.toFixed(0)}%)`
        : `EVM Write → settleMarket(${marketId}, ${outcomeLabel}, ${confidence.toFixed(0)}%, $${settledPriceUsd.toLocaleString()})`,
      capability: "EVM Write",
      status: "complete" as const,
    },
  ];

  return (
    <div className="explorer-section">
      <h3 className="section-title">
        CRE Settlement Explorer
      </h3>
      <p className="explorer-subtitle">
        How Chainlink CRE settled this market
      </p>

      <div className="explorer-steps">
        {steps.map((step) => (
          <div key={step.num} className="explorer-step">
            <div className="step-indicator">
              <div className="step-dot complete" />
              {step.num < steps.length && <div className="step-line" />}
            </div>
            <div className="step-content">
              <div className="step-header">
                <span className="step-title">{step.title}</span>
                <span className="step-capability">{step.capability}</span>
              </div>
              <p className="step-detail">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className={`explorer-summary ${market.outcome === 0 ? "yes-outcome" : "no-outcome"}`}>
        <div className="summary-row">
          <span>Outcome</span>
          <strong>{outcomeLabel}</strong>
        </div>
        <div className="summary-row">
          <span>Confidence</span>
          <strong>{confidence.toFixed(0)}%</strong>
        </div>
        {!isEventMarket && (
          <div className="summary-row">
            <span>Settled Price</span>
            <strong>${settledPriceUsd.toLocaleString()}</strong>
          </div>
        )}
        <div className="summary-row">
          <span>Settlement Method</span>
          <strong>{isEventMarket ? "AI + Google Search" : usedAI ? "AI-Assisted" : "Price Oracle"}</strong>
        </div>
        <div className="summary-row">
          <span>{isEventMarket ? "Data Source" : "Price Sources"}</span>
          <strong>{isEventMarket ? "Gemini AI (Google Search grounding)" : "CoinGecko + CoinCap"}</strong>
        </div>
        <div className="summary-row">
          <span>CRE Capabilities Used</span>
          <strong>{isEventMarket ? "7" : usedAI ? "8" : "7"}</strong>
        </div>
      </div>
    </div>
  );
}
