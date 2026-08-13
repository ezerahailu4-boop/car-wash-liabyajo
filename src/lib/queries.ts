import { createClient } from "@/lib/supabase/client";

export async function fetchDashboardStats() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [washRes, inventoryRes, requestsRes, washersRes] = await Promise.all([
    supabase
      .from("wash_transactions")
      .select("price, soap_used_ml, started_at, actual_minutes")
      .gte("started_at", `${today}T00:00:00`)
      .eq("status", "completed"),
    supabase.from("inventory").select("id, product_name, total_ml, min_stock_ml, status"),
    supabase.from("soap_requests").select("id, status").eq("status", "pending"),
    supabase.from("washer_inventory").select("washer_id, balance_ml, profiles(full_name)"),
  ]);

  return {
    washes: washRes.data ?? [],
    inventory: inventoryRes.data ?? [],
    pendingRequests: requestsRes.data?.length ?? 0,
    washers: washersRes.data ?? [],
  };
}

export async function fetchInventory() {
  const supabase = createClient();
  const { data } = await supabase
    .from("inventory")
    .select("*")
    .order("product_name");
  return data ?? [];
}

export async function fetchProfiles() {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  return data ?? [];
}

export async function fetchWashTransactions(from?: string, to?: string) {
  const supabase = createClient();
  let q = supabase
    .from("wash_transactions")
    .select("id, price, soap_used_ml, started_at, completed_at, actual_minutes, vehicle_type_id, washer_id, profiles(full_name), vehicles(plate)")
    .eq("status", "completed")
    .order("started_at", { ascending: false });

  if (from) q = q.gte("started_at", `${from}T00:00:00`);
  if (to) q = q.lte("started_at", `${to}T23:59:59`);

  const { data } = await q;
  return data ?? [];
}

export async function fetchRequests() {
  const supabase = createClient();
  const { data } = await supabase
    .from("soap_requests")
    .select("id, request_number, status, quantity_requested, quantity_approved, notes, created_at, washer_id, profiles(full_name), inventory(product_name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function fetchWashersWithSoap() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data } = await supabase
    .from("washer_inventory")
    .select("washer_id, balance_ml, profiles(full_name, active)");
  return (data as unknown[]) ?? [];
}


export async function fetchNotifications(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const supabase = createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function fetchWasherStats(washerId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [historyRes, soapRes, requestsRes] = await Promise.all([
    supabase
      .from("wash_transactions")
      .select("id, price, soap_used_ml, started_at, vehicle_type_id, vehicles(plate)")
      .eq("washer_id", washerId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("washer_inventory")
      .select("balance_ml, inventory(product_name)")
      .eq("washer_id", washerId),
    supabase
      .from("soap_requests")
      .select("id, request_number, status, quantity_requested, quantity_approved, notes, created_at, inventory(product_name)")
      .eq("washer_id", washerId)
      .order("created_at", { ascending: false }),
  ]);

  const todayWashes = (historyRes.data ?? []).filter((w) =>
    (w as { started_at?: string }).started_at?.startsWith(today)
  );

  return {
    history: historyRes.data ?? [],
    todayWashes,
    soap: soapRes.data ?? [],
    requests: requestsRes.data ?? [],
  };
}
