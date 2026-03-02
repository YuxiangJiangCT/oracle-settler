import { useState, useRef, useEffect, useCallback } from "react";
import type { Market } from "./contract";

interface SettlementExplorerProps {
  market: Market;
  marketId: number;
}

export function SettlementExplorer({ market, marketId }: SettlementExplorerProps) {
  // All hooks MUST be before any early return (React Rules of Hooks)
  const [isReplaying, setIsReplaying] = useState(false);
  const [visibleStep, setVisibleStep] = useState(0);
  const [showSummary, setShowSummary] = useState(true);
  const [priceCounter, setPriceCounter] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const isEventMarket = market.targetPrice === 0n;
  const settledPriceUsd = Number(market.settledPrice) / 1e6;

  const startReplay = useCallback(() => {
    setIsReplaying(true);
    setVisibleStep(0);
    setShowSummary(false);
    setPriceCounter(0);

    let currentStep = 0;
    intervalRef.current = window.setInterval(() => {
      currentStep++;
      setVisibleStep(currentStep);

      // Animate price counter for step 3 on price markets
      if (currentStep === 3 && !isEventMarket && settledPriceUsd > 0) {
        const duration = 600;
        const startTime = performance.now();
        const animate = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          setPriceCounter(Math.round(settledPriceUsd * eased));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }

      // 7 steps total — clear when all done
      if (currentStep >= 7) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => {
          setShowSummary(true);
          setIsReplaying(false);
        }, 400);
      }
    }, 1200);
  }, [isEventMarket, settledPriceUsd]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Early return AFTER all hooks
  if (!market.settled) return null;

  const targetPriceUsd = Number(market.targetPrice) / 1e6;
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
    },
    {
      num: 2,
      title: "EVM State Read",
      detail: isEventMarket
        ? `Event: ${market.asset} | Type: Event Market`
        : `Asset: ${market.asset} | Target: $${targetPriceUsd.toLocaleString()}`,
      capability: "EVM Read",
    },
    ...(isEventMarket
      ? [
          {
            num: 3,
            title: "AI + Google Search",
            detail: `Gemini AI with Google Search grounding — searched real-world news`,
            capability: "Confidential HTTP (AI)",
          },
          {
            num: 4,
            title: "Event Verification",
            detail: `AI analyzed news sources to determine if event occurred`,
            capability: "Custom Compute",
          },
          {
            num: 5,
            title: "AI Verdict",
            detail: `Event outcome: ${outcomeLabel} (${confidence.toFixed(0)}% confidence)`,
            capability: "Confidential HTTP (AI)",
          },
        ]
      : [
          {
            num: 3,
            title: "Dual-Source Price Fetch",
            detail: `Confidential HTTP → CoinGecko: $${settledPriceUsd.toLocaleString()} | CoinCap: cross-validated`,
            capability: "Confidential HTTP (x2)",
          },
          {
            num: 4,
            title: "Price Source Consensus",
            detail: `Sources divergence <2% → validated | Diff vs target: ${priceDiffPercent}% ${direction}`,
            capability: "Custom Compute",
          },
          ...(priceDiff <= 0.05
            ? [
                {
                  num: 5,
                  title: "AI Analysis (Gemini)",
                  detail: `Price within 5% → Gemini AI consulted for nuanced judgment`,
                  capability: "Confidential HTTP (AI)",
                },
              ]
            : [
                {
                  num: 5,
                  title: "Direct Settlement",
                  detail: `Price ${priceDiffPercent}% ${direction} — clear result, no AI needed`,
                  capability: "Custom Compute",
                },
              ]),
        ]),
    {
      num: 6,
      title: "CRE Consensus",
      detail: "Multi-node consensus on settlement data → Signed Report",
      capability: "Consensus",
    },
    {
      num: 7,
      title: "On-Chain Settlement",
      detail: isEventMarket
        ? `EVM Write → settleMarket(${marketId}, ${outcomeLabel}, ${confidence.toFixed(0)}%)`
        : `EVM Write → settleMarket(${marketId}, ${outcomeLabel}, ${confidence.toFixed(0)}%, $${settledPriceUsd.toLocaleString()})`,
      capability: "EVM Write",
    },
  ];

  const getStepStatus = (stepNum: number) => {
    if (!isReplaying) return "complete";
    if (stepNum < visibleStep) return "complete";
    if (stepNum === visibleStep) return "active";
    return "pending";
  };

  const getDisplayDetail = (step: typeof steps[0]) => {
    // During replay, animate the price counter for step 3
    if (isReplaying && step.num === 3 && !isEventMarket && step.num === visibleStep) {
      return step.detail.replace(
        /\$[\d,]+/,
        `$${priceCounter.toLocaleString()}`
      );
    }
    return step.detail;
  };

  return (
    <div className="explorer-section">
      <h3 className="section-title">
        CRE Settlement Explorer
      </h3>
      <p className="explorer-subtitle">
        How Chainlink CRE settled this market
      </p>

      <button
        className="replay-btn"
        onClick={startReplay}
        disabled={isReplaying}
      >
        {isReplaying ? "Replaying..." : "Replay Settlement"}
      </button>

      <div className={`explorer-steps ${isReplaying ? "replaying" : ""}`}>
        {steps.map((step, index) => {
          const status = getStepStatus(step.num);
          return (
            <div
              key={step.num}
              className={`explorer-step${isReplaying && status === "pending" ? " step-hidden" : ""}${isReplaying && status === "active" ? " step-revealing" : ""}`}
            >
              <div className="step-indicator">
                <div className={`step-dot ${status}`} />
                {index < steps.length - 1 && <div className="step-line" />}
              </div>
              <div className={`step-content${isReplaying && status === "pending" ? " content-hidden" : ""}`}>
                <div className="step-header">
                  <span className="step-title">{step.title}</span>
                  <span className="step-capability">{step.capability}</span>
                </div>
                <p className="step-detail">{getDisplayDetail(step)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary — hidden during replay, fades in after */}
      {(!isReplaying || showSummary) && (
        <div className={`explorer-summary ${market.outcome === 0 ? "yes-outcome" : "no-outcome"}${showSummary && visibleStep >= steps.length ? " summary-revealing" : ""}`}>
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
      )}

      {/* Settlement Narrative — also hidden during replay */}
      {(!isReplaying || showSummary) && (
        <div className="settlement-narrative">
          <h4 className="narrative-title">Settlement Report</h4>
          <div className="narrative-content">
            {isEventMarket ? (
              <>
                <div className="narrative-line">
                  <span className="narrative-label">Market Type</span>
                  <span>Event Market — no price target, resolved via AI judgment</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Query</span>
                  <span>"{market.question}"</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">AI Model</span>
                  <span>Gemini 2.0 Flash with Google Search grounding</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Verdict</span>
                  <span className={market.outcome === 0 ? "narrative-yes" : "narrative-no"}>
                    {outcomeLabel} — {confidence >= 80 ? "high" : confidence >= 60 ? "moderate" : "low"} confidence ({confidence.toFixed(0)}%)
                  </span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Process</span>
                  <span>AI searched real-world news sources, analyzed evidence, and produced a verdict with confidence score. CRE multi-node consensus signed the report.</span>
                </div>
              </>
            ) : (
              <>
                <div className="narrative-line">
                  <span className="narrative-label">Market Type</span>
                  <span>Price Market — dual-source oracle verification</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Target</span>
                  <span>${targetPriceUsd.toLocaleString()} USD ({market.asset})</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Price Fetched</span>
                  <span>CoinGecko: ${settledPriceUsd.toLocaleString()} | CoinCap: cross-validated</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Source Divergence</span>
                  <span className="narrative-pass">&lt; 2% threshold — sources agree</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Target Delta</span>
                  <span>{priceDiffPercent}% {direction} target ({settledPriceUsd >= targetPriceUsd ? "+" : "-"}${Math.abs(settledPriceUsd - targetPriceUsd).toLocaleString()})</span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Resolution</span>
                  <span>
                    {priceDiff > 0.05
                      ? `Price is ${priceDiffPercent}% ${direction} target (> 5% threshold) — direct settlement, no AI needed`
                      : `Price within 5% of target — Gemini AI consulted for nuanced analysis`}
                  </span>
                </div>
                <div className="narrative-line">
                  <span className="narrative-label">Outcome</span>
                  <span className={market.outcome === 0 ? "narrative-yes" : "narrative-no"}>
                    {outcomeLabel} with {confidence.toFixed(0)}% confidence
                    {confidence === 100 && " (deterministic — clear price threshold)"}
                    {confidence === 75 && " (capped — single source fallback)"}
                  </span>
                </div>
              </>
            )}
            <div className="narrative-footer">
              Settled {new Date(market.settledAt * 1000).toLocaleString()} — CRE signed by multi-node consensus — 1hr dispute window
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
