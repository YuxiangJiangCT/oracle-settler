import { useState } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "./contract";

interface CreateMarketProps {
  provider: ethers.BrowserProvider;
  onCreated: () => void;
}

export function CreateMarket({ provider, onCreated }: CreateMarketProps) {
  const [question, setQuestion] = useState("");
  const [asset, setAsset] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  const presets = [
    { label: "BTC > $100K", question: "Will Bitcoin exceed $100,000?", asset: "bitcoin", price: "100000" },
    { label: "ETH > $5K", question: "Will Ethereum exceed $5,000?", asset: "ethereum", price: "5000" },
    { label: "SOL > $200", question: "Will Solana exceed $200?", asset: "solana", price: "200" },
  ];

  const createMarket = async () => {
    if (!question || !asset || !targetPrice) return;

    setLoading(true);
    setTxStatus("Creating market...");

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const priceBigInt = BigInt(Math.round(parseFloat(targetPrice) * 1e6));
      const tx = await contract.createMarket(question, asset, priceBigInt);
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Market created!");
      setQuestion("");
      setAsset("");
      setTargetPrice("");
      onCreated();
    } catch (err: any) {
      if (err.code === "ACTION_REJECTED") {
        setTxStatus("Transaction cancelled");
      } else {
        setTxStatus(`Error: ${err.reason || err.message}`);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(""), 5000);
    }
  };

  return (
    <div className="create-market-section">
      <h2 className="section-title">Create Market</h2>
      <p className="create-subtitle">
        Deploy a new prediction market on-chain. CRE will automatically settle it using
        CoinGecko price data and Gemini AI.
      </p>

      {/* Presets */}
      <div className="presets">
        <span className="presets-label">Quick presets:</span>
        <div className="preset-buttons">
          {presets.map((p) => (
            <button
              key={p.label}
              className="preset-btn"
              onClick={() => {
                setQuestion(p.question);
                setAsset(p.asset);
                setTargetPrice(p.price);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="create-form">
        <div className="form-field">
          <label className="field-label">Question</label>
          <input
            type="text"
            className="field-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will Bitcoin exceed $100,000 by March 2025?"
            disabled={loading}
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="field-label">Asset (CoinGecko ID)</label>
            <input
              type="text"
              className="field-input"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="bitcoin"
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Target Price (USD)</label>
            <input
              type="text"
              className="field-input"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="100000"
              disabled={loading}
            />
          </div>
        </div>

        <button
          className="create-btn"
          onClick={createMarket}
          disabled={loading || !question || !asset || !targetPrice}
        >
          {loading ? "Creating..." : "Create Market"}
        </button>
      </div>

      {txStatus && <div className="tx-status">{txStatus}</div>}

      <div className="create-note">
        Markets are settled by Chainlink CRE using 3 triggers: Log (on-demand),
        Cron (automatic scan), and HTTP (price oracle). Settlement uses CoinGecko
        for price data with Gemini AI as a fallback for borderline cases.
      </div>
    </div>
  );
}
