-- WashOS Car Wash ERP — Core Schema
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------- Roles ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('administrator', 'manager', 'store_keeper', 'washer');
  end if;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'washer',
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Vehicle types & washing standards ----------
-- Standards sourced from "Vehicle Car Wash Service — Detergent Consumption Standard"
-- Approved detergent: LARGO, 5L = ETB 940 (ETB 188/L).
create table if not exists vehicle_types (
  id text primary key,              -- 'small' | 'medium' | 'large'
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

-- ---------- Wash Services & Add-ons ----------
create table if not exists wash_services (
  id text primary key,
  name text not null,
  category text not null default 'standard', -- standard | addon | detailing
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
  ('wax_polish', 'Hand Wax & Paint Sealant', 'addon', 'Carnuba wax coating for gloss finish and water repellency', 350, 700, 1100, 30),
  ('tire_shine', 'Tire & Trim Dressing', 'addon', 'Silicone-free deep black tire shine and UV protection', 100, 200, 300, 20)
on conflict (id) do nothing;

-- ---------- Customers & Vehicles ----------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  customer_id uuid references customers(id) on delete set null,
  vehicle_type_id text not null references vehicle_types(id),
  created_at timestamptz not null default now()
);

-- ---------- Suppliers ----------
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

-- ---------- Store Inventory ----------
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text not null,
  total_ml numeric not null default 0,      -- current remaining stock, in ml
  min_stock_ml numeric not null default 0,
  supplier text,
  supplier_id uuid references suppliers(id) on delete set null,
  batch_number text,
  purchase_date date,
  expiry_date date,
  unit_cost numeric,
  cost numeric,
  status text generated always as (
    case
      when total_ml <= min_stock_ml * 0.4 then 'critical'
      when total_ml <= min_stock_ml then 'low'
      else 'ok'
    end
  ) stored,
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory(id) on delete cascade,
  change_ml numeric not null,               -- positive = received, negative = issued
  reason text not null,                     -- 'purchase' | 'issue' | 'adjustment' | 'spillage'
  reference_id uuid,                        -- soap_requests.id, wash_transactions.id, or purchase_orders.id
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Purchase Orders ----------
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
  status text not null default 'pending', -- pending | received | cancelled
  ordered_at timestamptz not null default now(),
  received_at timestamptz,
  notes text,
  created_by uuid references profiles(id)
);

-- ---------- Washer Personal Stock ----------
create table if not exists washer_inventory (
  id uuid primary key default gen_random_uuid(),
  washer_id uuid not null references profiles(id) on delete cascade,
  inventory_id uuid not null references inventory(id) on delete cascade,
  balance_ml numeric not null default 0,
  unique (washer_id, inventory_id)
);

-- ---------- Soap Requests ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type request_status as enum ('pending', 'approved', 'rejected', 'partial');
  end if;
end $$;

create sequence if not exists soap_request_seq start 1000;

create table if not exists soap_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('RQ-' || to_char(nextval('soap_request_seq'), 'FM0000')),
  washer_id uuid not null references profiles(id),
  inventory_id uuid not null references inventory(id),
  quantity_requested numeric not null,
  quantity_approved numeric,
  status request_status not null default 'pending',
  notes text,
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------- Wash Transactions ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'wash_status') then
    create type wash_status as enum ('queued', 'in_progress', 'completed', 'cancelled');
  end if;
end $$;

create sequence if not exists receipt_seq start 10001;

create table if not exists wash_transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default ('REC-' || to_char(nextval('receipt_seq'), 'FM00000')),
  vehicle_id uuid not null references vehicles(id),
  vehicle_type_id text not null references vehicle_types(id),
  washer_id uuid not null references profiles(id),
  price numeric not null,
  soap_used_ml numeric not null,
  payment_method text not null default 'cash', -- cash | telebirr | cbe_birr | card | account
  payment_status text not null default 'paid',  -- paid | unpaid
  services jsonb default '[]'::jsonb,
  bay_number int default 1,
  photo_before_url text,
  photo_after_url text,
  remarks text,
  status wash_status not null default 'completed',
  started_at timestamptz not null default now(),
  completed_at timestamptz default now(),
  actual_minutes int
);

