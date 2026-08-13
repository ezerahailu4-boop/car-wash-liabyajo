"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Search,
  Phone,
  Car,
  Trash2,
  Sparkles,
  UserCheck,
  Calendar,
  CreditCard,
  Droplet,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { Customer } from "@/lib/types";

const EMPTY = { full_name: "", phone: "", notes: "" };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop flex items-center justify-center p-4">
      <div className="modal-content max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h3 className="font-semibold text-lg text-text font-[family-name:var(--font-display)]">{title}</h3>
          <button onClick={onClose} className="icon-btn">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadData() {
    setLoading(true);
    const data = await DataStore.getCustomers();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  const filtered = items.filter(
    (c) =>
      !search ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      notify("Customer full name is required.");
      return;
    }

    await DataStore.createCustomer({
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });

    notify(`✓ Customer ${form.full_name} added.`);
    setShowAdd(false);
    setForm(EMPTY);
    await loadData();
  }

  async function handleDeleteCustomer(id: string, name: string) {
    if (confirm(`Are you sure you want to remove customer ${name}?`)) {
      await DataStore.deleteCustomer(id);
      notify("Customer removed.");
      await loadData();
    }
  }

  const totalSpentAll = items.reduce((sum, c) => sum + (c.total_spent || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-panel border border-accent px-4 py-3 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium text-text">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text font-[family-name:var(--font-display)]">
            Customer Directory & CRM
          </h2>
          <p className="text-sm text-muted">
            Manage customer profiles, visit history, loyalty status, and quick-dispatch washes.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>New Customer</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-accent">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <UserCheck size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Registered Customers</p>
            <p className="text-xl font-bold font-mono text-text">{items.length}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-emerald-500">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <CreditCard size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Customer Lifetime Spend</p>
            <p className="text-xl font-bold font-mono text-text">{totalSpentAll.toLocaleString()} ETB</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-purple-500">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Car size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Fleet Accounts</p>
            <p className="text-xl font-bold font-mono text-text">
              {items.filter((c) => (c.vehicle_count || 0) > 1).length} Accounts
            </p>
          </div>
        </div>
      </div>

      {/* Search Row */}
      <div className="search-row max-w-md">
        <Search size={15} className="text-muted shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name, phone, or notes..."
          className="w-full text-xs"
        />
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((c) => (
          <div key={c.id} className="card p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-text">{c.full_name}</h3>
                  <p className="text-xs text-muted font-mono mt-0.5">{c.phone || "No phone on record"}</p>
                </div>
                <span className="badge badge-approved text-[10px]">
                  {c.vehicle_count && c.vehicle_count > 1 ? "Fleet" : "Regular"}
                </span>
              </div>

              {c.notes && (
                <div className="mt-3 p-2.5 rounded-lg bg-panel-2 border border-line text-xs text-muted">
                  <span className="text-[10px] text-muted-2 uppercase block font-semibold">Preferences</span>
                  <p className="text-text mt-0.5">{c.notes}</p>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-panel-2">
                  <span className="text-[10px] text-muted block">Vehicles</span>
                  <span className="font-bold text-text">{c.vehicle_count || 1} Registered</span>
                </div>
                <div className="p-2.5 rounded-lg bg-panel-2">
                  <span className="text-[10px] text-muted block">Total Spend</span>
                  <span className="font-bold text-accent">{(c.total_spent || 1200).toLocaleString()} ETB</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
              <button
                onClick={() => router.push(`/wash`)}
                className="btn btn-primary flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5"
              >
                <Droplet size={13} />
                <span>Wash Vehicle</span>
              </button>
              <button
                onClick={() => handleDeleteCustomer(c.id, c.full_name)}
                className="icon-btn text-red/70 hover:text-red hover:border-red"
                title="Delete customer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ADD CUSTOMER MODAL */}
      {showAdd && (
        <Modal title="Register New Customer" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="space-y-1.5">
              <label className="section-label">Full Name *</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Dawit Kebede"
                className="input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+251 91..."
                className="input font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Notes & Preferences</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. VIP Customer · Prefers hand dry & tire shine"
                className="input h-20 resize-none"
              />
            </div>

            <div className="pt-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Customer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
