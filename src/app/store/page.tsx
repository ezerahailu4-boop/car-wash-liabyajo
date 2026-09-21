"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  PackageCheck,
  Truck,
  X,
  Check,
  Bell,
  Search,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Building2,
  ReceiptText,
  DollarSign,
  Sparkles,
  Droplet,
  Box,
  Layers,
  Store,
  ArrowDownRight,
  Send,
  Calendar,
} from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { InventoryItem, PurchaseOrder, SoapRequest, Supplier } from "@/lib/types";

const TABS = ["Refill Desk", "Bulk Chemicals", "Purchase Orders", "Suppliers"] as const;
type Tab = (typeof TABS)[number];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="card glass-card max-w-md w-full p-6 space-y-4 shadow-2xl border-line fade-up">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h3 className="font-bold text-lg text-text font-[family-name:var(--font-display)]">{title}</h3>
          <button onClick={onClose} className="icon-btn w-7 h-7">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StorePage() {
  const [tab, setTab] = useState<Tab>("Refill Desk");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [soapReqs, setSoapReqs] = useState<SoapRequest[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPO, setShowPO] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [approveQty, setApproveQty] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  // PO Form state
  const [poForm, setPoForm] = useState({
    supplier_id: "",
    inventory_id: "",
    qty_ml: "",
    unit_cost: "0.188",
    notes: "",
  });

  // Supplier Form state
  const [supForm, setSupForm] = useState({
    name: "",
    contact: "",
    email: "",
    products: "",
    address: "",
  });

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  async function loadData() {
    setLoading(true);
    const [reqs, pos, sups, inv] = await Promise.all([
      DataStore.getSoapRequests(),
      DataStore.getPurchaseOrders(),
      DataStore.getSuppliers(),
      DataStore.getInventory(),
    ]);

    setSoapReqs(reqs);
    setOrders(pos);
    setSuppliers(sups);
    setInventory(inv);

    if (sups.length > 0 && !poForm.supplier_id) {
      setPoForm((p) => ({ ...p, supplier_id: sups[0].id, inventory_id: inv[0]?.id || "" }));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  async function handleDecideRequest(id: string, status: "approved" | "rejected") {
    const target = soapReqs.find((r) => r.id === id);
    const qty = status === "approved" ? Number(approveQty[id] || target?.quantity_requested || 0) : undefined;
    await DataStore.decideSoapRequest(id, status, qty);
    notify(status === "approved" ? `✓ Dispensed ${qty}ml to ${target?.washer_name}` : "✕ Requisition rejected.");
    await loadData();
  }

  async function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poForm.supplier_id);
    const inv = inventory.find((i) => i.id === poForm.inventory_id);
    const qty = Number(poForm.qty_ml);
    const unitCost = Number(poForm.unit_cost);

    if (!sup || !qty || qty <= 0) {
      notify("Please fill all required purchase order fields.");
      return;
    }

    await DataStore.createPurchaseOrder({
      supplier_id: sup.id,
      supplier_name: sup.name,
      inventory_id: inv?.id || null,
      product_name: inv?.product_name || "Detergent Concentrate",
      qty_ml: qty,
      unit_cost: unitCost,
      notes: poForm.notes || undefined,
    });

    notify(`✓ PO created: ${qty.toLocaleString()} ml from ${sup.name}`);
    setShowPO(false);
    setPoForm({ supplier_id: suppliers[0]?.id || "", inventory_id: inventory[0]?.id || "", qty_ml: "", unit_cost: "0.188", notes: "" });
    await loadData();
  }

  async function handleReceiveStock(poId: string) {
    await DataStore.receivePurchaseOrder(poId);
    notify("✓ Stock received! Warehouse inventory updated.");
    await loadData();
  }

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supForm.name || !supForm.contact) {
      notify("Vendor name and contact are required.");
      return;
    }

    await DataStore.createSupplier({
      name: supForm.name,
      contact: supForm.contact,
      email: supForm.email || null,
      products: supForm.products || "Car wash chemicals",
      address: supForm.address || null,
      active: true,
    });

    notify(`✓ Supplier added: ${supForm.name}`);
    setShowSupplier(false);
    setSupForm({ name: "", contact: "", email: "", products: "", address: "" });
    await loadData();
  }

  const pendingReqs = soapReqs.filter((r) => r.status === "pending");
  const totalStockMl = inventory.reduce((s, i) => s + (i.total_ml || 0), 0);
  const lowStockCount = inventory.filter((i) => i.status !== "ok").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl glass-card border border-accent px-5 py-3.5 shadow-2xl fade-up flex items-center gap-3">
          <Sparkles size={18} className="text-accent shrink-0" />
          <span className="text-sm font-semibold text-text">{toast}</span>
        </div>
      )}

      {/* Warehouse Header Banner */}
      <div className="card glass-card p-6 border-line relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Store size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text font-[family-name:var(--font-display)]">
                  Chemical Warehouse Hub
                </h2>
                <span className="badge badge-approved">Storekeeper Active</span>
              </div>
              <p className="text-xs text-muted font-mono mt-0.5">
                Bulk LARGO Detergent, Foam Tanks, Restock Deliveries & Attendant Dispensing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPO(true)}
              className="btn btn-primary text-xs font-semibold py-2 px-3.5 rounded-xl gap-2 shadow-sm shadow-accent/20"
            >
              <Plus size={14} />
              <span>Create PO</span>
            </button>
            <button
              onClick={() => setShowSupplier(true)}
              className="btn btn-ghost text-xs font-medium py-2 px-3 rounded-xl gap-1.5 border border-line"
            >
              <Building2 size={14} />
              <span>Add Vendor</span>
            </button>
            <button
              onClick={loadData}
              className="icon-btn rounded-xl border border-line"
              title="Sync Live"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Live Warehouse Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-line/60">
          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Pending Refills</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-text">{pendingReqs.length}</span>
              {pendingReqs.length > 0 && <span className="badge badge-pending">Urgent</span>}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Total Bulk Stock</p>
            <p className="text-2xl font-bold font-mono text-accent mt-1">
              {(totalStockMl / 1000).toFixed(1)} <span className="text-xs text-muted font-normal">Liters</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Stock Health</p>
            <p className="text-2xl font-bold font-mono text-text mt-1">
              {lowStockCount > 0 ? (
                <span className="text-amber">{lowStockCount} Low/Critical</span>
              ) : (
                <span className="text-emerald-400">All Good</span>
              )}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-panel-2/60 border border-line">
            <p className="text-[11px] font-mono text-muted uppercase">Pending Deliveries</p>
            <p className="text-2xl font-bold font-mono text-text mt-1">
              {orders.filter((o) => o.status === "pending").length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-panel-2 p-1 border border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === t ? "bg-panel text-accent shadow-xs" : "text-muted hover:text-text"
            }`}
          >
            {t === "Refill Desk" && <Droplet size={14} />}
            {t === "Bulk Chemicals" && <Box size={14} />}
            {t === "Purchase Orders" && <Truck size={14} />}
            {t === "Suppliers" && <Building2 size={14} />}
            <span>{t}</span>
            {t === "Refill Desk" && pendingReqs.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center ml-1">
                {pendingReqs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: ATTENDANT REFILL DESK ──────────────────────────── */}
      {tab === "Refill Desk" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
              Bay Attendant Detergent Requisitions ({soapReqs.length})
            </h3>
          </div>

          {soapReqs.length === 0 ? (
            <div className="card glass-card p-10 text-center text-muted border-line">
              <Droplet size={28} className="mx-auto text-accent mb-2" />
              <p className="font-semibold text-text">No Refill Requests</p>
              <p className="text-xs text-muted mt-1">When bay attendants request soap refills, they appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {soapReqs.map((req) => {
                const isPending = req.status === "pending";
                return (
                  <div
                    key={req.id}
                    className={`card glass-card p-4 border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                      isPending ? "border-amber/40 bg-amber/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-xs ${
                          isPending
                            ? "bg-amber/20 text-amber border border-amber/30"
                            : req.status === "approved"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red/20 text-red"
                        }`}
                      >
                        <Droplet size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text">{req.washer_name}</span>
                          <span className="text-xs font-mono text-muted">({req.request_number})</span>
                          <span
                            className={`badge ${
                              isPending
                                ? "badge-pending"
                                : req.status === "approved"
                                ? "badge-approved"
                                : "badge-rejected"
                            }`}
                          >
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-text-2 mt-1">
                          Product: <strong className="text-text">{req.product_name}</strong> · Requested:{" "}
                          <strong className="text-accent font-mono">{req.quantity_requested} ml</strong>
                          {req.quantity_approved && (
                            <>
                              {" "}
                              · Approved:{" "}
                              <strong className="text-emerald-400 font-mono">{req.quantity_approved} ml</strong>
                            </>
                          )}
                        </p>
                        {req.notes && <p className="text-[11px] text-muted italic mt-0.5">&quot;{req.notes}&quot;</p>}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <div className="flex items-center gap-1.5 bg-panel-2 p-1 rounded-xl border border-line">
                          <span className="text-[10px] font-mono text-muted pl-1">Qty:</span>
                          <input
                            type="number"
                            className="w-16 bg-transparent text-xs font-mono text-text text-center outline-hidden"
                            defaultValue={req.quantity_requested}
                            onChange={(e) =>
                              setApproveQty((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                          />
                          <span className="text-[10px] font-mono text-muted pr-1">ml</span>
                        </div>

                        <button
                          onClick={() => handleDecideRequest(req.id, "approved")}
                          className="btn btn-primary text-xs py-1.5 px-3 rounded-xl gap-1"
                        >
                          <Check size={13} />
                          <span>Approve & Dispense</span>
                        </button>
                        <button
                          onClick={() => handleDecideRequest(req.id, "rejected")}
                          className="btn btn-danger text-xs py-1.5 px-2.5 rounded-xl"
                          title="Reject"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: BULK CHEMICAL INVENTORY ────────────────────────── */}
      {tab === "Bulk Chemicals" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
              Main Store Stock Items ({inventory.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((item) => {
              const pct = Math.min(100, Math.round((item.total_ml / (item.min_stock_ml * 2.5 || 10000)) * 100));
              const isCrit = item.status === "critical";
              const isLow = item.status === "low";

              return (
                <div key={item.id} className="card glass-card p-5 border-line space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-panel-2 text-muted border border-line">
                        {item.category}
                      </span>
                      <h4 className="font-bold text-sm text-text mt-1.5">{item.product_name}</h4>
                    </div>
                    <span
                      className={`badge ${
                        isCrit ? "badge-critical" : isLow ? "badge-low" : "badge-ok"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline text-xs mb-1">
                      <span className="text-muted font-mono">Current Stock:</span>
                      <span className="text-lg font-bold font-mono text-text">
                        {item.total_ml.toLocaleString()} ml
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-panel-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCrit ? "bg-red" : isLow ? "bg-amber" : "bg-accent"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted font-mono mt-1">
                      <span>Reorder Min: {item.min_stock_ml.toLocaleString()} ml</span>
                      <span>{(item.total_ml / 1000).toFixed(1)} L</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-line text-[11px] text-muted flex justify-between">
                    <span>Supplier: {item.supplier || "Default Vendor"}</span>
                    <span>Cost: ETB {item.unit_cost || 0.188}/ml</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: PURCHASE ORDERS ────────────────────────────────── */}
      {tab === "Purchase Orders" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
              Restock Purchase Orders ({orders.length})
            </h3>
            <button
              onClick={() => setShowPO(true)}
              className="btn btn-primary text-xs py-1.5 px-3 rounded-xl gap-1.5"
            >
              <Plus size={13} />
              <span>New Order</span>
            </button>
          </div>

          <div className="card glass-card border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Product & Qty</th>
                    <th>Supplier</th>
                    <th>Ordered</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => (
                    <tr key={po.id}>
                      <td className="font-mono font-semibold text-text">{po.po_number}</td>
                      <td>
                        <span className="font-medium text-text">{po.product_name}</span>
                        <span className="text-xs text-muted block font-mono">
                          {po.qty_ml.toLocaleString()} ml ({(po.qty_ml / 1000).toFixed(1)} L)
                        </span>
                      </td>
                      <td className="text-xs">{po.supplier_name}</td>
                      <td className="text-xs font-mono">{po.ordered_at}</td>
                      <td className="text-xs font-mono font-bold text-accent">
                        ETB {(po.total_cost || 0).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            po.status === "received"
                              ? "badge-approved"
                              : po.status === "pending"
                              ? "badge-pending"
                              : "badge-rejected"
                          }`}
                        >
                          {po.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {po.status === "pending" && (
                          <button
                            onClick={() => handleReceiveStock(po.id)}
                            className="btn btn-primary text-[11px] py-1 px-2.5 rounded-lg gap-1 shadow-xs"
                          >
                            <PackageCheck size={13} />
                            <span>Receive Stock</span>
                          </button>
                        )}
                        {po.status === "received" && (
                          <span className="text-[11px] text-muted font-mono flex items-center gap-1">
                            <Check size={12} className="text-emerald-400" /> Stocked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: SUPPLIERS DIRECTORY ────────────────────────────── */}
      {tab === "Suppliers" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
              Chemical Vendors & Wholesalers ({suppliers.length})
            </h3>
            <button
              onClick={() => setShowSupplier(true)}
              className="btn btn-primary text-xs py-1.5 px-3 rounded-xl gap-1.5"
            >
              <Plus size={13} />
              <span>Add Vendor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div key={sup.id} className="card glass-card p-5 border-line space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-text">{sup.name}</h4>
                    <p className="text-xs text-muted mt-0.5 font-mono">{sup.products}</p>
                  </div>
                  <span className="badge badge-approved">Active</span>
                </div>

                <div className="space-y-1.5 text-xs text-text-2 pt-2 border-t border-line">
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-accent" />
                    <span>{sup.contact}</span>
                  </div>
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-muted" />
                      <span>{sup.email}</span>
                    </div>
                  )}
                  {sup.address && (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-muted" />
                      <span>{sup.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE PURCHASE ORDER ──────────────────────────── */}
      {showPO && (
        <Modal title="Create Chemical Purchase Order" onClose={() => setShowPO(false)}>
          <form onSubmit={handleCreatePO} className="space-y-3.5 text-xs">
            <div>
              <label className="text-muted font-mono uppercase block mb-1">Select Supplier:</label>
              <select
                value={poForm.supplier_id}
                onChange={(e) => setPoForm((p) => ({ ...p, supplier_id: e.target.value }))}
                className="input"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Target Chemical:</label>
              <select
                value={poForm.inventory_id}
                onChange={(e) => setPoForm((p) => ({ ...p, inventory_id: e.target.value }))}
                className="input"
              >
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.product_name} ({i.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-muted font-mono uppercase block mb-1">Quantity (ml):</label>
                <input
                  type="number"
                  value={poForm.qty_ml}
                  onChange={(e) => setPoForm((p) => ({ ...p, qty_ml: e.target.value }))}
                  placeholder="e.g. 20000"
                  required
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="text-muted font-mono uppercase block mb-1">Unit Cost (ETB/ml):</label>
                <input
                  type="number"
                  step="0.001"
                  value={poForm.unit_cost}
                  onChange={(e) => setPoForm((p) => ({ ...p, unit_cost: e.target.value }))}
                  required
                  className="input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Order Notes:</label>
              <input
                type="text"
                value={poForm.notes}
                onChange={(e) => setPoForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. 4x 5L Jerrycans"
                className="input"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-semibold rounded-xl mt-2">
              Confirm & Issue Purchase Order
            </button>
          </form>
        </Modal>
      )}

      {/* ── MODAL: ADD SUPPLIER ────────────────────────────────────── */}
      {showSupplier && (
        <Modal title="Register Chemical Supplier" onClose={() => setShowSupplier(false)}>
          <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-xs">
            <div>
              <label className="text-muted font-mono uppercase block mb-1">Company / Vendor Name:</label>
              <input
                type="text"
                value={supForm.name}
                onChange={(e) => setSupForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Addis Chemical Trading PLC"
                required
                className="input"
              />
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Phone / Contact:</label>
              <input
                type="text"
                value={supForm.contact}
                onChange={(e) => setSupForm((p) => ({ ...p, contact: e.target.value }))}
                placeholder="e.g. +251 911 234 567"
                required
                className="input"
              />
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Supplied Products:</label>
              <input
                type="text"
                value={supForm.products}
                onChange={(e) => setSupForm((p) => ({ ...p, products: e.target.value }))}
                placeholder="e.g. LARGO 5L jerrycans, Engine degreaser"
                className="input"
              />
            </div>

            <div>
              <label className="text-muted font-mono uppercase block mb-1">Warehouse Address:</label>
              <input
                type="text"
                value={supForm.address}
                onChange={(e) => setSupForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="e.g. Kaliti Industrial Zone, Addis Ababa"
                className="input"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-semibold rounded-xl mt-2">
              Save Supplier
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