-- ---------- Finance / Expenses ----------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,             -- payroll | maintenance | utilities | inventory_cost | rent | other
  amount numeric not null,
  description text,
  incurred_on date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Notifications & Audit ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index if not exists idx_wash_washer_started on wash_transactions (washer_id, started_at);
create index if not exists idx_wash_vehicle_type on wash_transactions (vehicle_type_id);
create index if not exists idx_soap_requests_status on soap_requests (status);
create index if not exists idx_inventory_movements on inventory_movements (inventory_id, created_at);
create index if not exists idx_vehicles_plate on vehicles (plate);
create index if not exists idx_po_status on purchase_orders (status);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table vehicle_types enable row level security;
alter table wash_services enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table suppliers enable row level security;
alter table inventory enable row level security;
alter table inventory_movements enable row level security;
alter table purchase_orders enable row level security;
alter table washer_inventory enable row level security;
alter table soap_requests enable row level security;
alter table wash_transactions enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- Role Helper
create or replace function current_role_name() returns user_role
language sql stable as $$
  select coalesce(role, 'washer'::user_role) from profiles where id = auth.uid()
$$;

-- RLS Policies
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_admin_write" on profiles for all using (current_role_name() = 'administrator');

create policy "vehicle_types_select" on vehicle_types for select using (auth.role() = 'authenticated');
create policy "vehicle_types_admin_write" on vehicle_types for insert with check (current_role_name() = 'administrator');
create policy "vehicle_types_admin_update" on vehicle_types for update using (current_role_name() = 'administrator');

create policy "wash_services_select" on wash_services for select using (auth.role() = 'authenticated');
create policy "wash_services_admin_write" on wash_services for all using (current_role_name() = 'administrator');

create policy "customers_all_select" on customers for select using (auth.role() = 'authenticated');
create policy "customers_staff_write" on customers for all using (current_role_name() in ('administrator','manager','washer'));

create policy "vehicles_all_select" on vehicles for select using (auth.role() = 'authenticated');
create policy "vehicles_staff_write" on vehicles for all using (current_role_name() in ('administrator','manager','washer'));

create policy "suppliers_select" on suppliers for select using (auth.role() = 'authenticated');
create policy "suppliers_write" on suppliers for all using (current_role_name() in ('administrator','store_keeper','manager'));

create policy "inventory_select" on inventory for select using (auth.role() = 'authenticated');
create policy "inventory_write" on inventory for all using (current_role_name() in ('administrator','store_keeper'));

create policy "inv_move_select" on inventory_movements for select using (auth.role() = 'authenticated');
create policy "inv_move_write" on inventory_movements for insert with check (current_role_name() in ('administrator','store_keeper'));

create policy "purchase_orders_select" on purchase_orders for select using (auth.role() = 'authenticated');
create policy "purchase_orders_write" on purchase_orders for all using (current_role_name() in ('administrator','store_keeper','manager'));

create policy "washer_inv_select_own" on washer_inventory for select using (
  washer_id = auth.uid() or current_role_name() in ('administrator','store_keeper','manager')
);
create policy "washer_inv_write" on washer_inventory for all using (current_role_name() in ('administrator','store_keeper'));

create policy "requests_select" on soap_requests for select using (
  washer_id = auth.uid() or current_role_name() in ('administrator','store_keeper','manager')
);
create policy "requests_insert_own" on soap_requests for insert with check (washer_id = auth.uid());
create policy "requests_decide" on soap_requests for update using (current_role_name() in ('administrator','store_keeper'));

create policy "wash_select" on wash_transactions for select using (auth.role() = 'authenticated');
create policy "wash_insert_own" on wash_transactions for insert with check (
  washer_id = auth.uid() or current_role_name() in ('administrator','manager')
);
create policy "wash_update_own_or_admin" on wash_transactions for update using (
  washer_id = auth.uid() or current_role_name() in ('administrator','manager')
);

