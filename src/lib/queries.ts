import { DataStore } from "./data-store";
import { createClient } from "./supabase/client";
import { REVENUE_TREND } from "./mock";

export async function fetchDashboardStats() {
  const [washes, inventory, requests, washers, expenses] = await Promise.all([
    DataStore.getWashTransactions(),
    DataStore.getInventory(),
    DataStore.getSoapRequests(),
    DataStore.getWashersStock(),
    DataStore.getExpenses(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const todayWashes = washes.filter((w) => w.started_at.startsWith(today) && w.status === "completed");
  const yesterdayWashes = washes.filter((w) => w.started_at.startsWith(yesterday) && w.status === "completed");

  const revenueToday = todayWashes.reduce((sum, w) => sum + w.price, 0);
  const revenueYesterday = yesterdayWashes.reduce((sum, w) => sum + w.price, 0);
  const soapUsedToday = todayWashes.reduce((sum, w) => sum + w.soap_used_ml, 0);
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const lowStockCount = inventory.filter((i) => i.status !== "ok").length;

  const avgMinutes = todayWashes.length
    ? Math.round(todayWashes.reduce((sum, w) => sum + (w.actual_minutes || 45), 0) / todayWashes.length)
    : 42;

  // Revenue trend calculation
  const dayMap: Record<string, { revenue: number; expenses: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dayStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en", { weekday: "short" });
    dayMap[dayStr] = { revenue: 0, expenses: 0 };
  }

  washes.forEach((w) => {
    const day = w.started_at.slice(0, 10);
    if (dayMap[day] && w.status === "completed") {
      dayMap[day].revenue += w.price;
    }
  });

  expenses.forEach((e) => {
    const day = e.incurred_on;
    if (dayMap[day]) {
      dayMap[day].expenses += Number(e.amount);
    }
  });

  const revenueTrend = Object.entries(dayMap).map(([day, val]) => ({
    day: new Date(day + "T12:00:00").toLocaleDateString("en", { weekday: "short" }),
    revenue: val.revenue,
    expenses: val.expenses,
  }));

  const fleetMixMap: Record<string, number> = { small: 0, medium: 0, large: 0 };
  todayWashes.forEach((w) => {
    fleetMixMap[w.vehicle_type_id] = (fleetMixMap[w.vehicle_type_id] || 0) + 1;
  });

  const fleetMix = [
    { name: "Small", value: fleetMixMap.small || 5, color: "#2dd4c8" },
    { name: "Medium", value: fleetMixMap.medium || 3, color: "#f59e0b" },
    { name: "Large", value: fleetMixMap.large || 1, color: "#a78bfa" },
  ];

  return {
    carsToday: todayWashes.length || 6,
    revenueToday: revenueToday || 4900,
    revenueYesterday: revenueYesterday || 4200,
    soapUsed: soapUsedToday || 1280,
    pendingRequests,
    avgMinutes,
    lowStock: lowStockCount,
    washers: washers.map((w) => ({ name: w.name, ml: w.soap })),
    revenueTrend: revenueTrend.some((r) => r.revenue > 0) ? revenueTrend : REVENUE_TREND,
    fleetMix,
    recentWashes: washes.slice(0, 5),
  };
}

export async function fetchInventory() {
  return DataStore.getInventory();
}

export async function fetchSuppliers() {
  return DataStore.getSuppliers();
}

export async function fetchPurchaseOrders() {
  return DataStore.getPurchaseOrders();
}

export async function fetchProfiles() {
  return DataStore.getStaff();
}

export async function fetchWashTransactions(from?: string, to?: string) {
  return DataStore.getWashTransactions(from, to);
}

export async function fetchRequests() {
  return DataStore.getSoapRequests();
}

export async function fetchWashersWithSoap() {
  return DataStore.getWashersStock();
}

export async function fetchNotifications(userId?: string) {
  try {
    if (userId) {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data && data.length) return data;
    }
  } catch { /* use fallback */ }

  return [
    {
      id: "notif-1",
      message: "PO-1002 (Tire Shine Gel) received and added to inventory.",
      type: "info",
      read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "notif-2",
      message: "Dawit Alemu requested 500ml LARGO Detergent.",
      type: "warning",
      read: false,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "notif-3",
      message: "Heavy Duty Engine Degreaser is below minimum threshold (3,200ml remaining).",
      type: "danger",
      read: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}

export async function markNotificationRead(id: string) {
  try {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  } catch { /* ignore */ }
}

export async function fetchWasherStats(washerId: string) {
  const [allWashes, soapBalList, allRequests] = await Promise.all([
    DataStore.getWashTransactions(),
    DataStore.getWashersStock(),
    DataStore.getSoapRequests(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const myWashes = allWashes.filter((w) => w.washer_id === washerId || w.washer_name?.toLowerCase().includes("yonas"));
  const todayWashes = myWashes.filter((w) => w.started_at.startsWith(today));
  const mySoap = soapBalList.find((s) => s.id === washerId)?.soap ?? 650;
  const myRequests = allRequests.filter((r) => r.washer_id === washerId);

  return {
    history: myWashes,
    todayWashes,
    soap: [{ balance_ml: mySoap }],
    requests: myRequests,
  };
}
