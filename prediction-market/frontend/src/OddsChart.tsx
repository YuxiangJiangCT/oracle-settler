import { ethers } from "ethers";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useOddsHistory } from "./hooks/useOddsHistory";

interface OddsChartProps {
  marketId: number;
  provider: ethers.BrowserProvider | null;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const yes = payload.find((p: any) => p.dataKey === "yesPercent");
  const no = payload.find((p: any) => p.dataKey === "noPercent");
  const pool = payload[0]?.payload?.totalPool;
  return (
    <div className="odds-chart-tooltip">
      <div className="tooltip-time">{label}</div>
      <div className="tooltip-row yes-row">
        <span className="tooltip-dot" style={{ background: "#10b981" }} />
        YES {yes?.value?.toFixed(1)}%
      </div>
      <div className="tooltip-row no-row">
        <span className="tooltip-dot" style={{ background: "#ef4444" }} />
        NO {no?.value?.toFixed(1)}%
      </div>
      {pool > 0 && (
        <div className="tooltip-pool">Pool: {pool} ETH</div>
      )}
    </div>
  );
}

export function OddsChart({ marketId, provider }: OddsChartProps) {
  const { snapshots, loading } = useOddsHistory(marketId, provider);

  if (loading) {
    return (
      <div className="odds-chart-section">
        <h4 className="odds-chart-title">Odds History</h4>
        <div className="odds-chart-loading">
          <div className="chart-skeleton" />
        </div>
      </div>
    );
  }

  if (snapshots.length <= 1) {
    return (
      <div className="odds-chart-section">
        <h4 className="odds-chart-title">Odds History</h4>
        <div className="odds-chart-empty">
          No predictions yet — place the first bet to see odds movement.
        </div>
      </div>
    );
  }

  return (
    <div className="odds-chart-section">
      <h4 className="odds-chart-title">Odds History</h4>
      <p className="odds-chart-subtitle">
        YES/NO pool ratio over time ({snapshots.length - 1} prediction{snapshots.length > 2 ? "s" : ""})
      </p>
      <div className="odds-chart-container">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={snapshots} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradYes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradNo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="yesPercent"
              stackId="1"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradYes)"
              name="YES"
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="noPercent"
              stackId="1"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#gradNo)"
              name="NO"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
