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
  color?: string;
};

export type WashService = {
  id: string;
  name: string;
  category: "standard" | "addon" | "detailing";
  description: string;
  price_small: number;
  price_medium: number;
  price_large: number;
  extra_soap_ml: number;
  active: boolean;
};

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  active: boolean;
  photo_url?: string | null;
  created_at?: string;
};

export type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  vehicle_count?: number;
  total_spent?: number;
  last_visit?: string | null;
};

export type Vehicle = {
  id: string;
  plate: string;
  customer_id: string | null;
  vehicle_type_id: "small" | "medium" | "large";
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  email: string | null;
  products: string;
  address: string | null;
  active: boolean;
  created_at?: string;
};

export type InventoryItem = {
  id: string;
  product_name: string;
  category: string;
  total_ml: number;
  min_stock_ml: number;
  supplier: string | null;
  supplier_id?: string | null;
  batch_number?: string | null;
  expiry_date: string | null;
  unit_cost?: number;
  cost?: number;
  status: "ok" | "low" | "critical";
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  supplier_name: string;
  inventory_id: string | null;
  product_name: string;
  qty_ml: number;
  unit_cost: number;
  total_cost?: number;
  status: "pending" | "received" | "cancelled";
  ordered_at: string;
  received_at: string | null;
  notes?: string | null;
};

export type SoapRequest = {
  id: string;
  request_number: string;
  washer_id: string;
  washer_name?: string;
  inventory_id: string;
  product_name?: string;
  quantity_requested: number;
  quantity_approved: number | null;
  status: "pending" | "approved" | "rejected" | "partial";
  notes?: string | null;
  created_at: string;
  decided_at?: string | null;
};

export type PaymentMethod = "cash" | "telebirr" | "cbe_birr" | "card" | "account";

export type WashTransaction = {
  id: string;
  receipt_number?: string;
  vehicle_id?: string;
  plate?: string;
  vehicle_type_id: "small" | "medium" | "large";
  washer_id: string;
  washer_name?: string;
  customer_name?: string;
  price: number;
  soap_used_ml: number;
  payment_method: PaymentMethod;
  payment_status: "paid" | "unpaid";
  services?: string[];
  bay_number?: number;
  status: "queued" | "in_progress" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  actual_minutes?: number | null;
  remarks?: string | null;
};

export type Expense = {
  id: string;
  category: "payroll" | "maintenance" | "utilities" | "inventory_cost" | "rent" | "other";
  amount: number;
  description: string | null;
  incurred_on: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id?: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
};

export type ReceiptData = {
  receiptNumber: string;
  date: string;
  time: string;
  plate: string;
  vehicleType: string;
  customerName?: string;
  washerName: string;
  services: string[];
  price: number;
  paymentMethod: PaymentMethod;
  bayNumber?: number;
};
