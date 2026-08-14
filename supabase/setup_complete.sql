-- ============================================================================
-- WashOS Car Wash ERP — Master Database Setup & Seed
-- Idempotent script: Safe to execute multiple times in Supabase SQL Editor.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 1. Custom Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('administrator', 'manager', 'store_keeper', 'washer');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type request_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'wash_status') then
    create type wash_status as enum ('queued', 'in_progress', 'completed', 'cancelled');
  end if;
end $$;

-- 2. Profiles Table
create table if not exists profiles (
  id uuid primary key,
  full_name text not null,
  phone text,
  role text not null default 'washer',
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Vehicle Types
create table if not exists vehicle_types (
  id text primary key,
  name text not null,
  examples text,
  standard_minutes int not null,
  workers_required int not null default 2,
  default_soap_ml numeric not null,
  detergent_cost_etb numeric not null default 0,
  default_price numeric not null,
  notes text
);

insert into vehicle_types (id, name, examples, standard_minutes, workers_required, default_soap_ml, detergent_cost_etb, default_price)
values
  ('small', 'Light Vehicle', 'Automobile, Minibus, Pickup', 45, 2, 180, 33.84, 350),
  ('medium', 'Medium Vehicle', 'Sino Truck, Isuzu, Mid Bus', 120, 2, 250, 47.00, 900),
  ('large', 'Heavy Vehicle', 'Trailer', 180, 2, 500, 94.00, 1800)
on conflict (id) do update
  set name = excluded.name,
      examples = excluded.examples,
      standard_minutes = excluded.standard_minutes,
      workers_required = excluded.workers_required,
      default_soap_ml = excluded.default_soap_ml,
      detergent_cost_etb = excluded.detergent_cost_etb,
      default_price = excluded.default_price;

-- 4. Wash Services
create table if not exists wash_services (
  id text primary key,
  name text not null,
  category text not null default 'standard',
  description text,
  price_small numeric not null default 0,
  price_medium numeric not null default 0,
  price_large numeric not null default 0,
  extra_soap_ml numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into wash_services (id, name, category, description, price_small, price_medium, price_large, extra_soap_ml)
values
  ('exterior', 'Standard Exterior Wash', 'standard', 'High-pressure foam wash, wheel clean, hand dry', 350, 900, 1800, 0),
  ('full_wash', 'Full Wash (Body + Engine + Underbody)', 'standard', 'Full body shampoo, undercarriage degrease, engine bay wash', 550, 1400, 2600, 80),
  ('engine_steam', 'Engine Steam Clean', 'addon', 'High-temp degreasing and electronic component care', 250, 450, 700, 50),
  ('interior_detail', 'Interior Deep Clean & Vacuum', 'addon', 'Seat extraction, dashboard UV protectant, carpet shampoo', 300, 600, 900, 40),
  ('wax_polish', 'Hand Wax & Paint Sealant', 'addon', 'Carnauba wax coating for gloss finish and water repellency', 350, 700, 1100, 30),
  ('tire_shine', 'Tire & Trim Dressing', 'addon', 'Silicone-free deep black tire shine and UV protection', 100, 200, 300, 20)
on conflict (id) do nothing;

-- 5. Customers & Vehicles
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  customer_id uuid references customers(id) on delete set null,
  vehicle_type_id text not null references vehicle_types(id),
  created_at timestamptz not null default now()
);

-- 6. Suppliers & Inventory
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  email text,
  products text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text not null default 'Soap',
  total_ml numeric not null default 0,
  min_stock_ml numeric not null default 5000,
  supplier text,
  supplier_id uuid references suppliers(id) on delete set null,
  batch_number text,
  purchase_date date,
  expiry_date date,
  unit_cost numeric not null default 0.188,
  cost numeric not null default 0,
  updated_at timestamptz not null default now()
);

create sequence if not exists po_seq start 1001;

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique default ('PO-' || to_char(nextval('po_seq'), 'FM0000')),
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text not null,
  inventory_id uuid references inventory(id) on delete set null,
  product_name text not null,
  qty_ml numeric not null,
  unit_cost numeric not null default 0,
  total_cost numeric generated always as (qty_ml * unit_cost) stored,
  status text not null default 'pending',
  ordered_at timestamptz not null default now(),
  received_at timestamptz,
  notes text,
  created_by uuid
);

