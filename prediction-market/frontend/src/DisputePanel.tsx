import { useState, useEffect } from "react";
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

      {txStatus && <div className="tx-status">{txStatus}</div>}
    </div>
  );
}
