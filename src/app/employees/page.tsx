"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Car,
  TrendingUp,
  Droplet,
  Users,
  ShieldCheck,
  ChevronRight,
  Phone,
  Sparkles,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { Profile } from "@/lib/types";

type WasherStat = {
  id: string;
  name: string;
  soap: number;
  carsToday: number;
  revenueToday: number;
  phone?: string;
};

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  administrator: { bg: "#2a1f4a", fg: "var(--violet)" },
  manager: { bg: "#123A34", fg: "var(--accent)" },
  store_keeper: { bg: "#3A2E14", fg: "var(--amber)" },
  washer: { bg: "#1c2830", fg: "var(--muted)" },
};

export default function EmployeesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [washerStats, setWasherStats] = useState<WasherStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function loadData() {
    setLoading(true);
    const [staffList, washersList] = await Promise.all([
      DataStore.getStaff(),
      DataStore.getWashersStock(),
    ]);

    setProfiles(staffList);
    setWasherStats(washersList);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  const totalWashers = profiles.filter((p) => p.role === "washer").length;
  const totalManagement = profiles.filter((p) => p.role !== "washer").length;
  const totalCarsToday = washerStats.reduce((s, w) => s + w.carsToday, 0);
  const totalRevenueToday = washerStats.reduce((s, w) => s + w.revenueToday, 0);

  const filtered = profiles.filter((p) => filter === "all" || p.role === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text font-[family-name:var(--font-display)]">
            Staff & Attendants Directory
          </h2>
          <p className="text-sm text-muted">
            Monitor washer performance, daily car wash throughput, detergent allocations, and commissions.
          </p>
        </div>
        <button onClick={loadData} className="icon-btn" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-accent">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Total Staff</p>
            <p className="text-xl font-bold font-mono text-text">{profiles.length}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-emerald-500">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Car size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Cars Washed Today</p>
            <p className="text-xl font-bold font-mono text-text">{totalCarsToday}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-amber">
          <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Washer Revenue Today</p>
            <p className="text-xl font-bold font-mono text-text">{totalRevenueToday.toLocaleString()} ETB</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-purple-500">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Supervisors / Store</p>
            <p className="text-xl font-bold font-mono text-text">{totalManagement}</p>
          </div>
        </div>
      </div>

      {/* Role Filters */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-panel border border-line w-fit">
        {["all", "washer", "manager", "store_keeper", "administrator"].map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`tab-btn capitalize ${filter === r ? "active" : ""}`}
          >
            {r.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((p) => {
          const stats = washerStats.find((w) => w.id === p.id || w.name === p.full_name);
          const tone = ROLE_COLORS[p.role] || ROLE_COLORS.washer;

          return (
            <div
              key={p.id}
              onClick={() => router.push(`/employees/${p.id}`)}
              className="card card-hover p-5 space-y-4 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="avatar w-11 h-11 text-sm bg-accent/15 text-accent font-bold">
                      {p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-text">{p.full_name}</h3>
                      <p className="text-xs text-muted font-mono">{p.phone || "+251 91 •••••••"}</p>
                    </div>
                  </div>
                  <span
                    className="badge text-[10px] capitalize"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {p.role.replace("_", " ")}
                  </span>
                </div>

                {p.role === "washer" && stats ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-panel-2">
                      <span className="text-[10px] text-muted block">Cars Today</span>
                      <span className="font-bold text-text">{stats.carsToday}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-panel-2">
                      <span className="text-[10px] text-muted block">Revenue</span>
                      <span className="font-bold text-text">{stats.revenueToday.toLocaleString()} ETB</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-panel-2">
                      <span className="text-[10px] text-muted block">Soap Left</span>
                      <span className={`font-bold ${stats.soap < 200 ? "text-red" : "text-accent"}`}>
                        {stats.soap} ml
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 rounded-lg bg-panel-2 text-xs text-muted flex items-center justify-between">
                    <span>System Role:</span>
                    <span className="font-medium text-text capitalize">{p.role.replace("_", " ")}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-accent font-medium">
                <span>View Performance Profile</span>
                <ChevronRight size={14} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