-- 7. Washer Inventory & Soap Requests
create table if not exists washer_inventory (
  id uuid primary key default gen_random_uuid(),
  washer_id text not null,
  inventory_id uuid references inventory(id) on delete cascade,
  balance_ml numeric not null default 0,
  capacity_ml numeric not null default 800,
  updated_at timestamptz not null default now()
);

create table if not exists soap_requests (
  id uuid primary key default gen_random_uuid(),
  washer_id text not null,
  washer_name text not null,
  inventory_id uuid references inventory(id) on delete cascade,
  product_name text not null,
  amount_ml numeric not null default 500,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  reason text
);

-- 8. Wash Transactions & Expenses
create table if not exists wash_transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text,
  vehicle_id uuid references vehicles(id) on delete set null,
  plate text,
  customer_name text,
  vehicle_type_id text not null references vehicle_types(id),
  washer_id text not null,
  washer_name text,
  price numeric not null,
  soap_used_ml numeric not null,
  payment_method text not null default 'cash',
  payment_status text not null default 'paid',
  services jsonb default '[]'::jsonb,
  bay_number int default 1,
  status text not null default 'completed',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  actual_minutes int
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric not null,
  description text not null,
  incurred_on date not null default current_date,
  receipt_url text,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  message text not null,
  type text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- 9. Enable Row Level Security & Open Policies
alter table profiles enable row level security;
alter table vehicle_types enable row level security;
alter table wash_services enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table suppliers enable row level security;
alter table inventory enable row level security;
alter table purchase_orders enable row level security;
alter table washer_inventory enable row level security;
alter table soap_requests enable row level security;
alter table wash_transactions enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- Open policies for seamless frontend CRUD
drop policy if exists "allow_all_profiles" on profiles;
create policy "allow_all_profiles" on profiles for all using (true) with check (true);

drop policy if exists "allow_all_vehicle_types" on vehicle_types;
create policy "allow_all_vehicle_types" on vehicle_types for all using (true) with check (true);

drop policy if exists "allow_all_wash_services" on wash_services;
create policy "allow_all_wash_services" on wash_services for all using (true) with check (true);

drop policy if exists "allow_all_customers" on customers;
create policy "allow_all_customers" on customers for all using (true) with check (true);

drop policy if exists "allow_all_vehicles" on vehicles;
create policy "allow_all_vehicles" on vehicles for all using (true) with check (true);

drop policy if exists "allow_all_suppliers" on suppliers;
create policy "allow_all_suppliers" on suppliers for all using (true) with check (true);

drop policy if exists "allow_all_inventory" on inventory;
create policy "allow_all_inventory" on inventory for all using (true) with check (true);

drop policy if exists "allow_all_pos" on purchase_orders;
create policy "allow_all_pos" on purchase_orders for all using (true) with check (true);

drop policy if exists "allow_all_washer_inv" on washer_inventory;
create policy "allow_all_washer_inv" on washer_inventory for all using (true) with check (true);

drop policy if exists "allow_all_soap_requests" on soap_requests;
create policy "allow_all_soap_requests" on soap_requests for all using (true) with check (true);

drop policy if exists "allow_all_washes" on wash_transactions;
create policy "allow_all_washes" on wash_transactions for all using (true) with check (true);

drop policy if exists "allow_all_expenses" on expenses;
create policy "allow_all_expenses" on expenses for all using (true) with check (true);

drop policy if exists "allow_all_notifs" on notifications;
create policy "allow_all_notifs" on notifications for all using (true) with check (true);

drop policy if exists "allow_all_audit" on audit_logs;
create policy "allow_all_audit" on audit_logs for all using (true) with check (true);

-- 10. Enable Supabase Realtime Publication
do $$
begin
  alter publication supabase_realtime add table wash_transactions, soap_requests, inventory, washer_inventory, purchase_orders, notifications;
exception
  when others then null;
end $$;

-- 11. Initial Realistic Seed Data
insert into suppliers (id, name, contact, email, products, address)
values
  ('a1111111-1111-1111-1111-111111111111', 'Chemtech PLC', '+251 11 234 5678', 'sales@chemtech.et', 'LARGO Foam Shampoo, Glass Cleaner, Engine Degreaser', 'Bole Sub-city, Woreda 03, Addis Ababa'),
  ('a2222222-2222-2222-2222-222222222222', 'AutoCare Import & Dist.', '+251 11 345 6789', 'info@autocare.et', 'Tire Shine Gel, Carnauba Wax, Microfiber Towels', 'Nifas Silk Lafto, Addis Ababa'),
  ('a3333333-3333-3333-3333-333333333333', 'Habesha Chemical Industries', '+251 11 456 7890', 'contact@habeshachem.com', 'Heavy Duty Degreaser, Acid Wash, Upholstery Cleaner', 'Kaliti Industrial Zone, Addis Ababa')
