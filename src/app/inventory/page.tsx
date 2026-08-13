"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  X,
  Pencil,
  RefreshCw,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Sparkles,
  Layers,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { InventoryItem } from "@/lib/types";

const CATEGORIES = ["All", "Soap", "Finishing", "Interior"] as const;

function statusBadge(status: string) {
  if (status === "ok") return <span className="badge badge-ok">Healthy</span>;
  if (status === "low") return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-critical">Critical</span>;
}

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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_name: "",
    category: "Soap",
    total_ml: "",
    min_stock_ml: "",
    supplier: "",
    expiry_date: "",
    unit_cost: "0.188",
  });

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadData() {
    setLoading(true);
    const data = await DataStore.getInventory();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  function openAdd() {
    setForm({
      product_name: "",
      category: "Soap",
      total_ml: "",
      min_stock_ml: "5000",
      supplier: "",
      expiry_date: "",
      unit_cost: "0.188",
    });
    setEditItem(null);
    setModal("add");
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setForm({
      product_name: item.product_name,
      category: item.category,
      total_ml: String(item.total_ml),
      min_stock_ml: String(item.min_stock_ml),
      supplier: item.supplier || "",
      expiry_date: item.expiry_date || "",
      unit_cost: String(item.unit_cost || "0.188"),
    });
    setModal("edit");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_name.trim() || !form.total_ml) {
      notify("Product name and quantity are required.");
      return;
    }

    if (modal === "edit" && editItem) {
      await DataStore.updateInventoryItem(editItem.id, {
        product_name: form.product_name,
        category: form.category,
        total_ml: Number(form.total_ml),
        min_stock_ml: Number(form.min_stock_ml),
        supplier: form.supplier || null,
        expiry_date: form.expiry_date || null,
        unit_cost: Number(form.unit_cost),
      });
      notify("✓ Item updated.");
    } else {
      await DataStore.createInventoryItem({
        product_name: form.product_name,
        category: form.category,
        total_ml: Number(form.total_ml),
        min_stock_ml: Number(form.min_stock_ml),
        supplier: form.supplier || null,
        expiry_date: form.expiry_date || null,
        unit_cost: Number(form.unit_cost),
      });
      notify("✓ New chemical item added.");
    }

    setModal(null);
    await loadData();
  }

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (item.supplier || "").toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === "All" || item.category.toLowerCase() === selectedCat.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const lowStockCount = items.filter((i) => i.status !== "ok").length;
  const totalVolumeLiters = (items.reduce((s, i) => s + i.total_ml, 0) / 1000).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
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
            Chemical & Consumable Inventory
          </h2>
          <p className="text-sm text-muted">
            Track detergent stock balances, reorder points, consumption rates, and batch numbers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAdd} className="btn btn-primary">
            <Plus size={16} />
            <span>Add Chemical Item</span>
          </button>
          <button onClick={loadData} className="icon-btn" title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-accent">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Package size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Total Products</p>
            <p className="text-xl font-bold font-mono text-text">{items.length}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Total Volume in Store</p>
            <p className="text-xl font-bold font-mono text-text">{totalVolumeLiters} Liters</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-amber">
          <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Stock Warnings</p>
            <p className="text-xl font-bold font-mono text-text">{lowStockCount} items</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-purple-500">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Approved Formula</p>
            <p className="text-sm font-bold text-text">LARGO 180ml/250ml/500ml</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-panel border border-line w-full sm:w-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`tab-btn flex-1 sm:flex-none ${selectedCat === cat ? "active" : ""}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-row w-full sm:w-72">
          <Search size={15} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chemical name or supplier..."
            className="w-full text-xs"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chemical Product</th>
                <th>Category</th>
                <th>Current Volume</th>
                <th>Stock Bar</th>
                <th>Min Reorder Threshold</th>
                <th>Vendor / Supplier</th>
                <th>Unit Rate</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const maxStock = Math.max(item.total_ml, item.min_stock_ml * 2.5);
                const percent = Math.min(100, Math.round((item.total_ml / maxStock) * 100));

                return (
                  <tr key={item.id}>
                    <td>
                      <p className="font-semibold text-text text-sm">{item.product_name}</p>
                      {item.batch_number && (
                        <span className="text-[10px] font-mono text-muted">{item.batch_number}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-approved text-[10px]">{item.category}</span>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-text text-sm">
                        {(item.total_ml / 1000).toFixed(1)} L
                      </span>
                      <span className="text-[11px] text-muted block font-mono">
                        ({item.total_ml.toLocaleString()} ml)
                      </span>
                    </td>
                    <td className="w-36">
                      <div className="w-full h-2 rounded-full bg-panel-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.status === "critical"
                              ? "bg-red"
                              : item.status === "low"
                              ? "bg-amber"
                              : "bg-accent"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                    <td className="font-mono text-xs text-muted">
                      {(item.min_stock_ml / 1000).toFixed(1)} L ({item.min_stock_ml.toLocaleString()} ml)
                    </td>
                    <td className="text-xs text-muted">{item.supplier || "Chemtech PLC"}</td>
                    <td className="font-mono text-xs text-text">{item.unit_cost || 0.188} ETB/ml</td>
                    <td>{statusBadge(item.status)}</td>
                    <td>
                      <button
                        onClick={() => openEdit(item)}
                        className="btn btn-ghost py-1 px-2.5 text-xs flex items-center gap-1"
                      >
                        <Pencil size={12} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modal && (
        <Modal
          title={modal === "add" ? "Add Chemical / Consumable" : "Edit Stock Item"}
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="section-label">Product Name *</label>
              <input
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                placeholder="e.g. LARGO Foam Detergent"
                className="input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="section-label">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input"
                >
                  <option value="Soap">Soap & Detergent</option>
                  <option value="Finishing">Finishing & Wax</option>
                  <option value="Interior">Interior Care</option>
                  <option value="Equipment">Equipment & Towels</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="section-label">Unit Cost (ETB/ml)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.unit_cost}
                  onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                  className="input font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="section-label">Current Stock (ml) *</label>
                <input
                  type="number"
                  value={form.total_ml}
                  onChange={(e) => setForm({ ...form, total_ml: e.target.value })}
                  placeholder="e.g. 20000 (20L)"
                  className="input font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="section-label">Min Alert Threshold (ml) *</label>
                <input
                  type="number"
                  value={form.min_stock_ml}
                  onChange={(e) => setForm({ ...form, min_stock_ml: e.target.value })}
                  placeholder="e.g. 5000"
                  className="input font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Supplier / Vendor</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="e.g. Chemtech PLC"
                className="input"
              />
            </div>

            <div className="pt-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {modal === "add" ? "Create Item" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
