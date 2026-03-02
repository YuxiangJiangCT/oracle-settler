import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ABI, CONTRACT_ADDRESS, SEPOLIA } from "../contract";

export interface OddsSnapshot {
  time: string;
  yesPercent: number;
  noPercent: number;
  totalPool: number; // ETH
}

export function useOddsHistory(
  marketId: number,
  provider: ethers.BrowserProvider | null
): { snapshots: OddsSnapshot[]; loading: boolean } {
  const [snapshots, setSnapshots] = useState<OddsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Use connected provider or fallback to public RPC
        const rpcProvider = provider ?? new ethers.JsonRpcProvider(SEPOLIA.rpcUrl);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, rpcProvider);

        // Query all PredictionMade events for this market
        const filter = contract.filters.PredictionMade(marketId);
        const events = await contract.queryFilter(filter);

        if (cancelled) return;

        if (events.length === 0) {
          setSnapshots([]);
          setLoading(false);
          return;
        }

        // Sort by block number then log index
        events.sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
          return a.index - b.index;
        });

        // Get timestamps for unique blocks (batch with concurrency limit)
        const uniqueBlocks = [...new Set(events.map((e) => e.blockNumber))];
        const blockTimestamps = new Map<number, number>();

        // Fetch in batches of 5 to avoid RPC rate limits
        for (let i = 0; i < uniqueBlocks.length; i += 5) {
          const batch = uniqueBlocks.slice(i, i + 5);
          const blocks = await Promise.all(
            batch.map((bn) => rpcProvider.getBlock(bn))
          );
          if (cancelled) return;
          blocks.forEach((block, idx) => {
            if (block) blockTimestamps.set(batch[idx], block.timestamp);
          });
        }

        // Build cumulative snapshots
        let yesPool = 0n;
        let noPool = 0n;
        const result: OddsSnapshot[] = [
          { time: "Start", yesPercent: 50, noPercent: 50, totalPool: 0 },
        ];

        for (const event of events) {
          const log = event as ethers.EventLog;
          const prediction = Number(log.args[2]); // 0 = YES, 1 = NO
          const amount = log.args[3] as bigint;

          if (prediction === 0) {
            yesPool += amount;
          } else {
            noPool += amount;
          }

          const total = yesPool + noPool;
          const yesPercent = Number((yesPool * 10000n) / total) / 100;
          const totalEth = Number(ethers.formatEther(total));

          const ts = blockTimestamps.get(event.blockNumber);
          const time = ts
            ? new Date(ts * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : `Bet #${result.length}`;

          result.push({
            time,
            yesPercent: Math.round(yesPercent * 10) / 10,
            noPercent: Math.round((100 - yesPercent) * 10) / 10,
            totalPool: Math.round(totalEth * 1000) / 1000,
          });
        }

        if (!cancelled) {
          setSnapshots(result);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch odds history:", err);
        if (!cancelled) {
          setSnapshots([]);
          setLoading(false);
        }
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [marketId, provider]);

  return { snapshots, loading };
}
