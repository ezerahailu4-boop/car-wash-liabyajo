"use client";

import { useEffect, useState } from "react";
import { Plus, X, Trash2, TrendingDown, Wallet, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  incurred_on: string;
  created_at: string;
};

const CATEGORIES = ["payroll", "maintenance", "utilities", "inventory_cost", "other"] as const;

const CATEGORY_LABEL: Record<string, string> = {
  payroll: "Payroll",
  maintenance: "Maintenance",
  utilities: "Utilities",
  inventory_cost: "Inventory Cost",
  other: "Other",
};

const EMPTY = { category: "payroll" as string, amount: "", description: "", incurred_on: new Date().toISOString().slice(0, 10) };

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

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));

  function notify(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  async function load() {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, amount, description, incurred_on, created_at")
        .order("incurred_on", { ascending: false });
      if (error) throw error;
      setItems((data as Expense[]) ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((e) => e.incurred_on.startsWith(monthFilter));
  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    total: filtered.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0),
  })).filter((c) => c.total > 0);

  async function addExpense() {
    const amt = Number(form.amount);
    if (!form.category || !amt || amt <= 0) {
      notify("Enter a category and a valid amount.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("expenses").insert({
        category: form.category,
        amount: amt,
        description: form.description || null,
        incurred_on: form.incurred_on,
        created_by: userData.user?.id ?? null,
      }).select().single();
      if (error) throw error;
      setItems((prev) => [data as Expense, ...prev]);
      notify("Expense logged.");
      setShowAdd(false);
      setForm(EMPTY);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save expense.");
    }
    setSaving(false);
  }

  async function removeExpense(id: string) {
    const supabase = createClient();
    setItems((prev) => prev.filter((e) => e.id !== id));
    try {
      await supabase.from("expenses").delete().eq("id", id);
    } catch { /* optimistic */ }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl px-4 py-3 bg-panel border border-line shadow-xl text-sm">{toast}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Expenses</h1>
          <p className="text-sm text-muted mt-1">Track operating costs — payroll, maintenance, utilities, and more.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-panel-2 border border-line">
            <Calendar size={14} className="text-muted" />
            <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-transparent text-sm outline-none" />
          </div>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center gap-2">
            <Plus size={16} /> Log Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 border border-line bg-panel">
          <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wide mb-2">
            <Wallet size={14} /> Total This Month
          </div>
          <p className="font-[family-name:var(--font-mono)] text-2xl">{total.toLocaleString()} birr</p>
        </div>
        <div className="rounded-2xl p-5 border border-line bg-panel">
          <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wide mb-2">
            <TrendingDown size={14} /> By Category
          </div>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted">No expenses logged yet.</p>
          ) : (
            <div className="space-y-1.5">
              {byCategory.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{CATEGORY_LABEL[c.category]}</span>
                  <span className="font-[family-name:var(--font-mono)]">{c.total.toLocaleString()} birr</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted text-xs uppercase tracking-wide">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No expenses for this month.</td></tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-muted">{e.incurred_on}</td>
                  <td className="px-4 py-3">{CATEGORY_LABEL[e.category] ?? e.category}</td>
                  <td className="px-4 py-3 text-muted">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)]">{Number(e.amount).toLocaleString()} birr</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeExpense(e.id)} className="text-muted hover:text-[var(--red)]">
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
        <Modal title="Log Expense" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Amount (birr)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent font-[family-name:var(--font-mono)]" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Date</label>
              <input type="date" value={form.incurred_on} onChange={(e) => setForm((f) => ({ ...f, incurred_on: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent" placeholder="e.g. May generator fuel" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={addExpense} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D] disabled:opacity-50">
                {saving ? "Saving…" : "Log Expense"}
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
