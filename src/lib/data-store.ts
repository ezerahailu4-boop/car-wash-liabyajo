"use client";

import { createClient } from "./supabase/client";
import {
  VEHICLE_TYPES,
  WASH_SERVICES,
  INVENTORY as SEED_INVENTORY,
  SUPPLIERS as SEED_SUPPLIERS,
  PURCHASE_ORDERS as SEED_PO,
  WASHERS as SEED_WASHERS,
  STAFF as SEED_STAFF,
  CUSTOMERS as SEED_CUSTOMERS,
  REQUESTS as SEED_REQUESTS,
  EXPENSES as SEED_EXPENSES,
  WASH_HISTORY as SEED_WASHES,
} from "./mock";
import {
  Customer,
  Expense,
  InventoryItem,
  Notification,
  Profile,
  PurchaseOrder,
  SoapRequest,
  Supplier,
  WashService,
  WashTransaction,
} from "./types";

const STORAGE_KEYS = {
  INVENTORY: "washos_inventory",
  SUPPLIERS: "washos_suppliers",
  PURCHASE_ORDERS: "washos_purchase_orders",
  CUSTOMERS: "washos_customers",
  WASH_TRANSACTIONS: "washos_wash_transactions",
  SOAP_REQUESTS: "washos_soap_requests",
  EXPENSES: "washos_expenses",
  STAFF: "washos_staff",
  WASHERS_STOCK: "washos_washers_stock",
  NOTIFICATIONS: "washos_notifications",
  SERVICES: "washos_services",
};

// Safe browser localStorage helper
function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("washos_data_change"));
  } catch (e) {
    console.error("Local storage write error:", e);
  }
}

/* Fast resilient helper: queries Supabase with a fast timeout and graceful fallback to local storage */
async function supabaseCall<T>(
  supabasePromise: Promise<{ data: T | null; error: any }>,
  localFallback: () => T,
  timeoutMs = 1200
): Promise<T> {
  try {
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), timeoutMs)
    );
    const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);
    if (error || data === null || data === undefined) {
      return localFallback();
    }
    if (Array.isArray(data) && data.length === 0) {
      const fallback = localFallback();
      if (Array.isArray(fallback) && fallback.length > 0) {
        return fallback;
      }
    }
    return data as T;
  } catch {
    return localFallback();
  }
}

/* ─────────────────────────────────────────────────────────────
   DATA STORE INTERFACE
   ───────────────────────────────────────────────────────────── */

