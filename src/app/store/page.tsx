"use client";

import { useEffect, useState } from "react";
import { Plus, PackageCheck, Truck, Building2, X, Check, Bell } from "lucide-react";
import { PURCHASE_ORDERS, SUPPLIERS, INVENTORY, REQUESTS as MOCK_REQUESTS } from "@/lib/mock";
import { createClient } from "@/lib/supabase/client";

type PO = (typeof PURCHASE_ORDERS)[number];

type SoapReq = {
  id: string;
  request_number: string;
  washer_name: string;
  vehicle_type: string;
  quantity_requested: number;
  quantity_approved: number | null;
  status: string;
  created_at: string;
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending:  { bg: "#3A2E14", fg: "var(--amber)" },
  approved: { bg: "#123A34", fg: "var(--accent)" },
  rejected: { bg: "#3A1A1A", fg: "var(--red)" },
  received: { bg: "#123A34", fg: "var(--accent)" },
  cancelled:{ bg: "#3A1A1A", fg: "var(--red)" },
};

const TABS = ["Soap Requests", "Purchase Orders", "Receive Stock", "Suppliers"] as const;
type Tab = (typeof TABS)[number];

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

export default function StorePage() {
  const [tab, setTab] = useState<Tab>("Soap Requests");
  const [orders, setOrders] = useState(PURCHASE_ORDERS);
  const [suppliers, setSuppliers] = useState(SUPPLIERS);
  const [soapReqs, setSoapReqs] = useState<SoapReq[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [liveInventory, setLiveInventory] = useState<typeof INVENTORY | null>(null);
  const [showPO, setShowPO] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [poForm, setPoForm] = useState({ supplier: "", product: "", qty_ml: "", unit_cost: "" });
  const [supForm, setSupForm] = useState({ name: "", contact: "", products: "" });
  const [approveQty, setApproveQty] = useState<Record<string, string>>({});

  async function loadRequests() {
    setLoadingReqs(true);
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from("soap_requests")
        .select("id, request_number, quantity_requested, quantity_approved, status, notes, created_at, profiles(full_name)")
        .order("created_at", { ascending: false });
      if (data?.length) {
        type SoapReqRow = { id: string; request_number: string; quantity_requested: number; quantity_approved: number | null; status: string; notes: string | null; created_at: string; profiles: { full_name: string } | null };
        setSoapReqs((data as SoapReqRow[]).map((r) => ({
          id: r.id,
          request_number: r.request_number,
          washer_name: (r.profiles as { full_name: string } | null)?.full_name ?? "Unknown",
          vehicle_type: r.notes ?? "—",
          quantity_requested: r.quantity_requested,
          quantity_approved: r.quantity_approved,
          status: r.status,
          created_at: r.created_at,
        })));
      } else {
        setSoapReqs(MOCK_REQUESTS.map((r) => ({
          id: r.id, request_number: r.request_number,
          washer_name: r.washer, vehicle_type: "Light Vehicle × 1",
          quantity_requested: r.qty, quantity_approved: null,
          status: r.status, created_at: "",
        })));
      }
    } catch {
      setSoapReqs(MOCK_REQUESTS.map((r) => ({
        id: r.id, request_number: r.request_number,
        washer_name: r.washer, vehicle_type: "Light Vehicle × 1",
        quantity_requested: r.qty, quantity_approved: null,
        status: r.status, created_at: "",
      })));
    }
    setLoadingReqs(false);
  }

  async function loadInventory() {
    const supabase = createClient();
    try {
      const { data } = await supabase.from("inventory").select("*").order("product_name");
      if (data?.length) setLiveInventory(data as typeof INVENTORY);
    } catch { /* use mock */ }
  }

  useEffect(() => { loadRequests(); loadInventory(); }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    const qty = status === "approved" ? Number(approveQty[id] ?? soapReqs.find((r) => r.id === id)?.quantity_requested ?? 0) : null;
    setSoapReqs((prev) => prev.map((r) => r.id === id ? { ...r, status, quantity_approved: qty } : r));
    const supabase = createClient();
    try {
      await supabase.from("soap_requests").update({
        status,
        quantity_approved: qty,
        approved_by: (await supabase.auth.getUser()).data.user?.id,
      }).eq("id", id);
    } catch { /* demo */ }
    notify(status === "approved" ? `Approved — ${qty} ml dispensed.` : "Request rejected.");
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function createPO() {
    if (!poForm.supplier || !poForm.product || !poForm.qty_ml) return;
    const next: PO = {
      id: String(Date.now()),
      po_number: `PO-${String(orders.length + 45).padStart(4, "0")}`,
      supplier: poForm.supplier,
      product: poForm.product,
      qty_ml: Number(poForm.qty_ml),
      unit_cost: Number(poForm.unit_cost),
      status: "pending",
      ordered_at: new Date().toISOString().slice(0, 10),
      received_at: null,
    };
    setOrders((prev) => [next, ...prev]);
    setPoForm({ supplier: "", product: "", qty_ml: "", unit_cost: "" });
    setShowPO(false);
    notify(`${next.po_number} created.`);
  }

  async function markReceived(id: string) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const receivedDate = new Date().toISOString().slice(0, 10);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "received", received_at: receivedDate } : o));
    setReceiveId(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // Find matching inventory item and add stock
      const { data: invList } = await supabase.from("inventory").select("id, total_ml, product_name").limit(20);
      type InvStockRow = { id: string; total_ml: number; product_name: string };
      const inv = (invList as InvStockRow[] ?? []).find((i) =>
        i.product_name?.toLowerCase().includes(order.product.toLowerCase())
      ) ?? (invList as InvStockRow[])?.[0];
      if (inv) {
        await supabase.from("inventory").update({ total_ml: inv.total_ml + order.qty_ml }).eq("id", inv.id);
        await supabase.from("inventory_movements").insert({ inventory_id: inv.id, change_ml: order.qty_ml, reason: "purchase" });
      }
    } catch { /* demo mode */ }
    notify("Stock received and inventory updated.");
  }

  function cancelOrder(id: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "cancelled" } : o));
    notify("Order cancelled.");
  }

  function addSupplier() {
    if (!supForm.name) return;
    setSuppliers((prev) => [...prev, { id: String(Date.now()), ...supForm }]);
    setSupForm({ name: "", contact: "", products: "" });
    setShowSupplier(false);
    notify("Supplier added.");
  }

  const pending = orders.filter((o) => o.status === "pending").length;
  const totalValue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.qty_ml * o.unit_cost, 0);
  const pendingSoapReqs = soapReqs.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Soap Requests", value: pendingSoapReqs, icon: Bell, accent: pendingSoapReqs > 0 ? "var(--amber)" : "var(--accent)" },
          { label: "Pending Orders", value: pending, icon: Truck, accent: "var(--amber)" },
          { label: "Products in Stock", value: INVENTORY.length, icon: PackageCheck, accent: "var(--accent)" },
          { label: "Total PO Value", value: `${totalValue.toFixed(0)} birr`, icon: Check, accent: "var(--accent)" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl p-5 border border-line bg-panel flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
              <p className="font-[family-name:var(--font-display)] text-2xl mt-1">{value}</p>
            </div>
            <div className="rounded-xl p-2.5 bg-panel-2" style={{ color: accent }}><Icon size={18} /></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-sm transition"
            style={{ background: tab === t ? "var(--panel-2)" : "transparent", color: tab === t ? "var(--accent)" : "var(--muted)", border: "1px solid", borderColor: tab === t ? "var(--accent)" : "var(--line)" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Soap Requests from Employees */}
      {tab === "Soap Requests" && (
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg">Employee Soap Requests</h3>
              <p className="text-xs text-muted mt-1">Approve or reject — approved amounts are deducted from inventory and added to the washer&apos;s balance.</p>
            </div>
            <button onClick={loadRequests} className="p-2.5 rounded-xl bg-panel-2 border border-line text-muted hover:text-text">
              <PackageCheck size={15} />
            </button>
          </div>
          {loadingReqs ? (
            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                  <th className="px-5 py-3">Request #</th>
                  <th className="px-5 py-3">Washer</th>
                  <th className="px-5 py-3">For</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Approve Qty</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {soapReqs.map((req) => {
                  const t = STATUS_TONE[req.status] ?? STATUS_TONE.pending;
                  return (
                    <tr key={req.id} className="border-b border-line">
                      <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs">{req.request_number}</td>
                      <td className="px-5 py-3.5">{req.washer_name}</td>
                      <td className="px-5 py-3.5 text-muted text-xs">{req.vehicle_type}</td>
                      <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs">{req.quantity_requested} ml</td>
                      <td className="px-5 py-3.5">
                        {req.status === "pending" ? (
                          <input
                            type="number" min="1" max={req.quantity_requested}
                            value={approveQty[req.id] ?? req.quantity_requested}
                            onChange={(e) => setApproveQty((p) => ({ ...p, [req.id]: e.target.value }))}
                            className="w-24 rounded-lg px-2 py-1 text-xs bg-panel-2 border border-line outline-none focus:ring-1 focus:ring-accent font-[family-name:var(--font-mono)]"
                          />
                        ) : (
                          <span className="font-[family-name:var(--font-mono)] text-xs text-muted">{req.quantity_approved ?? "—"} ml</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wide" style={{ background: t.bg, color: t.fg }}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <button onClick={() => decide(req.id, "approved")}
                              className="px-3 py-1.5 rounded-xl text-xs bg-[#123A34] text-accent flex items-center gap-1.5">
                              <Check size={13} /> Approve
                            </button>
                            <button onClick={() => decide(req.id, "rejected")}
                              className="px-3 py-1.5 rounded-xl text-xs bg-[#3A1A1A] text-red flex items-center gap-1.5">
                              <X size={13} /> Reject
                            </button>
                          </div>
                        )}
                        {req.status !== "pending" && <span className="text-xs text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {soapReqs.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">No requests yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Purchase Orders */}
      {tab === "Purchase Orders" && (
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Purchase Orders</h3>
            <button onClick={() => setShowPO(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center gap-2">
              <Plus size={16} /> New Order
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                <th className="px-5 py-3">PO #</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Ordered</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const t = STATUS_TONE[o.status];
                return (
                  <tr key={o.id} className="border-b border-line">
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs">{o.po_number}</td>
                    <td className="px-5 py-3.5">{o.supplier}</td>
                    <td className="px-5 py-3.5 text-muted">{o.product}</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs">{(o.qty_ml / 1000).toFixed(1)} L</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs">{(o.qty_ml * o.unit_cost).toFixed(0)} birr</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted">{o.ordered_at}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wide" style={{ background: t.bg, color: t.fg }}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {o.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => setReceiveId(o.id)} className="px-3 py-1.5 rounded-xl text-xs bg-[#123A34] text-accent flex items-center gap-1.5">
                            <PackageCheck size={13} /> Receive
                          </button>
                          <button onClick={() => cancelOrder(o.id)} className="px-3 py-1.5 rounded-xl text-xs bg-[#3A1A1A] text-red flex items-center gap-1.5">
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      )}
                      {o.status !== "pending" && <span className="text-xs text-muted">{o.received_at ?? "—"}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receive Stock */}
      {tab === "Receive Stock" && (
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="p-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Current Inventory Levels</h3>
            <p className="text-xs text-muted mt-1">Mark a pending purchase order as received to update stock.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Current Stock</th>
                <th className="px-5 py-3">Min Stock</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Expiry</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(liveInventory ?? INVENTORY).map((item) => {
                const pct = Math.min(100, (item.total_ml / (item.min_stock_ml * 3)) * 100);
                const tone = item.status === "ok" ? "var(--accent)" : item.status === "low" ? "var(--amber)" : "var(--red)";
                return (
                  <tr key={item.id} className="border-b border-line">
                    <td className="px-5 py-3.5">{item.product_name}</td>
                    <td className="px-5 py-3.5 text-muted">{item.category}</td>
                    <td className="px-5 py-3.5 w-44">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-panel-2">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: tone }} />
                        </div>
                        <span className="font-[family-name:var(--font-mono)] text-xs">{(item.total_ml / 1000).toFixed(1)} L</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted">{(item.min_stock_ml / 1000).toFixed(1)} L</td>
                    <td className="px-5 py-3.5 text-muted">{item.supplier}</td>
                    <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted">{item.expiry_date}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wide"
                        style={{ background: item.status === "ok" ? "#123A34" : item.status === "low" ? "#3A2E14" : "#3A1A1A", color: tone }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Suppliers */}
      {tab === "Suppliers" && (
        <div className="rounded-2xl border border-line bg-panel overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-lg">Suppliers</h3>
            <button onClick={() => setShowSupplier(true)} className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center gap-2">
              <Plus size={16} /> Add Supplier
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Products Supplied</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-panel-2 text-violet text-xs font-[family-name:var(--font-display)]">
                        {s.name[0]}
                      </div>
                      {s.name}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-xs text-muted">{s.contact}</td>
                  <td className="px-5 py-3.5 text-muted text-xs">{s.products}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New PO Modal */}
      {showPO && (
        <Modal title="New Purchase Order" onClose={() => setShowPO(false)}>
          <div className="space-y-4">
            {[
              { label: "Supplier", key: "supplier", placeholder: "e.g. Chemtech PLC" },
              { label: "Product", key: "product", placeholder: "e.g. Foam Shampoo Concentrate" },
              { label: "Quantity (ml)", key: "qty_ml", placeholder: "e.g. 20000" },
              { label: "Unit Cost (birr/ml)", key: "unit_cost", placeholder: "e.g. 0.18" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs uppercase tracking-wide text-muted">{label}</label>
                <input
                  value={poForm[key as keyof typeof poForm]}
                  onChange={(e) => setPoForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={createPO} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D]">Create Order</button>
              <button onClick={() => setShowPO(false)} className="flex-1 py-2.5 rounded-xl text-sm border border-line text-muted">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Receive Modal */}
      {receiveId && (
        <Modal title="Confirm Stock Receipt" onClose={() => setReceiveId(null)}>
          <p className="text-sm text-muted mb-5">Mark this order as received? This will update the inventory stock level.</p>
          <div className="flex gap-3">
            <button onClick={() => markReceived(receiveId)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D]">Confirm Receipt</button>
            <button onClick={() => setReceiveId(null)} className="flex-1 py-2.5 rounded-xl text-sm border border-line text-muted">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Add Supplier Modal */}
      {showSupplier && (
        <Modal title="Add Supplier" onClose={() => setShowSupplier(false)}>
          <div className="space-y-4">
            {[
              { label: "Company Name", key: "name", placeholder: "e.g. Chemtech PLC" },
              { label: "Contact", key: "contact", placeholder: "+251 11 xxx xxxx" },
              { label: "Products Supplied", key: "products", placeholder: "e.g. Foam Shampoo, Wax" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs uppercase tracking-wide text-muted">{label}</label>
                <input
                  value={supForm[key as keyof typeof supForm]}
                  onChange={(e) => setSupForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={addSupplier} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent text-[#06201D]">Add Supplier</button>
              <button onClick={() => setShowSupplier(false)} className="flex-1 py-2.5 rounded-xl text-sm border border-line text-muted">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="fixed bottom-6 right-6 fade-up rounded-xl px-4 py-3 text-sm bg-[var(--accent-dim)] text-accent z-50">{toast}</div>}
    </div>
  );
}
