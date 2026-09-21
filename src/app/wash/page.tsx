"use client";

import { useEffect, useState } from "react";
import {
  Car,
  Droplet,
  Clock,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Printer,
  X,
  Search,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  QrCode,
  Check,
  Play,
  Wind,
  Plus,
  Layers,
  Award,
  Phone,
} from "lucide-react";
import { DEFAULT_VEHICLE_TYPES as VEHICLE_TYPES, DEFAULT_WASH_SERVICES as WASH_SERVICES } from "@/lib/catalog";
import { DataStore } from "@/lib/data-store";
import { PaymentMethod, WashTransaction, VehicleType, WashService, WashStatus } from "@/lib/types";
import ThermalReceipt from "@/components/ThermalReceipt";

type Washer = { id: string; name: string; soap: number; phone?: string };

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; badge: string }[] = [
  { id: "cash", label: "Cash", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "telebirr", label: "Telebirr", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { id: "cbe_birr", label: "CBE Birr", badge: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  { id: "card", label: "Card / POS", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { id: "account", label: "Corporate Account", badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
];

export default function WashPage() {
  const [activeTab, setActiveTab] = useState<"bays" | "entry" | "history">("bays");
  const [vehicleType, setVehicleType] = useState<VehicleType["id"]>("small");
  const [plate, setPlate] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [washerId, setWasherId] = useState("");
  const [washers, setWashers] = useState<Washer[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>(["exterior"]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [txnRef, setTxnRef] = useState("");
  const [bayNumber, setBayNumber] = useState<number>(1);
  const [recentWashes, setRecentWashes] = useState<WashTransaction[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<WashTransaction | null>(null);
  const [thermalReceipt, setThermalReceipt] = useState<WashTransaction | null>(null);
  const [loyaltyPerk, setLoyaltyPerk] = useState<{ nextDiscount: string | null; totalPastWashes: number; rewardActive?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    const [washersList, allWashes] = await Promise.all([
      DataStore.getWashersStock(),
      DataStore.getWashTransactions(),
    ]);

    setWashers(washersList);
    if (washersList.length > 0 && !washerId) {
      setWasherId(washersList[0].id);
    }
    setRecentWashes(allWashes);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  // Auto-detect returning vehicle & loyalty status
  useEffect(() => {
    if (plate.trim().length >= 4) {
      DataStore.getLoyaltyStatus(plate).then((status) => {
        if (status) setLoyaltyPerk(status);
        else setLoyaltyPerk(null);
      });

      const foundWash = recentWashes.find((w) => w.plate?.toLowerCase() === plate.trim().toLowerCase());
      if (foundWash) {
        setVehicleType(foundWash.vehicle_type_id);
        if (foundWash.customer_name && !customer) {
          setCustomer(foundWash.customer_name);
        }
        if (foundWash.customer_phone && !customerPhone) {
          setCustomerPhone(foundWash.customer_phone);
        }
      }
    } else {
      setLoyaltyPerk(null);
    }
  }, [plate, recentWashes]);

  const vt = VEHICLE_TYPES.find((v) => v.id === vehicleType) || VEHICLE_TYPES[0];
  const assignedWasher = washers.find((w) => w.id === washerId) || washers[0];

  // Pricing calculations
  const serviceObjects = WASH_SERVICES.filter((s) => selectedServices.includes(s.id));
  const basePrice = vt.default_price;
  const addOnsTotal = serviceObjects
    .filter((s) => s.category !== "standard")
    .reduce((sum, s) => {
      const price = vehicleType === "large" ? s.price_large : vehicleType === "medium" ? s.price_medium : s.price_small;
      return sum + price;
    }, 0);

  let rawTotal = basePrice + addOnsTotal;
  // Apply loyalty discount if active
  if (loyaltyPerk?.nextDiscount?.includes("50%")) {
    rawTotal = Math.round(rawTotal * 0.5);
  } else if (loyaltyPerk?.nextDiscount?.includes("FREE")) {
    rawTotal = 0;
  }

  const extraSoap = serviceObjects.reduce((sum, s) => sum + (s.extra_soap_ml || 0), 0);
  const totalSoapNeeded = vt.default_soap_ml + extraSoap;

  async function handleCreateWash(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) {
      notify("Please enter a vehicle license plate.");
      return;
    }

    if ((paymentMethod === "telebirr" || paymentMethod === "cbe_birr") && !txnRef.trim()) {
      notify(`Please input the ${paymentMethod === "telebirr" ? "Telebirr" : "CBE Birr"} transaction code.`);
      return;
    }

    if (assignedWasher && assignedWasher.soap < totalSoapNeeded) {
      notify(`⚠️ Warning: ${assignedWasher.name} has only ${assignedWasher.soap}ml soap left (needs ${totalSoapNeeded}ml).`);
    }

    setSaving(true);
    try {
      const newWash = await DataStore.createWashTransaction({
        plate: plate.toUpperCase().trim(),
        vehicle_type_id: vehicleType,
        washer_id: assignedWasher?.id || "w-1",
        washer_name: assignedWasher?.name || "Assigned Attendant",
        customer_name: customer.trim() || "Walk-in Guest",
        customer_phone: customerPhone.trim() || undefined,
        price: rawTotal,
        soap_used_ml: totalSoapNeeded,
        payment_method: paymentMethod,
        payment_status: "paid",
        txn_ref: txnRef.trim() || undefined,
        services: selectedServices,
        bay_number: bayNumber,
        status: "in_progress",
        actual_minutes: vt.standard_minutes,
      });

      notify(`✓ Wash recorded · ETB ${rawTotal.toLocaleString()} · ${totalSoapNeeded}ml deducted`);
      setActiveReceipt(newWash);

      // Reset form
      setPlate("");
      setCustomer("");
      setCustomerPhone("");
      setTxnRef("");
      setSelectedServices(["exterior"]);
      setActiveTab("bays");
      await loadData();
    } catch (err) {
      notify("Failed to record wash transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, nextStatus: WashStatus) {
    await DataStore.updateWashStatus(id, nextStatus);
    notify(`✓ Vehicle status advanced to "${nextStatus.replace("_", " ").toUpperCase()}"`);
    await loadData();
  }

  // Group washes for Live Bay Board
  const today = new Date().toISOString().slice(0, 10);
  const todayWashes = recentWashes.filter((w) => w.started_at.startsWith(today) && w.status !== "cancelled");

  const queuedList = todayWashes.filter((w) => w.status === "queued");
  const washingList = todayWashes.filter((w) => w.status === "in_progress");
  const dryingList = todayWashes.filter((w) => w.status === "drying");
  const readyList = todayWashes.filter((w) => w.status === "ready");

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl glass-card border border-accent px-5 py-3.5 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={18} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text">{toast}</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="card glass-card p-5 border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-[family-name:var(--font-display)] text-text">
              Live Bays & Wash POS
            </h2>
            <span className="badge badge-ok animate-pulse">Live Operations</span>
          </div>
          <p className="text-xs text-muted font-mono mt-0.5">
            Real-time Bay Queue, Detergent Consumption & Ethiopian Mobile Money POS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("entry")}
            className="btn btn-primary text-xs font-semibold py-2 px-3.5 rounded-xl gap-2 shadow-sm shadow-accent/20"
          >
            <Plus size={14} />
            <span>New Car Arrival</span>
          </button>
          <button
            onClick={loadData}
            className="icon-btn rounded-xl border border-line"
            title="Sync live"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-panel-2 p-1 border border-line">
        <button
          onClick={() => setActiveTab("bays")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "bays" ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
          }`}
        >
          <Layers size={14} />
          <span>Live Bay Board ({todayWashes.filter((w) => w.status !== "completed").length} Active)</span>
        </button>
        <button
          onClick={() => setActiveTab("entry")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "entry" ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
          }`}
        >
          <Plus size={14} />
          <span>New Vehicle Check-in (POS)</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "history" ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
          }`}
        >
          <Clock size={14} />
          <span>Today&apos;s Wash Log ({todayWashes.length})</span>
        </button>
      </div>

      {/* ── TAB 1: LIVE BAY BOARD (KANBAN) ────────────────────────── */}
      {activeTab === "bays" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 fade-in">
          {/* Col 1: Queue / Arrived */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-mono font-bold uppercase text-muted flex items-center gap-1.5">
                <Clock size={13} className="text-amber" /> 1. Queue ({queuedList.length})
              </span>
            </div>
            <div className="space-y-2.5 min-h-[300px] p-2 rounded-2xl bg-panel-2/50 border border-line">
              {queuedList.length === 0 ? (
                <p className="text-xs text-muted text-center py-10 font-mono">No queue</p>
              ) : (
                queuedList.map((w) => (
                  <div key={w.id} className="card glass-card p-3.5 space-y-2.5 border-line shadow-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-sm bg-panel-2 px-2 py-0.5 rounded border border-line text-text">
                        {w.plate}
                      </span>
                      <span className="text-[10px] font-mono text-muted">Bay {w.bay_number}</span>
                    </div>
                    <p className="text-xs text-text-2 font-medium">{w.customer_name}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-line text-xs font-mono">
                      <span className="text-accent font-bold">ETB {w.price}</span>
                      <button
                        onClick={() => updateStatus(w.id, "in_progress")}
                        className="btn btn-primary text-[10px] py-1 px-2 rounded-lg gap-1"
                      >
                        <Play size={10} /> <span>Move to Bay</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Col 2: In Wash Bay */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-mono font-bold uppercase text-accent flex items-center gap-1.5">
                <Droplet size={13} /> 2. Washing ({washingList.length})
              </span>
            </div>
            <div className="space-y-2.5 min-h-[300px] p-2 rounded-2xl bg-panel-2/50 border border-line">
              {washingList.length === 0 ? (
                <p className="text-xs text-muted text-center py-10 font-mono">No cars in bays</p>
              ) : (
                washingList.map((w) => (
                  <div key={w.id} className="card glass-card p-3.5 space-y-2.5 border-accent/40 shadow-xs glow-cyan">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-sm bg-accent/15 text-accent px-2 py-0.5 rounded border border-accent/30">
                        {w.plate}
                      </span>
                      <span className="text-[10px] font-mono text-muted">Bay {w.bay_number}</span>
                    </div>
                    <p className="text-xs text-text-2">
                      Attendant: <strong className="text-text">{w.washer_name}</strong>
                    </p>
                    <div className="flex justify-between items-center pt-2 border-t border-line text-xs font-mono">
                      <span className="text-muted text-[10px]">{w.soap_used_ml}ml soap</span>
                      <button
                        onClick={() => updateStatus(w.id, "drying")}
                        className="btn bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border-purple-500/30 text-[10px] py-1 px-2 rounded-lg gap-1 font-semibold"
                      >
                        <Wind size={10} /> <span>To Drying</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Col 3: Detailing & Drying */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-mono font-bold uppercase text-purple-400 flex items-center gap-1.5">
                <Wind size={13} /> 3. Drying / Detailing ({dryingList.length})
              </span>
            </div>
            <div className="space-y-2.5 min-h-[300px] p-2 rounded-2xl bg-panel-2/50 border border-line">
              {dryingList.length === 0 ? (
                <p className="text-xs text-muted text-center py-10 font-mono">No detailing</p>
              ) : (
                dryingList.map((w) => (
                  <div key={w.id} className="card glass-card p-3.5 space-y-2.5 border-purple-500/40 shadow-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-sm bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">
                        {w.plate}
                      </span>
                      <span className="badge badge-partial text-[9px]">Detailing</span>
                    </div>
                    <p className="text-xs text-text-2 font-medium">{w.customer_name}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-line text-xs font-mono">
                      <span className="text-accent font-bold">ETB {w.price}</span>
                      <button
                        onClick={() => updateStatus(w.id, "ready")}
                        className="btn bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30 text-[10px] py-1 px-2 rounded-lg gap-1 font-semibold"
                      >
                        <Check size={10} /> <span>Mark Ready</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Col 4: Ready for Pickup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> 4. Ready for Customer ({readyList.length})
              </span>
            </div>
            <div className="space-y-2.5 min-h-[300px] p-2 rounded-2xl bg-panel-2/50 border border-line">
              {readyList.length === 0 ? (
                <p className="text-xs text-muted text-center py-10 font-mono">No cars ready</p>
              ) : (
                readyList.map((w) => (
                  <div key={w.id} className="card glass-card p-3.5 space-y-2.5 border-emerald-500/40 shadow-xs glow-emerald">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-sm bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        {w.plate}
                      </span>
                      <span className="badge badge-approved text-[9px]">Cleaned</span>
                    </div>
                    <p className="text-xs text-text-2 font-medium">{w.customer_name}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-line text-xs font-mono">
                      <button
                        onClick={() => setThermalReceipt(w)}
                        className="text-muted hover:text-text flex items-center gap-1 text-[11px]"
                      >
                        <Printer size={12} /> Receipt
                      </button>
                      <button
                        onClick={() => updateStatus(w.id, "completed")}
                        className="btn btn-primary text-[10px] py-1 px-2.5 rounded-lg gap-1 font-bold"
                      >
                        <span>Release Car</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: FAST POS VEHICLE CHECK-IN ──────────────────────── */}
      {activeTab === "entry" && (
        <form onSubmit={handleCreateWash} className="card glass-card p-6 sm:p-8 space-y-6 fade-in border-line">
          {/* License Plate & Customer Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
                License Plate (Ethiopia Format):
              </label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="e.g. 2-B12345 AA"
                required
                className="input font-mono text-base font-bold tracking-wider"
              />
              {loyaltyPerk?.rewardActive && (
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                  <Award size={12} /> {loyaltyPerk.nextDiscount}! ({loyaltyPerk.totalPastWashes} previous washes)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
                Customer Name (Optional):
              </label>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. Abebe Kebede"
                className="input text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
                Customer Phone (SMS Pickup):
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0911..."
                className="input text-sm font-mono"
              />
            </div>
          </div>

          {/* Vehicle Tier Selection */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
              Select Vehicle Tier & Standard Detergent:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {VEHICLE_TYPES.map((v) => {
                const isSelected = vehicleType === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleType(v.id as VehicleType["id"])}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-accent/15 border-accent text-accent font-semibold shadow-xs"
                        : "bg-panel-2 border-line text-text hover:border-line-2"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-text">{v.name}</span>
                      <span className="font-mono text-xs font-bold text-accent">ETB {v.default_price}</span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">{v.examples}</p>
                    <p className="text-[10px] font-mono text-muted mt-2">
                      Std: {v.default_soap_ml}ml soap · {v.standard_minutes} mins
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Add-ons & Bay Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
                Assigned Attendant & Canister:
              </label>
              <select
                value={washerId}
                onChange={(e) => setWasherId(e.target.value)}
                className="input text-sm"
              >
                {washers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.soap} ml remaining soap)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
                Wash Bay Station:
              </label>
              <select
                value={bayNumber}
                onChange={(e) => setBayNumber(Number(e.target.value))}
                className="input text-sm"
              >
                <option value={1}>Bay 1 (Light vehicles)</option>
                <option value={2}>Bay 2 (Trucks & SUV)</option>
                <option value={3}>Bay 3 (Express Wash)</option>
                <option value={4}>Bay 4 (Detailing & Wax)</option>
              </select>
            </div>
          </div>

          {/* Payment Method & Telebirr/CBE Prompt */}
          <div className="space-y-3 pt-2 border-t border-line">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
              Payment Method & Verification:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMethod(opt.id)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-center ${
                    paymentMethod === opt.id
                      ? "bg-accent/15 border-accent text-accent shadow-xs"
                      : "bg-panel-2 border-line text-muted hover:text-text"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* If Mobile Money: Show QR Code & Transaction Code Input */}
            {(paymentMethod === "telebirr" || paymentMethod === "cbe_birr") && (
              <div className="p-4 rounded-xl bg-panel-2 border border-accent/40 flex flex-col sm:flex-row items-center gap-4 fade-in">
                <div className="w-16 h-16 rounded-xl bg-white p-1 flex items-center justify-center shrink-0">
                  <QrCode size={56} className="text-slate-900" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-text">
                    Scan {paymentMethod === "telebirr" ? "Telebirr" : "CBE Birr"} Merchant QR Code
                  </p>
                  <p className="text-[11px] text-muted font-mono">
                    Merchant Code: <strong className="text-text">908821</strong> · Account: WashOS Express
                  </p>
                  <input
                    type="text"
                    value={txnRef}
                    onChange={(e) => setTxnRef(e.target.value)}
                    placeholder="Enter Transaction Ref / SMS code (Required)"
                    required
                    className="input text-xs font-mono mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Order Summary & Submit Button */}
          <div className="pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-muted uppercase">Total Price Due:</span>
              <p className="text-2xl font-black font-mono text-accent">
                ETB {rawTotal.toLocaleString()}{" "}
                <span className="text-xs text-muted font-normal">({totalSoapNeeded}ml soap)</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary py-3 px-8 text-sm font-bold rounded-xl gap-2 shadow-lg shadow-accent/25"
            >
              <CheckCircle2 size={16} />
              <span>{saving ? "Registering..." : "Confirm Arrival & Generate Receipt"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ── TAB 3: SHIFT WASH HISTORY ─────────────────────────────── */}
      {activeTab === "history" && (
        <div className="card glass-card border-line overflow-hidden fade-in">
          <div className="p-4 border-b border-line flex justify-between items-center">
            <h3 className="font-bold text-sm text-text">Today&apos;s Completed & Active Washes</h3>
            <span className="badge badge-ok">{todayWashes.length} recorded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plate</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Attendant</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {todayWashes.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono font-bold text-text">{w.plate}</td>
                    <td className="text-xs capitalize">{w.vehicle_type_id}</td>
                    <td className="text-xs">{w.customer_name}</td>
                    <td className="text-xs">{w.washer_name}</td>
                    <td>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-panel-2 border border-line capitalize">
                        {w.payment_method.replace("_", " ")}
                      </span>
                    </td>
                    <td className="font-mono font-bold text-accent">ETB {w.price}</td>
                    <td>
                      <span
                        className={`badge ${
                          w.status === "completed"
                            ? "badge-approved"
                            : w.status === "in_progress"
                            ? "badge-active"
                            : "badge-pending"
                        }`}
                      >
                        {w.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setThermalReceipt(w)}
                        className="icon-btn text-muted hover:text-accent"
                        title="Print Receipt"
                      >
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal */}
      {thermalReceipt && (
        <ThermalReceipt wash={thermalReceipt} onClose={() => setThermalReceipt(null)} />
      )}
    </div>
  );
}
