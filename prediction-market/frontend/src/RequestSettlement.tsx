import { useState } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "./contract";
import type { Market } from "./contract";

interface RequestSettlementProps {
  provider: ethers.BrowserProvider;
  marketId: number;
  market: Market;
  onUpdate: () => void;
}

export function RequestSettlement({ provider, marketId, market, onUpdate }: RequestSettlementProps) {
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  // Only show for unsettled markets
  if (market.settled) return null;

  const requestSettlement = async () => {
    setLoading(true);
    setTxStatus("Requesting CRE settlement...");

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const tx = await contract.requestSettlement(marketId);
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Settlement requested! CRE workflow will process this market.");
      onUpdate();
      setTimeout(() => onUpdate(), 2000);
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
    <div className="settlement-section">
      <h3 className="section-title">Request Settlement</h3>
      <p className="settlement-info">
        {market.targetPrice > 0n
          ? "Trigger the Chainlink CRE workflow to settle this market. The oracle will fetch prices from CoinGecko and CryptoCompare, cross-validate, and use Gemini AI for borderline cases."
          : "Trigger the Chainlink CRE workflow to settle this market. The oracle will use Gemini AI with Google Search grounding to research the event and determine the outcome."}
      </p>

      <div className="cre-flow-preview">
        <div className="flow-step">
          <span className="step-num">1</span>
          <span>Emit SettlementRequested event</span>
        </div>
        <div className="flow-step">
          <span className="step-num">2</span>
          <span>CRE Log Trigger captures event</span>
        </div>
        <div className="flow-step">
          <span className="step-num">3</span>
          <span>{market.targetPrice > 0n ? "Confidential HTTP to CoinGecko + CryptoCompare" : "Gemini AI + Google Search grounding"}</span>
        </div>
        <div className="flow-step">
          <span className="step-num">4</span>
          <span>{market.targetPrice > 0n ? "Dual-source consensus + AI fallback" : "AI confidence scoring + evidence analysis"}</span>
        </div>
        <div className="flow-step">
          <span className="step-num">5</span>
          <span>CRE consensus + on-chain write</span>
        </div>
      </div>

      <button
        className="settlement-btn"
        onClick={requestSettlement}
        disabled={loading}
      >
        {loading ? "Processing..." : "Request CRE Settlement"}
      </button>

      {txStatus && <div className="tx-status">{txStatus}</div>}
    </div>
  );
}
