"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  TrendingUp,
  Droplet,
  Bell,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Layers,
  ChevronRight,
  Receipt,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { fetchDashboardStats } from "@/lib/queries";
import { DataStore } from "@/lib/data-store";
import { WashTransaction } from "@/lib/types";
import { REVENUE_TREND, WASH_HISTORY } from "@/lib/mock";

/* ── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "var(--accent)",
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
  delta?: number | null;
}) {
  return (
    <div
      className="card fade-up relative overflow-hidden flex flex-col justify-between p-5 space-y-3"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="section-label">{label}</p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="stat-value text-2xl font-bold font-mono text-text">{value}</p>
        {sub && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {delta !== undefined && delta !== null && (
              delta >= 0 ? (
                <ArrowUpRight size={12} style={{ color: "var(--green)" }} />
              ) : (
                <ArrowDownRight size={12} style={{ color: "var(--red)" }} />
              )
            )}
            <p
              className="text-xs"
              style={{
                color:
                  delta !== undefined && delta !== null
                    ? delta >= 0
                      ? "var(--green)"
                      : "var(--red)"
                    : "var(--muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {sub}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Soap Gauge ─────────────────────────────────────────────── */
function SoapGauge({ label, ml, capacity = 800 }: { label: string; ml: number; capacity?: number }) {
  const pct = Math.max(0, Math.min(100, (ml / capacity) * 100));
  const critical = pct < 20;
  const warning = pct < 45;
  const color = critical ? "var(--red)" : warning ? "var(--amber)" : "var(--accent)";
  const r = 28;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-panel-2 border border-line">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--panel-3)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="36"
          y="40"
          textAnchor="middle"
          fontSize="12"
          fill="var(--text)"
          fontFamily="var(--font-mono)"
          fontWeight="600"
        >
          {Math.round(pct)}%
        </text>
      </svg>
      <p className="text-xs font-semibold text-center text-text truncate max-w-[90px]">{label}</p>
      <p className="text-[10px] text-muted font-mono">{ml} ml left</p>
    </div>
  );
}

type Stats = {
  carsToday: number;
  revenueToday: number;
  revenueYesterday: number;
  soapUsed: number;
  pendingRequests: number;
  avgMinutes: number;
  lowStock: number;
  washers: { name: string; ml: number }[];
  revenueTrend: { day: string; revenue: number; expenses?: number }[];
  fleetMix: { name: string; value: number; color: string }[];
  recentWashes: WashTransaction[];
};

