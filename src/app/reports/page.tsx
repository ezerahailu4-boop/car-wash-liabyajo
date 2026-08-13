"use client";

import { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  TrendingUp,
  Car,
  Droplet,
  Clock,
  DollarSign,
  PieChart as PieIcon,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { DataStore } from "@/lib/data-store";
import { Expense, WashTransaction } from "@/lib/types";

const VT_COLORS: Record<string, string> = { small: "#2FD5C8", medium: "#F2A93B", large: "#8B7CF6" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgoStr(7));
  const [to, setTo] = useState(todayStr());
  const [txns, setTxns] = useState<WashTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [allWashes, allExpenses] = await Promise.all([
      DataStore.getWashTransactions(from, to),
      DataStore.getExpenses(),
    ]);

    setTxns(allWashes);
    setExpenses(allExpenses.filter((e) => e.incurred_on >= from && e.incurred_on <= to));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    window.addEventListener("washos_data_change", loadData);
    return () => window.removeEventListener("washos_data_change", loadData);
  }, [from, to]);

  // Aggregations
  const totalRevenue = txns.reduce((s, t) => s + t.price, 0);
  const totalSoapUsed = txns.reduce((s, t) => s + t.soap_used_ml, 0);
  const detergentCost = Math.round(totalSoapUsed * 0.188); // ETB 0.188 / ml standard
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - detergentCost - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const avgWashTime = txns.length ? Math.round(txns.reduce((s, t) => s + (t.actual_minutes || 45), 0) / txns.length) : 42;

  // Daily Trend Map
  const dayMap: Record<string, { day: string; revenue: number; expenses: number }> = {};
  txns.forEach((t) => {
    const day = t.started_at.slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { day, revenue: 0, expenses: 0 };
    dayMap[day].revenue += t.price;
  });
  expenses.forEach((e) => {
    const day = e.incurred_on;
    if (!dayMap[day]) dayMap[day] = { day, revenue: 0, expenses: 0 };
    dayMap[day].expenses += Number(e.amount);
  });
  const dailyData = Object.values(dayMap)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      day: new Date(d.day + "T12:00:00").toLocaleDateString("en", { weekday: "short", month: "numeric", day: "numeric" }),
      revenue: d.revenue,
      expenses: d.expenses,
    }));

  // Per Washer Breakdown
  const washerMap: Record<string, { name: string; cars: number; revenue: number; soap: number }> = {};
  txns.forEach((t) => {
    const name = t.washer_name || "Attendant";
    if (!washerMap[name]) washerMap[name] = { name, cars: 0, revenue: 0, soap: 0 };
    washerMap[name].cars++;
    washerMap[name].revenue += t.price;
    washerMap[name].soap += t.soap_used_ml;
  });
  const washerData = Object.values(washerMap).sort((a, b) => b.revenue - a.revenue);

  // Fleet Mix
  const fleetMap: Record<string, number> = {};
  txns.forEach((t) => {
    fleetMap[t.vehicle_type_id] = (fleetMap[t.vehicle_type_id] || 0) + 1;
  });
  const fleetData = Object.entries(fleetMap).map(([id, value]) => ({
    name: id.charAt(0).toUpperCase() + id.slice(1),
    value,
    color: VT_COLORS[id] || "#2FD5C8",
  }));

  // Payment Breakdown
  const paymentMap: Record<string, number> = {};
  txns.forEach((t) => {
    const method = (t.payment_method || "cash").toUpperCase();
    paymentMap[method] = (paymentMap[method] || 0) + t.price;
  });
  const paymentData = Object.entries(paymentMap).map(([method, amount]) => ({
    method,
    amount,
  }));

  // Exports
  function exportCSV() {
    const rows = [
      ["Receipt Number", "Date", "Plate", "Vehicle Type", "Attendant", "Services", "Payment Method", "Price (ETB)", "Soap (ml)", "Minutes"],
      ...txns.map((t) => [
        t.receipt_number || "",
        t.started_at.slice(0, 10),
        t.plate || "",
        t.vehicle_type_id,
        t.washer_name || "",
        (t.services || []).join(" | "),
        t.payment_method,
        t.price,
        t.soap_used_ml,
        t.actual_minutes || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `washos-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const summarySheet = [
      { Metric: "Gross Wash Revenue (ETB)", Value: totalRevenue },
      { Metric: "Detergent Chemical Cost (ETB)", Value: detergentCost },
      { Metric: "Operating Overhead & Expenses (ETB)", Value: totalExpenses },
      { Metric: "Net Profit (ETB)", Value: netProfit },
      { Metric: "Net Profit Margin (%)", Value: `${profitMargin}%` },
      { Metric: "Total Cars Washed", Value: txns.length },
      { Metric: "Total Soap Used (ml)", Value: totalSoapUsed },
      { Metric: "Reporting Period", Value: `${from} to ${to}` },
    ];

    const txSheet = txns.map((t) => ({
      Receipt: t.receipt_number || "",
      Date: t.started_at.slice(0, 10),
      Plate: t.plate || "",
      Type: t.vehicle_type_id,
      Washer: t.washer_name || "",
      Payment: t.payment_method,
      "Price (ETB)": t.price,
      "Soap (ml)": t.soap_used_ml,
      Minutes: t.actual_minutes || "",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), "P&L Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txSheet), "Wash Transactions");
    XLSX.writeFile(wb, `washos-financial-report-${from}-to-${to}.xlsx`);
  }

  async function exportPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("WashOS Car Wash ERP — Financial Statement", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}`, 14, 26);

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Gross Revenue: ${totalRevenue.toLocaleString()} ETB`, 14, 36);
    doc.text(`Detergent Cost (LARGO): ${detergentCost.toLocaleString()} ETB`, 14, 43);
    doc.text(`Operating Expenses: ${totalExpenses.toLocaleString()} ETB`, 14, 50);
    doc.text(`Net Operating Profit: ${netProfit.toLocaleString()} ETB (${profitMargin}% Margin)`, 14, 57);

    autoTable(doc, {
      startY: 65,
      head: [["Receipt", "Date", "Plate", "Type", "Attendant", "Payment", "Price (ETB)", "Soap (ml)"]],
      body: txns.map((t) => [
        t.receipt_number || "",
        t.started_at.slice(0, 10),
        t.plate || "",
        t.vehicle_type_id,
        t.washer_name || "",
        t.payment_method.toUpperCase(),
        t.price.toLocaleString(),
        t.soap_used_ml,
      ]),
    });

    doc.save(`washos-report-${from}-to-${to}.pdf`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text font-[family-name:var(--font-display)]">
            Executive Analytics & Financial Reports
          </h2>
          <p className="text-sm text-muted">
            Inspect revenue throughput, chemical consumption economics, P&L statements, and export reports.
          </p>
        </div>

        {/* Date Range & Exports */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-panel border border-line text-xs">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent border-none text-text text-xs outline-none font-mono"
            />
            <span className="text-muted">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent border-none text-text text-xs outline-none font-mono"
            />
          </div>

          <button onClick={exportCSV} className="btn btn-ghost text-xs flex items-center gap-1.5" title="Export CSV">
            <FileText size={14} />
            <span>CSV</span>
          </button>
          <button onClick={exportExcel} className="btn btn-ghost text-xs flex items-center gap-1.5" title="Export Excel">
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>
          <button onClick={exportPDF} className="btn btn-primary text-xs flex items-center gap-1.5" title="Export PDF">
            <Download size={14} />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* P&L Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-l-emerald-500 space-y-1">
          <p className="section-label">Gross Revenue</p>
          <p className="text-2xl font-bold font-mono text-text">{totalRevenue.toLocaleString()} ETB</p>
          <p className="text-[11px] text-muted font-mono">{txns.length} washes completed</p>
        </div>

        <div className="card p-5 border-l-4 border-l-amber space-y-1">
          <p className="section-label">Chemical Detergent Cost</p>
          <p className="text-2xl font-bold font-mono text-text">{detergentCost.toLocaleString()} ETB</p>
          <p className="text-[11px] text-muted font-mono">{totalSoapUsed.toLocaleString()} ml soap used</p>
        </div>

        <div className="card p-5 border-l-4 border-l-red space-y-1">
          <p className="section-label">Operating Expenses</p>
          <p className="text-2xl font-bold font-mono text-text">{totalExpenses.toLocaleString()} ETB</p>
          <p className="text-[11px] text-muted font-mono">Utilities, payroll & rent</p>
        </div>

        <div className="card p-5 border-l-4 border-l-accent space-y-1">
          <p className="section-label">Net Operating Profit</p>
          <p className="text-2xl font-bold font-mono text-accent">{netProfit.toLocaleString()} ETB</p>
          <p className="text-[11px] text-emerald-400 font-mono font-medium">
            {profitMargin}% Net Margin
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Revenue vs Expense Chart */}
        <div className="xl:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-text">Daily Revenue vs Overhead</h3>
              <p className="text-xs text-muted">Daily breakdown of wash earnings vs logged expenses</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: 12 }}
                />
                <Bar dataKey="revenue" fill="var(--accent)" name="Revenue (ETB)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="var(--red)" name="Expenses (ETB)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Distribution */}
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-base text-text">Fleet Distribution</h3>
            <p className="text-xs text-muted">Vehicle categories washed</p>
          </div>
          <div className="h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fleetData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label>
                  {fleetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            {fleetData.map((f) => (
              <div key={f.name} className="p-2 rounded-lg bg-panel-2">
                <span className="text-[10px] text-muted block">{f.name}</span>
                <span className="font-bold text-text">{f.value} cars</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendant Leaderboard */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3 className="font-semibold text-text">Attendant Performance & Commission Summary</h3>
          <span className="text-xs text-muted font-mono">{washerData.length} attendants active</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Attendant Name</th>
                <th>Cars Washed</th>
                <th>Soap Used (ml)</th>
                <th>Gross Revenue Generated</th>
                <th>Est. Commission (20%)</th>
                <th>Efficiency Rating</th>
              </tr>
            </thead>
            <tbody>
              {washerData.map((w, idx) => (
                <tr key={w.name}>
                  <td className="font-bold text-text flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span>{w.name}</span>
                  </td>
                  <td className="font-mono font-bold text-text">{w.cars} vehicles</td>
                  <td className="font-mono text-xs text-muted">{w.soap} ml</td>
                  <td className="font-mono font-bold text-text">{w.revenue.toLocaleString()} ETB</td>
                  <td className="font-mono font-bold text-emerald-400">
                    {Math.round(w.revenue * 0.2).toLocaleString()} ETB
                  </td>
                  <td>
                    <span className="badge badge-approved text-[10px]">96% Optimal</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
