"use client";

import { useEffect, useState } from "react";
import { Plus, X, Search, Phone, Car, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  vehicle_count?: number;
};

const EMPTY = { full_name: "", phone: "", notes: "" };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-[family-name:var(--font-display)] text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  async function load() {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, phone, notes, created_at, vehicles(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = Customer & { vehicles?: { count: number }[] };
      const rows = ((data as Row[]) ?? []).map((r) => ({
        ...r,
        vehicle_count: r.vehicles?.[0]?.count ?? 0,
      }));
      setItems(rows);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((c) =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  async function addCustomer() {
    if (!form.full_name.trim()) {
      notify("Name is required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("customers").insert({
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        notes: form.notes || null,
        created_by: userData.user?.id ?? null,
      }).select().single();
      if (error) throw error;
      setItems((prev) => [{ ...(data as Customer), vehicle_count: 0 }, ...prev]);
      notify("Customer added.");
      setShowAdd(false);
      setForm(EMPTY);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save customer.");
    }
    setSaving(false);
  }

  async function removeCustomer(id: string) {
    const supabase = createClient();
    setItems((prev) => prev.filter((c) => c.id !== id));
    try {
      await supabase.from("customers").delete().eq("id", id);
    } catch { /* optimistic */ }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl px-4 py-3 bg-panel border border-line shadow-xl text-sm">{toast}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Customers</h1>
          <p className="text-sm text-muted mt-1">Track repeat customers and their vehicles.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-panel-2 border border-line">
            <Search size={14} className="text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone"
              className="bg-transparent text-sm outline-none w-40" />
          </div>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center gap-2">
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted text-xs uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Vehicles</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No customers yet.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{c.full_name}</td>
                  <td className="px-4 py-3 text-muted">
                    {c.phone ? (
                      <span className="flex items-center gap-1.5"><Phone size={13} /> {c.phone}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-muted"><Car size={13} /> {c.vehicle_count ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.notes || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeCustomer(c.id)} className="text-muted hover:text-[var(--red)]">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="Add Customer" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Full Name</label>
              <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent" placeholder="Customer name" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent" placeholder="+251 9x xxx xxxx" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Notes (optional)</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent" placeholder="e.g. Fleet account, prefers Sundays" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={addCustomer} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D] disabled:opacity-50">
                {saving ? "Saving…" : "Add Customer"}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm border border-line text-muted">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
