// Fallback data shown until Supabase env vars are configured / tables are seeded.
// Standards per "Vehicle Car Wash Service — Detergent Consumption Standard" (May 2026):
// detergent = LARGO, 5L = ETB 940 (ETB 188/L). Manpower: 2 persons/wash across categories.
export const VEHICLE_TYPES = [
  { id: "small", name: "Light Vehicle", examples: "Automobile, Minibus, Pickup", standard_minutes: 45, workers_required: 2, default_soap_ml: 180, detergent_cost_etb: 33.84, default_price: 350, color: "#2FD5C8" },
  { id: "medium", name: "Medium Vehicle", examples: "Sino Truck, Isuzu, Mid Bus", standard_minutes: 120, workers_required: 2, default_soap_ml: 250, detergent_cost_etb: 47.0, default_price: 900, color: "#F2A93B" },
  { id: "large", name: "Heavy Vehicle", examples: "Trailer", standard_minutes: 180, workers_required: 2, default_soap_ml: 500, detergent_cost_etb: 94.0, default_price: 1800, color: "#8B7CF6" },
] as const;

export const WASHERS = [
  { id: "1", name: "Yonas Bekele", soap: 590, carsToday: 6, revenueToday: 2100, avgEff: 96 },
  { id: "2", name: "Selam Girma", soap: 340, carsToday: 4, revenueToday: 1400, avgEff: 91 },
  { id: "3", name: "Dawit Alemu", soap: 80, carsToday: 3, revenueToday: 2700, avgEff: 88 },
  { id: "4", name: "Hana Tesfaye", soap: 210, carsToday: 5, revenueToday: 1750, avgEff: 99 },
];

export const INVENTORY = [
  { id: "1", product_name: "LARGO Detergent", category: "Soap", total_ml: 18000, min_stock_ml: 5000, supplier: "Chemtech PLC", expiry_date: "2026-11-02", status: "ok" as const },
  { id: "2", product_name: "Tire Shine Gel", category: "Finishing", total_ml: 6200, min_stock_ml: 4000, supplier: "AutoCare Import", expiry_date: "2027-02-14", status: "low" as const },
  { id: "3", product_name: "Glass Cleaner", category: "Interior", total_ml: 9400, min_stock_ml: 3000, supplier: "Chemtech PLC", expiry_date: "2026-09-30", status: "ok" as const },
  { id: "4", product_name: "Degreaser Heavy Duty", category: "Soap", total_ml: 2100, min_stock_ml: 5000, supplier: "Habesha Chem", expiry_date: "2026-08-10", status: "critical" as const },
];

export const REQUESTS = [
  { id: "RQ-1042", request_number: "RQ-1042", washer: "Dawit Alemu", product: "Foam Shampoo Concentrate", qty: 500, status: "pending" as const },
  { id: "RQ-1041", request_number: "RQ-1041", washer: "Selam Girma", product: "Degreaser Heavy Duty", qty: 300, status: "pending" as const },
  { id: "RQ-1040", request_number: "RQ-1040", washer: "Yonas Bekele", product: "Foam Shampoo Concentrate", qty: 600, status: "approved" as const },
  { id: "RQ-1039", request_number: "RQ-1039", washer: "Hana Tesfaye", product: "Glass Cleaner", qty: 400, status: "rejected" as const },
];

export const STAFF: { id: string; name: string; role: string; phone: string; active: boolean; joined: string }[] = [
  { id: "1", name: "Yonas Bekele", role: "washer", phone: "+251 91 234 5678", active: true, joined: "2023-03-12" },
  { id: "2", name: "Selam Girma", role: "washer", phone: "+251 92 345 6789", active: true, joined: "2023-06-01" },
  { id: "3", name: "Dawit Alemu", role: "washer", phone: "+251 93 456 7890", active: true, joined: "2024-01-15" },
  { id: "4", name: "Hana Tesfaye", role: "washer", phone: "+251 94 567 8901", active: true, joined: "2024-02-20" },
  { id: "5", name: "Ezra Mulugeta", role: "manager", phone: "+251 91 111 2222", active: true, joined: "2022-11-01" },
  { id: "6", name: "Liya Hailu", role: "store_keeper", phone: "+251 92 222 3333", active: false, joined: "2023-08-10" },
];

