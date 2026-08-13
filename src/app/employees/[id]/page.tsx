"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Car, Droplet, RefreshCw, Plus, Send } from "lucide-react";
import { WASHERS, REQUESTS as MOCK_REQUESTS, VEHICLE_TYPES } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { fetchWasherStats } from "@/lib/queries";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending:  { bg: "#3A2E14", fg: "var(--amber)" },
  approved: { bg: "#123A34", fg: "var(--accent)" },
  rejected: { bg: "#3A1A1A", fg: "var(--red)" },
  partial:  { bg: "#2a1f4a", fg: "var(--violet)" },
};

const TABS = ["Stats", "Wash History", "Request Soap"] as const;
type Tab = (typeof TABS)[number];

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Stats");
  const [name, setName]           = useState("Loading…");
  const [role, setRole]           = useState("washer");
  const [soapMl, setSoapMl]       = useState(0);
  const [todayWashes, setTodayWashes]   = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [history, setHistory]     = useState<{ id: string; plate: string; vehicle_type_id: string; price: number; soap_used_ml: number; started_at: string }[]>([]);
  const [requests, setRequests]   = useState<{ id: string; request_number: string; status: string; quantity_requested: number; vehicle_type: string; created_at: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [useMock, setUseMock]     = useState(false);

  // request form — car-type based
  const [vehicleType, setVehicleType] = useState<string>(VEHICLE_TYPES[0].id);
  const [carCount, setCarCount]       = useState(1);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<string | null>(null);

  const selectedVT = VEHICLE_TYPES.find((v) => v.id === vehicleType) ?? VEHICLE_TYPES[0];
  const requestedMl = selectedVT.default_soap_ml * carCount;

  function notify(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3200); }

  async function load() {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", id).single();
      if (!profile) throw new Error("no profile");
      setName(profile.full_name ?? "Employee");
      setRole(profile.role ?? "washer");

      type SoapRow    = { balance_ml: number };
      type HistoryRow  = { id: string; vehicles?: { plate: string } | null; vehicle_type_id: string; price: number; soap_used_ml: number; started_at: string };
      type RequestRow  = { id: string; request_number: string; status: string; quantity_requested: number; notes?: string | null; created_at: string };
      type WashRow     = { price: number; started_at: string };

      const d = await fetchWasherStats(id);
      const soap     = d.soap     as SoapRow[];
      const history  = d.history  as HistoryRow[];
      const requests = d.requests as RequestRow[];
      const todayW   = d.todayWashes as WashRow[];

      setSoapMl(soap.reduce((s, x) => s + x.balance_ml, 0));
      setTodayWashes(todayW.length);
      setTodayRevenue(todayW.reduce((s, w) => s + w.price, 0));
      setHistory(history.map((h) => ({
        id: h.id, plate: h.vehicles?.plate ?? "—",
        vehicle_type_id: h.vehicle_type_id, price: h.price,
        soap_used_ml: h.soap_used_ml, started_at: h.started_at,
      })));
      setRequests(requests.map((r) => ({
        id: r.id, request_number: r.request_number, status: r.status,
        quantity_requested: r.quantity_requested,
        vehicle_type: r.notes ?? "—",
        created_at: r.created_at,
      })));
    } catch {
      setUseMock(true);
      const mock = WASHERS.find((w) => w.id === id) ?? WASHERS[0];
      setName(mock.name);
      setSoapMl(mock.soap);
      setTodayWashes(mock.carsToday);
      setTodayRevenue(mock.revenueToday);
      setRequests(MOCK_REQUESTS.slice(0, 3).map((r) => ({
        id: r.id, request_number: r.request_number, status: r.status,
        quantity_requested: r.qty, vehicle_type: "Small Vehicle", created_at: "",
      })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (carCount < 1) return;
    setSaving(true);
    const supabase = createClient();

    // find the main soap product in inventory
    const { data: invList, error: invErr } = await supabase
      .from("inventory").select("id, product_name").limit(10);
    if (invErr) {
      notify(`Request failed: ${invErr.message}`);
      setSaving(false);
      return;
    }
    type InvRow = { id: string; product_name: string };
    const invRows = (invList ?? []) as InvRow[];
    const inventoryId = (invRows.find((i) =>
      i.product_name?.toLowerCase().includes("shampoo") ||
      i.product_name?.toLowerCase().includes("soap")
    ) ?? invRows[0])?.id;
    if (!inventoryId) {
      notify("Request failed: no inventory product found.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("soap_requests").insert({
      washer_id: id,
      inventory_id: inventoryId,
      quantity_requested: requestedMl,
      status: "pending",
      notes: `${selectedVT.name} × ${carCount}`,
    });

    if (error) {
      console.error("soap_requests insert failed:", error);
      notify(`Request failed: ${error.message}`);
      setSaving(false);
      return;
    }

    notify(`Request sent — ${requestedMl} ml for ${carCount} × ${selectedVT.name}`);
    setCarCount(1);
    await load();
    setSaving(false);
  }

  const soapPct = Math.max(0, Math.min(100, (soapMl / 700) * 100));
  const soapCritical = soapPct < 15;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const r = 44, c = 2 * Math.PI * r;

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="rounded-2xl border border-line bg-panel p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="shrink-0">
          <svg width="108" height="108" viewBox="0 0 108 108">
            <circle cx="54" cy="54" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="8" />
            <circle cx="54" cy="54" r={r} fill="none"
              stroke={soapCritical ? "var(--red)" : "var(--accent)"} strokeWidth="8"
              strokeDasharray={c} strokeDashoffset={c - (soapPct / 100) * c}
              strokeLinecap="round" transform="rotate(-90 54 54)" />
            <text x="54" y="50" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="IBM Plex Mono">SOAP</text>
            <text x="54" y="66" textAnchor="middle" fontSize="15" fill="var(--text)" fontFamily="IBM Plex Mono">{Math.round(soapPct)}%</text>
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-[family-name:var(--font-display)] text-xl bg-panel-2 text-accent">
              {loading ? "…" : initials}
            </div>
            <div>
              <p className="font-[family-name:var(--font-display)] text-2xl">{name}</p>
              <p className="text-sm text-muted capitalize mt-0.5">{role.replace("_", " ")} · {useMock ? "Demo" : "Active"}</p>
            </div>
            {loading && <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />}
            <button onClick={load} className="p-1.5 rounded-lg text-muted hover:text-text"><RefreshCw size={14} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mt-4">
            {[
              { label: "Cars Today",   value: todayWashes,   icon: Car },
              { label: "Soap Balance", value: `${soapMl} ml`, icon: Droplet, accent: soapCritical ? "var(--red)" : "var(--accent)" },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="rounded-xl p-3 bg-panel-2 border border-line">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: accent ?? "var(--accent)" }}>
                  <Icon size={13} />
                  <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
                </div>
                <p className="font-[family-name:var(--font-mono)] text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-sm transition"
            style={{ background: tab === t ? "var(--panel-2)" : "transparent", color: tab === t ? "var(--accent)" : "var(--muted)", border: "1px solid", borderColor: tab === t ? "var(--accent)" : "var(--line)" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Stats */}
      {tab === "Stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-line bg-panel p-5 space-y-4">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Today&apos;s Performance</h3>
            {[
              { label: "Cars Washed",     value: todayWashes,        max: 12,  color: "var(--accent)" },
              { label: "Soap Remaining",  value: Math.round(soapPct), max: 100, color: soapCritical ? "var(--red)" : "var(--accent)", suffix: "%" },
            ].map(({ label, value, max, color, suffix }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted">{label}</span>
                  <span className="font-[family-name:var(--font-mono)]" style={{ color }}>{value}{suffix ?? ""}</span>
                </div>
                <div className="h-2 rounded-full bg-panel-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg mb-4">Soap Status</h3>
            <div className="rounded-xl px-4 py-3 text-sm text-center font-[family-name:var(--font-mono)] mb-3"
              style={{ background: soapCritical ? "#3A1A1A" : "#123A34", color: soapCritical ? "var(--red)" : "var(--accent)" }}>
              {soapCritical ? "⚠ Critical — request soap now" : `${soapMl} ml available — sufficient`}
            </div>
            {soapCritical && (
              <button onClick={() => setTab("Request Soap")}
                className="w-full py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center justify-center gap-2">
                <Plus size={15} /> Request Soap Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Wash History */}
      {tab === "Wash History" && (
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="p-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Wash History</h3>
            <p className="text-xs text-muted mt-1">{history.length} washes recorded</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>
          ) : history.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted">No wash history yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                  <th className="px-5 py-3">Plate</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Soap Used</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-line hover:bg-panel-2 transition">
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs">{h.plate}</td>
                    <td className="px-5 py-3.5 text-muted capitalize">{h.vehicle_type_id}</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-accent">+{h.price} birr</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted">{h.soap_used_ml} ml</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted">
                      {new Date(h.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Request Soap */}
      {tab === "Request Soap" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Form */}
          <form onSubmit={submitRequest} className="rounded-2xl border border-line bg-panel p-6 space-y-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Request Soap from Store</h3>
            <p className="text-xs text-muted">Select the vehicle type you&apos;re washing — the soap amount is calculated automatically.</p>

            {/* Vehicle type selector */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted mb-2">Vehicle Type</p>
              <div className="grid grid-cols-1 gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button type="button" key={v.id} onClick={() => setVehicleType(v.id)}
                    className="rounded-xl p-3 text-left border transition flex items-center justify-between"
                    style={{ borderColor: vehicleType === v.id ? v.color : "var(--line)", background: vehicleType === v.id ? "var(--panel-2)" : "transparent" }}>
                    <div>
                      <p className="font-medium text-sm" style={{ color: vehicleType === v.id ? v.color : "var(--text)" }}>{v.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">{v.examples}</p>
                    </div>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-muted">{v.default_soap_ml} ml / car</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Car count */}
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Number of Cars</label>
              <div className="flex items-center gap-3 mt-1">
                <button type="button" onClick={() => setCarCount((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-xl bg-panel-2 border border-line text-lg font-bold flex items-center justify-center hover:border-accent transition">−</button>
                <span className="font-[family-name:var(--font-mono)] text-xl w-8 text-center">{carCount}</span>
                <button type="button" onClick={() => setCarCount((n) => n + 1)}
                  className="w-9 h-9 rounded-xl bg-panel-2 border border-line text-lg font-bold flex items-center justify-center hover:border-accent transition">+</button>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl p-4 bg-panel-2 border border-line">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Vehicle type</span>
                <span>{selectedVT.name}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Cars</span>
                <span className="font-[family-name:var(--font-mono)]">{carCount}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Soap per car</span>
                <span className="font-[family-name:var(--font-mono)]">{selectedVT.default_soap_ml} ml</span>
              </div>
              <div className="border-t border-line mt-2 pt-2 flex justify-between font-medium">
                <span className="text-muted">Total requested</span>
                <span className="font-[family-name:var(--font-mono)] text-accent">{requestedMl} ml</span>
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D] disabled:opacity-40 flex items-center justify-center gap-2">
              <Send size={15} /> {saving ? "Sending…" : `Request ${requestedMl} ml from Store`}
            </button>
          </form>

          {/* Request history */}
          <div className="rounded-2xl border border-line bg-panel overflow-hidden">
            <div className="p-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg">My Requests</h3>
              <p className="text-xs text-muted mt-1">Store keeper will approve or reject</p>
            </div>
            <div className="divide-y divide-line">
              {requests.length === 0 && <p className="px-5 pb-5 text-sm text-muted">No requests yet.</p>}
              {requests.map((req) => {
                const t = STATUS_TONE[req.status] ?? STATUS_TONE.pending;
                return (
                  <div key={req.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-[family-name:var(--font-mono)]">{req.request_number}</p>
                      <p className="text-xs text-muted mt-0.5">{req.vehicle_type} · {req.quantity_requested} ml</p>
                      {req.created_at && (
                        <p className="text-[10px] text-muted font-[family-name:var(--font-mono)] mt-0.5">
                          {new Date(req.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wide shrink-0"
                      style={{ background: t.bg, color: t.fg }}>
                      {req.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 fade-up rounded-xl px-4 py-3 text-sm bg-[var(--accent-dim)] text-accent z-50">{toast}</div>}
    </div>
  );
}
