"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Power,
  Users,
  ShieldCheck,
  X,
  Check,
  Droplet,
  TrendingUp,
  Bell,
  RefreshCw,
  Database,
  Copy,
  ExternalLink,
  Activity,
  Server,
  Terminal,
  Layers,
  Sparkles,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  Lock,
  Clock,
} from "lucide-react";
import { VEHICLE_TYPES, WASHERS } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { MASTER_SETUP_SQL } from "@/lib/setup-sql";
import { DataStore } from "@/lib/data-store";

type StaffMember = { id: string; name: string; role: string; phone: string; active: boolean; joined: string };

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  administrator: { bg: "#2a1f4a", fg: "var(--violet)" },
  manager: { bg: "#123A34", fg: "var(--accent)" },
  store_keeper: { bg: "#3A2E14", fg: "var(--amber)" },
  washer: { bg: "#1c2830", fg: "var(--muted)" },
};

const TABS = [
  "Users & Roles",
  "Pricing & Standards",
  "Chemical Variance Audit",
  "Shift Cash Drawer",
  "Database & System",
] as const;
type Tab = (typeof TABS)[number];

const PRICING_INIT = VEHICLE_TYPES.map((v) => ({ ...v }));

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-line glass-card p-6 shadow-2xl fade-up">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
          <h3 className="font-bold text-base font-[family-name:var(--font-display)] text-text">{title}</h3>
          <button onClick={onClose} className="icon-btn w-7 h-7">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("Users & Roles");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [pricing, setPricing] = useState(PRICING_INIT);
  const [editUser, setEditUser] = useState<StaffMember | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "washer", phone: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  // Diagnostics & Audits
  const [dbStatus, setDbStatus] = useState<Record<string, { ok: boolean; count?: number; error?: string }> | null>(null);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Live Audits
  const [varianceData, setVarianceData] = useState<{
    carsWashed: number;
    theoreticalSoapUsed: number;
    actualSoapDispensed: number;
    varianceMl: number;
    status: string;
  } | null>(null);

  const [settlementData, setSettlementData] = useState<{
    today: string;
    washesCount: number;
    totalRevenue: number;
    cashTotal: number;
    telebirrTotal: number;
    cbeBirrTotal: number;
    cardTotal: number;
    accountTotal: number;
    totalCommission: number;
    totalExpenses: number;
    netCashInDrawer: number;
  } | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    setStaffLoading(true);
    try {
      const [profiles, variance, settlement] = await Promise.all([
        DataStore.getStaff(),
        DataStore.getChemicalVariance(),
        DataStore.getShiftSettlement(),
      ]);

      const mapped: StaffMember[] = profiles.map((p) => ({
        id: p.id,
        name: p.full_name,
        role: p.role,
        phone: p.phone || "—",
        active: p.active,
        joined: p.created_at ? p.created_at.slice(0, 10) : "2025-01-15",
      }));

      setStaff(mapped);
      setVarianceData(variance);
      setSettlementData(settlement);
    } catch (e) {
      console.error(e);
    } finally {
      setStaffLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  async function checkDatabase() {
    setCheckingDb(true);
    const start = Date.now();
    const supabase = createClient();
    const tables = [
      "profiles",
      "inventory",
      "purchase_orders",
      "wash_transactions",
      "soap_requests",
      "customers",
      "suppliers",
      "expenses",
    ];

    const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};

    await Promise.all(
      tables.map(async (tbl) => {
        try {
          const res: any = await (supabase as any).from(tbl).select("*", { count: "exact", head: true });
          const count = res?.count;
          const error = res?.error;
          if (error) {
            results[tbl] = { ok: false, error: error.message };
          } else {
            results[tbl] = { ok: true, count: count ?? 0 };
          }
        } catch (e: any) {
          results[tbl] = { ok: false, error: e?.message || "Connection failed" };
        }
      })
    );

    setDbLatency(Date.now() - start);
    setDbStatus(results);
    setCheckingDb(false);
  }

  async function handleToggleUser(user: StaffMember) {
    const updated = staff.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u));
    setStaff(updated);
    const supabase = createClient();
    await supabase.from("profiles").update({ active: !user.active }).eq("id", user.id);
    notify(`${user.name} is now ${!user.active ? "Active" : "Inactive"}`);
  }

  function handleSavePricing(id: string, field: string, val: number) {
    setPricing((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
    notify("Pricing standard updated.");
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl glass-card border border-accent px-5 py-3.5 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={18} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text">{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="card glass-card p-6 border-line relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet/15 border border-violet/30 flex items-center justify-center text-violet font-bold">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text font-[family-name:var(--font-display)]">
                  Executive Admin Command Center
                </h2>
                <span className="badge badge-approved">Root Controls</span>
              </div>
              <p className="text-xs text-muted font-mono mt-0.5">
                Staff RBAC, Detergent Standards, Chemical Leakage Audit & Financial Settlement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="btn btn-primary text-xs font-semibold py-2 px-3.5 rounded-xl gap-2 shadow-sm shadow-accent/20"
            >
              <Plus size={14} />
              <span>Add Staff</span>
            </button>
            <button onClick={loadData} className="icon-btn rounded-xl border border-line" title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Quick Executive KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-line/60">
          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Active Personnel</p>
            <p className="text-2xl font-bold font-mono text-text mt-1">{staff.filter((s) => s.active).length}</p>
          </div>

          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Today's Revenue</p>
            <p className="text-2xl font-bold font-mono text-accent mt-1">
              ETB {(settlementData?.totalRevenue || 0).toLocaleString()}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Chemical Theft / Variance</p>
            <p className="text-2xl font-bold font-mono text-text mt-1">
              {varianceData?.status === "excessive_loss" ? (
                <span className="text-red">⚠️ Overuse</span>
              ) : (
                <span className="text-emerald-400">✓ Healthy</span>
              )}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Database Latency</p>
            <p className="text-2xl font-bold font-mono text-text mt-1">
              {dbLatency ? `${dbLatency} ms` : "Connected"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-panel-2 p-1 border border-line overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
              tab === t ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
            }`}
          >
            {t === "Users & Roles" && <Users size={14} />}
            {t === "Pricing & Standards" && <Layers size={14} />}
            {t === "Chemical Variance Audit" && <Droplet size={14} />}
            {t === "Shift Cash Drawer" && <Wallet size={14} />}
            {t === "Database & System" && <Database size={14} />}
            <span>{t}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: USERS & ROLES ──────────────────────────────────── */}
      {tab === "Users & Roles" && (
        <div className="card glass-card border-line overflow-hidden fade-in">
          <div className="p-4 border-b border-line flex justify-between items-center">
            <h3 className="font-bold text-sm text-text">Staff Accounts & Access Roles</h3>
            <button
              onClick={() => setShowAdd(true)}
              className="btn btn-primary text-xs py-1 px-3 rounded-lg gap-1"
            >
              <Plus size={12} /> Add Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="font-semibold text-text">{u.name}</span>
                    </td>
                    <td>
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold capitalize"
                        style={{
                          background: ROLE_COLORS[u.role]?.bg || "#1e293b",
                          color: ROLE_COLORS[u.role]?.fg || "#fff",
                        }}
                      >
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-xs font-mono">{u.phone}</td>
                    <td className="text-xs font-mono text-muted">{u.joined}</td>
                    <td>
                      <span className={`badge ${u.active ? "badge-approved" : "badge-critical"}`}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleUser(u)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all ${
                          u.active
                            ? "text-red border-red/30 hover:bg-red-dim"
                            : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        }`}
                      >
                        {u.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: PRICING & STANDARDS ────────────────────────────── */}
      {tab === "Pricing & Standards" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
              Vehicle Washing Standards & Ethiopian Pricing
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pricing.map((vt) => (
              <div key={vt.id} className="card glass-card p-5 border-line space-y-4">
                <div className="flex justify-between items-start pb-3 border-b border-line">
                  <div>
                    <h4 className="font-bold text-base text-text">{vt.name}</h4>
                    <p className="text-xs text-muted mt-0.5">{vt.examples}</p>
                  </div>
                  <span className="badge badge-approved">{vt.id.toUpperCase()}</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-muted font-mono uppercase block mb-1">Standard Wash Fee (ETB):</label>
                    <input
                      type="number"
                      value={vt.default_price}
                      onChange={(e) => handleSavePricing(vt.id, "default_price", Number(e.target.value))}
                      className="input font-mono font-bold text-accent text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-muted font-mono uppercase block mb-1">Standard Detergent Allocation (ml):</label>
                    <input
                      type="number"
                      value={vt.default_soap_ml}
                      onChange={(e) => handleSavePricing(vt.id, "default_soap_ml", Number(e.target.value))}
                      className="input font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-muted font-mono uppercase block mb-1">Time (Mins):</label>
                      <input
                        type="number"
                        value={vt.standard_minutes}
                        onChange={(e) => handleSavePricing(vt.id, "standard_minutes", Number(e.target.value))}
                        className="input font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-muted font-mono uppercase block mb-1">Workers Req.:</label>
                      <input
                        type="number"
                        value={vt.workers_required}
                        onChange={(e) => handleSavePricing(vt.id, "workers_required", Number(e.target.value))}
                        className="input font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: CHEMICAL VARIANCE & THEFT AUDIT ─────────────────── */}
      {tab === "Chemical Variance Audit" && (
        <div className="card glass-card p-6 sm:p-8 space-y-6 fade-in border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div>
              <h3 className="text-lg font-bold text-text">Detergent Theft & Chemical Leakage Auditor</h3>
              <p className="text-xs text-muted mt-0.5">
                Reconciliation of theoretical Largo consumption vs physical detergent dispensed to bay canisters.
              </p>
            </div>
            <span
              className={`badge ${
                varianceData?.status === "excessive_loss"
                  ? "badge-critical"
                  : varianceData?.status === "possible_underwash"
                  ? "badge-low"
                  : "badge-approved"
              }`}
            >
              {varianceData?.status === "excessive_loss"
                ? "Excessive Chemical Loss"
                : varianceData?.status === "possible_underwash"
                ? "Low Soap Usage"
                : "Standard Variance (OK)"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">Theoretical Usage (Standard)</span>
              <p className="text-2xl font-bold font-mono text-text mt-1">
                {(varianceData?.theoreticalSoapUsed || 0).toLocaleString()} ml
              </p>
              <p className="text-[11px] text-muted mt-1 font-mono">
                Calculated from {varianceData?.carsWashed || 0} washed vehicles
              </p>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">Actual Dispensed to Bays</span>
              <p className="text-2xl font-bold font-mono text-accent mt-1">
                {(varianceData?.actualSoapDispensed || 0).toLocaleString()} ml
              </p>
              <p className="text-[11px] text-muted mt-1 font-mono">Approved by storekeeper today</p>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">Variance (Discrepancy)</span>
              <p
                className={`text-2xl font-bold font-mono mt-1 ${
                  (varianceData?.varianceMl || 0) > 400 ? "text-red" : "text-emerald-400"
                }`}
              >
                {(varianceData?.varianceMl || 0) > 0 ? "+" : ""}
                {(varianceData?.varianceMl || 0).toLocaleString()} ml
              </p>
              <p className="text-[11px] text-muted mt-1 font-mono">
                {(varianceData?.varianceMl || 0) > 400
                  ? "⚠️ Overuse / Unrecorded washing flag"
                  : "Within normal operations margin"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: SHIFT CASH DRAWER SETTLEMENT ────────────────────── */}
      {tab === "Shift Cash Drawer" && (
        <div className="card glass-card p-6 sm:p-8 space-y-6 fade-in border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div>
              <h3 className="text-lg font-bold text-text">Daily Shift Drawer Reconciliation</h3>
              <p className="text-xs text-muted mt-0.5">
                Audit physical cash drawer against mobile money payments and attendant commissions.
              </p>
            </div>
            <span className="badge badge-ok">{settlementData?.today}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">Physical Cash Sales</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                ETB {(settlementData?.cashTotal || 0).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">Telebirr Received</span>
              <p className="text-2xl font-bold font-mono text-sky-400 mt-1">
                ETB {(settlementData?.telebirrTotal || 0).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">CBE Birr Received</span>
              <p className="text-2xl font-bold font-mono text-purple-400 mt-1">
                ETB {(settlementData?.cbeBirrTotal || 0).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line">
              <span className="text-xs font-mono text-muted uppercase">Attendant Commission</span>
              <p className="text-2xl font-bold font-mono text-amber mt-1">
                ETB {(settlementData?.totalCommission || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-panel-2 border border-accent/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-muted uppercase">Net Cash to Deposit into Safe:</p>
              <p className="text-xs text-muted mt-0.5">(Cash Sales - Cash Expenses - Attendant Commissions)</p>
            </div>
            <p className="text-3xl font-black font-mono text-accent">
              ETB {(settlementData?.netCashInDrawer || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* ── TAB 5: DATABASE & SYSTEM DIAGNOSTICS ───────────────────── */}
      {tab === "Database & System" && (
        <div className="space-y-6 fade-in">
          <div className="card glass-card p-6 border-line space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-text">Supabase Database Diagnostics</h3>
                <p className="text-xs text-muted mt-0.5 font-mono">
                  Live table connectivity and exact record counts.
                </p>
              </div>
              <button
                onClick={checkDatabase}
                disabled={checkingDb}
                className="btn btn-primary text-xs py-1.5 px-3.5 rounded-xl gap-1.5"
              >
                <Activity size={14} />
                <span>{checkingDb ? "Pinging DB..." : "Run Diagnostics"}</span>
              </button>
            </div>

            {dbStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                {Object.entries(dbStatus).map(([table, stat]) => (
                  <div key={table} className="p-3 rounded-xl bg-panel-2 border border-line">
                    <p className="text-xs font-mono text-muted">{table}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${stat.ok ? "bg-emerald-400" : "bg-red"}`} />
                      <span className="font-mono font-bold text-text">{stat.count ?? 0} rows</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card glass-card p-6 border-line space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-text font-mono">Master SQL Schema Setup</h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(MASTER_SETUP_SQL);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="btn btn-ghost text-xs py-1 px-2.5 rounded-lg border border-line gap-1"
              >
                <Copy size={12} />
                <span>{copiedSql ? "Copied!" : "Copy SQL"}</span>
              </button>
            </div>
            <p className="text-xs text-muted">
              Use this script in the Supabase SQL Editor if you ever need to initialize or recreate tables.
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-48 border border-line">
              {MASTER_SETUP_SQL.slice(0, 800)}...
            </pre>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD STAFF ──────────────────────────────────────── */}
      {showAdd && (
        <Modal title="Add Staff Member" onClose={() => setShowAdd(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              const newMember: StaffMember = {
                id: "st-" + Date.now(),
                name: form.name,
                role: form.role,
                phone: form.phone || "—",
                active: true,
                joined: new Date().toISOString().slice(0, 10),
              };
              setStaff([newMember, ...staff]);
              notify(`✓ Added ${form.name} (${form.role})`);
              setShowAdd(false);
              setSaving(false);
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label className="text-muted font-mono uppercase block mb-1">Full Name:</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Almaz Tadesse"
                required
                className="input"
              />
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Role Permission:</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="input"
              >
                <option value="washer">Washer / Bay Attendant</option>
                <option value="store_keeper">Storekeeper (Chemicals & POs)</option>
                <option value="manager">Operations Manager (Bays & POS)</option>
                <option value="administrator">System Administrator</option>
              </select>
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Phone Number:</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="0911..."
                className="input font-mono"
              />
            </div>

            <button type="submit" disabled={saving} className="btn btn-primary w-full py-2.5 rounded-xl font-semibold mt-2">
              Create Staff Account
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
