export type UserRole = "administrator" | "manager" | "store_keeper" | "washer";

export type VehicleType = {
  id: "small" | "medium" | "large";
  name: string;
  examples: string;
  standard_minutes: number;
  workers_required: number;
  default_soap_ml: number;
  detergent_cost_etb: number;
  default_price: number;
};

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  active: boolean;
};

export type InventoryItem = {
  id: string;
  product_name: string;
  category: string;
  total_ml: number;
  min_stock_ml: number;
  supplier: string | null;
  expiry_date: string | null;
  status: "ok" | "low" | "critical";
};

export type SoapRequest = {
  id: string;
  request_number: string;
  washer_id: string;
  inventory_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  status: "pending" | "approved" | "rejected" | "partial";
  created_at: string;
};

export type WashTransaction = {
  id: string;
  vehicle_id: string;
  vehicle_type_id: "small" | "medium" | "large";
  washer_id: string;
  price: number;
  soap_used_ml: number;
  status: "in_progress" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
};
