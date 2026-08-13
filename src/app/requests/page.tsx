"use client";

import { useEffect, useState } from "react";
import { Check, X, RefreshCw, Sparkles, Bell, Droplet, User, Package } from "lucide-react";
import { DataStore } from "@/lib/data-store";
import { SoapRequest } from "@/lib/types";

const tone: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#3A2E14", fg: "var(--amber)" },
  approved: { bg: "#123A34", fg: "var(--accent)" },
  rejected: { bg: "#3A1A1A", fg: "var(--red)" },
  partial: { bg: "#2a1f4a", fg: "var(--violet)" },
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<SoapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [approveQty, setApproveQty] = useState<Record<string, string>>({});

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadData() {
    setLoading(true);
    const data = await DataStore.getSoapRequests();
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, []);

  async function handleDecide(id: string, status: "approved" | "rejected") {
    const target = requests.find((r) => r.id === id);
    const qty = status === "approved" ? Number(approveQty[id] || target?.quantity_requested || 0) : undefined;
    await DataStore.decideSoapRequest(id, status, qty);
    notify(status === "approved" ? `✓ Approved ${qty}ml for ${target?.washer_name}` : "✕ Request rejected.");
    await loadData();
  }

  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;

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
            Soap & Chemical Requisition
          </h2>
          <p className="text-sm text-muted">
            Review and decide on detergent requests submitted by wash bay attendants.
          </p>
        </div>
        <button onClick={loadData} className="icon-btn" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between border-l-4 border-l-amber">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted font-medium">Pending Review</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-text mt-1">{pending}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-amber/15 text-amber">
            <Bell size={18} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-accent">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted font-medium">Approved & Issued</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-text mt-1">{approved}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-accent/15 text-accent">
            <Check size={18} />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-red">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted font-medium">Rejected</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-text mt-1">{rejected}</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-red/15 text-red">
            <X size={18} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3 className="font-semibold text-text">All Requisitions</h3>
          <span className="text-xs text-muted font-mono">{requests.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Request #</th>
                <th>Attendant</th>
                <th>Product</th>
                <th>Qty Requested</th>
                <th>Approve Qty (ml)</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const t = tone[r.status] || tone.pending;
                const isPending = r.status === "pending";

                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs font-bold text-accent">{r.request_number}</td>
                    <td className="font-medium text-text">{r.washer_name}</td>
                    <td className="text-xs text-muted">{r.product_name}</td>
                    <td className="font-mono font-bold text-text">{r.quantity_requested} ml</td>
                    <td>
                      {isPending ? (
                        <input
                          type="number"
                          defaultValue={r.quantity_requested}
                          onChange={(e) => setApproveQty({ ...approveQty, [r.id]: e.target.value })}
                          className="input py-1 px-2 text-xs w-24 font-mono"
                        />
                      ) : (
                        <span className="font-mono text-xs text-muted">
                          {r.quantity_approved ? `${r.quantity_approved} ml` : "—"}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-muted max-w-xs truncate">{r.notes || "Standard wash supply"}</td>
                    <td>
                      <span className="badge text-[10px]" style={{ background: t.bg, color: t.fg }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted font-mono">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {isPending ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDecide(r.id, "approved")}
                            className="btn btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                          >
                            <Check size={12} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleDecide(r.id, "rejected")}
                            className="btn btn-danger py-1 px-2 text-xs"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted font-mono">Processed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