create policy "expenses_rw" on expenses for all using (current_role_name() in ('administrator','manager'));
create policy "notif_select_own" on notifications for select using (user_id = auth.uid());
create policy "notif_update_own" on notifications for update using (user_id = auth.uid());
create policy "audit_select" on audit_logs for select using (current_role_name() in ('administrator','manager'));

-- ---------- Automation: Deduct soap on wash completion (INSERT or UPDATE) ----------
create or replace function handle_wash_completion() returns trigger
language plpgsql security definer as $$
declare
  v_inventory_id uuid;
begin
  if new.status = 'completed' and (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.status is distinct from 'completed')) then
    new.completed_at := coalesce(new.completed_at, now());
    if new.started_at is not null then
      new.actual_minutes := coalesce(new.actual_minutes, round(extract(epoch from (new.completed_at - new.started_at)) / 60));
    end if;

    -- Deduct from washer stock
    select inventory_id into v_inventory_id
    from washer_inventory wi
    where wi.washer_id = new.washer_id
    order by wi.balance_ml desc
    limit 1;

    if v_inventory_id is not null then
      update washer_inventory
        set balance_ml = greatest(0, balance_ml - new.soap_used_ml)
        where washer_id = new.washer_id and inventory_id = v_inventory_id;
    end if;

    insert into audit_logs (actor_id, action, entity, entity_id, detail)
    values (new.washer_id, 'wash_completed', 'wash_transactions', new.id,
      jsonb_build_object(
        'receipt_number', new.receipt_number,
        'price', new.price,
        'soap_used_ml', new.soap_used_ml,
        'payment_method', new.payment_method
      ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wash_completion on wash_transactions;
create trigger trg_wash_completion
  before insert or update on wash_transactions
  for each row execute function handle_wash_completion();

-- ---------- Automation: Apply soap request decision ----------
create or replace function handle_request_decision() returns trigger
language plpgsql security definer as $$
begin
  if new.status in ('approved','partial') and (TG_OP = 'INSERT' or old.status = 'pending') then
    new.decided_at := now();
    update inventory set total_ml = greatest(0, total_ml - new.quantity_approved) where id = new.inventory_id;

    insert into inventory_movements (inventory_id, change_ml, reason, reference_id, created_by)
    values (new.inventory_id, -new.quantity_approved, 'issue', new.id, new.approved_by);

    insert into washer_inventory (washer_id, inventory_id, balance_ml)
    values (new.washer_id, new.inventory_id, new.quantity_approved)
    on conflict (washer_id, inventory_id)
      do update set balance_ml = washer_inventory.balance_ml + excluded.balance_ml;

    insert into notifications (user_id, type, message)
    values (new.washer_id, 'soap_approved', new.quantity_approved || ' ml approved for request ' || new.request_number);
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.decided_at := now();
    insert into notifications (user_id, type, message)
    values (new.washer_id, 'soap_rejected', 'Request ' || new.request_number || ' was rejected');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_request_decision on soap_requests;
create trigger trg_request_decision
  before update on soap_requests
  for each row execute function handle_request_decision();

-- ---------- Secured Admin RPC Functions ----------
create or replace function admin_create_employee(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_phone text default null
) returns uuid
language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_caller_role user_role;
begin
  v_caller_role := current_role_name();
  if v_caller_role is distinct from 'administrator'::user_role then
    raise exception 'Access denied: Only administrators can create employees';
  end if;

  v_user_id := (select id from auth.users where email = p_email limit 1);
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, role)
    values (
      v_user_id,
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      'authenticated'
    );
  end if;

  insert into profiles (id, full_name, role, phone)
  values (v_user_id, p_full_name, p_role::user_role, p_phone)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        phone = excluded.phone;

  return v_user_id;
end;
$$;

create or replace function admin_reset_employee_password(
  p_user_id uuid,
  p_new_password text
) returns void
language plpgsql security definer as $$
declare
  v_caller_role user_role;
begin
  v_caller_role := current_role_name();
  if v_caller_role is distinct from 'administrator'::user_role then
    raise exception 'Access denied: Only administrators can reset passwords';
  end if;

  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf'))
  where id = p_user_id;
end;
$$;
