"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Car,
  Droplet,
  RefreshCw,
  Plus,
  Send,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { VEHICLE_TYPES } from "@/lib/mock";
import { DataStore } from "@/lib/data-store";
import { Profile, SoapRequest, WashTransaction } from "@/lib/types";

const TABS = ["Performance & Stats", "Wash History", "Request Soap Refill"] as const;
type Tab = (typeof TABS)[number];

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Performance & Stats");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [soapMl, setSoapMl] = useState(650);
  const [washes, setWashes] = useState<WashTransaction[]>([]);
  const [requests, setRequests] = useState<SoapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Request form state
  const [reqProduct, setReqProduct] = useState("inv-1");
  const [vehicleType, setVehicleType] = useState<string>("small");
  const [carCount, setCarCount] = useState(1);
  const [saving, setSaving] = useState(false);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  const selectedVT = VEHICLE_TYPES.find((v) => v.id === vehicleType) || VEHICLE_TYPES[0];
  const requestedMl = selectedVT.default_soap_ml * carCount;

  async function loadData() {
    setLoading(true);
    const [staffList, allWashes, allReqs, washersStock] = await Promise.all([
      DataStore.getStaff(),
      DataStore.getWashTransactions(),
      DataStore.getSoapRequests(),
      DataStore.getWashersStock(),
    ]);

    const target = staffList.find((s) => s.id === id) || staffList[0];
    setProfile(target);

    const targetStock = washersStock.find((w) => w.id === id || w.name === target.full_name);
    setSoapMl(targetStock?.soap || 650);

    const myWashes = allWashes.filter((w) => w.washer_id === id || w.washer_name === target.full_name);
    setWashes(myWashes);

    const myReqs = allReqs.filter((r) => r.washer_id === id || r.washer_name === target.full_name);
    setRequests(myReqs);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, [id]);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const inv = await DataStore.getInventory();
    const product = inv.find((i) => i.id === reqProduct) || inv[0];

    await DataStore.createSoapRequest({
      washer_id: profile.id,
      washer_name: profile.full_name,
      inventory_id: product?.id || "inv-1",
      product_name: product?.product_name || "LARGO Detergent Concentrate",
      quantity_requested: requestedMl,
      notes: `${selectedVT.name} × ${carCount} cars prep`,
    });

    notify(`✓ Requisition submitted: ${requestedMl}ml ${product?.product_name}`);
    setSaving(false);
    setTab("Performance & Stats");
    await loadData();
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayWashes = washes.filter((w) => w.started_at.startsWith(today));
  const todayRevenue = todayWashes.reduce((sum, w) => sum + w.price, 0);
  const estimatedCommission = Math.round(todayRevenue * 0.2); // 20% commission standard

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-panel border border-accent px-4 py-3 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium text-text">{toast}</span>
        </div>
      )}

      {/* Back Button & Profile Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/employees")} className="icon-btn" title="Back to staff list">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-text font-[family-name:var(--font-display)]">
            {profile?.full_name || "Employee Profile"}
          </h2>
          <p className="text-xs text-muted capitalize">
            {profile?.role.replace("_", " ")} · {profile?.phone || "No phone listed"}
          </p>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="card p-6 grid grid-cols-2 lg:grid-cols-4 gap-4 border-l-4 border-l-accent">
        <div>
          <p className="text-xs text-muted">Current Soap Stock</p>
          <p className="text-2xl font-bold font-mono text-accent">{soapMl} ml</p>
          <span className="text-[10px] text-muted">Personal wash bottle</span>
        </div>
        <div>
          <p className="text-xs text-muted">Cars Washed Today</p>
          <p className="text-2xl font-bold font-mono text-text">{todayWashes.length}</p>
          <span className="text-[10px] text-muted">{washes.length} lifetime washes</span>
        </div>
        <div>
          <p className="text-xs text-muted">Today&apos;s Wash Revenue</p>
          <p className="text-2xl font-bold font-mono text-text">{todayRevenue.toLocaleString()} ETB</p>
          <span className="text-[10px] text-muted">Gross billed</span>
        </div>
        <div>
          <p className="text-xs text-muted">Est. Today Commission</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{estimatedCommission.toLocaleString()} ETB</p>
          <span className="text-[10px] text-muted">20% commission tier</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-panel border border-line w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? "active" : ""}`}>
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: STATS & EFFICIENCY */}
      {tab === "Performance & Stats" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-text text-sm">Quality & Speed Metrics</h3>
            <div className="p-3.5 rounded-xl bg-panel-2 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Avg Wash Completion Time:</span>
                <span className="font-mono font-bold text-text">38 mins (vs 45m target)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Detergent Conservation Score:</span>
                <span className="font-mono font-bold text-accent">96% High Efficiency</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Customer Return Rate:</span>
                <span className="font-mono font-bold text-emerald-400">88% Loyalty</span>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-text text-sm">Recent Detergent Requisitions</h3>
            <div className="space-y-2">
              {requests.slice(0, 4).map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-panel-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold font-mono text-accent">{r.request_number}</p>
                    <p className="text-[11px] text-muted">{r.product_name || "Detergent"}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-text">{r.quantity_requested}ml</span>
                    <span className="badge badge-approved text-[9px] block capitalize">{r.status}</span>
                  </div>
                </div>
              ))}
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
                  <th>Payment</th>
                  <th>Soap Used</th>
                  <th>Price</th>
                  <th>Timestamp</th>
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
                    <td className="text-xs text-muted font-mono">{new Date(w.started_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REQUEST SOAP REFILL */}
      {tab === "Request Soap Refill" && (
        <div className="card p-6 max-w-xl space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-text font-[family-name:var(--font-display)]">
              Submit Chemical Requisition
            </h3>
            <p className="text-xs text-muted">
              Select vehicle wash batch quantity to automatically calculate chemical volume according to standards.
            </p>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="space-y-1.5">
              <label className="section-label">Vehicle Category Standard</label>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setVehicleType(v.id)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      vehicleType === v.id
                        ? "border-accent bg-accent/10 text-accent font-bold"
                        : "border-line bg-panel-2 text-muted hover:text-text"
                    }`}
                  >
                    <p>{v.name}</p>
                    <span className="text-[10px] font-mono text-muted-2">{v.default_soap_ml}ml/car</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Number of Expected Washes</label>
              <div className="flex items-center gap-3">
                {[1, 2, 4, 6].map((count) => (
                  <button
                    type="button"
                    key={count}
                    onClick={() => setCarCount(count)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-mono font-bold ${
                      carCount === count
                        ? "border-accent bg-accent text-slate-900"
                        : "border-line bg-panel-2 text-muted"
                    }`}
                  >
                    {count} Cars
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-panel-2 border border-line flex justify-between items-center text-xs font-mono">
              <span className="text-muted">Total Soap Requested:</span>
              <span className="text-xl font-bold text-accent">{requestedMl} ml</span>
            </div>

            <button type="submit" disabled={saving} className="btn btn-primary w-full py-3 flex items-center justify-center gap-2">
              <Send size={16} />
              <span>Submit Request to Storekeeper</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
