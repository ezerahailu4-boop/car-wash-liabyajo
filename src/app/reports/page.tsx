"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, TrendingUp, Car, Droplet, Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { REVENUE_TREND, WASHERS } from "@/lib/mock";
import { fetchWashTransactions } from "@/lib/queries";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Txn = {
  id: string; price: number; soap_used_ml: number; started_at: string;
  actual_minutes: number | null; vehicle_type_id: string;
  washer_id: string;
  profiles: { full_name: string } | null;
  vehicles: { plate: string } | null;
};

const VT_COLORS: Record<string, string> = { small: "#2FD5C8", medium: "#F2A93B", large: "#8B7CF6" };

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchWashTransactions(from, to);
      if (data.length) { setTxns(data as unknown as Txn[]); setUseMock(false); }
      else { setUseMock(true); }
    } catch { setUseMock(true); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [from, to]);

  // Aggregations
  const totalRevenue = txns.reduce((s, t) => s + t.price, 0);
  const totalSoap = txns.reduce((s, t) => s + t.soap_used_ml, 0);
  const avgTime = txns.length ? Math.round(txns.reduce((s, t) => s + (t.actual_minutes ?? 0), 0) / txns.length) : 0;

  // Daily revenue chart
  const dailyMap: Record<string, number> = {};
  txns.forEach((t) => {
    const day = t.started_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + t.price;
  });
  const dailyData = Object.entries(dailyMap).sort().map(([day, revenue]) => ({
    day: new Date(day).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }),
    revenue,
  }));

  // Per-washer breakdown
  const washerMap: Record<string, { name: string; cars: number; revenue: number; soap: number }> = {};
  txns.forEach((t) => {
    const name = t.profiles?.full_name ?? t.washer_id;
    if (!washerMap[t.washer_id]) washerMap[t.washer_id] = { name, cars: 0, revenue: 0, soap: 0 };
    washerMap[t.washer_id].cars++;
    washerMap[t.washer_id].revenue += t.price;
    washerMap[t.washer_id].soap += t.soap_used_ml;
  });
  const washerData = Object.values(washerMap).sort((a, b) => b.revenue - a.revenue);

  // Fleet mix
  const fleetMap: Record<string, number> = {};
  txns.forEach((t) => { fleetMap[t.vehicle_type_id] = (fleetMap[t.vehicle_type_id] ?? 0) + 1; });
  const fleetData = Object.entries(fleetMap).map(([id, value]) => ({
    name: id.charAt(0).toUpperCase() + id.slice(1), value, color: VT_COLORS[id] ?? "#84939E",
  }));

  function exportCSV() {
    const rows = [
      ["Date", "Plate", "Vehicle Type", "Washer", "Price (birr)", "Soap (ml)", "Minutes"],
      ...(useMock ? [] : txns.map((t) => [
        t.started_at.slice(0, 10),
        t.vehicles?.plate ?? "",
        t.vehicle_type_id,
        t.profiles?.full_name ?? "",
        t.price,
        t.soap_used_ml,
        t.actual_minutes ?? "",
      ])),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `washos-report-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = txns.map((t) => ({
      Date: t.started_at.slice(0, 10),
      Plate: t.vehicles?.plate ?? "",
      "Vehicle Type": t.vehicle_type_id,
      Washer: t.profiles?.full_name ?? "",
      "Price (birr)": t.price,
      "Soap (ml)": t.soap_used_ml,
      Minutes: t.actual_minutes ?? "",
    }));
    const summary = [
      { Metric: "Total Washes", Value: txns.length },
      { Metric: "Total Revenue (birr)", Value: totalRevenue },
      { Metric: "Soap Used (ml)", Value: totalSoap },
      { Metric: "Avg Wash Time (min)", Value: avgTime },
      { Metric: "Period", Value: `${from} to ${to}` },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Transactions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(displayWashers.map((w) => ({
      Washer: w.name, Cars: w.cars, "Revenue (birr)": w.revenue, "Soap (ml)": w.soap,
    }))), "Per Washer");
    XLSX.writeFile(wb, `washos-report-${from}-to-${to}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("WashOS — Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Period: ${from} to ${to}`, 14, 25);

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Total Washes: ${txns.length}`, 14, 35);
    doc.text(`Total Revenue: ${totalRevenue.toLocaleString()} birr`, 14, 42);
    doc.text(`Soap Used: ${totalSoap.toLocaleString()} ml`, 14, 49);
    doc.text(`Avg Wash Time: ${avgTime} min`, 14, 56);

    autoTable(doc, {
      startY: 64,
      head: [["Date", "Plate", "Type", "Washer", "Price", "Soap (ml)", "Min"]],
      body: txns.slice(0, 200).map((t) => [
        t.started_at.slice(0, 10),
        t.vehicles?.plate ?? "—",
        t.vehicle_type_id,
        t.profiles?.full_name ?? "—",
        `${t.price} birr`,
        `${t.soap_used_ml}`,
        `${t.actual_minutes ?? "—"}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [47, 213, 200] },
    });

    doc.save(`washos-report-${from}-to-${to}.pdf`);
  }

  const displayRevenue = useMock ? REVENUE_TREND : dailyData;
  const displayWashers = useMock
    ? WASHERS.map((w) => ({ name: w.name, cars: w.carsToday, revenue: w.revenueToday, soap: w.soap }))
    : washerData;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent font-[family-name:var(--font-mono)]" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted block mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm bg-panel-2 border border-line outline-none focus:ring-2 focus:ring-accent font-[family-name:var(--font-mono)]" />
          </div>
          {[
            { label: "Today", fn: () => { setFrom(today()); setTo(today()); } },
            { label: "7 Days", fn: () => { setFrom(daysAgo(6)); setTo(today()); } },
            { label: "30 Days", fn: () => { setFrom(daysAgo(29)); setTo(today()); } },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} className="mt-5 px-3 py-2 rounded-xl text-xs bg-panel-2 border border-line text-muted hover:text-text">{label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2.5 rounded-xl bg-panel-2 border border-line text-muted hover:text-text"><RefreshCw size={15} /></button>
          <button onClick={exportCSV} className="px-4 py-2 rounded-xl text-sm font-medium bg-panel-2 border border-line text-muted hover:text-text flex items-center gap-2">
            <Download size={15} /> CSV
          </button>
          <button onClick={exportExcel} className="px-4 py-2 rounded-xl text-sm font-medium bg-panel-2 border border-line text-muted hover:text-text flex items-center gap-2">
            <Download size={15} /> Excel
          </button>
          <button onClick={exportPDF} className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-[#06201D] flex items-center gap-2">
            <Download size={15} /> PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Washes", value: useMock ? 141 : txns.length, icon: Car, accent: "var(--accent)" },
          { label: "Total Revenue", value: `${(useMock ? 141200 : totalRevenue).toLocaleString()} birr`, icon: TrendingUp, accent: "var(--accent)" },
          { label: "Soap Used", value: `${(useMock ? 2820 : totalSoap).toLocaleString()} ml`, icon: Droplet, accent: "var(--amber)" },
          { label: "Avg Wash Time", value: `${useMock ? 41 : avgTime} min`, icon: Clock, accent: "var(--violet)" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl p-5 border border-line bg-panel flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="font-[family-name:var(--font-display)] text-2xl mt-1">{value}</p>
            </div>
            <div className="rounded-xl p-2.5 bg-panel-2" style={{ color: accent }}><Icon size={18} /></div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-7 h-7 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>
      ) : (
        <>
          {/* Revenue chart */}
          <div className="rounded-2xl p-5 border border-line bg-panel">
            <h3 className="font-[family-name:var(--font-display)] text-lg mb-4">Daily Revenue</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={displayRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243139" />
                <XAxis dataKey={useMock ? "day" : "day"} stroke="#84939E" fontSize={11} />
                <YAxis stroke="#84939E" fontSize={11} />
                <Tooltip contentStyle={{ background: "#1C2830", border: "1px solid #243139", borderRadius: 8, color: "#E8EEF2" }} />
                <Bar dataKey="revenue" fill="#2FD5C8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Per-washer */}
            <div className="xl:col-span-2 rounded-2xl border border-line bg-panel overflow-hidden">
              <div className="p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg">Per-Washer Breakdown</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                    <th className="px-5 py-3">Washer</th>
                    <th className="px-5 py-3">Cars</th>
                    <th className="px-5 py-3">Revenue</th>
                    <th className="px-5 py-3">Soap Used</th>
                    <th className="px-5 py-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {displayWashers.map((w, i) => {
                    const total = displayWashers.reduce((s, x) => s + x.revenue, 0);
                    const pct = total ? Math.round((w.revenue / total) * 100) : 0;
                    return (
                      <tr key={i} className="border-b border-line">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-[family-name:var(--font-display)] bg-panel-2 text-accent">
                              {w.name.split(" ").map((n: string) => n[0]).join("")}
                            </div>
                            {w.name}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-mono)]">{w.cars}</td>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-accent">{w.revenue.toLocaleString()} birr</td>
                        <td className="px-5 py-3.5 font-[family-name:var(--font-mono)] text-muted">{w.soap} ml</td>
                        <td className="px-5 py-3.5 w-32">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-panel-2">
                              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted font-[family-name:var(--font-mono)]">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Fleet mix */}
            <div className="rounded-2xl p-5 border border-line bg-panel">
              <h3 className="font-[family-name:var(--font-display)] text-lg mb-4">Fleet Mix</h3>
              {(useMock ? [{ name: "Small", value: 62, color: "#2FD5C8" }, { name: "Medium", value: 28, color: "#F2A93B" }, { name: "Large", value: 10, color: "#8B7CF6" }] : fleetData).length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={useMock ? [{ name: "Small", value: 62, color: "#2FD5C8" }, { name: "Medium", value: 28, color: "#F2A93B" }, { name: "Large", value: 10, color: "#8B7CF6" }] : fleetData}
                        dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={3}>
                        {(useMock ? [{ color: "#2FD5C8" }, { color: "#F2A93B" }, { color: "#8B7CF6" }] : fleetData).map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1C2830", border: "1px solid #243139", borderRadius: 8, color: "#E8EEF2" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {(useMock ? [{ name: "Small", value: 62, color: "#2FD5C8" }, { name: "Medium", value: 28, color: "#F2A93B" }, { name: "Large", value: 10, color: "#8B7CF6" }] : fleetData).map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} /><span className="text-muted">{e.name}</span></div>
                        <span className="font-[family-name:var(--font-mono)]">{e.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-muted">No data for this period.</p>}
            </div>
          </div>

          {/* Transaction log */}
          {!useMock && txns.length > 0 && (
            <div className="rounded-2xl border border-line bg-panel overflow-hidden">
              <div className="p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg">Transaction Log</h3>
                <p className="text-xs text-muted mt-1">{txns.length} washes in selected period</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted border-t border-b border-line">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Plate</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Washer</th>
                      <th className="px-5 py-3">Price</th>
                      <th className="px-5 py-3">Soap</th>
                      <th className="px-5 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.slice(0, 50).map((t) => (
                      <tr key={t.id} className="border-b border-line hover:bg-panel-2 transition">
                        <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-muted">{t.started_at.slice(0, 10)}</td>
                        <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs">{t.vehicles?.plate ?? "—"}</td>
                        <td className="px-5 py-3 text-muted capitalize">{t.vehicle_type_id}</td>
                        <td className="px-5 py-3">{t.profiles?.full_name ?? "—"}</td>
                        <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-accent">+{t.price} birr</td>
                        <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-muted">{t.soap_used_ml} ml</td>
                        <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-muted">{t.actual_minutes ?? "—"} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