const INITIAL_STATS: Stats = {
  carsToday: 6,
  revenueToday: 4900,
  revenueYesterday: 4200,
  soapUsed: 1280,
  pendingRequests: 1,
  avgMinutes: 42,
  lowStock: 1,
  washers: [
    { name: "Yonas Bekele", ml: 750 },
    { name: "Selam Girma", ml: 540 },
    { name: "Dawit Alemu", ml: 180 },
    { name: "Hana Tesfaye", ml: 620 },
  ],
  revenueTrend: REVENUE_TREND,
  fleetMix: [
    { name: "Small", value: 5, color: "#2dd4c8" },
    { name: "Medium", value: 3, color: "#f59e0b" },
    { name: "Large", value: 1, color: "#a78bfa" },
  ],
  recentWashes: (WASH_HISTORY as unknown as WashTransaction[]).slice(0, 5),
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadData() {
    setIsRefreshing(true);
    try {
      const data = await fetchDashboardStats();
      if (data) {
        setStats(data as Stats);
      }
    } catch {
      // fallback handled in fetchDashboardStats
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  const revDelta =
    stats.revenueYesterday > 0
      ? Math.round(((stats.revenueToday - stats.revenueYesterday) / stats.revenueYesterday) * 100)
      : 18;

  const revSub = `${revDelta >= 0 ? "+" : ""}${revDelta}% vs yesterday`;

  const kpis = [
    {
      label: "Cars Washed Today",
      value: stats.carsToday,
      sub: "wash tickets completed",
      icon: Car,
      accent: "var(--accent)",
      delta: null,
    },
    {
      label: "Revenue Today",
      value: `${stats.revenueToday.toLocaleString()} ETB`,
      sub: revSub,
      icon: TrendingUp,
      accent: "var(--green)",
      delta: revDelta,
    },
    {
      label: "Soap Dispensed",
      value: `${stats.soapUsed.toLocaleString()} ml`,
      sub: "LARGO formula tracked",
      icon: Droplet,
      accent: "var(--amber)",
      delta: null,
    },
    {
      label: "Pending Requisitions",
      value: stats.pendingRequests,
      sub: stats.pendingRequests > 0 ? "needs review" : "all clear",
      icon: Bell,
      accent: stats.pendingRequests > 0 ? "var(--amber)" : "var(--accent)",
      delta: null,
    },
    {
      label: "Avg Wash Duration",
      value: `${stats.avgMinutes} min`,
      sub: "standard time adherence",
      icon: Clock,
      accent: "var(--violet)",
      delta: null,
    },
    {
      label: "Inventory Alerts",
      value: stats.lowStock,
      sub: stats.lowStock > 0 ? "action required" : "stock healthy",
      icon: AlertTriangle,
      accent: stats.lowStock > 0 ? "var(--red)" : "var(--green)",
      delta: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Quick Dispatch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text font-[family-name:var(--font-display)]">
            Executive Command Dashboard
          </h2>
          <p className="text-sm text-muted">
            Live overview of car wash bays, chemical consumption economics, attendant balances, and daily financials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/wash")} className="btn btn-primary">
            <Plus size={16} />
            <span>New Wash POS</span>
          </button>
          <button onClick={loadData} disabled={isRefreshing} className="icon-btn" title="Refresh">
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-accent" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            sub={k.sub}
            icon={k.icon}
            accent={k.accent}
            delta={k.delta}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Revenue area chart */}
        <div className="xl:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text font-[family-name:var(--font-display)]">
                Revenue & Expense Momentum — Past 7 Days
              </h3>
              <p className="text-xs text-muted">Daily gross revenue vs operating expenses</p>
            </div>
            <span className="badge badge-approved text-[10px]">Realtime Synced</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenueTrend}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGrad)"
                  name="Revenue (ETB)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Mix Pie Chart */}
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-text font-[family-name:var(--font-display)]">
              Vehicle Mix Breakdown
            </h3>
            <p className="text-xs text-muted">Today&apos;s wash traffic by category</p>
          </div>

          <div className="h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.fleetMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                  {stats.fleetMix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            {stats.fleetMix.map((f) => (
              <div key={f.name} className="p-2 rounded-lg bg-panel-2">
                <span className="text-[10px] text-muted block">{f.name}</span>
                <span className="font-bold text-text">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendant Detergent Gauges & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Detergent Gauges */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-text">Attendant Soap Gauges</h3>
              <p className="text-xs text-muted">Personal detergent stock in wash bay</p>
            </div>
            <button onClick={() => router.push("/store")} className="text-xs text-accent hover:underline">
              Issue Refill →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stats.washers.map((w) => (
              <SoapGauge key={w.name} label={w.name} ml={w.ml} />
            ))}
          </div>
        </div>

        {/* Recent Washes Stream */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-text">Live Wash Transactions</h3>
              <p className="text-xs text-muted">Recent completions across active wash bays</p>
            </div>
            <button onClick={() => router.push("/wash")} className="text-xs text-accent hover:underline">
              View All Washes →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Plate</th>
                  <th>Vehicle</th>
                  <th>Attendant</th>
                  <th>Payment</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentWashes.slice(0, 5).map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs font-bold text-accent">{w.receipt_number || "REC-1004"}</td>
                    <td className="font-mono font-bold text-text">{w.plate}</td>
                    <td className="capitalize text-xs text-muted">{w.vehicle_type_id}</td>
                    <td className="text-xs text-text">{w.washer_name}</td>
                    <td>
                      <span className="badge badge-approved text-[9px] uppercase">{w.payment_method}</span>
                    </td>
                    <td className="font-mono font-bold text-text">{w.price} ETB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}