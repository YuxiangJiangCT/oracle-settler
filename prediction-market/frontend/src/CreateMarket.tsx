import { useState } from "react";
import { ethers } from "ethers";
import { IDKitWidget, VerificationLevel } from "@worldcoin/idkit";
import type { ISuccessResult } from "@worldcoin/idkit";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS } from "./contract";

const WORLD_ID_APP_ID = "app_e5fb2e27e8b9d3c7ea376b845676f05a";
const WORLD_ID_ACTION = "create-market";

interface CreateMarketProps {
  provider: ethers.BrowserProvider;
  account: string;
  onCreated: () => void;
}

export function CreateMarket({ provider, account, onCreated }: CreateMarketProps) {
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

  const isFormValid = question && asset && targetPrice;

  const createMarket = async () => {
    if (!isFormValid) return;
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
      resetForm();
      onCreated();
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(""), 5000);
    }
  };

  const createMarketVerified = async (result: ISuccessResult) => {
    if (!isFormValid) return;
    setLoading(true);
    setTxStatus("Creating verified market with World ID proof...");

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const priceBigInt = BigInt(Math.round(parseFloat(targetPrice) * 1e6));

      // Decode ABI-encoded proof values for the contract
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const root = abiCoder.decode(["uint256"], result.merkle_root)[0];
      const nullifierHash = abiCoder.decode(["uint256"], result.nullifier_hash)[0];
      const proof = abiCoder.decode(["uint256[8]"], result.proof)[0];

      const tx = await contract.createMarketVerified(
        question, asset, priceBigInt, root, nullifierHash, proof
      );
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Verified market created! (World ID)");
      resetForm();
      onCreated();
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
      setTimeout(() => setTxStatus(""), 5000);
    }
  };

  const resetForm = () => {
    setQuestion("");
    setAsset("");
    setTargetPrice("");
  };

  const handleError = (err: any) => {
    if (err.code === "ACTION_REJECTED") {
      setTxStatus("Transaction cancelled");
    } else {
      setTxStatus(`Error: ${err.reason || err.message}`);
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

        {/* Action buttons */}
        <div className="create-buttons">
          <button
            className="create-btn"
            onClick={createMarket}
            disabled={loading || !isFormValid}
          >
            {loading ? "Creating..." : "Create Market"}
          </button>

          <IDKitWidget
            app_id={WORLD_ID_APP_ID as `app_${string}`}
            action={WORLD_ID_ACTION}
            signal={account}
            onSuccess={createMarketVerified}
            verification_level={VerificationLevel.Device}
          >
            {({ open }) => (
              <button
                className="create-btn worldid-btn"
                onClick={open}
                disabled={loading || !isFormValid}
              >
                {loading ? "Creating..." : "Create with World ID"}
              </button>
            )}
          </IDKitWidget>
        </div>
      </div>

      {txStatus && <div className="tx-status">{txStatus}</div>}

      <div className="create-note">
        <strong>World ID</strong> adds sybil resistance — each human can only create one verified
        market. Regular market creation remains available for CRE-triggered workflows.
      </div>
    </div>
  );
}