export const DataStore = {
  // ── INVENTORY ──────────────────────────────────────────────
  async getInventory(): Promise<InventoryItem[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("inventory").select("*").order("product_name");
        return { data, error };
      })(),
      () => getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY)
    );
  },

  async createInventoryItem(item: Omit<InventoryItem, "id" | "status">): Promise<InventoryItem> {
    const totalMl = Number(item.total_ml);
    const minMl = Number(item.min_stock_ml);
    const status: "ok" | "low" | "critical" =
      totalMl <= minMl * 0.4 ? "critical" : totalMl <= minMl ? "low" : "ok";

    const newItem: InventoryItem = {
      id: "inv-" + Date.now(),
      ...item,
      total_ml: totalMl,
      min_stock_ml: minMl,
      status,
    };

    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("inventory").insert(newItem).select().single();
        return { data, error };
      })(),
      () => {
        const items = getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY);
        const updated = [newItem, ...items];
        setLocal(STORAGE_KEYS.INVENTORY, updated);
        return newItem;
      }
    );
  },

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<void> {
    await supabaseCall(
      (async () => {
        const supabase = createClient();
        const { error } = await supabase.from("inventory").update(updates).eq("id", id);
        return { data: null, error };
      })(),
      () => {
        const items = getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY);
        const updated = items.map((i) => {
          if (i.id !== id) return i;
          const totalMl = updates.total_ml !== undefined ? Number(updates.total_ml) : i.total_ml;
          const minMl = updates.min_stock_ml !== undefined ? Number(updates.min_stock_ml) : i.min_stock_ml;
          const status: "ok" | "low" | "critical" =
            totalMl <= minMl * 0.4 ? "critical" : totalMl <= minMl ? "low" : "ok";
          return { ...i, ...updates, total_ml: totalMl, min_stock_ml: minMl, status };
        });
        setLocal(STORAGE_KEYS.INVENTORY, updated);
        return undefined;
      }
    );
  },

  // ── SUPPLIERS ──────────────────────────────────────────────
  async getSuppliers(): Promise<Supplier[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("suppliers").select("*").order("name");
        return { data, error };
      })(),
      () => getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, SEED_SUPPLIERS)
    );
  },

  async createSupplier(sup: Omit<Supplier, "id">): Promise<Supplier> {
    const newSup: Supplier = { id: "sup-" + Date.now(), ...sup };
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("suppliers").insert(newSup).select().single();
        return { data, error };
      })(),
      () => {
        const current = getLocal<Supplier[]>(STORAGE_KEYS.SUPPLIERS, SEED_SUPPLIERS);
        const updated = [newSup, ...current];
        setLocal(STORAGE_KEYS.SUPPLIERS, updated);
        return newSup;
      }
    );
  },

  // ── PURCHASE ORDERS ────────────────────────────────────────
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("purchase_orders")
          .select("*")
          .order("ordered_at", { ascending: false });
        return { data, error };
      })(),
      () => getLocal<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, SEED_PO)
    );
  },

  async createPurchaseOrder(po: Omit<PurchaseOrder, "id" | "po_number" | "ordered_at" | "status" | "received_at">): Promise<PurchaseOrder> {
    const count = getLocal<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, SEED_PO).length;
    const poNumber = `PO-${1000 + count + 1}`;
    const newPO: PurchaseOrder = {
      id: "po-" + Date.now(),
      po_number: poNumber,
      ordered_at: new Date().toISOString(),
      received_at: null,
      status: "pending",
      ...po,
      total_cost: po.qty_ml * po.unit_cost,
    };

    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("purchase_orders").insert(newPO).select().single();
        return { data, error };
      })(),
      () => {
        const pos = getLocal<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, SEED_PO);
        setLocal(STORAGE_KEYS.PURCHASE_ORDERS, [newPO, ...pos]);
        return newPO;
      }
    );
  },

  async receivePurchaseOrder(id: string): Promise<void> {
    await supabaseCall(
      (async () => {
        const supabase = createClient();
        const pos = getLocal<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, SEED_PO);
        const target = pos.find((p) => p.id === id);
        if (!target) return { data: null, error: null };
        const now = new Date().toISOString();
        let error: { message: string } | null = null;
        try {
          await supabase.from("purchase_orders").update({ status: "received", received_at: now }).eq("id", id);
          if (target.inventory_id) {
            const { data: inv, error: invError } = await supabase
              .from("inventory")
              .select("total_ml")
              .eq("id", target.inventory_id)
              .single();
            if (invError) throw invError;
            if (inv) {
              await supabase
                .from("inventory")
                .update({ total_ml: (inv.total_ml || 0) + target.qty_ml })
                .eq("id", target.inventory_id);
            }
          }
        } catch (err) {
          error = err;
        }
        return { data: null, error };
      })(),
      () => {
        const pos = getLocal<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, SEED_PO);
        const updatedPOs = pos.map((p) =>
          p.id === id ? { ...p, status: "received" as const, received_at: new Date().toISOString() } : p
        );
        setLocal(STORAGE_KEYS.PURCHASE_ORDERS, updatedPOs);

        const inventory = getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY);
        const target = pos.find((p) => p.id === id);
        if (target) {
          const updatedInv = inventory.map((item) => {
            if (item.id === target.inventory_id || item.product_name === target.product_name) {
              const newTotal = item.total_ml + target.qty_ml;
              const status: "ok" | "low" | "critical" =
                newTotal <= item.min_stock_ml * 0.4
                  ? "critical"
                  : newTotal <= item.min_stock_ml
                  ? "low"
                  : "ok";
              return { ...item, total_ml: newTotal, status };
            }
            return item;
          });
          setLocal(STORAGE_KEYS.INVENTORY, updatedInv);
        }
        return undefined;
      }
    );
  },

  // ── CUSTOMERS ──────────────────────────────────────────────
  async getCustomers(): Promise<Customer[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("customers")
          .select("id, full_name, phone, notes, created_at, vehicles(count)")
          .order("created_at", { ascending: false });
        return { data, error };
      })(),
      () => getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, SEED_CUSTOMERS)
    );
  },

  async createCustomer(cust: { full_name: string; phone?: string; notes?: string }): Promise<Customer> {
    const newCust: Customer = {
      id: "c-" + Date.now(),
      full_name: cust.full_name,
      phone: cust.phone || null,
      notes: cust.notes || null,
      created_at: new Date().toISOString(),
      vehicle_count: 0,
      total_spent: 0,
      last_visit: null,
    };

    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("customers").insert(newCust).select().single();
        return { data, error };
      })(),
      () => {
        const customers = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, SEED_CUSTOMERS);
        setLocal(STORAGE_KEYS.CUSTOMERS, [newCust, ...customers]);
        return newCust;
      }
    );
  },

  async deleteCustomer(id: string): Promise<void> {
    await supabaseCall(
      (async () => {
        const supabase = createClient();
        const { error } = await supabase.from("customers").delete().eq("id", id);
        return { data: null, error };
      })(),
      () => {
        const customers = getLocal<Customer[]>(STORAGE_KEYS.CUSTOMERS, SEED_CUSTOMERS);
        setLocal(STORAGE_KEYS.CUSTOMERS, customers.filter((c) => c.id !== id));
        return undefined;
      }
    );
  },

  // ── WASH TRANSACTIONS ──────────────────────────────────────
  async getWashTransactions(from?: string, to?: string): Promise<WashTransaction[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        let q = supabase
          .from("wash_transactions")
          .select(
            "id, receipt_number, price, soap_used_ml, payment_method, payment_status, services, bay_number, started_at, completed_at, actual_minutes, vehicle_type_id, washer_id, profiles(full_name), vehicles(plate, customers(full_name))"
          )
          .order("started_at", { ascending: false });

        if (from) q = q.gte("started_at", `${from}T00:00:00`);
        if (to) q = q.lte("started_at", `${to}T23:59:59`);

        const { data, error } = await q;
        return { data, error };
      })(),
      () => {
        const localWashes = getLocal<WashTransaction[]>(STORAGE_KEYS.WASH_TRANSACTIONS, SEED_WASHES);
        if (!from && !to) return localWashes;
        return localWashes.filter((w) => {
          const day = w.started_at.slice(0, 10);
          if (from && day < from) return false;
          if (to && day > to) return false;
          return true;
        });
      }
    );
  },

  async createWashTransaction(tx: Omit<WashTransaction, "id" | "receipt_number" | "started_at">): Promise<WashTransaction> {
    const currentWashes = getLocal<WashTransaction[]>(STORAGE_KEYS.WASH_TRANSACTIONS, SEED_WASHES);
    const receiptNumber = `REC-${10000 + currentWashes.length + 1}`;
    const newTx: WashTransaction = {
      ...tx,
      id: "tx-" + Date.now(),
      receipt_number: receiptNumber,
      started_at: new Date().toISOString(),
      completed_at: tx.completed_at || (tx.status === "completed" ? new Date().toISOString() : null),
    };

    return supabaseCall(
      (async () => {
        const supabase = createClient();
        // ensure vehicle exists
        let vehicleId = tx.vehicle_id;
        if (!vehicleId && tx.plate) {
          const { data: v } = await supabase
            .from("vehicles")
            .upsert({ plate: tx.plate, vehicle_type_id: tx.vehicle_type_id }, { onConflict: "plate" })
            .select("id")
            .single();
          if (v) vehicleId = v.id;
        }
        await supabase.from("wash_transactions").insert({
          receipt_number: receiptNumber,
          vehicle_id: vehicleId,
          vehicle_type_id: tx.vehicle_type_id,
          washer_id: tx.washer_id,
          price: tx.price,
          soap_used_ml: tx.soap_used_ml,
          payment_method: tx.payment_method || "cash",
          payment_status: tx.payment_status || "paid",
          services: tx.services || [],
          bay_number: tx.bay_number || 1,
          status: tx.status || "completed",
          completed_at: newTx.completed_at,
        });
        return { data: newTx, error: null };
      })(),
      () => {
        // Deduct washer local soap balance
        const washerStocks = getLocal<Record<string, number>>(STORAGE_KEYS.WASHERS_STOCK, {
          "w-1": 750,
          "w-2": 540,
          "w-3": 180,
          "w-4": 620,
        });
        washerStocks[tx.washer_id] = Math.max(0, (washerStocks[tx.washer_id] ?? 500) - tx.soap_used_ml);
        setLocal(STORAGE_KEYS.WASHERS_STOCK, washerStocks);

        setLocal(STORAGE_KEYS.WASH_TRANSACTIONS, [newTx, ...currentWashes]);
        return newTx;
      }
    );
  },

  async updateWashStatus(id: string, status: WashTransaction["status"]): Promise<void> {
    await supabaseCall(
      (async () => {
        const supabase = createClient();
        const { error } = await supabase.from("wash_transactions").update({ status }).eq("id", id);
        return { data: null, error };
      })(),
      () => {
        const washes = getLocal<WashTransaction[]>(STORAGE_KEYS.WASH_TRANSACTIONS, SEED_WASHES);
        const updated = washes.map((w) => {
          if (w.id !== id) return w;
          return {
            ...w,
            status,
            completed_at: status === "completed" ? (w.completed_at || new Date().toISOString()) : w.completed_at,
          };
        });
        setLocal(STORAGE_KEYS.WASH_TRANSACTIONS, updated);
        return undefined;
      }
    );
  },

  // ── SOAP REQUESTS ──────────────────────────────────────────
  async getSoapRequests(): Promise<SoapRequest[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("soap_requests")
          .select(
            "id, request_number, quantity_requested, quantity_approved, status, notes, created_at, washer_id, inventory_id, profiles(full_name), inventory(product_name)"
          )
          .order("created_at", { ascending: false });
        return { data, error };
      })(),
      () => getLocal<SoapRequest[]>(STORAGE_KEYS.SOAP_REQUESTS, SEED_REQUESTS)
    );
  },

  async createSoapRequest(req: {
    washer_id: string;
    washer_name: string;
    inventory_id: string;
    product_name: string;
    quantity_requested: number;
    notes?: string;
  }): Promise<SoapRequest> {
    const current = getLocal<SoapRequest[]>(STORAGE_KEYS.SOAP_REQUESTS, SEED_REQUESTS);
    const newReq: SoapRequest = {
      id: "rq-" + Date.now(),
      request_number: `RQ-${1040 + current.length + 1}`,
      status: "pending",
      quantity_approved: null,
      created_at: new Date().toISOString(),
      ...req,
    };

    return supabaseCall(
      (async () => {
        const supabase = createClient();
        await supabase.from("soap_requests").insert({
          request_number: newReq.request_number,
          washer_id: req.washer_id,
          inventory_id: req.inventory_id,
          quantity_requested: req.quantity_requested,
          notes: req.notes,
        });
        return { data: newReq, error: null };
      })(),
      () => {
        setLocal(STORAGE_KEYS.SOAP_REQUESTS, [newReq, ...current]);
        return newReq;
      }
    );
  },

  async decideSoapRequest(
    id: string,
    status: "approved" | "rejected",
    approvedQty?: number
  ): Promise<void> {
    await supabaseCall(
      (async () => {
        const supabase = createClient();
        const current = getLocal<SoapRequest[]>(STORAGE_KEYS.SOAP_REQUESTS, SEED_REQUESTS);
        const target = current.find((r) => r.id === id);
        if (!target) return { data: null, error: null };
        const qty = status === "approved" ? (approvedQty ?? target.quantity_requested) : null;
        const updatedReqs = current.map((r) =>
          r.id === id ? { ...r, status, quantity_approved: qty, decided_at: new Date().toISOString() } : r
        );
        setLocal(STORAGE_KEYS.SOAP_REQUESTS, updatedReqs);

        if (status === "approved" && qty) {
          // 1. Deduct from main store inventory
          const inv = getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY);
          const updatedInv = inv.map((item) => {
            if (item.id === target.inventory_id || item.product_name === target.product_name) {
              const newTotal = Math.max(0, item.total_ml - qty);
              const st: "ok" | "low" | "critical" =
                newTotal <= item.min_stock_ml * 0.4 ? "critical" : newTotal <= item.min_stock_ml ? "low" : "ok";
              return { ...item, total_ml: newTotal, status: st };
            }
            return item;
          });
          setLocal(STORAGE_KEYS.INVENTORY, updatedInv);

          // 2. Add to washer's stock
          const washerStocks = getLocal<Record<string, number>>(STORAGE_KEYS.WASHERS_STOCK, {
            "w-1": 750,
            "w-2": 540,
            "w-3": 180,
            "w-4": 620,
          });
          washerStocks[target.washer_id] =
            (washerStocks[target.washer_id] ?? 0) + qty;
          setLocal(STORAGE_KEYS.WASHERS_STOCK, washerStocks);
        }

        await supabase
          .from("soap_requests")
          .update({ status, quantity_approved: qty, decided_at: new Date().toISOString() })
          .eq("id", id);
        return { data: null, error: null };
      })(),
      () => {
        // fallback already handled inside supabaseCall; but we need to also perform local updates.
        // For simplicity, we will reuse same logic as try block but using local only.
        const current = getLocal<SoapRequest[]>(STORAGE_KEYS.SOAP_REQUESTS, SEED_REQUESTS);
        const target = current.find((r) => r.id === id);
        if (!target) return undefined;
        const qty = status === "approved" ? (approvedQty ?? target.quantity_requested) : null;
        const updatedReqs = current.map((r) =>
          r.id === id ? { ...r, status, quantity_approved: qty, decided_at: new Date().toISOString() } : r
        );
        setLocal(STORAGE_KEYS.SOAP_REQUESTS, updatedReqs);

        if (status === "approved" && qty) {
          const inv = getLocal<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY);
          const updatedInv = inv.map((item) => {
            if (item.id === target.inventory_id || item.product_name === target.product_name) {
              const newTotal = Math.max(0, item.total_ml - qty);
              const st: "ok" | "low" | "critical" =
                newTotal <= item.min_stock_ml * 0.4 ? "critical" : newTotal <= item.min_stock_ml ? "low" : "ok";
              return { ...item, total_ml: newTotal, status: st };
            }
            return item;
          });
          setLocal(STORAGE_KEYS.INVENTORY, updatedInv);

          const washerStocks = getLocal<Record<string, number>>(STORAGE_KEYS.WASHERS_STOCK, {
            "w-1": 750,
            "w-2": 540,
            "w-3": 180,
            "w-4": 620,
          });
          washerStocks[target.washer_id] =
            (washerStocks[target.washer_id] ?? 0) + qty;
          setLocal(STORAGE_KEYS.WASHERS_STOCK, washerStocks);
        }
        return undefined;
      }
    );
  },

  // ── EXPENSES ───────────────────────────────────────────────
  async getExpenses(): Promise<Expense[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("expenses").select("*").order("incurred_on", { ascending: false });
        return { data, error };
      })(),
      () => getLocal<Expense[]>(STORAGE_KEYS.EXPENSES, SEED_EXPENSES)
    );
  },

  async createExpense(exp: Omit<Expense, "id" | "created_at">): Promise<Expense> {
    const newExp: Expense = {
      id: "exp-" + Date.now(),
      created_at: new Date().toISOString(),
      ...exp,
    };

    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("expenses").insert(newExp).select().single();
        return { data, error };
      })(),
      () => {
        const list = getLocal<Expense[]>(STORAGE_KEYS.EXPENSES, SEED_EXPENSES);
        setLocal(STORAGE_KEYS.EXPENSES, [newExp, ...list]);
        return newExp;
      }
    );
  },

  async deleteExpense(id: string): Promise<void> {
    await supabaseCall(
      (async () => {
        const supabase = createClient();
        const { error } = await supabase.from("expenses").delete().eq("id", id);
        return { data: null, error };
      })(),
      () => {
        const list = getLocal<Expense[]>(STORAGE_KEYS.EXPENSES, SEED_EXPENSES);
        setLocal(STORAGE_KEYS.EXPENSES, list.filter((e) => e.id !== id));
        return undefined;
      }
    );
  },

  // ── WASHER & STAFF STATS ───────────────────────────────────
  async getWashersStock(): Promise<
    { id: string; name: string; soap: number; carsToday: number; revenueToday: number; phone?: string }[]
  > {
    // This method already uses local washerStocks; we still need to fetch from Supabase for washes etc.
    // We'll call supabase for washes, expenses etc., but fallback to local if supabase not configured.
    return supabaseCall(
      (async () => {
        const washes = await DataStore.getWashTransactions();
        const today = new Date().toISOString().slice(0, 10);
        const todayWashes = washes.filter((w) => w.started_at.startsWith(today) && w.status === "completed");
        const washerStocks = getLocal<Record<string, number>>(STORAGE_KEYS.WASHERS_STOCK, {
          "w-1": 750,
          "w-2": 540,
          "w-3": 180,
          "w-4": 620,
        });

        return SEED_WASHERS.map((w) => {
          const myToday = todayWashes.filter(
            (tw) => tw.washer_id === w.id || tw.washer_name === w.name
          );
          return {
            id: w.id,
            name: w.name,
            soap: washerStocks[w.id] ?? w.soap,
            carsToday: myToday.length || w.carsToday,
            revenueToday: myToday.reduce((s, tw) => s + tw.price, 0) || w.revenueToday,
            phone: w.phone,
          };
        });
      })(),
      () => {
        // fallback to seed data
        return SEED_WASHERS.map((w) => ({
          id: w.id,
          name: w.name,
          soap: w.soap,
          carsToday: w.carsToday,
          revenueToday: w.revenueToday,
          phone: w.phone,
        }));
      }
    );
  },

  async getStaff(): Promise<Profile[]> {
    return supabaseCall(
      (async () => {
        const supabase = createClient();
        const { data, error } = await supabase.from("profiles").select("*").order("full_name");
        return { data, error };
      })(),
      () => getLocal<Profile[]>(STORAGE_KEYS.STAFF, SEED_STAFF)
    );
  },

  // ── SERVICES & CATALOG ─────────────────────────────────────
  getServices(): WashService[] {
    return WASH_SERVICES;
  },

  getVehicleTypes() {
    return VEHICLE_TYPES;
  },
};