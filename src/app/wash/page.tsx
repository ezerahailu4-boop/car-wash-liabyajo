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
} from "lucide-react";
import { VEHICLE_TYPES, WASH_SERVICES } from "@/lib/mock";
import { DataStore } from "@/lib/data-store";
import { PaymentMethod, WashTransaction, VehicleType, WashService } from "@/lib/types";
import ThermalReceipt from "@/components/ThermalReceipt";

type Washer = { id: string; name: string; soap: number; phone?: string };

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; badge: string }[] = [
  { id: "cash", label: "Cash", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "telebirr", label: "Telebirr", badge: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  { id: "cbe_birr", label: "CBE Birr", badge: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  { id: "card", label: "Card / POS", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { id: "account", label: "Corporate Account", badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
];

export default function WashEntryPage() {
  const [activeTab, setActiveTab] = useState<"entry" | "queue" | "history">("entry");
  const [vehicleType, setVehicleType] = useState<VehicleType["id"]>("small");
  const [plate, setPlate] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [washerId, setWasherId] = useState("");
  const [washers, setWashers] = useState<Washer[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>(["exterior"]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [bayNumber, setBayNumber] = useState<number>(1);
  const [washQueue, setWashQueue] = useState<WashTransaction[]>([]);
  const [recentWashes, setRecentWashes] = useState<WashTransaction[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<WashTransaction | null>(null);
  const [thermalReceipt, setThermalReceipt] = useState<WashTransaction | null>(null);
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
    setWashQueue(allWashes.filter((w) => w.status !== "cancelled"));
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  // Auto-detect returning vehicle / customer
  useEffect(() => {
    if (plate.trim().length >= 4) {
      DataStore.getCustomers().then((custs) => {
        const foundWash = recentWashes.find((w) => w.plate?.toLowerCase() === plate.trim().toLowerCase());
        if (foundWash) {
          setVehicleType(foundWash.vehicle_type_id);
          if (foundWash.customer_name && !customer) {
            setCustomer(foundWash.customer_name);
          }
        }
      });
    }
  }, [plate, recentWashes]);

  const vt = VEHICLE_TYPES.find((v) => v.id === vehicleType) || VEHICLE_TYPES[0];
  const assignedWasher = washers.find((w) => w.id === washerId) || washers[0];

  // Calculate pricing & total soap needed
  const serviceObjects = WASH_SERVICES.filter((s) => selectedServices.includes(s.id));
  const basePrice = vt.default_price;
  const extraServicesPrice = serviceObjects.reduce((sum, s) => {
    if (s.id === "exterior") return sum; // included in base
    if (vehicleType === "small") return sum + s.price_small;
    if (vehicleType === "medium") return sum + s.price_medium;
    return sum + s.price_large;
  }, 0);
  const totalPrice = basePrice + extraServicesPrice;

  const extraSoapMl = serviceObjects.reduce((sum, s) => sum + s.extra_soap_ml, 0);
  const totalSoapNeeded = vt.default_soap_ml + extraSoapMl;

  const isLowSoap = assignedWasher ? assignedWasher.soap < totalSoapNeeded : false;

  function toggleService(serviceId: string) {
    if (serviceId === "exterior") return; // always active
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plate.trim()) {
      notify("Please enter a vehicle license plate.");
      return;
    }
    if (isLowSoap) {
      notify(`Warning: ${assignedWasher?.name} has insufficient soap (${assignedWasher?.soap}ml available, ${totalSoapNeeded}ml required).`);
      return;
    }

    setSaving(true);
    try {
      // 1. Create or link customer if entered
      if (customer.trim()) {
        const custs = await DataStore.getCustomers();
        const existing = custs.find((c) => c.full_name.toLowerCase() === customer.trim().toLowerCase());
        if (!existing) {
          await DataStore.createCustomer({
            full_name: customer.trim(),
            phone: customerPhone.trim() || undefined,
            notes: `Auto-created from wash entry (${plate.toUpperCase()})`,
          });
        }
      }

      const serviceNames = serviceObjects.map((s) => s.name);

      const newWash = await DataStore.createWashTransaction({
        plate: plate.toUpperCase().trim(),
        vehicle_type_id: vehicleType,
        washer_id: assignedWasher.id,
        washer_name: assignedWasher.name,
        customer_name: customer.trim() || "Walk-in Customer",
        price: totalPrice,
        soap_used_ml: totalSoapNeeded,
        payment_method: paymentMethod,
        payment_status: "paid",
        services: serviceNames,
        bay_number: bayNumber,
        status: "completed",
        completed_at: new Date().toISOString(),
        actual_minutes: vt.standard_minutes,
      });

      notify(`✓ Wash recorded · ${totalPrice.toLocaleString()} birr · ${totalSoapNeeded}ml deducted`);
      setActiveReceipt(newWash);

      // Reset form
      setPlate("");
      setCustomer("");
      setCustomerPhone("");
      setSelectedServices(["exterior"]);
      await loadData();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error recording wash transaction.");
    }
    setSaving(false);
  }

  async function updateQueueStatus(washId: string, nextStatus: WashTransaction["status"]) {
    await DataStore.updateWashStatus(washId, nextStatus);
    notify(`Status updated to ${nextStatus.replace("_", " ")}`);
    await loadData();
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-panel border border-accent px-4 py-3 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium text-text">{toast}</span>
        </div>
      )}

      {/* Header with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text font-[family-name:var(--font-display)]">
            Wash Bay Operations & POS
          </h2>
          <p className="text-sm text-muted">
            Process vehicle washes, deduct detergent standards, assign bays, and print receipts.
          </p>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-panel border border-line">
          <button
            onClick={() => setActiveTab("entry")}
            className={`tab-btn ${activeTab === "entry" ? "active" : ""}`}
          >
            New Wash Entry
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`tab-btn flex items-center gap-1.5 ${activeTab === "queue" ? "active" : ""}`}
          >
            <span>Live Bay Queue</span>
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">
              {washQueue.filter((w) => w.status === "in_progress" || w.status === "queued").length || 4}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          >
            Recent Log ({recentWashes.length})
          </button>
        </div>
      </div>

      {/* TAB 1: NEW WASH ENTRY */}
      {activeTab === "entry" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 card p-6 space-y-6">
            {/* 1. Vehicle Class */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="section-label">1. Select Vehicle Category *</label>
                <span className="text-xs text-muted font-mono">LARGO detergent formula standard</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {VEHICLE_TYPES.map((v) => {
                  const active = vehicleType === v.id;
                  const accent = v.color || "var(--accent)";
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setVehicleType(v.id)}
                      className="rounded-2xl p-4 text-left border-2 transition-all relative overflow-hidden"
                      style={{
                        borderColor: active ? accent : "var(--line)",
                        background: active ? `color-mix(in srgb, ${accent} 10%, var(--panel))` : "var(--panel-2)",
                      }}
                    >
                      {active && (
                        <div
                          className="absolute top-2 right-2 w-2 h-2 rounded-full"
                          style={{ background: accent }}
                        />
                      )}
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent }}
                        >
                          <Car size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-text">{v.name}</p>
                          <p className="text-[11px] text-muted truncate">{v.examples.split(",")[0]}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-line/60 text-[11px] font-mono text-muted">
                        <div>
                          <span className="block text-[9px] uppercase text-muted-2">Time</span>
                          <span className="text-text font-medium">{v.standard_minutes}m</span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-muted-2">Soap</span>
                          <span className="text-accent font-medium">{v.default_soap_ml}ml</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] uppercase text-muted-2">Base</span>
                          <span className="text-text font-semibold">{v.default_price} ETB</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Vehicle Plate & Customer Information */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="section-label" htmlFor="plate-input">
                  Plate Number *
                </label>
                <div className="relative">
                  <input
                    id="plate-input"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. AA-A-12345"
                    required
                    className="input font-mono font-bold tracking-wide"
                  />
                  {plate.length >= 4 && (
                    <span className="absolute right-3 top-2.5 text-xs text-accent">✓ valid</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <label className="section-label" htmlFor="customer-input">
                  Customer Name
                </label>
                <input
                  id="customer-input"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Optional or Walk-in"
                  className="input"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <label className="section-label" htmlFor="phone-input">
                  Phone (for SMS receipt)
                </label>
                <input
                  id="phone-input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+251 9..."
                  className="input font-mono"
                />
              </div>
            </div>

            {/* 3. Service Packages & Add-ons */}
            <div>
              <label className="section-label mb-2.5 block">2. Add Service Packages & Treatments</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {WASH_SERVICES.map((s) => {
                  const selected = selectedServices.includes(s.id);
                  const isBase = s.id === "exterior";
                  const price =
                    vehicleType === "small"
                      ? s.price_small
                      : vehicleType === "medium"
                      ? s.price_medium
                      : s.price_large;

                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selected
                          ? "border-accent bg-accent/5"
                          : "border-line bg-panel-2 hover:border-line-2"
                      } ${isBase ? "opacity-90" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs ${
                            selected
                              ? "bg-accent border-accent text-slate-900 font-bold"
                              : "border-muted/40"
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text">{s.name}</p>
                          <p className="text-[11px] text-muted">{s.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold font-mono text-text">
                          {isBase ? "Included" : `+${price} ETB`}
                        </p>
                        {s.extra_soap_ml > 0 && (
                          <p className="text-[10px] text-accent font-mono">+{s.extra_soap_ml}ml</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Washer & Bay Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
              <div className="space-y-1.5">
                <label className="section-label" htmlFor="washer-select">
                  3. Assign Attendant / Washer *
                </label>
                <select
                  id="washer-select"
                  value={washerId}
                  onChange={(e) => setWasherId(e.target.value)}
                  className="input"
                >
                  {washers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — Balance: {w.soap}ml {w.soap < totalSoapNeeded ? "(⚠️ Low)" : "(✓ Ready)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="section-label" htmlFor="bay-select">
                  Assigned Bay
                </label>
                <select
                  id="bay-select"
                  value={bayNumber}
                  onChange={(e) => setBayNumber(Number(e.target.value))}
                  className="input"
                >
                  <option value={1}>Bay 1 — Express Foam Line</option>
                  <option value={2}>Bay 2 — Medium Truck Ramp</option>
                  <option value={3}>Bay 3 — Heavy Vehicle Pit</option>
                  <option value={4}>Bay 4 — VIP Detailing Studio</option>
                </select>
              </div>
            </div>

            {/* 5. Payment Method */}
            <div>
              <label className="section-label mb-2.5 block">4. Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PAYMENT_OPTIONS.map((opt) => {
                  const active = paymentMethod === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? "border-accent bg-accent/15 text-accent shadow-sm"
                          : "border-line bg-panel-2 text-muted hover:text-text"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Total Due</p>
                <p className="text-2xl font-bold font-mono text-text">
                  {totalPrice.toLocaleString()} <span className="text-sm font-normal text-muted">ETB</span>
                </p>
              </div>
              <button
                type="submit"
                disabled={saving || isLowSoap}
                className="btn btn-primary px-8 py-3 text-base shadow-lg shadow-accent/20 flex items-center gap-2"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                <span>Record Wash & Print Receipt</span>
              </button>
            </div>
          </form>

          {/* Right Summary / Washer Meter */}
          <div className="space-y-6">
            {/* Live Ticket Card */}
            <div className="card p-5 space-y-4 border-l-4 border-l-accent">
              <div className="flex items-center justify-between">
                <span className="badge badge-approved">Ticket Preview</span>
                <span className="text-xs font-mono text-muted">Bay #{bayNumber}</span>
              </div>

              <div>
                <p className="text-xs text-muted">Vehicle</p>
                <p className="text-lg font-bold text-text font-mono">{plate || "AA-A-•••••"}</p>
                <p className="text-xs text-muted">{vt.name} · {customer || "Walk-in"}</p>
              </div>

              <div className="p-3 rounded-xl bg-panel-2 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Base Wash:</span>
                  <span className="font-mono text-text">{basePrice} ETB</span>
                </div>
                {serviceObjects.filter((s) => s.id !== "exterior").map((s) => (
                  <div key={s.id} className="flex justify-between text-muted">
                    <span>{s.name}:</span>
                    <span className="font-mono text-text">
                      +{vehicleType === "small" ? s.price_small : vehicleType === "medium" ? s.price_medium : s.price_large} ETB
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-line flex justify-between font-bold text-sm text-text">
                  <span>Total (inc. VAT):</span>
                  <span className="text-accent font-mono">{totalPrice.toLocaleString()} ETB</span>
                </div>
              </div>

              {/* Washer Soap Gauge */}
              {assignedWasher && (
                <div className="p-3.5 rounded-xl border border-line bg-panel-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-text">Attendant Soap Balance</span>
                    <span className="font-mono font-bold text-accent">{assignedWasher.soap} ml</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-panel-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isLowSoap ? "bg-red" : assignedWasher.soap < 300 ? "bg-amber" : "bg-accent"
                      }`}
                      style={{ width: `${Math.min(100, (assignedWasher.soap / 800) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted font-mono">
                    <span>Deduction: -{totalSoapNeeded} ml</span>
                    <span>Remaining: {Math.max(0, assignedWasher.soap - totalSoapNeeded)} ml</span>
                  </div>
                  {isLowSoap && (
                    <div className="flex items-center gap-1.5 text-[11px] text-red font-medium pt-1">
                      <AlertTriangle size={13} />
                      <span>Insufficient detergent! Request refill in Store.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Tips */}
            <div className="card p-5 space-y-2.5 text-xs text-muted">
              <p className="font-semibold text-text flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-accent" />
                Standard Quality Checklist
              </p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Pre-rinse chassis to remove abrasive road grit.</li>
                <li>Apply LARGO foam shampoo at standard dilution.</li>
                <li>Clean wheels & rims with dedicated wash mitts.</li>
                <li>Microfiber hand-dry to avoid water spots.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE BAY QUEUE BOARD */}
      {activeTab === "queue" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((bayNum) => {
            const bayWashes = washQueue.filter((w) => (w.bay_number || 1) === bayNum);
            const current = bayWashes[0];

            return (
              <div key={bayNum} className="card p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <h3 className="font-semibold text-base text-text font-[family-name:var(--font-display)]">
                      Bay #{bayNum}
                    </h3>
                    <span
                      className={`badge ${
                        current ? "badge-approved" : "badge-ok"
                      }`}
                    >
                      {current ? "Occupied" : "Available"}
                    </span>
                  </div>

                  {current ? (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-xl font-bold font-mono text-text">{current.plate}</p>
                        <p className="text-xs text-muted capitalize">
                          {current.vehicle_type_id} Vehicle · {current.customer_name || "Customer"}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-panel-2 space-y-1 text-xs">
                        <div className="flex justify-between text-muted">
                          <span>Attendant:</span>
                          <span className="font-medium text-text">{current.washer_name}</span>
                        </div>
                        <div className="flex justify-between text-muted">
                          <span>Payment:</span>
                          <span className="font-mono text-accent uppercase">{current.payment_method}</span>
                        </div>
                        <div className="flex justify-between text-muted">
                          <span>Elapsed:</span>
                          <span className="font-mono text-text font-bold">
                            {current.actual_minutes || 25} mins
                          </span>
                        </div>
                      </div>

                      {/* Status Selector */}
                      <div className="space-y-1.5 pt-2">
                        <label className="text-[11px] text-muted uppercase font-semibold">
                          Stage Progress
                        </label>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          {(["queued", "in_progress", "completed"] as const).map((st) => (
                            <button
                              key={st}
                              onClick={() => updateQueueStatus(current.id, st)}
                              className={`p-1.5 rounded-lg border font-medium transition-all ${
                                current.status === st
                                  ? "bg-accent text-slate-900 border-accent font-bold"
                                  : "border-line bg-panel-2 text-muted hover:text-text"
                              }`}
                            >
                              {st === "queued" ? "Queued" : st === "in_progress" ? "Washing" : "Done"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-muted">
                      <Car size={32} className="opacity-20 mb-2" />
                      <p className="text-xs">Bay is ready for next vehicle</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-line text-[11px] text-muted flex justify-between">
                  <span>Bay Capacity: 1 Car</span>
                  <span className="text-accent font-medium">Pressure Pump: OK</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: RECENT LOG */}
      {activeTab === "history" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-line flex items-center justify-between">
            <h3 className="font-semibold text-text">Recent Wash Transactions</h3>
            <span className="text-xs text-muted font-mono">{recentWashes.length} total entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Plate</th>
                  <th>Type</th>
                  <th>Attendant</th>
                  <th>Services</th>
                  <th>Payment</th>
                  <th>Price</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentWashes.map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs font-bold text-accent">{w.receipt_number || "REC-1004"}</td>
                    <td className="font-mono font-bold text-text">{w.plate}</td>
                    <td className="capitalize text-xs">{w.vehicle_type_id}</td>
                    <td className="text-xs">{w.washer_name}</td>
                    <td className="text-xs max-w-xs truncate text-muted">
                      {w.services?.join(", ") || "Standard Wash"}
                    </td>
                    <td>
                      <span className="badge badge-approved uppercase text-[10px]">
                        {w.payment_method}
                      </span>
                    </td>
                    <td className="font-mono font-bold text-text">{w.price.toLocaleString()} ETB</td>
                    <td className="text-xs text-muted font-mono">
                      {new Date(w.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>
                      <button
                        onClick={() => setActiveReceipt(w)}
                        className="btn btn-ghost px-2.5 py-1 text-xs flex items-center gap-1"
                      >
                        <Receipt size={13} />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT MODAL */}
      {activeReceipt && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-content max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line no-print">
              <h3 className="font-bold text-base text-text flex items-center gap-2">
                <Receipt size={16} className="text-accent" />
                <span>Wash Receipt</span>
              </h3>
              <button onClick={() => setActiveReceipt(null)} className="icon-btn">
                <X size={16} />
              </button>
            </div>

            {/* Printable Paper Area */}
            <div className="receipt-paper printable-receipt p-5 rounded-xl space-y-3 text-xs">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <p className="font-bold text-base tracking-wider">WASHOS CAR WASH</p>
                <p className="text-[10px] text-slate-500">Bole Main Branch · Addis Ababa</p>
                <p className="text-[10px] text-slate-500">Tel: +251 91 123 4567 / +251 11 234 5678</p>
                <p className="font-bold font-mono text-xs mt-1">{activeReceipt.receipt_number || "REC-10041"}</p>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Date/Time:</span>
                  <span className="font-mono font-medium">
                    {new Date(activeReceipt.started_at).toLocaleString("en-GB")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Plate No:</span>
                  <span className="font-mono font-bold text-sm">{activeReceipt.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Vehicle Type:</span>
                  <span className="capitalize font-medium">{activeReceipt.vehicle_type_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Customer:</span>
                  <span>{activeReceipt.customer_name || "Walk-in"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Attendant:</span>
                  <span>{activeReceipt.washer_name}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3">
                <p className="font-bold text-[11px] uppercase">Services Rendered:</p>
                {activeReceipt.services?.map((s, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>• {s}</span>
                    <span>✓</span>
                  </div>
                )) || <div className="text-[11px]">Standard Wash Package</div>}
              </div>

              <div className="space-y-1 pt-1 font-mono">
                <div className="flex justify-between text-base font-bold">
                  <span>TOTAL:</span>
                  <span>{activeReceipt.price.toLocaleString()} ETB</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Payment Method:</span>
                  <span className="uppercase font-bold">{activeReceipt.payment_method}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Payment Status:</span>
                  <span className="font-bold text-emerald-700">PAID ✓</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-500">
                <p>Thank you for choosing WashOS!</p>
                <p>Please inspect your vehicle before departure.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 no-print">
              <button
                type="button"
                onClick={() => setThermalReceipt(activeReceipt)}
                className="btn btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold"
              >
                <Printer size={15} />
                <span>Print 58mm POS Slip</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-ghost border border-line py-2 text-xs"
                title="Print Full Page"
              >
                Full Page
              </button>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="btn btn-ghost py-2 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 58mm / 80mm ESC/POS Thermal Receipt Modal */}
      {thermalReceipt && (
        <ThermalReceipt
          wash={thermalReceipt}
          onClose={() => setThermalReceipt(null)}
        />
      )}
    </div>
  );
}
