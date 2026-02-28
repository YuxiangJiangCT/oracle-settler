import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "./contract";
import type { Market, UserPrediction } from "./contract";

interface ClaimPanelProps {
  provider: ethers.BrowserProvider;
  account: string;
  marketId: number;
  market: Market;
  onUpdate: () => void;
}

const CONFETTI_COLORS = ["#6366f1", "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#22d3ee"];

export function ClaimPanel({ provider, account, marketId, market, onUpdate }: ClaimPanelProps) {
  const [prediction, setPrediction] = useState<UserPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    loadPrediction();
  }, [marketId, account]);

  const loadPrediction = async () => {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, provider);
      const p = await contract.getPrediction(marketId, account);
      setPrediction({
        amount: p[0],
        prediction: Number(p[1]),
        claimed: p[2],
      });
    } catch {
      setPrediction(null);
    }
  };

  if (!market.settled || !prediction || prediction.amount === 0n) return null;

  const isWinner = prediction.prediction === market.outcome;
  const totalPool = market.totalYesPool + market.totalNoPool;
  const winningPool = market.outcome === 0 ? market.totalYesPool : market.totalNoPool;
  const payout = winningPool > 0n
    ? (prediction.amount * totalPool) / winningPool
    : 0n;

  const claim = async () => {
    setLoading(true);
    setTxStatus("Claiming winnings...");

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const tx = await contract.claim(marketId);
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Claimed!");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      onUpdate();
      setTimeout(() => onUpdate(), 2000);
      loadPrediction();
    } catch (err: any) {
      if (err.code === "ACTION_REJECTED") {
        setTxStatus("Transaction cancelled");
      } else {
        setTxStatus(`Error: ${err.reason || err.message}`);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(""), 4000);
    }
  };

  return (
    <div className="claim-panel">
      <h3 className="section-title">Your Prediction</h3>

      <div className="prediction-summary">
        <div className="prediction-row">
          <span>Your bet</span>
          <span className={prediction.prediction === 0 ? "yes-label" : "no-label"}>
            {prediction.prediction === 0 ? "YES" : "NO"} — {ethers.formatEther(prediction.amount)} ETH
          </span>
        </div>
        <div className="prediction-row">
          <span>Outcome</span>
          <span className={market.outcome === 0 ? "yes-label" : "no-label"}>
            {market.outcome === 0 ? "YES" : "NO"}
          </span>
        </div>
        <div className="prediction-row">
          <span>Status</span>
          <span className={isWinner ? "yes-label" : "no-label"}>
            {isWinner ? "Winner!" : "Lost"}
          </span>
        </div>
        {isWinner && (
          <div className="prediction-row">
            <span>Payout</span>
            <span className="yes-label">{ethers.formatEther(payout)} ETH</span>
          </div>
        )}
      </div>

      {isWinner && !prediction.claimed && (
        <button className="claim-btn" onClick={claim} disabled={loading}>
          {loading ? "Claiming..." : `Claim ${ethers.formatEther(payout)} ETH`}
        </button>
      )}

      {prediction.claimed && (
        <div className="tx-status" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)", color: "#4ade80" }}>
          Already claimed
        </div>
      )}

      {txStatus && <div className="tx-status">{txStatus}</div>}

      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${10 + Math.random() * 80}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1.5 + Math.random() * 1}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
