"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Trash2,
  TrendingDown,
  Wallet,
  Calendar,
  Sparkles,
  PieChart as PieIcon,
  RefreshCw,
  Building,
  Zap,
  Wrench,
  Users,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { Expense } from "@/lib/types";

const CATEGORIES = ["payroll", "maintenance", "utilities", "inventory_cost", "rent", "other"] as const;

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  payroll: { label: "Payroll & Commission", icon: Users, color: "var(--accent)" },
  maintenance: { label: "Equipment Maintenance", icon: Wrench, color: "var(--amber)" },
  utilities: { label: "Water & Electricity", icon: Zap, color: "var(--sky-500)" },
  inventory_cost: { label: "Chemical Restock", icon: Wallet, color: "var(--emerald-500)" },
  rent: { label: "Bay Lease / Rent", icon: Building, color: "var(--purple-500)" },
  other: { label: "Lounge & Supplies", icon: TrendingDown, color: "var(--muted)" },
};

const EMPTY = {
  category: "payroll" as Expense["category"],
  amount: "",
  description: "",
  incurred_on: new Date().toISOString().slice(0, 10),
};

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

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [toast, setToast] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadData() {
    setLoading(true);
    const data = await DataStore.getExpenses();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) {
      notify("Please enter a valid expense amount.");
      return;
    }

    await DataStore.createExpense({
      category: form.category,
      amount: amt,
      description: form.description.trim() || null,
      incurred_on: form.incurred_on,
    });

    notify("✓ Expense logged successfully.");
    setShowAdd(false);
    setForm(EMPTY);
    await loadData();
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this expense record?")) {
      await DataStore.deleteExpense(id);
      notify("Expense deleted.");
      await loadData();
    }
  }

  const filtered = items.filter((e) => e.incurred_on.startsWith(monthFilter));
  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryBreakdown = CATEGORIES.map((cat) => {
    const catTotal = filtered.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0);
    const meta = CATEGORY_META[cat] || CATEGORY_META.other;
    return {
      cat,
      label: meta.label,
      total: catTotal,
      percent: total > 0 ? Math.round((catTotal / total) * 100) : 0,
      icon: meta.icon,
      color: meta.color,
    };
  }).filter((c) => c.total > 0);

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
            Operating Expenses & Overhead
          </h2>
          <p className="text-sm text-muted">
            Track utility bills, payroll payouts, equipment maintenance, and chemical restocking costs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Log Expense</span>
          </button>
          <button onClick={loadData} className="icon-btn" title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Overview Cards & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Total Expense Card */}
        <div className="card p-6 flex flex-col justify-between border-l-4 border-l-red">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="section-label">Month Total</span>
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="input py-1 px-2.5 text-xs w-auto font-mono"
              />
            </div>
            <p className="text-3xl font-bold font-mono text-text">{total.toLocaleString()} ETB</p>
            <p className="text-xs text-muted">Total operating expenses logged for {monthFilter}</p>
          </div>

          <div className="pt-4 border-t border-line text-xs text-muted flex justify-between">
            <span>Logged Entries: {filtered.length}</span>
            <span className="text-accent font-medium">Daily Avg: {Math.round(total / 30).toLocaleString()} ETB</span>
          </div>
        </div>

        {/* Category Breakdown Bars */}
        <div className="lg:col-span-2 card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text text-sm">Expenses by Category</h3>
            <span className="text-xs font-mono text-muted">{categoryBreakdown.length} active categories</span>
          </div>

          <div className="space-y-3">
            {categoryBreakdown.map((item) => (
              <div key={item.cat} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <item.icon size={14} className="text-accent" />
                    <span className="font-medium text-text">{item.label}</span>
                  </div>
                  <span className="font-mono font-bold text-text">
                    {item.total.toLocaleString()} ETB ({item.percent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-panel-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-accent"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expense Entries Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3 className="font-semibold text-text">Expense Transactions</h3>
          <span className="text-xs text-muted font-mono">{filtered.length} entries for this month</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
                return (
                  <tr key={e.id}>
                    <td className="font-mono text-xs text-muted">{e.incurred_on}</td>
                    <td>
                      <span className="badge badge-approved text-[10px]">{meta.label}</span>
                    </td>
                    <td className="text-xs text-text">{e.description || "General operational expense"}</td>
                    <td className="font-mono font-bold text-text">{Number(e.amount).toLocaleString()} ETB</td>
                    <td>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="icon-btn text-red/70 hover:text-red hover:border-red"
                        title="Delete expense"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOG EXPENSE MODAL */}
      {showAdd && (
        <Modal title="Log Operational Expense" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-1.5">
              <label className="section-label">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })}
                className="input"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat]?.label || cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Amount (ETB) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 4500"
                className="input font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Date Incurred</label>
              <input
                type="date"
                value={form.incurred_on}
                onChange={(e) => setForm({ ...form, incurred_on: e.target.value })}
                className="input font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Description / Invoice Reference</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. High pressure pump nozzle repair at Addis Machinery"
                className="input h-20 resize-none"
              />
            </div>

            <div className="pt-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Expense
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