on conflict (id) do nothing;

insert into inventory (id, product_name, category, total_ml, min_stock_ml, supplier, supplier_id, batch_number, purchase_date, expiry_date, unit_cost, cost)
values
  ('b1111111-1111-1111-1111-111111111111', 'LARGO Foam Detergent Concentrate', 'Soap', 38500, 10000, 'Chemtech PLC', 'a1111111-1111-1111-1111-111111111111', 'BATCH-2026-04', '2026-04-10', '2027-04-10', 0.188, 9400),
  ('b2222222-2222-2222-2222-222222222222', 'Tire Shine Silicone Gel', 'Finishing', 12400, 6000, 'AutoCare Import & Dist.', 'a2222222-2222-2222-2222-222222222222', 'BATCH-2026-03', '2026-03-15', '2027-09-15', 0.320, 4800),
  ('b3333333-3333-3333-3333-333333333333', 'Crystal Clear Glass Cleaner', 'Interior', 14800, 5000, 'Chemtech PLC', 'a1111111-1111-1111-1111-111111111111', 'BATCH-2026-05', '2026-05-02', '2027-11-02', 0.150, 3000),
  ('b4444444-4444-4444-4444-444444444444', 'Heavy Duty Engine Degreaser', 'Soap', 3200, 8000, 'Habesha Chemical Industries', 'a3333333-3333-3333-3333-333333333333', 'BATCH-2026-01', '2026-01-20', '2026-10-20', 0.220, 3300),
  ('b5555555-5555-5555-5555-555555555555', 'Carnauba Liquid Gloss Wax', 'Finishing', 8500, 4000, 'AutoCare Import & Dist.', 'a2222222-2222-2222-2222-222222222222', 'BATCH-2026-04', '2026-04-18', '2027-08-18', 0.450, 4500)
on conflict (id) do nothing;

insert into purchase_orders (id, po_number, supplier_id, supplier_name, inventory_id, product_name, qty_ml, unit_cost, status, ordered_at, received_at, notes)
values
  ('c1111111-1111-1111-1111-111111111111', 'PO-1001', 'a1111111-1111-1111-1111-111111111111', 'Chemtech PLC', 'b1111111-1111-1111-1111-111111111111', 'LARGO Foam Detergent Concentrate', 50000, 0.188, 'received', now() - interval '14 days', now() - interval '11 days', '50L bulk barrel delivery'),
  ('c2222222-2222-2222-2222-222222222222', 'PO-1002', 'a2222222-2222-2222-2222-222222222222', 'AutoCare Import & Dist.', 'b2222222-2222-2222-2222-222222222222', 'Tire Shine Silicone Gel', 15000, 0.320, 'received', now() - interval '7 days', now() - interval '4 days', 'Restocked for weekend rush')
on conflict (id) do nothing;

insert into customers (id, full_name, phone, notes)
values
  ('d1111111-1111-1111-1111-111111111111', 'Alemayehu Tadesse', '+251 91 123 4567', 'VIP Customer · Prefers full wash + engine steam'),
  ('d2222222-2222-2222-2222-222222222222', 'Bethlehem Haile', '+251 92 234 5678', 'Weekly regular (Tucson)'),
  ('d3333333-3333-3333-3333-333333333333', 'Kassahun Worku', '+251 93 345 6789', 'Sino Truck fleet owner · Monthly account')
on conflict (id) do nothing;

insert into expenses (id, category, amount, description, incurred_on)
values
  ('f1111111-1111-1111-1111-111111111111', 'utilities', 4200, 'Water utility bill for wash bays (Month 1)', current_date - interval '10 days'),
  ('f2222222-2222-2222-2222-222222222222', 'maintenance', 3500, 'High-pressure washer pump hose & nozzle replacement', current_date - interval '6 days'),
  ('f3333333-3333-3333-3333-333333333333', 'inventory_cost', 9400, 'LARGO 50L bulk purchase PO-1001 payment', current_date - interval '11 days')
on conflict (id) do nothing;
