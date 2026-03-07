import { useState, useMemo } from "react";
import { ethers } from "ethers";
import type { Market } from "./contract";
import { usePriceData } from "./hooks/usePriceData";

interface AIAdvisorProps {
  market: Market;
}

interface AdvisorResult {
  probability: number;
  reasoning: string;
  riskLevel: "Low" | "Medium" | "High";
}

interface AdvisorDisplay {
  recommendation: "BET YES" | "BET NO" | "HOLD";
  aiProbability: number;
  marketOdds: number;
  edge: number;
  reasoning: string;
  riskLevel: "Low" | "Medium" | "High";
}

function formatTimeLeft(deadline: number): string {
  const now = Date.now() / 1000;
  const diff = deadline - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}

async function callGeminiAdvisor(
  market: Market,
  marketYesPercent: number,
  avgPrice?: number
): Promise<AdvisorResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const isPriceMarket = market.targetPrice > 0n;
  const targetPriceUsd = Number(market.targetPrice) / 1e6;
  const totalPool = market.totalYesPool + market.totalNoPool;
  const poolETH = Number(ethers.formatEther(totalPool));
  const timeLeft = formatTimeLeft(market.deadline);

  const prompt = isPriceMarket
    ? `You are a prediction market analyst. Analyze this market and estimate the TRUE probability that the outcome will be YES.

Market question: "${market.question}"
Asset: ${market.asset}
Target price: $${targetPriceUsd.toLocaleString()}
Current live price: $${avgPrice?.toFixed(2) ?? "unknown"}
Price vs target: ${avgPrice ? `${((avgPrice - targetPriceUsd) / targetPriceUsd * 100).toFixed(1)}% ${avgPrice >= targetPriceUsd ? "above" : "below"}` : "unknown"}
Current market odds: ${marketYesPercent.toFixed(1)}% YES / ${(100 - marketYesPercent).toFixed(1)}% NO
Pool size: ${poolETH.toFixed(4)} ETH
Time remaining: ${timeLeft}

Based on the current price trajectory and market conditions, estimate the TRUE probability of YES occurring (0-100%). Compare this with the market odds to identify any mispricing.

Respond with ONLY valid JSON: {"probability": <0-100>, "reasoning": "<2-3 sentence analysis>", "riskLevel": "Low" or "Medium" or "High"}`
    : `You are a prediction market analyst with access to current world knowledge.

Market question: "${market.question}"
Current market odds: ${marketYesPercent.toFixed(1)}% YES / ${(100 - marketYesPercent).toFixed(1)}% NO
Pool size: ${poolETH.toFixed(4)} ETH
Time remaining: ${timeLeft}

Research this event using your knowledge of current events and news. Estimate the TRUE probability that the answer is YES (0-100%). Compare with the current market odds to identify any mispricing.

Respond with ONLY valid JSON: {"probability": <0-100>, "reasoning": "<2-3 sentence analysis citing specific evidence>", "riskLevel": "Low" or "Medium" or "High"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
  }

  if (!res || !res.ok) throw new Error(res?.status === 429 ? "Rate limited — please wait a moment and retry" : "Gemini API unavailable");

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    probability: Math.min(100, Math.max(0, Number(parsed.probability))),
    reasoning: String(parsed.reasoning || "No reasoning provided"),
    riskLevel: (["Low", "Medium", "High"].includes(parsed.riskLevel) ? parsed.riskLevel : "Medium") as AdvisorResult["riskLevel"],
  };
}

// Edge comparison bar
function EdgeBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="edge-bar-row">
      <span className="edge-bar-label">{label}</span>
      <div className="edge-bar-track">
        <div
          className="edge-bar-fill"
          style={{ width: `${Math.max(2, percent)}%`, background: color }}
        />
      </div>
      <span className="edge-bar-value" style={{ color }}>{percent.toFixed(1)}%</span>
    </div>
  );
}

export function AIAdvisor({ market }: AIAdvisorProps) {
  const [result, setResult] = useState<AdvisorDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPriceMarket = market.targetPrice > 0n;
  const assets = useMemo(() => (isPriceMarket ? [market.asset] : []), [isPriceMarket, market.asset]);
  const prices = usePriceData(assets);
  const priceData = prices[0] ?? null;

  // Don't render for settled markets
  if (market.settled) return null;

  // Calculate market implied odds
  const totalPool = market.totalYesPool + market.totalNoPool;
  const marketYesPercent = totalPool > 0n
    ? Number((market.totalYesPool * 10000n) / totalPool) / 100
    : 50;

  // Average price from dual sources
  const geckoPrice = priceData?.coingecko ?? null;
  const capPrice = priceData?.coincap ?? null;
  const avgPrice =
    geckoPrice !== null && capPrice !== null
      ? (geckoPrice + capPrice) / 2
      : geckoPrice ?? capPrice ?? undefined;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const aiResult = await callGeminiAdvisor(market, marketYesPercent, avgPrice);

      const edge = aiResult.probability - marketYesPercent;
      let recommendation: AdvisorDisplay["recommendation"];
      if (edge > 10) {
        recommendation = "BET YES";
      } else if (edge < -10) {
        recommendation = "BET NO";
      } else {
        recommendation = "HOLD";
      }

      setResult({
        recommendation,
        aiProbability: aiResult.probability,
        marketOdds: marketYesPercent,
        edge,
        reasoning: aiResult.reasoning,
        riskLevel: aiResult.riskLevel,
      });
    } catch (err: any) {
      setError(err.message || "AI analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (level: string) => {
    if (level === "Low") return "#22c55e";
    if (level === "Medium") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="ai-advisor">
      <h3 className="advisor-title">
        AI Market Advisor
      </h3>
      <p className="advisor-subtitle">
        Gemini AI analyzes market data and identifies mispriced odds
      </p>

      {/* Button */}
      {!result && !loading && (
        <button className="advisor-btn pulse-advisor" onClick={handleAnalyze}>
          Ask AI Advisor
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="advisor-loading">
          <div className="advisor-spinner" />
          <span>Analyzing market data...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="advisor-error">
          {error}
          <button className="advisor-retry-btn" onClick={handleAnalyze}>Retry</button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="advisor-result">
          {/* Recommendation Badge */}
          <div className={`advisor-recommendation rec-${result.recommendation.replace(" ", "-").toLowerCase()}`}>
            {result.recommendation}
          </div>

          {/* Edge Comparison */}
          <div className="edge-comparison">
            <EdgeBar
              label="Market Says"
              percent={result.marketOdds}
              color="rgba(255,255,255,0.5)"
            />
            <EdgeBar
              label="AI Estimates"
              percent={result.aiProbability}
              color={result.edge > 0 ? "#22c55e" : result.edge < 0 ? "#ef4444" : "#94a3b8"}
            />
          </div>

          {/* Edge Indicator */}
          <div className={`edge-indicator ${result.edge > 10 ? "edge-positive" : result.edge < -10 ? "edge-negative" : "edge-neutral"}`}>
            <span className="edge-label">Edge</span>
            <span className="edge-value">
              {result.edge > 0 ? "+" : ""}{result.edge.toFixed(1)}%
              {Math.abs(result.edge) > 10
                ? " — mispricing detected"
                : " — fairly priced"}
            </span>
          </div>

          {/* Risk Level */}
          <div className="advisor-risk">
            <span className="risk-label">Risk</span>
            <span className="risk-badge" style={{ background: riskColor(result.riskLevel) }}>
              {result.riskLevel}
            </span>
          </div>

          {/* Reasoning */}
          <p className="advisor-reasoning">{result.reasoning}</p>

          {/* Source Tag */}
          <div className="advisor-source-tag">Gemini 2.0 Flash — market intelligence analysis</div>

          {/* Re-analyze */}
          <button className="advisor-retry-btn" onClick={handleAnalyze}>Re-analyze</button>
        </div>
      )}
    </div>
  );
}
