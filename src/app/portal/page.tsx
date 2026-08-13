"use client";

import { useEffect, useState } from "react";
import {
  Droplet,
  Car,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Clock,
  Receipt,
} from "lucide-react";
import { VEHICLE_TYPES } from "@/lib/mock";
import { DataStore } from "@/lib/data-store";
import { SoapRequest, WashTransaction } from "@/lib/types";

const TABS = ["My Shift Dashboard", "Wash History", "Request Detergent Refill"] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#3A2E14", fg: "var(--amber)" },
  approved: { bg: "#123A34", fg: "var(--accent)" },
  rejected: { bg: "#3A1A1A", fg: "var(--red)" },
  partial: { bg: "#2a1f4a", fg: "var(--violet)" },
};

export default function PortalPage() {
  const [tab, setTab] = useState<Tab>("My Shift Dashboard");
  const [washerName, setWasherName] = useState("Yonas Bekele");
  const [washerId, setWasherId] = useState("w-1");
  const [soapMl, setSoapMl] = useState(750);
  const [washes, setWashes] = useState<WashTransaction[]>([]);
  const [requests, setRequests] = useState<SoapRequest[]>([]);
  const [vehicleType, setVehicleType] = useState<string>("small");
  const [carCount, setCarCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  const selectedVT = VEHICLE_TYPES.find((v) => v.id === vehicleType) || VEHICLE_TYPES[0];
  const requestedMl = selectedVT.default_soap_ml * carCount;

  async function loadData() {
    const [allWashes, allReqs, washersStock] = await Promise.all([
      DataStore.getWashTransactions(),
      DataStore.getSoapRequests(),
      DataStore.getWashersStock(),
    ]);

    const myStock = washersStock.find((w) => w.id === washerId || w.name === washerName);
    if (myStock) {
      setSoapMl(myStock.soap);
    }

    const myWashes = allWashes.filter((w) => w.washer_id === washerId || w.washer_name === washerName);
    setWashes(myWashes);

    const myReqs = allReqs.filter((r) => r.washer_id === washerId || r.washer_name === washerName);
    setRequests(myReqs);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("washos_active_session");
        if (raw) {
          const sess = JSON.parse(raw);
          if (sess.name) setWasherName(sess.name);
          if (sess.id) setWasherId(sess.id);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, [washerId, washerName]);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const inv = await DataStore.getInventory();
    const soapProduct = inv.find((i) => i.category === "Soap") || inv[0];

    await DataStore.createSoapRequest({
      washer_id: washerId,
      washer_name: washerName,
      inventory_id: soapProduct?.id || "inv-1",
      product_name: soapProduct?.product_name || "LARGO Foam Shampoo",
      quantity_requested: requestedMl,
      notes: `Prep for ${carCount} ${selectedVT.name} washes`,
    });

    notify(`✓ Requisition sent: ${requestedMl}ml requested.`);
    setSaving(false);
    setTab("My Shift Dashboard");
    await loadData();
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayWashes = washes.filter((w) => w.started_at.startsWith(today));
  const todayRevenue = todayWashes.reduce((sum, w) => sum + w.price, 0);
  const todayCommission = Math.round(todayRevenue * 0.2);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-panel border border-accent px-4 py-3 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium text-text">{toast}</span>
        </div>
      )}

      {/* Attendant Welcome Banner */}
      <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-accent">
        <div className="flex items-center gap-3.5">
          <div className="avatar w-12 h-12 text-base bg-accent text-slate-950 font-bold">
            {washerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text font-[family-name:var(--font-display)]">
              Welcome, {washerName}!
            </h2>
            <p className="text-xs text-muted">Wash Bay Attendant · Shift Active</p>
          </div>
        </div>

        {/* Soap Bottle Meter */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-panel-2 border border-line">
          <div className="flex items-center gap-2">
            <Droplet size={20} className={soapMl < 250 ? "text-red animate-pulse" : "text-accent"} />
            <div>
              <p className="text-[10px] text-muted uppercase font-semibold">Your Soap Balance</p>
              <p className="text-base font-bold font-mono text-text">{soapMl} ml</p>
            </div>
          </div>
          <button
            onClick={() => setTab("Request Detergent Refill")}
            className="btn btn-primary text-xs py-1 px-3"
          >
            Refill Bottle
          </button>
        </div>
      </div>

      {/* Quick KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4 space-y-1">
          <p className="section-label">Cars Washed Today</p>
          <p className="text-2xl font-bold font-mono text-text">{todayWashes.length}</p>
          <p className="text-[11px] text-muted">{washes.length} total washes logged</p>
        </div>

        <div className="card p-4 space-y-1">
          <p className="section-label">Gross Revenue Today</p>
          <p className="text-2xl font-bold font-mono text-text">{todayRevenue.toLocaleString()} ETB</p>
          <p className="text-[11px] text-muted">Wash tickets generated</p>
        </div>

        <div className="card p-4 space-y-1 col-span-2 sm:col-span-1 border-l-2 border-l-emerald-500">
          <p className="section-label">Est. Commission (20%)</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{todayCommission.toLocaleString()} ETB</p>
          <p className="text-[11px] text-muted">Earned today</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-panel border border-line w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? "active" : ""}`}>
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: SHIFT DASHBOARD */}
      {tab === "My Shift Dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Recent Washes */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-text text-sm">Today&apos;s Washes</h3>
            {todayWashes.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                <Car size={24} className="opacity-30 mx-auto mb-1.5" />
                <span>No vehicles washed yet today. Ready for your first car!</span>
              </div>
            ) : (
              <div className="space-y-2">
                {todayWashes.slice(0, 5).map((w) => (
                  <div key={w.id} className="p-3 rounded-lg bg-panel-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold font-mono text-text">{w.plate}</p>
                      <p className="text-[11px] text-muted capitalize">{w.vehicle_type_id} vehicle</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono text-accent">{w.price} ETB</p>
                      <span className="text-[10px] text-muted font-mono">-{w.soap_used_ml}ml soap</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Soap Requests */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-text text-sm">My Detergent Requisitions</h3>
            <div className="space-y-2">
              {requests.slice(0, 4).map((r) => {
                const tone = STATUS_TONE[r.status] || STATUS_TONE.pending;
                return (
                  <div key={r.id} className="p-3 rounded-lg bg-panel-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono font-bold text-accent">{r.request_number}</p>
                      <p className="text-[11px] text-muted">{r.product_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-text">{r.quantity_requested} ml</p>
                      <span className="badge text-[9px] capitalize" style={{ background: tone.bg, color: tone.fg }}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WASH HISTORY */}
      {tab === "Wash History" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Plate</th>
                  <th>Vehicle Type</th>
                  <th>Payment Method</th>
                  <th>Soap Used</th>
                  <th>Ticket Price</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {washes.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs font-bold text-accent">{w.receipt_number || "REC-1004"}</td>
                    <td className="font-mono font-bold text-text">{w.plate}</td>
                    <td className="capitalize text-xs">{w.vehicle_type_id}</td>
                    <td>
                      <span className="badge badge-approved uppercase text-[10px]">{w.payment_method}</span>
                    </td>
                    <td className="font-mono text-xs text-muted">{w.soap_used_ml} ml</td>
                    <td className="font-mono font-bold text-text">{w.price.toLocaleString()} ETB</td>
                    <td className="text-xs text-muted font-mono">
                      {new Date(w.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REQUEST REFILL */}
      {tab === "Request Detergent Refill" && (
        <div className="card p-6 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-text font-[family-name:var(--font-display)]">
              Request Soap Refill from Store
            </h3>
            <p className="text-xs text-muted">
              Select vehicle size and batch to calculate detergent volume standard automatically.
            </p>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="space-y-1.5">
              <label className="section-label">Vehicle Type</label>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setVehicleType(v.id)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      vehicleType === v.id
                        ? "border-accent bg-accent/10 text-accent font-bold"
                        : "border-line bg-panel-2 text-muted"
                    }`}
                  >
                    <p>{v.name}</p>
                    <span className="text-[10px] font-mono text-muted">{v.default_soap_ml}ml/car</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Car Batch Count</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 6].map((cnt) => (
                  <button
                    type="button"
                    key={cnt}
                    onClick={() => setCarCount(cnt)}
                    className={`py-2 rounded-xl border text-xs font-mono font-bold ${
                      carCount === cnt ? "border-accent bg-accent text-slate-900" : "border-line bg-panel-2 text-muted"
                    }`}
                  >
                    {cnt} Cars
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line flex justify-between items-center text-xs font-mono">
              <span className="text-muted">Calculated Chemical Volume:</span>
              <span className="text-2xl font-bold text-accent">{requestedMl} ml</span>
            </div>

            <button type="submit" disabled={saving} className="btn btn-primary w-full py-3 flex items-center justify-center gap-2">
              <Send size={16} />
              <span>Send Refill Request to Storekeeper</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
