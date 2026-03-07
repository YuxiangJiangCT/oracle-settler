import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  PREDICTION_MARKET_ABI,
  CONTRACT_ADDRESS,
  PARLAY_ENGINE_ABI,
  PARLAY_ENGINE_ADDRESS,
  SEPOLIA,
} from "./contract";
import type { Market, Parlay, ParlayLeg } from "./contract";

interface ParlayPageProps {
  provider: ethers.BrowserProvider | null;
  account: string | null;
}

interface SlipEntry {
  marketId: number;
  market: Market;
  prediction: number; // 0=YES, 1=NO
}

export function ParlayPage({ provider, account }: ParlayPageProps) {
  const [markets, setMarkets] = useState<{ id: number; data: Market }[]>([]);
  const [slip, setSlip] = useState<SlipEntry[]>([]);
  const [stakeInput, setStakeInput] = useState("0.005");
  const [creating, setCreating] = useState(false);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  const [myParlays, setMyParlays] = useState<
    { id: number; parlay: Parlay; legs: ParlayLeg[] }[]
  >([]);
  const [loadingParlays, setLoadingParlays] = useState(true);
  const [actionParlayId, setActionParlayId] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  useEffect(() => {
    loadActiveMarkets();
  }, [provider]);

  useEffect(() => {
    if (account) loadMyParlays();
  }, [provider, account]);

  const loadActiveMarkets = async () => {
    setLoadingMarkets(true);
    try {
      const rpc = provider || new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, rpc);
      const nextId = await contract.getNextMarketId();
      const count = Number(nextId);
      const loaded: { id: number; data: Market }[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const m = await contract.getMarket(i);
          loaded.push({
            id: i,
            data: {
              creator: m[0],
              createdAt: Number(m[1]),
              settledAt: Number(m[2]),
              deadline: Number(m[3]),
              settled: m[4],
              confidence: Number(m[5]),
              outcome: Number(m[6]),
              totalYesPool: m[7],
              totalNoPool: m[8],
              question: m[9],
              asset: m[10],
              targetPrice: m[11],
              settledPrice: m[12],
            },
          });
        } catch {
          /* skip */
        }
      }
      setMarkets(loaded);
    } catch (err) {
      console.error("Failed to load markets:", err);
    } finally {
      setLoadingMarkets(false);
    }
  };

  const loadMyParlays = async () => {
    if (!account) return;
    setLoadingParlays(true);
    try {
      const rpc = provider || new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
      const parlayContract = new ethers.Contract(
        PARLAY_ENGINE_ADDRESS,
        PARLAY_ENGINE_ABI,
        rpc
      );
      const nextId = await parlayContract.getNextParlayId();
      const count = Number(nextId);
      const loaded: { id: number; parlay: Parlay; legs: ParlayLeg[] }[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const p = await parlayContract.getParlay(i);
          if (p[0].toLowerCase() !== account.toLowerCase()) continue;

          const parlay: Parlay = {
            creator: p[0],
            createdAt: Number(p[1]),
            stake: p[2],
            potentialPayout: p[3],
            legCount: Number(p[4]),
            settled: p[5],
            won: p[6],
            voided: p[7],
            claimed: p[8],
          };

          const rawLegs = await parlayContract.getParlayLegs(i);
          const legs: ParlayLeg[] = rawLegs.map((l: any) => ({
            marketId: l[0],
            prediction: Number(l[1]),
            multiplierBps: l[2],
          }));

          loaded.push({ id: i, parlay, legs });
        } catch {
          /* skip */
        }
      }
      setMyParlays(loaded);
    } catch (err) {
      console.error("Failed to load parlays:", err);
    } finally {
      setLoadingParlays(false);
    }
  };

  const calcLegMultiplier = (market: Market, prediction: number): number => {
    const totalPool = Number(market.totalYesPool + market.totalNoPool);
    const selectedPool =
      prediction === 0 ? Number(market.totalYesPool) : Number(market.totalNoPool);
    if (selectedPool === 0) return 2.0;
    return totalPool / selectedPool;
  };

  const combinedMultiplier = slip.reduce(
    (acc, entry) => acc * calcLegMultiplier(entry.market, entry.prediction),
    1
  );
  const stakeEth = parseFloat(stakeInput) || 0;
  const potentialPayout = stakeEth * combinedMultiplier;

  const toggleMarket = (marketId: number, market: Market) => {
    const existing = slip.find((s) => s.marketId === marketId);
    if (existing) {
      setSlip(slip.filter((s) => s.marketId !== marketId));
    } else if (slip.length < 5) {
      setSlip([...slip, { marketId, market, prediction: 0 }]);
    }
  };

  const setPrediction = (marketId: number, prediction: number) => {
    setSlip(
      slip.map((s) => (s.marketId === marketId ? { ...s, prediction } : s))
    );
  };

  const createParlay = async () => {
    if (!provider || !account || slip.length < 2) return;
    setCreating(true);
    setTxStatus("Creating parlay...");
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PARLAY_ENGINE_ADDRESS,
        PARLAY_ENGINE_ABI,
        signer
      );
      const marketIds = slip.map((s) => s.marketId);
      const predictions = slip.map((s) => s.prediction);
      const stakeWei = ethers.parseEther(stakeInput);

      const tx = await contract.createParlay(marketIds, predictions, {
        value: stakeWei,
      });
      setTxStatus("Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Parlay created!");
      setSlip([]);
      setStakeInput("0.005");
      loadMyParlays();
      setTimeout(() => setTxStatus(null), 3000);
    } catch (err: any) {
      setTxStatus(
        `Error: ${err.reason || err.message || "Transaction failed"}`
      );
      setTimeout(() => setTxStatus(null), 5000);
    } finally {
      setCreating(false);
    }
  };

  const requestSettlement = async (parlayId: number) => {
    if (!provider) return;
    setActionParlayId(parlayId);
    setTxStatus("Requesting settlement...");
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PARLAY_ENGINE_ADDRESS,
        PARLAY_ENGINE_ABI,
        signer
      );
      const tx = await contract.requestParlaySettlement(parlayId);
      await tx.wait();
      setTxStatus("Settlement requested! CRE will process automatically.");
      loadMyParlays();
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: any) {
      setTxStatus(`Error: ${err.reason || err.message}`);
      setTimeout(() => setTxStatus(null), 5000);
    } finally {
      setActionParlayId(null);
    }
  };

  const claimWinnings = async (parlayId: number) => {
    if (!provider) return;
    setActionParlayId(parlayId);
    setTxStatus("Claiming winnings...");
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PARLAY_ENGINE_ADDRESS,
        PARLAY_ENGINE_ABI,
        signer
      );
      const tx = await contract.claimParlayWinnings(parlayId);
      await tx.wait();
      setTxStatus("Winnings claimed!");
      loadMyParlays();
      setTimeout(() => setTxStatus(null), 3000);
    } catch (err: any) {
      setTxStatus(`Error: ${err.reason || err.message}`);
      setTimeout(() => setTxStatus(null), 5000);
    } finally {
      setActionParlayId(null);
    }
  };

  const activeMarkets = markets.filter(
    (m) => !m.data.settled && !(m.data.deadline > 0 && Date.now() / 1000 > m.data.deadline)
  );

  const getParlayStatus = (
    p: Parlay
  ): { label: string; className: string } => {
    if (!p.settled) return { label: "Pending", className: "status-pending" };
    if (p.voided) return { label: "Voided", className: "status-voided" };
    if (p.won)
      return {
        label: p.claimed ? "Claimed" : "Won",
        className: "status-won",
      };
    return { label: "Lost", className: "status-lost" };
  };

  return (
    <div className="parlay-page">
      <div className="page-header">
        <h1>Parlay Builder</h1>
        <span className="market-count">Combine 2-5 predictions into one bet</span>
      </div>

      {txStatus && (
        <div
          className={`parlay-tx-status ${txStatus.startsWith("Error") ? "error" : ""}`}
        >
          {txStatus}
        </div>
      )}

      {/* ── Builder ────────────────────────────────── */}
      <div className="parlay-builder">
        {/* Market Selection */}
        <div className="parlay-markets-section">
          <h3 className="parlay-section-title">Select Markets</h3>
          {loadingMarkets ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Loading markets...</p>
            </div>
          ) : activeMarkets.length === 0 ? (
            <p className="parlay-empty">No active markets available</p>
          ) : (
            <div className="parlay-market-grid">
              {activeMarkets.map((m) => {
                const inSlip = slip.some((s) => s.marketId === m.id);
                return (
                  <div
                    key={m.id}
                    className={`parlay-market-card ${inSlip ? "selected" : ""}`}
                    onClick={() => toggleMarket(m.id, m.data)}
                  >
                    <div className="pmc-header">
                      <span className="pmc-id">#{m.id}</span>
                      <span className="pmc-asset">
                        {m.data.asset.toUpperCase()}
                      </span>
                    </div>
                    <div className="pmc-question">{m.data.question}</div>
                    <div className="pmc-pool">
                      Pool:{" "}
                      {ethers.formatEther(
                        m.data.totalYesPool + m.data.totalNoPool
                      )}{" "}
                      ETH
                    </div>
                    {inSlip && <div className="pmc-check">&#10003;</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Parlay Slip */}
        <div className="parlay-slip-section">
          <h3 className="parlay-section-title">
            Parlay Slip ({slip.length}/5)
          </h3>

          {slip.length === 0 ? (
            <p className="parlay-empty">
              Click markets above to add legs
            </p>
          ) : (
            <div className="parlay-slip-legs">
              {slip.map((entry, idx) => {
                const mult = calcLegMultiplier(
                  entry.market,
                  entry.prediction
                );
                return (
                  <div key={entry.marketId} className="slip-leg">
                    <div className="slip-leg-header">
                      <span className="slip-leg-num">Leg {idx + 1}</span>
                      <span className="slip-leg-mult">
                        {mult.toFixed(2)}x
                      </span>
                      <button
                        className="slip-leg-remove"
                        onClick={() =>
                          toggleMarket(entry.marketId, entry.market)
                        }
                      >
                        &times;
                      </button>
                    </div>
                    <div className="slip-leg-question">
                      {entry.market.question}
                    </div>
                    <div className="slip-leg-direction">
                      <button
                        className={`dir-btn ${entry.prediction === 0 ? "active-yes" : ""}`}
                        onClick={() =>
                          setPrediction(entry.marketId, 0)
                        }
                      >
                        YES
                      </button>
                      <button
                        className={`dir-btn ${entry.prediction === 1 ? "active-no" : ""}`}
                        onClick={() =>
                          setPrediction(entry.marketId, 1)
                        }
                      >
                        NO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {slip.length >= 2 && (
            <div className="parlay-summary">
              <div className="parlay-odds-row">
                <span>Combined Odds</span>
                <span className="parlay-odds-value">
                  {combinedMultiplier.toFixed(2)}x
                </span>
              </div>

              <div className="parlay-stake-row">
                <label>Stake (ETH)</label>
                <div className="stake-input-group">
                  <input
                    type="number"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="stake-input"
                  />
                  <div className="stake-quick-btns">
                    {["0.001", "0.005", "0.01"].map((val) => (
                      <button
                        key={val}
                        className="stake-quick"
                        onClick={() => setStakeInput(val)}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="parlay-payout-row">
                <span>Potential Payout</span>
                <span className="parlay-payout-value">
                  {potentialPayout.toFixed(4)} ETH
                </span>
              </div>

              <button
                className="parlay-create-btn"
                onClick={createParlay}
                disabled={creating || !account || slip.length < 2}
              >
                {creating
                  ? "Creating..."
                  : !account
                    ? "Connect Wallet"
                    : `Create ${slip.length}-Leg Parlay`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── My Parlays ─────────────────────────────── */}
      {account && (
        <div className="my-parlays-section">
          <h2 className="parlay-section-title" style={{ marginBottom: 16 }}>
            My Parlays
          </h2>
          {loadingParlays ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Loading parlays...</p>
            </div>
          ) : myParlays.length === 0 ? (
            <p className="parlay-empty">
              No parlays yet. Create your first combo bet above!
            </p>
          ) : (
            <div className="my-parlays-grid">
              {myParlays.map(({ id, parlay, legs }) => {
                const status = getParlayStatus(parlay);
                const allLegsSettled = legs.every((leg) => {
                  const m = markets.find(
                    (mk) => mk.id === Number(leg.marketId)
                  );
                  return m?.data.settled;
                });

                return (
                  <div key={id} className={`parlay-card ${status.className}`}>
                    <div className="parlay-card-header">
                      <span className="parlay-card-id">Parlay #{id}</span>
                      <span
                        className={`parlay-status-badge ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="parlay-card-legs">
                      {legs.map((leg, idx) => {
                        const m = markets.find(
                          (mk) => mk.id === Number(leg.marketId)
                        );
                        const multiplier =
                          Number(leg.multiplierBps) / 10000;
                        return (
                          <div key={idx} className="parlay-card-leg">
                            <span className="pcl-num">Leg {idx + 1}</span>
                            <span className="pcl-question">
                              {m
                                ? m.data.question
                                : `Market #${leg.marketId}`}
                            </span>
                            <span
                              className={`pcl-direction ${leg.prediction === 0 ? "yes" : "no"}`}
                            >
                              {leg.prediction === 0 ? "YES" : "NO"}
                            </span>
                            <span className="pcl-mult">
                              {multiplier.toFixed(2)}x
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="parlay-card-footer">
                      <div className="pcf-row">
                        <span>Stake</span>
                        <span>
                          {ethers.formatEther(parlay.stake)} ETH
                        </span>
                      </div>
                      <div className="pcf-row">
                        <span>Potential Payout</span>
                        <span className="pcf-payout">
                          {ethers.formatEther(parlay.potentialPayout)} ETH
                        </span>
                      </div>

                      {!parlay.settled && allLegsSettled && (
                        <button
                          className="parlay-action-btn settle"
                          onClick={() => requestSettlement(id)}
                          disabled={actionParlayId === id}
                        >
                          {actionParlayId === id
                            ? "Requesting..."
                            : "Request Settlement"}
                        </button>
                      )}

                      {parlay.settled &&
                        (parlay.won || parlay.voided) &&
                        !parlay.claimed && (
                          <button
                            className="parlay-action-btn claim"
                            onClick={() => claimWinnings(id)}
                            disabled={actionParlayId === id}
                          >
                            {actionParlayId === id
                              ? "Claiming..."
                              : parlay.voided
                                ? "Claim Refund"
                                : "Claim Winnings"}
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
