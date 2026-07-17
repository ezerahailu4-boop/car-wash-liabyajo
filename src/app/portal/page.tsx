"use client";

import { useEffect, useState } from "react";
import { Droplet, Car, Plus, RefreshCw, Send, TrendingUp } from "lucide-react";
import { INVENTORY, REQUESTS as MOCK_REQUESTS, VEHICLE_TYPES } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";
import { fetchWasherStats } from "@/lib/queries";

const TABS = ["My Stats", "Wash History", "Request Soap"] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending:  { bg: "#3A2E14", fg: "var(--amber)" },
  approved: { bg: "#123A34", fg: "var(--accent)" },
  rejected: { bg: "#3A1A1A", fg: "var(--red)" },
  partial:  { bg: "#2a1f4a", fg: "var(--violet)" },
};

type InventoryProduct = { id: string; product_name: string };

export default function PortalPage() {
  const [tab, setTab] = useState<Tab>("My Stats");
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [stats, setStats] = useState<{
    todayWashes: number;
    todayRevenue: number;
    soapMl: number;
    history: { id: string; plate: string; vehicle_type_id: string; price: number; soap_used_ml: number; started_at: string }[];
    requests: { id: string; request_number: string; status: string; quantity_requested: number; product: string; created_at: string }[];
  } | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(VEHICLE_TYPES[0].id);
  const [carCount, setCarCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  function notify(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3200); }

  const selectedVT = VEHICLE_TYPES.find((v) => v.id === vehicleType) ?? VEHICLE_TYPES[0];
  const requestedMl = selectedVT.default_soap_ml * carCount;

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) { setUseMock(true); setLoading(false); return; }

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", authUser.id).single();
    setUser({ id: authUser.id, name: profile?.full_name ?? authUser.email ?? "Washer" });

    try {
      const [d, invRes] = await Promise.all([
        fetchWasherStats(authUser.id),
        supabase.from("inventory").select("id, product_name").order("product_name"),
      ]);

      type InvRow = { id: string; product_name: string };
      const invList = (invRes.data as InvRow[] ?? []);
      if (invList.length) {
        setProducts(invList);
        setSelectedProductId(invList[0].id);
      } else {
        const fallback = INVENTORY.map((i) => ({ id: i.id, product_name: i.product_name }));
        setProducts(fallback);
        setSelectedProductId(fallback[0]?.id ?? "");
      }

      type SoapBalRow = { balance_ml: number };
      type HistRow = { id: string; vehicles?: { plate: string } | null; vehicle_type_id: string; price: number; soap_used_ml: number; started_at: string };
      type ReqRow = { id: string; request_number: string; status: string; quantity_requested: number; inventory?: { product_name: string } | null; created_at: string };
      type WashPriceRow = { price: number; started_at: string };

      setStats({
        todayWashes: d.todayWashes.length,
        todayRevenue: (d.todayWashes as WashPriceRow[]).reduce((s, w) => s + w.price, 0),
        soapMl: (d.soap as SoapBalRow[]).reduce((s, x) => s + x.balance_ml, 0),
        history: (d.history as HistRow[]).map((h) => ({
          id: h.id, plate: h.vehicles?.plate ?? "—",
          vehicle_type_id: h.vehicle_type_id, price: h.price,
          soap_used_ml: h.soap_used_ml, started_at: h.started_at,
        })),
        requests: (d.requests as ReqRow[]).map((r) => ({
          id: r.id, request_number: r.request_number, status: r.status,
          quantity_requested: r.quantity_requested,
          product: r.inventory?.product_name ?? "—",
          created_at: r.created_at,
        })),
      });
    } catch {
      setUseMock(true);
      const fallback = INVENTORY.map((i) => ({ id: i.id, product_name: i.product_name }));
      setProducts(fallback);
      setSelectedProductId(fallback[0]?.id ?? "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (carCount < 1 || !user || !selectedProductId) return;
    setSaving(true);

    const supabase = createClient();
    try {
      const { error } = await supabase.from("soap_requests").insert({
        washer_id: user.id,
        inventory_id: selectedProductId,
        quantity_requested: requestedMl,
        status: "pending",
        notes: `${selectedVT.name} × ${carCount}`,
      });
      if (error) throw error;
      notify(`Request sent — ${requestedMl} ml for ${carCount} × ${selectedVT.name}`);
      setCarCount(1);
      await load();
    } catch {
      notify(`Request sent (demo) — ${requestedMl} ml for ${carCount} × ${selectedVT.name}`);
      setCarCount(1);
    }
    setSaving(false);
  }

  const soapMl = stats?.soapMl ?? 0;
  const soapPct = Math.max(0, Math.min(100, (soapMl / 700) * 100));
  const soapCritical = soapPct < 15;
  const r = 44, c = 2 * Math.PI * r;

  const displayName = useMock ? "Demo Washer" : (user?.name ?? "Loading…");
  const displayStats = useMock
    ? { todayWashes: 6, todayRevenue: 2100, soapMl: 590 }
    : (stats ?? { todayWashes: 0, todayRevenue: 0, soapMl: 0 });
  const displaySoapPct = useMock ? 84 : soapPct;
  const displayHistory = useMock ? [] : (stats?.history ?? []);
  const displayRequests = useMock
    ? MOCK_REQUESTS.slice(0, 3).map((r) => ({ id: r.id, request_number: r.request_number, status: r.status, quantity_requested: r.qty, product: r.product, created_at: "" }))
    : (stats?.requests ?? []);

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="rounded-2xl border border-line bg-panel p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="shrink-0">
          <svg width="108" height="108" viewBox="0 0 108 108">
            <circle cx="54" cy="54" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="8" />
            <circle cx="54" cy="54" r={r} fill="none"
              stroke={soapCritical ? "var(--red)" : "var(--accent)"} strokeWidth="8"
              strokeDasharray={c} strokeDashoffset={c - (displaySoapPct / 100) * c}
              strokeLinecap="round" transform="rotate(-90 54 54)" />
            <text x="54" y="50" textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--font-mono)">SOAP</text>
            <text x="54" y="66" textAnchor="middle" fontSize="15" fill="var(--text)" fontFamily="var(--font-mono)">{Math.round(displaySoapPct)}%</text>
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <p className="font-[family-name:var(--font-display)] text-2xl">{displayName}</p>
            {loading && <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />}
            <button onClick={load} className="p-1.5 rounded-lg text-muted hover:text-text"><RefreshCw size={14} /></button>
          </div>
          <p className="text-sm text-muted mt-0.5">Washer · Active</p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Cars Today", value: displayStats.todayWashes, icon: Car },
              { label: "Revenue Today", value: `${displayStats.todayRevenue.toLocaleString()} birr`, icon: TrendingUp },
              { label: "Soap Balance", value: `${displayStats.soapMl} ml`, icon: Droplet, accent: soapCritical ? "var(--red)" : "var(--accent)" },
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

      {/* My Stats */}
      {tab === "My Stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-line bg-panel p-5 space-y-4">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Today&apos;s Performance</h3>
            {[
              { label: "Cars Washed", value: displayStats.todayWashes, max: 12, color: "var(--accent)" },
              { label: "Soap Remaining", value: Math.round(displaySoapPct), max: 100, color: soapCritical ? "var(--red)" : "var(--accent)", suffix: "%" },
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
              {soapCritical ? "⚠ Critical — request soap immediately" : `${displayStats.soapMl} ml available — sufficient`}
            </div>
            <p className="text-xs text-muted text-center">
              {soapCritical ? "Your balance is below threshold. Submit a request now." : "Your soap balance is healthy. Keep it up!"}
            </p>
            {soapCritical && (
              <button onClick={() => setTab("Request Soap")} className="w-full mt-3 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center justify-center gap-2">
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
            <h3 className="font-[family-name:var(--font-display)] text-lg">My Wash History</h3>
            <p className="text-xs text-muted mt-1">{displayHistory.length} washes recorded</p>
          </div>
          {displayHistory.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted">No wash history yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                  <th className="px-5 py-3">Plate</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Soap</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((h) => (
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
          <form onSubmit={submitRequest} className="rounded-2xl border border-line bg-panel p-6 space-y-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Request Soap from Store</h3>
            <p className="text-xs text-muted">Select the product and vehicle type — the amount is calculated automatically.</p>

            {/* Product */}
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Product</label>
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent">
                {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
              </select>
            </div>

            {/* Vehicle type */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted mb-2">Vehicle Type</p>
              <div className="space-y-2">
                {VEHICLE_TYPES.map((v) => (
                  <button type="button" key={v.id} onClick={() => setVehicleType(v.id)}
                    className="w-full rounded-xl p-3 text-left border transition flex items-center justify-between"
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
            <div className="rounded-xl p-4 bg-panel-2 border border-line space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted">Product</span><span>{products.find((p) => p.id === selectedProductId)?.product_name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Vehicle type</span><span>{selectedVT.name}</span></div>
              <div className="flex justify-between"><span className="text-muted">Cars</span><span className="font-[family-name:var(--font-mono)]">{carCount}</span></div>
              <div className="flex justify-between"><span className="text-muted">Soap per car</span><span className="font-[family-name:var(--font-mono)]">{selectedVT.default_soap_ml} ml</span></div>
              <div className="border-t border-line pt-2 flex justify-between font-medium">
                <span className="text-muted">Total requested</span>
                <span className="font-[family-name:var(--font-mono)] text-accent">{requestedMl} ml</span>
              </div>
            </div>

            <button type="submit" disabled={saving || !selectedProductId}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2">
              <Send size={15} /> {saving ? "Sending…" : `Request ${requestedMl} ml from Store`}
            </button>
          </form>

          {/* Request history */}
          <div className="rounded-2xl border border-line bg-panel overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-lg">My Requests</h3>
                <p className="text-xs text-muted mt-0.5">Store keeper will approve or reject</p>
              </div>
              <button onClick={load} className="p-1.5 rounded-lg text-muted hover:text-text"><RefreshCw size={14} /></button>
            </div>
            <div className="divide-y divide-line">
              {displayRequests.length === 0 && <p className="px-5 pb-5 text-sm text-muted">No requests yet.</p>}
              {displayRequests.map((req) => {
                const t = STATUS_TONE[req.status] ?? STATUS_TONE.pending;
                return (
                  <div key={req.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-[family-name:var(--font-mono)]">{req.request_number}</p>
                      <p className="text-xs text-muted mt-0.5 truncate">{req.product} · {req.quantity_requested} ml</p>
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