export const PURCHASE_ORDERS: { id: string; po_number: string; supplier: string; product: string; qty_ml: number; unit_cost: number; status: "pending" | "received" | "cancelled"; ordered_at: string; received_at: string | null }[] = [
  { id: "1", po_number: "PO-0041", supplier: "Chemtech PLC", product: "Foam Shampoo Concentrate", qty_ml: 20000, unit_cost: 0.18, status: "received", ordered_at: "2025-06-01", received_at: "2025-06-04" },
  { id: "2", po_number: "PO-0042", supplier: "AutoCare Import", product: "Tire Shine Gel", qty_ml: 8000, unit_cost: 0.32, status: "received", ordered_at: "2025-06-10", received_at: "2025-06-13" },
  { id: "3", po_number: "PO-0043", supplier: "Habesha Chem", product: "Degreaser Heavy Duty", qty_ml: 10000, unit_cost: 0.22, status: "pending", ordered_at: "2025-07-01", received_at: null },
  { id: "4", po_number: "PO-0044", supplier: "Chemtech PLC", product: "Glass Cleaner", qty_ml: 12000, unit_cost: 0.15, status: "pending", ordered_at: "2025-07-03", received_at: null },
];

export const SUPPLIERS = [
  { id: "1", name: "Chemtech PLC", contact: "+251 11 234 5678", products: "Foam Shampoo, Glass Cleaner" },
  { id: "2", name: "AutoCare Import", contact: "+251 11 345 6789", products: "Tire Shine Gel, Wax" },
  { id: "3", name: "Habesha Chem", contact: "+251 11 456 7890", products: "Degreaser, Acid Wash" },
];

export const WASH_HISTORY: { id: string; plate: string; vehicle_type: string; washer: string; price: number; soap_ml: number; completed_at: string }[] = [
  { id: "1", plate: "AA-A-12345", vehicle_type: "Light Vehicle", washer: "Yonas Bekele", price: 350, soap_ml: 180, completed_at: "2025-07-04T08:12:00" },
  { id: "2", plate: "AA-B-67890", vehicle_type: "Medium Vehicle", washer: "Yonas Bekele", price: 900, soap_ml: 250, completed_at: "2025-07-04T09:45:00" },
  { id: "3", plate: "AA-C-11111", vehicle_type: "Light Vehicle", washer: "Selam Girma", price: 350, soap_ml: 180, completed_at: "2025-07-04T10:20:00" },
  { id: "4", plate: "AA-D-22222", vehicle_type: "Heavy Vehicle", washer: "Yonas Bekele", price: 1800, soap_ml: 500, completed_at: "2025-07-04T11:00:00" },
  { id: "5", plate: "AA-E-33333", vehicle_type: "Light Vehicle", washer: "Hana Tesfaye", price: 350, soap_ml: 180, completed_at: "2025-07-04T11:30:00" },
  { id: "6", plate: "AA-F-44444", vehicle_type: "Medium Vehicle", washer: "Dawit Alemu", price: 900, soap_ml: 250, completed_at: "2025-07-04T12:10:00" },
];

export const REVENUE_TREND = [
  { day: "Mon", revenue: 14200, expenses: 5200 },
  { day: "Tue", revenue: 16800, expenses: 5600 },
  { day: "Wed", revenue: 15200, expenses: 5100 },
  { day: "Thu", revenue: 19800, expenses: 6100 },
  { day: "Fri", revenue: 22400, expenses: 6400 },
  { day: "Sat", revenue: 28900, expenses: 7200 },
  { day: "Sun", revenue: 24100, expenses: 6800 },
];
