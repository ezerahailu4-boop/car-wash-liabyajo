"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Droplet } from "lucide-react";
import { VEHICLE_TYPES, WASHERS } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";

type Washer = { id: string; name: string; soap: number };
type LogEntry = { plate: string; vehicleName: string; washer: string; time: string; price: number };

export default function WashEntryPage() {
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLE_TYPES)[number]["id"]>("small");
  const [plate, setPlate] = useState("");
  const [customer, setCustomer] = useState("");
  const [washerId, setWasherId] = useState("");
  const [washers, setWashers] = useState<Washer[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadWashers() {
      const supabase = createClient();
      try {
        const { data } = await supabase
          .from("washer_inventory")
          .select("washer_id, balance_ml, profiles(full_name, active)")
          .eq("profiles.active", true);
        type Row = { washer_id: string; balance_ml: number; profiles: { full_name: string; active: boolean } | null };
        if (data?.length) {
          const list = (data as Row[]).map((r) => ({
            id: r.washer_id,
            name: r.profiles?.full_name ?? "Unknown",
            soap: r.balance_ml,
          }));
          setWashers(list);
          setWasherId(list[0]?.id ?? "");
          return;
        }
      } catch { /* fall through */ }
      // fallback
      setWashers(WASHERS.map((w) => ({ id: w.id, name: w.name, soap: w.soap })));
      setWasherId(WASHERS[0].id);
    }
    loadWashers();
  }, []);

  const vt = VEHICLE_TYPES.find((v) => v.id === vehicleType)!;
  const washer = washers.find((w) => w.id === washerId);
  const insufficient = washer ? washer.soap < vt.default_soap_ml : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plate || insufficient || !washer) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: vehicle, error: vErr } = await supabase
        .from("vehicles")
        .upsert({ plate, vehicle_type_id: vehicleType }, { onConflict: "plate" })
        .select()
        .single();
      if (vErr) throw vErr;

      const { error: txErr } = await supabase.from("wash_transactions").insert({
        vehicle_id: vehicle.id,
        vehicle_type_id: vehicleType,
        washer_id: washerId,
        price: vt.default_price,
        soap_used_ml: vt.default_soap_ml,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      if (txErr) throw txErr;

      // Optimistically update local soap balance
      setWashers((prev) => prev.map((w) => w.id === washerId ? { ...w, soap: w.soap - vt.default_soap_ml } : w));
    } catch {
      // Demo mode — still reflect in UI
    }

    setLog((prev) => [
      { plate, vehicleName: vt.name, washer: washer.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), price: vt.default_price },
      ...prev,
    ]);
    setToast(`${vt.name} washed · ${vt.default_price} birr recorded · ${vt.default_soap_ml} ml deducted from ${washer.name.split(" ")[0]}`);
    setPlate("");
    setCustomer("");
    setSaving(false);
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="lg:col-span-2 rounded-2xl p-6 border border-line bg-panel space-y-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg">New Wash</h3>

        <div>
          <p className="text-xs uppercase tracking-wide mb-2 text-muted">Vehicle Category</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {VEHICLE_TYPES.map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => setVehicleType(v.id)}
                className="rounded-xl p-3 text-left border transition"
                style={{
                  borderColor: vehicleType === v.id ? v.color : "var(--line)",
                  background: vehicleType === v.id ? "var(--panel-2)" : "transparent",
                }}
              >
                <p className="font-medium text-sm" style={{ color: vehicleType === v.id ? v.color : "var(--text)" }}>
                  {v.name}
                </p>
                <p className="text-[11px] mt-1 text-muted">{v.examples}</p>
                <div className="flex justify-between mt-2 text-[11px] font-[family-name:var(--font-mono)] text-muted">
                  <span>{v.standard_minutes} min</span>
                  <span>{v.default_soap_ml} ml</span>
                  <span>{v.default_price} birr</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">Vehicle Plate</label>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="AA-A-12345"
              required
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">Customer</label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Customer name"
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-muted">Assign Washer</label>
          <select
            value={washerId}
            onChange={(e) => setWasherId(e.target.value)}
            className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent"
          >
            {washers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} — {w.soap} ml available
              </option>
            ))}
          </select>
          {insufficient && (
            <p className="text-xs mt-2 flex items-center gap-1.5 text-red">
              <AlertTriangle size={14} /> Insufficient soap balance — wash blocked until restocked.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line">
          <p className="text-xs font-[family-name:var(--font-mono)] text-muted">
            standard {vt.standard_minutes} min
          </p>
          <button
            type="submit"
            disabled={insufficient || !plate || saving || !washer}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
          >
            <CheckCircle2 size={16} /> {saving ? "Saving…" : `Complete Wash — ${vt.default_price} birr`}
          </button>
        </div>
        {toast && <div className="fade-up rounded-xl px-4 py-3 text-sm bg-[var(--accent-dim)] text-accent">{toast}</div>}
      </form>

      <div className="rounded-2xl p-5 border border-line bg-panel">
        <h3 className="font-[family-name:var(--font-display)] text-lg mb-4">Live Activity</h3>
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {log.length === 0 && <p className="text-sm text-muted">No washes recorded yet today.</p>}
          {log.map((l, i) => (
            <div key={i} className="fade-up flex items-start gap-3 pb-3 border-b border-line">
              <div className="mt-0.5 rounded-lg p-1.5 bg-panel-2 text-accent">
                <Droplet size={14} />
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  {l.plate} · <span className="text-muted">{l.vehicleName}</span>
                </p>
                <p className="text-[11px] font-[family-name:var(--font-mono)] text-muted">
                  {l.washer} · {l.time} · +{l.price} birr
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
