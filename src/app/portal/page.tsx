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
  AlertTriangle,
  Play,
  Wind,
  Check,
  Award,
  Wallet,
  Calendar,
} from "lucide-react";
import { VEHICLE_TYPES } from "@/lib/mock";
import { DataStore } from "@/lib/data-store";
import { SoapRequest, WashStatus, WashTransaction } from "@/lib/types";

const QUICK_REFILLS = [
  { label: "+250 ml (1-2 Light cars)", ml: 250 },
  { label: "+500 ml (Standard Canister)", ml: 500 },
  { label: "+1,000 ml (Truck / Heavy shift)", ml: 1000 },
];

export default function PortalPage() {
  const [tab, setTab] = useState<"station" | "history" | "refill">("station");
  const [washerName, setWasherName] = useState("Yonas Bekele");
  const [washerId, setWasherId] = useState("w-1");
  const [soapMl, setSoapMl] = useState(750);
  const [washes, setWashes] = useState<WashTransaction[]>([]);
  const [requests, setRequests] = useState<SoapRequest[]>([]);
  const [customMl, setCustomMl] = useState(500);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

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

  async function handleQuickRefill(ml: number, noteMsg?: string) {
    setSaving(true);
    const inv = await DataStore.getInventory();
    const soap = inv.find((i) => i.category === "Soap") || inv[0];

    await DataStore.createSoapRequest({
      washer_id: washerId,
      washer_name: washerName,
      inventory_id: soap?.id || "inv-1",
      product_name: soap?.product_name || "LARGO Foam Shampoo",
      quantity_requested: ml,
      notes: noteMsg || `Fast refill request from station (${ml}ml)`,
    });

    notify(`✓ Requisition for ${ml}ml sent to Storekeeper.`);
    setSaving(false);
    await loadData();
  }

  async function advanceWashStatus(washId: string, nextStatus: WashStatus) {
    await DataStore.updateWashStatus(washId, nextStatus);
    notify(`✓ Vehicle status updated to "${nextStatus.replace("_", " ").toUpperCase()}"`);
    await loadData();
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayWashes = washes.filter((w) => w.started_at.startsWith(today));
  const completedToday = todayWashes.filter((w) => w.status === "completed");
  const activeWashes = todayWashes.filter(
    (w) => w.status === "in_progress" || w.status === "queued" || w.status === "drying" || w.status === "ready"
  );
  const todayRevenue = completedToday.reduce((sum, w) => sum + w.price, 0);
  const todayCommission = Math.round(todayRevenue * 0.2); // 20% commission

  const pendingReq = requests.find((r) => r.status === "pending");

  // Gauge calculations
  const capacity = 1000;
  const pct = Math.min(100, Math.max(0, Math.round((soapMl / capacity) * 100)));
  const isCritical = pct < 25;
  const isWarning = pct < 50;
  const approxLightCars = Math.floor(soapMl / 180);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl glass-card border border-accent px-5 py-3.5 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={18} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text">{toast}</span>
        </div>
      )}

      {/* Attendant Station Banner */}
      <div className="card glass-card p-5 sm:p-6 border-line relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-xl font-bold font-mono">
              {washerName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text font-[family-name:var(--font-display)]">
                  {washerName}
                </h2>
                <span className="badge badge-ok">On Shift</span>
              </div>
              <p className="text-xs text-muted font-mono mt-0.5">
                Bay Station Attendant · ID: {washerId} · Standard: 180ml / Light Car
              </p>
            </div>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={loadData}
            className="btn btn-ghost text-xs gap-2 self-start sm:self-auto border border-line"
          >
            <RefreshCw size={13} />
            <span>Sync Live</span>
          </button>
        </div>

        {/* Pending Requisition Banner */}
        {pendingReq && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber/10 border border-amber/30 flex items-center justify-between gap-3 fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber animate-ping" />
              <p className="text-xs font-medium text-text">
                <strong className="text-amber">Refill Pending Storekeeper Approval:</strong>{" "}
                {pendingReq.quantity_requested}ml of {pendingReq.product_name}
              </p>
            </div>
            <span className="badge badge-pending shrink-0">Awaiting Store</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex rounded-xl bg-panel-2 p-1 border border-line">
        <button
          onClick={() => setTab("station")}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            tab === "station" ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
          }`}
        >
          <Car size={15} />
          <span>My Live Bay & Canister</span>
        </button>
        <button
          onClick={() => setTab("refill")}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            tab === "refill" ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
          }`}
        >
          <Droplet size={15} />
          <span>Request Detergent Refill</span>
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            tab === "history" ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
          }`}
        >
          <Award size={15} />
          <span>Shift Earnings & History ({completedToday.length})</span>
        </button>
      </div>

      {/* ── TAB 1: LIVE STATION & CANISTER ─────────────────────────── */}
      {tab === "station" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 fade-in">
          {/* Canister Soap Gauge Card */}
          <div className="card glass-card p-6 flex flex-col justify-between items-center text-center space-y-4 md:col-span-1 border-line">
            <div className="w-full flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
                Detergent Canister
              </span>
              <span
                className={`badge ${
                  isCritical ? "badge-critical" : isWarning ? "badge-low" : "badge-ok"
                }`}
              >
                {isCritical ? "Critical" : isWarning ? "Refill Soon" : "Good"}
              </span>
            </div>

            {/* Radial SVG Gauge */}
            <div className="relative flex items-center justify-center my-2">
              <svg width="150" height="150" viewBox="0 0 100 100" className="rotate-[-90deg]">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--panel-3)"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={isCritical ? "var(--red)" : isWarning ? "var(--amber)" : "var(--accent)"}
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold font-mono text-text">{soapMl}</span>
                <span className="text-[11px] font-mono text-muted uppercase">ml remaining</span>
              </div>
            </div>

            <div className="w-full bg-panel-2 p-3 rounded-xl border border-line text-left space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Estimated Capacity:</span>
                <span className="font-semibold text-text">~{approxLightCars} Light Washes</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted">Canister Max:</span>
                <span className="font-mono text-text">1,000 ml</span>
              </div>
            </div>

            <button
              onClick={() => handleQuickRefill(500)}
              disabled={saving || !!pendingReq}
              className="btn btn-primary w-full text-xs font-semibold py-2.5 rounded-xl gap-2"
            >
              <Droplet size={14} />
              <span>{pendingReq ? "Refill Requested" : "Request 500ml Refill"}</span>
            </button>
          </div>

          {/* Active Vehicles in Bay Card */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
                Assigned Vehicles In My Bay ({activeWashes.length})
              </h3>
            </div>

            {activeWashes.length === 0 ? (
              <div className="card glass-card p-8 text-center space-y-3 border-dashed border-line">
                <div className="w-12 h-12 rounded-2xl bg-panel-2 flex items-center justify-center mx-auto text-muted">
                  <CheckCircle2 size={24} className="text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-text">Bay is currently clear</p>
                  <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                    When cashiers record a new arrival and assign it to you, it will appear here with
                    1-touch action buttons.
                  </p>
                </div>
              </div>
            ) : (
              activeWashes.map((wash) => {
                const vt = VEHICLE_TYPES.find((v) => v.id === wash.vehicle_type_id) || VEHICLE_TYPES[0];
                return (
                  <div
                    key={wash.id}
                    className="card glass-card p-5 border-line space-y-4 relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg font-black font-mono tracking-wider text-text bg-panel-2 px-2.5 py-1 rounded-lg border border-line">
                            {wash.plate}
                          </span>
                          <span className="badge badge-active">{vt.name}</span>
                          <span className="text-xs font-mono text-muted">Bay {wash.bay_number ?? 1}</span>
                        </div>
                        <p className="text-xs text-muted mt-1.5">
                          Customer: <strong className="text-text">{wash.customer_name}</strong> · Total:{" "}
                          <strong className="text-accent font-mono">ETB {wash.price}</strong>
                        </p>
                      </div>

                      <span
                        className={`badge ${
                          wash.status === "in_progress"
                            ? "badge-approved"
                            : wash.status === "drying"
                            ? "badge-partial"
                            : "badge-pending"
                        }`}
                      >
                        {wash.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>

                    {/* Progress Control Buttons (Big tactile buttons for wet hands) */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => advanceWashStatus(wash.id, "in_progress")}
                        disabled={wash.status === "in_progress"}
                        className={`btn-touch btn flex items-center justify-center gap-2 border text-xs font-bold transition-all ${
                          wash.status === "in_progress"
                            ? "bg-accent/20 text-accent border-accent/40 shadow-xs"
                            : "bg-panel-2 text-muted hover:text-text border-line"
                        }`}
                      >
                        <Play size={14} />
                        <span>Washing</span>
                      </button>

                      <button
                        onClick={() => advanceWashStatus(wash.id, "drying")}
                        disabled={wash.status === "drying"}
                        className={`btn-touch btn flex items-center justify-center gap-2 border text-xs font-bold transition-all ${
                          wash.status === "drying"
                            ? "bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-xs"
                            : "bg-panel-2 text-muted hover:text-text border-line"
                        }`}
                      >
                        <Wind size={14} />
                        <span>Drying</span>
                      </button>

                      <button
                        onClick={() => advanceWashStatus(wash.id, "completed")}
                        className="btn-touch btn btn-primary flex items-center justify-center gap-2 text-xs font-bold shadow-md shadow-accent/20"
                      >
                        <Check size={16} />
                        <span>Finish & Done</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Today's Commission Summary Box */}
            <div className="card glass-card p-5 border-line flex items-center justify-between bg-gradient-to-r from-accent/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-slate-950 flex items-center justify-center font-bold">
                  <Wallet size={18} />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-muted font-semibold">
                    My Shift Commission (20%)
                  </p>
                  <p className="text-xl font-extrabold font-mono text-text">
                    ETB {todayCommission.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-muted">Completed Today</span>
                <p className="text-lg font-bold font-mono text-accent">{completedToday.length} cars</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: REFILL REQUISITION FORM ─────────────────────────── */}
      {tab === "refill" && (
        <div className="card glass-card p-6 sm:p-8 space-y-6 fade-in border-line">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text font-[family-name:var(--font-display)]">
              Requisition Chemical Refill
            </h3>
            <p className="text-xs text-muted">
              Submit an approved detergent refill request to the storekeeper. Stock will be dispensed to
              your canister upon store approval.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
              Select Preset Quantity:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {QUICK_REFILLS.map((q) => (
                <button
                  key={q.ml}
                  type="button"
                  onClick={() => setCustomMl(q.ml)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    customMl === q.ml
                      ? "bg-accent/15 border-accent text-accent font-semibold shadow-xs"
                      : "bg-panel-2 border-line text-text hover:border-line-2"
                  }`}
                >
                  <p className="text-sm font-bold font-mono">{q.ml} ml</p>
                  <p className="text-[11px] text-muted mt-1">{q.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom ml input */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
              Or Custom Milliliters (ml):
            </label>
            <input
              type="number"
              value={customMl}
              onChange={(e) => setCustomMl(Number(e.target.value))}
              min={50}
              max={2500}
              className="input font-mono text-base"
              placeholder="e.g. 750"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">
              Notes for Storekeeper (Optional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input text-sm"
              placeholder="e.g. Heavy afternoon queue expected"
            />
          </div>

          <button
            type="button"
            onClick={() => handleQuickRefill(customMl, notes)}
            disabled={saving || !customMl || customMl <= 0}
            className="btn btn-primary w-full py-3 text-sm font-semibold rounded-xl gap-2 shadow-lg shadow-accent/25"
          >
            <Send size={16} />
            <span>Send Refill Request ({customMl} ml)</span>
          </button>
        </div>
      )}

      {/* ── TAB 3: SHIFT HISTORY & EARNINGS ───────────────────────── */}
      {tab === "history" && (
        <div className="card glass-card p-6 space-y-4 fade-in border-line">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h3 className="text-base font-bold text-text">Today&apos;s Completed Washes</h3>
              <p className="text-xs text-muted font-mono">
                Total Revenue: ETB {todayRevenue.toLocaleString()} · Estimated Commission (20%): ETB{" "}
                {todayCommission.toLocaleString()}
              </p>
            </div>
            <span className="badge badge-ok">{completedToday.length} completed</span>
          </div>

          {completedToday.length === 0 ? (
            <p className="text-sm text-center py-8 text-muted">No completed washes yet today.</p>
          ) : (
            <div className="divide-y divide-line">
              {completedToday.map((w) => (
                <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-text px-2 py-0.5 rounded bg-panel-2 border border-line">
                      {w.plate}
                    </span>
                    <div>
                      <p className="font-semibold text-text">{w.customer_name}</p>
                      <p className="text-[10px] text-muted font-mono">
                        {w.services?.join(", ") || "Standard Wash"} · Bay {w.bay_number ?? 1}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-accent">ETB {w.price}</span>
                    <p className="text-[10px] font-mono text-emerald-400">
                      +ETB {Math.round(w.price * 0.2)} comm.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
