import { useState, useMemo } from "react";
import type { Market } from "./contract";
import { usePriceData } from "./hooks/usePriceData";

interface SettlePreviewProps {
  market: Market;
}

interface AIResult {
  outcome: string;
  confidence: number;
  reasoning: string;
}

function formatUsd(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

async function callGeminiPreview(market: Market, avgPrice?: number): Promise<AIResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const isPriceMarket = market.targetPrice > 0n;
  const targetPriceUsd = Number(market.targetPrice) / 1e6;

  const prompt = isPriceMarket
    ? `You are a prediction market settlement oracle. Analyze this market and predict the settlement outcome.

Market question: "${market.question}"
Asset: ${market.asset}
Target price: $${targetPriceUsd.toLocaleString()}
Current average price from oracles: $${avgPrice?.toFixed(2) ?? "unknown"}
Price difference from target: ${avgPrice ? ((Math.abs(avgPrice - targetPriceUsd) / targetPriceUsd) * 100).toFixed(2) : "unknown"}%

This is a borderline case (within 5% of target). Would you settle this market YES or NO?
Respond with ONLY valid JSON: {"outcome":"YES" or "NO","confidence":0-100,"reasoning":"1-2 sentence explanation"}`
    : `You are a prediction market settlement oracle with access to current world knowledge.

Market question: "${market.question}"

Research this question using your knowledge of current events and news. Determine if this event has occurred or is likely to occur within the market's timeframe.

Respond with ONLY valid JSON: {"outcome":"YES" or "NO","confidence":0-100,"reasoning":"1-2 sentence explanation citing specific evidence or news"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) throw new Error("Gemini API unavailable");

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    outcome: String(parsed.outcome).toUpperCase(),
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence))),
    reasoning: String(parsed.reasoning || "No reasoning provided"),
  };
}

// SVG confidence gauge component
function ConfidenceGauge({ confidence, outcome }: { confidence: number; outcome: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (confidence / 100) * circumference;
  const color = outcome === "YES" ? "#22c55e" : "#ef4444";

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="confidence-gauge-svg">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
      <circle
        cx="50" cy="50" r={radius}
        fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
        strokeDashoffset={circumference * 0.25}
        style={{ transition: "stroke-dasharray 1s ease-out" }}
      />
      <text x="50" y="46" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
        {confidence}%
      </text>
      <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10">
        confidence
      </text>
    </svg>
  );
}

export function SettlePreview({ market }: SettlePreviewProps) {
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isPriceMarket = market.targetPrice > 0n;
  const assets = useMemo(() => (isPriceMarket ? [market.asset] : []), [isPriceMarket, market.asset]);
  const prices = usePriceData(assets);
  const priceData = prices[0] ?? null;

  // Don't render for settled markets
  if (market.settled) return null;

  const targetPriceUsd = Number(market.targetPrice) / 1e6;
  const geckoPrice = priceData?.coingecko ?? null;
  const capPrice = priceData?.coincap ?? null;

  // Dual-source consensus
  const avgPrice =
    geckoPrice !== null && capPrice !== null
      ? (geckoPrice + capPrice) / 2
      : geckoPrice ?? capPrice ?? null;

  const sourceDivergence =
    geckoPrice !== null && capPrice !== null
      ? (Math.abs(geckoPrice - capPrice) / ((geckoPrice + capPrice) / 2)) * 100
      : null;

  const targetDelta =
    avgPrice !== null && targetPriceUsd > 0
      ? (Math.abs(avgPrice - targetPriceUsd) / targetPriceUsd) * 100
      : null;

  const isBorderline = targetDelta !== null && targetDelta <= 5;
  const isDivergenceWarning = sourceDivergence !== null && sourceDivergence >= 2;

  // Predicted outcome for price markets (>5% threshold)
  let predictedOutcome: string | null = null;
  let predictedConfidence: number | null = null;
  if (isPriceMarket && avgPrice !== null && targetDelta !== null && targetDelta > 5) {
    predictedOutcome = avgPrice >= targetPriceUsd ? "YES" : "NO";
    predictedConfidence = 100;
  }

  const handleAiDryRun = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await callGeminiPreview(market, avgPrice ?? undefined);
      setAiResult(result);
    } catch (err: any) {
      setAiError(err.message || "AI request failed");
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Event Market ───
  if (!isPriceMarket) {
    return (
      <div className="settle-preview event-preview">
        <h3 className="preview-title">
          If Settled Now...
        </h3>
        <p className="preview-subtitle">
          Simulates CRE's event market pipeline — AI analyzes news instead of price feeds
        </p>

        {/* Resolution Path */}
        <div className="preview-path">
          <div className="path-step path-done">
            <div className="path-dot" />
            <span>Event Market Detected</span>
            <span className="path-note">Price oracles skipped</span>
          </div>
          <div className="path-line" />
          <div className={`path-step ${aiResult ? "path-done" : aiLoading ? "path-active" : "path-pending"}`}>
            <div className="path-dot" />
            <span>AI + Google Search</span>
            <span className="path-note">Analyzing real-world evidence</span>
          </div>
          <div className="path-line" />
          <div className={`path-step ${aiResult ? "path-done" : "path-pending"}`}>
            <div className="path-dot" />
            <span>Verdict</span>
            <span className="path-note">Outcome + confidence</span>
          </div>
        </div>

        {/* AI Button */}
        {!aiResult && !aiLoading && (
          <button className="preview-ai-btn pulse-btn" onClick={handleAiDryRun}>
            Ask AI Oracle
          </button>
        )}

        {/* Loading State */}
        {aiLoading && (
          <div className="preview-searching">
            <div className="searching-spinner" />
            <span>Searching real-world news...</span>
          </div>
        )}

        {/* AI Error */}
        {aiError && (
          <div className="preview-error">
            {aiError}
            <button className="preview-retry-btn" onClick={handleAiDryRun}>Retry</button>
          </div>
        )}

        {/* AI Result */}
        {aiResult && (
          <div className="preview-ai-result">
            <div className="ai-result-main">
              <div className={`ai-outcome ${aiResult.outcome === "YES" ? "outcome-yes" : "outcome-no"}`}>
                {aiResult.outcome}
              </div>
              <ConfidenceGauge confidence={aiResult.confidence} outcome={aiResult.outcome} />
            </div>
            <p className="preview-reasoning">{aiResult.reasoning}</p>
            <div className="preview-source-tag">Gemini 2.0 Flash + Google Search grounding</div>
            <button className="preview-retry-btn" onClick={handleAiDryRun}>Re-analyze</button>
          </div>
        )}
      </div>
    );
  }

  // ─── Price Market ───
  return (
    <div className="settle-preview price-preview">
      <h3 className="preview-title">
        If Settled Now...
      </h3>
      <p className="preview-subtitle">
        Live dual-source price check — mirrors CRE's settlement pipeline
      </p>

      {/* Live Prices */}
      <div className="preview-prices">
        <div className="price-source">
          <span className="source-label">CoinGecko</span>
          <span className="source-price">
            {priceData?.loading ? "Loading..." : geckoPrice !== null ? formatUsd(geckoPrice) : "N/A"}
          </span>
        </div>
        <div className="price-source">
          <span className="source-label">CryptoCompare</span>
          <span className="source-price">
            {priceData?.loading ? "Loading..." : capPrice !== null ? formatUsd(capPrice) : "N/A"}
          </span>
        </div>
      </div>

      {/* Source Consensus */}
      {sourceDivergence !== null && (
        <div className={`preview-consensus ${isDivergenceWarning ? "consensus-warn" : "consensus-pass"}`}>
          <span className="consensus-label">Source Divergence</span>
          <span className="consensus-value">
            {sourceDivergence.toFixed(2)}%
            {isDivergenceWarning
              ? " — above 2% threshold (CRE would reject)"
              : " — within 2% threshold"}
          </span>
        </div>
      )}

      {/* Target Delta */}
      {targetDelta !== null && avgPrice !== null && (
        <div className="preview-delta">
          <span className="delta-label">vs Target ({formatUsd(targetPriceUsd)})</span>
          <span className={`delta-value ${targetDelta > 5 ? "delta-clear" : "delta-borderline"}`}>
            {avgPrice >= targetPriceUsd ? "+" : "-"}{targetDelta.toFixed(2)}%
            {targetDelta > 5 ? " — clear result" : " — borderline (≤5%)"}
          </span>
        </div>
      )}

      {/* Predicted Outcome (>5% = direct) */}
      {predictedOutcome && predictedConfidence && !isDivergenceWarning && (
        <div className={`preview-verdict ${predictedOutcome === "YES" ? "verdict-yes" : "verdict-no"}`}>
          <span className="verdict-label">CRE would settle</span>
          <span className="verdict-outcome">{predictedOutcome}</span>
          <span className="verdict-detail">100% confidence — direct settlement, no AI needed</span>
        </div>
      )}

      {/* Divergence rejection */}
      {isDivergenceWarning && (
        <div className="preview-verdict verdict-reject">
          <span className="verdict-label">CRE would</span>
          <span className="verdict-outcome">REJECT</span>
          <span className="verdict-detail">Source disagreement too high — settlement blocked</span>
        </div>
      )}

      {/* Borderline — AI dry run */}
      {isBorderline && !isDivergenceWarning && (
        <div className="preview-borderline">
          <div className="borderline-notice">
            Within 5% threshold — CRE would consult Gemini AI
          </div>

          {!aiResult && !aiLoading && (
            <button className="preview-ai-btn pulse-btn" onClick={handleAiDryRun}>
              AI Dry-Run
            </button>
          )}

          {aiLoading && (
            <div className="preview-searching">
              <div className="searching-spinner" />
              <span>Consulting Gemini AI...</span>
            </div>
          )}

          {aiError && (
            <div className="preview-error">
              {aiError}
              <button className="preview-retry-btn" onClick={handleAiDryRun}>Retry</button>
            </div>
          )}

          {aiResult && (
            <div className="preview-ai-result">
              <div className="ai-result-main">
                <div className={`ai-outcome ${aiResult.outcome === "YES" ? "outcome-yes" : "outcome-no"}`}>
                  {aiResult.outcome}
                </div>
                <ConfidenceGauge confidence={aiResult.confidence} outcome={aiResult.outcome} />
              </div>
              <p className="preview-reasoning">{aiResult.reasoning}</p>
              {aiResult.confidence < 60 && (
                <div className="low-confidence-notice">
                  Below 60% threshold — CRE would reject settlement
                </div>
              )}
              <button className="preview-retry-btn" onClick={handleAiDryRun}>Re-analyze</button>
            </div>
          )}
        </div>
      )}

      {/* Refresh indicator */}
      <div className="preview-refresh-note">
        Prices auto-refresh every 30s
      </div>
    </div>
  );
}
