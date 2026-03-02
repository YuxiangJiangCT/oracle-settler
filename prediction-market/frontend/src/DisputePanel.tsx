import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "./contract";
import type { Market, Dispute } from "./contract";

interface DisputePanelProps {
  provider: ethers.BrowserProvider;
  marketId: number;
  market: Market;
  onUpdate: () => void;
}

const DISPUTE_STAKE = "0.001"; // 0.001 ETH
const DISPUTE_WINDOW_SECS = 3600; // 1 hour

export function DisputePanel({ provider, marketId, market, onUpdate }: DisputePanelProps) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const simIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadDispute();
  }, [marketId]);

  useEffect(() => {
    if (!market.settled || market.confidence === 0) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const windowEnd = market.settledAt + DISPUTE_WINDOW_SECS;
      setTimeLeft(Math.max(0, windowEnd - now));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [market.settledAt, market.settled, market.confidence]);

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const loadDispute = async () => {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, provider);
      const d = await contract.getDispute(marketId);
      setDispute({
        disputer: d[0],
        filedAt: Number(d[1]),
        stake: d[2],
        resolved: d[3],
        overturned: d[4],
      });
    } catch {
      setDispute(null);
    }
  };

  // Only show for settled, non-cancelled markets
  if (!market.settled || market.confidence === 0) return null;

  const hasDispute = dispute && dispute.disputer !== ethers.ZeroAddress;
  const windowOpen = timeLeft > 0;

  // Simulation computed values
  const simConfidence = market.confidence / 100;
  const simConfirmed = simConfidence >= 70;
  const isEventMarket = market.targetPrice === 0n;
  const outcomeLabel = market.outcome === 0 ? "YES" : "NO";
  const settledPriceUsd = Number(market.settledPrice) / 1e6;

  const simSteps = [
    {
      title: "Dispute Filed",
      detail: `Disputer stakes ${DISPUTE_STAKE} ETH challenging Market #${marketId} (${outcomeLabel} at ${simConfidence.toFixed(0)}% confidence)`,
    },
    {
      title: "CRE Strict Re-verification",
      detail: isEventMarket
        ? "Gemini AI re-querying with strict mode + fresh Google Search grounding"
        : `Re-fetching from CoinGecko + CoinCap with stricter divergence threshold (<1%). Settled: $${settledPriceUsd.toLocaleString()}`,
    },
    {
      title: "AI Re-analysis (Strict Mode)",
      detail: `Gemini 2.0 Flash re-evaluating with elevated confidence threshold (70% required vs 50% normal)`,
    },
    {
      title: "Dispute Resolution",
      detail: simConfirmed
        ? `Original ${outcomeLabel} settlement CONFIRMED — ${simConfidence.toFixed(0)}% confidence meets 70% strict threshold. Dispute stake forfeited.`
        : `Settlement OVERTURNED — ${simConfidence.toFixed(0)}% confidence below 70% strict threshold. Outcome may be corrected. Stake refunded.`,
    },
  ];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const fileDispute = async () => {
    setLoading(true);
    setTxStatus("Filing dispute...");

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const tx = await contract.disputeMarket(marketId, {
        value: ethers.parseEther(DISPUTE_STAKE),
      });
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Dispute filed! CRE will re-verify this market.");
      onUpdate();
      setTimeout(() => onUpdate(), 2000);
      loadDispute();
    } catch (err: any) {
      if (err.code === "ACTION_REJECTED") {
        setTxStatus("Transaction cancelled");
      } else {
        setTxStatus(`Error: ${err.reason || err.message}`);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(""), 6000);
    }
  };

  const startSimulation = () => {
    setSimulating(true);
    setSimStep(0);
    let step = 0;
    simIntervalRef.current = window.setInterval(() => {
      step++;
      setSimStep(step);
      if (step >= simSteps.length) {
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      }
    }, 700);
  };

  const closeSimulation = () => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setSimulating(false);
    setSimStep(0);
  };

  return (
    <div className="dispute-panel">
      <h3 className="section-title">Dispute Arbitration</h3>

      {/* Dispute Window Timer */}
      {windowOpen && !hasDispute && (
        <>
          <div className="dispute-timer">
            <span className="timer-icon">&#9201;</span>
            <span>Dispute window: <strong>{formatTime(timeLeft)}</strong> remaining</span>
          </div>

          <div className="dispute-info">
            <p>
              Think the settlement is wrong? File a dispute to trigger a second-round CRE re-verification
              with stricter confidence thresholds.
            </p>
            <div className="dispute-details">
              <div className="dispute-detail-row">
                <span>Required stake</span>
                <span>{DISPUTE_STAKE} ETH</span>
              </div>
              <div className="dispute-detail-row">
                <span>If overturned</span>
                <span>Stake refunded + outcome corrected</span>
              </div>
              <div className="dispute-detail-row">
                <span>If confirmed</span>
                <span>Stake forfeited (anti-spam)</span>
              </div>
            </div>
          </div>

          <button className="dispute-btn" onClick={fileDispute} disabled={loading}>
            {loading ? "Processing..." : `File Dispute (${DISPUTE_STAKE} ETH)`}
          </button>
        </>
      )}

      {/* Window Closed — No Dispute */}
      {!windowOpen && !hasDispute && (
        <div className="dispute-status resolved">
          Dispute window closed — settlement is final.
        </div>
      )}

      {/* Active Dispute */}
      {hasDispute && !dispute.resolved && (
        <div className="dispute-status active">
          <div className="dispute-status-header">
            <span className="status-dot active-dot" />
            <strong>Dispute Active</strong>
          </div>
          <p>
            CRE is re-verifying this market with stricter dual-source consensus and AI analysis.
            Claims are locked until the dispute is resolved.
          </p>
          <div className="dispute-detail-row">
            <span>Disputer</span>
            <span>{dispute.disputer.slice(0, 6)}...{dispute.disputer.slice(-4)}</span>
          </div>
          <div className="dispute-detail-row">
            <span>Stake</span>
            <span>{ethers.formatEther(dispute.stake)} ETH</span>
          </div>
        </div>
      )}

      {/* Dispute Resolved */}
      {hasDispute && dispute.resolved && (
        <div className={`dispute-status ${dispute.overturned ? "overturned" : "confirmed"}`}>
          <div className="dispute-status-header">
            <span className={`status-dot ${dispute.overturned ? "overturned-dot" : "confirmed-dot"}`} />
            <strong>Dispute {dispute.overturned ? "Overturned" : "Confirmed"}</strong>
          </div>
          <p>
            {dispute.overturned
              ? "CRE re-verification found a different result. The outcome has been corrected and the dispute stake was refunded."
              : "CRE re-verification confirmed the original settlement. The dispute stake was forfeited as anti-spam penalty."}
          </p>
        </div>
      )}

      {/* Simulate Dispute Button */}
      <button className="sim-trigger-btn" onClick={startSimulation}>
        Simulate Dispute
      </button>

      {/* Simulation Modal */}
      {simulating && (
        <div className="sim-overlay" onClick={closeSimulation}>
          <div className="sim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sim-modal-header">
              <h3>Dispute Simulation</h3>
              <button className="sim-close" onClick={closeSimulation}>&times;</button>
            </div>
            <p className="sim-subtitle">
              Simulating what happens if someone disputes Market #{marketId}
            </p>

            <div className="sim-steps">
              {simSteps.map((s, i) => {
                const status = i < simStep ? "complete" : i === simStep ? "active" : "pending";
                return (
                  <div key={i} className={`sim-step sim-step-${status}`}>
                    <div className="sim-step-indicator">
                      <span className={`sim-dot sim-dot-${status}`}>
                        {status === "complete" ? "\u2713" : (i + 1)}
                      </span>
                    </div>
                    <div className="sim-step-content">
                      <span className="sim-step-title">{s.title}</span>
                      {status !== "pending" && (
                        <p className="sim-step-detail">{s.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {simStep >= simSteps.length && (
              <div className={`sim-result ${simConfirmed ? "sim-confirmed" : "sim-overturned"}`}>
                <strong>{simConfirmed ? "Settlement Confirmed" : "Settlement Overturned"}</strong>
                <p>
                  {simConfirmed
                    ? `The original ${outcomeLabel} outcome stands with ${simConfidence.toFixed(0)}% confidence. The disputer's ${DISPUTE_STAKE} ETH stake would be forfeited as anti-spam penalty.`
                    : `The ${outcomeLabel} outcome would be overturned. The disputer's ${DISPUTE_STAKE} ETH stake would be refunded and the market outcome corrected.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {txStatus && <div className="tx-status">{txStatus}</div>}
    </div>
  );
}
