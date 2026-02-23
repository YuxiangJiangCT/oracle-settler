import { useState } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "./contract";

interface BetPanelProps {
  provider: ethers.BrowserProvider;
  marketId: number;
  isActive: boolean;
  onUpdate: () => void;
}

export function BetPanel({ provider, marketId, isActive, onUpdate }: BetPanelProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  if (!isActive) return null;

  const placeBet = async () => {
    if (selectedOption === null || !betAmount) return;

    setLoading(true);
    setTxStatus("Sending prediction...");

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const value = ethers.parseEther(betAmount);
      const tx = await contract.predict(marketId, selectedOption, { value });
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Prediction placed!");
      setBetAmount("");
      setSelectedOption(null);
      onUpdate();
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
    <div className="bet-section">
      <h3 className="section-title">Place Prediction</h3>

      <div className="option-buttons">
        <button
          className={`option-btn yes ${selectedOption === 0 ? "selected" : ""}`}
          onClick={() => setSelectedOption(0)}
          disabled={loading}
        >
          YES
        </button>
        <button
          className={`option-btn no ${selectedOption === 1 ? "selected" : ""}`}
          onClick={() => setSelectedOption(1)}
          disabled={loading}
        >
          NO
        </button>
      </div>

      <div className="amount-section">
        <label className="amount-label">Amount (ETH)</label>
        <div className="amount-row">
          <input
            type="text"
            className="amount-input"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="0.0"
            disabled={loading}
          />
          <div className="quick-amounts">
            {["0.001", "0.01", "0.05"].map((amt) => (
              <button key={amt} className="quick-btn" onClick={() => setBetAmount(amt)} disabled={loading}>
                {amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="place-bet-btn"
        onClick={placeBet}
        disabled={loading || selectedOption === null || !betAmount || parseFloat(betAmount) <= 0}
      >
        {loading ? "Processing..." : selectedOption === null ? "Select YES or NO" : "Place Prediction"}
      </button>

      {txStatus && <div className="tx-status">{txStatus}</div>}
    </div>
  );
}
