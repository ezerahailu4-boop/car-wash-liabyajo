-- WashOS Car Wash ERP — core schema
-- Run in Supabase SQL editor. Assumes auth.users already exists (Supabase Auth).

create extension if not exists "pgcrypto";

-- ---------- Roles ----------
create type user_role as enum ('administrator', 'manager', 'store_keeper', 'washer');

create table profiles (
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
-- (Maintenance and Production Division, May 2026). Approved detergent: LARGO,
-- 5L = ETB 940 (ETB 188/L).
create table vehicle_types (
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

insert into vehicle_types (id, name, examples, standard_minutes, workers_required, default_soap_ml, detergent_cost_etb, default_price) values
  ('small', 'Light Vehicle', 'Automobile, Minibus, Pickup', 45, 2, 180, 33.84, 350),
  ('medium', 'Medium Vehicle', 'Sino Truck, Isuzu, Mid Bus', 120, 2, 250, 47.00, 900),
  ('large', 'Heavy Vehicle', 'Trailer', 180, 2, 500, 94.00, 1800);

-- ---------- Customers & vehicles ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  customer_id uuid references customers(id) on delete set null,
  vehicle_type_id text not null references vehicle_types(id),
  created_at timestamptz not null default now()
);

-- ---------- Store inventory ----------
create table inventory (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text not null,
  total_ml numeric not null default 0,      -- current remaining stock, in ml
  min_stock_ml numeric not null default 0,
  supplier text,
  batch_number text,
  purchase_date date,
  expiry_date date,
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

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory(id) on delete cascade,
  change_ml numeric not null,               -- positive = received, negative = issued
  reason text not null,                     -- 'purchase' | 'issue' | 'adjustment'
  reference_id uuid,                        -- soap_requests.id or wash_transactions.id
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Washer personal stock ----------
create table washer_inventory (
  id uuid primary key default gen_random_uuid(),
  washer_id uuid not null references profiles(id) on delete cascade,
  inventory_id uuid not null references inventory(id) on delete cascade,
  balance_ml numeric not null default 0,
  unique (washer_id, inventory_id)
);

-- ---------- Soap requests ----------
create type request_status as enum ('pending', 'approved', 'rejected', 'partial');

create sequence soap_request_seq start 1000;

create table soap_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('RQ-' || to_char(nextval('soap_request_seq'), 'FM0000')),
  washer_id uuid not null references profiles(id),
  inventory_id uuid not null references inventory(id),
  quantity_requested numeric not null,
  quantity_approved numeric,
  status request_status not null default 'pending',
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------- Wash transactions ----------
create type wash_status as enum ('in_progress', 'completed', 'cancelled');

create table wash_transactions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id),
  vehicle_type_id text not null references vehicle_types(id),
  washer_id uuid not null references profiles(id),
  price numeric not null,
  soap_used_ml numeric not null,
  photo_before_url text,
  photo_after_url text,
  remarks text,
  status wash_status not null default 'completed',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  actual_minutes int
);

-- ---------- Finance ----------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,             -- payroll | maintenance | utilities | inventory_cost | other
  amount numeric not null,
  description text,
  incurred_on date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Notifications & audit ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index on wash_transactions (washer_id, started_at);
create index on wash_transactions (vehicle_type_id);
create index on soap_requests (status);
create index on inventory_movements (inventory_id, created_at);
create index on vehicles (plate);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table vehicle_types enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table inventory enable row level security;
alter table inventory_movements enable row level security;
alter table washer_inventory enable row level security;
alter table soap_requests enable row level security;
alter table wash_transactions enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- helper: current user's role
create or replace function current_role_name() returns user_role
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- profiles: everyone can read active staff; only admins write
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_admin_write" on profiles for all using (current_role_name() = 'administrator');

-- vehicle_types: readable by all authenticated, editable by admin
create policy "vehicle_types_select" on vehicle_types for select using (auth.role() = 'authenticated');
create policy "vehicle_types_admin_write" on vehicle_types for insert with check (current_role_name() = 'administrator');
create policy "vehicle_types_admin_update" on vehicle_types for update using (current_role_name() = 'administrator');

-- customers & vehicles: readable by all staff, writable by washer/manager/admin
create policy "customers_all_select" on customers for select using (auth.role() = 'authenticated');
create policy "customers_staff_write" on customers for insert with check (current_role_name() in ('administrator','manager','washer'));
create policy "vehicles_all_select" on vehicles for select using (auth.role() = 'authenticated');
create policy "vehicles_staff_write" on vehicles for insert with check (current_role_name() in ('administrator','manager','washer'));

-- inventory: store keeper + admin manage; all staff can read
create policy "inventory_select" on inventory for select using (auth.role() = 'authenticated');
create policy "inventory_write" on inventory for all using (current_role_name() in ('administrator','store_keeper'));

create policy "inv_move_select" on inventory_movements for select using (auth.role() = 'authenticated');
create policy "inv_move_write" on inventory_movements for insert with check (current_role_name() in ('administrator','store_keeper'));

-- washer_inventory: washer sees own, store keeper/admin see all
create policy "washer_inv_select_own" on washer_inventory for select using (
  washer_id = auth.uid() or current_role_name() in ('administrator','store_keeper','manager')
);
create policy "washer_inv_write" on washer_inventory for all using (current_role_name() in ('administrator','store_keeper'));

-- soap_requests: washer creates/sees own; store keeper/admin see & decide all
create policy "requests_select" on soap_requests for select using (
  washer_id = auth.uid() or current_role_name() in ('administrator','store_keeper','manager')
);
create policy "requests_insert_own" on soap_requests for insert with check (washer_id = auth.uid());
create policy "requests_decide" on soap_requests for update using (current_role_name() in ('administrator','store_keeper'));

-- wash_transactions: washer creates own; everyone with a role can read (for dashboards)
create policy "wash_select" on wash_transactions for select using (auth.role() = 'authenticated');
create policy "wash_insert_own" on wash_transactions for insert with check (
  washer_id = auth.uid() or current_role_name() in ('administrator','manager')
);
create policy "wash_update_own_or_admin" on wash_transactions for update using (
  washer_id = auth.uid() or current_role_name() in ('administrator','manager')
);

-- expenses: manager/admin only
create policy "expenses_rw" on expenses for all using (current_role_name() in ('administrator','manager'));

-- notifications: user sees own
create policy "notif_select_own" on notifications for select using (user_id = auth.uid());
create policy "notif_update_own" on notifications for update using (user_id = auth.uid());

-- audit logs: admin/manager read only, system inserts via service role
create policy "audit_select" on audit_logs for select using (current_role_name() in ('administrator','manager'));

-- ---------- Automation: deduct soap + record revenue on wash completion ----------
create or replace function handle_wash_completion() returns trigger
language plpgsql security definer as $$
declare
  v_inventory_id uuid;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
    new.actual_minutes := extract(epoch from (new.completed_at - new.started_at)) / 60;

    select inventory_id into v_inventory_id
    from washer_inventory wi
    join inventory i on i.id = wi.inventory_id
    where wi.washer_id = new.washer_id
    order by wi.balance_ml desc
    limit 1;

    if v_inventory_id is not null then
      update washer_inventory
        set balance_ml = balance_ml - new.soap_used_ml
        where washer_id = new.washer_id and inventory_id = v_inventory_id;
    end if;

    insert into audit_logs (actor_id, action, entity, entity_id, detail)
    values (new.washer_id, 'wash_completed', 'wash_transactions', new.id,
      jsonb_build_object('price', new.price, 'soap_used_ml', new.soap_used_ml));
  end if;
  return new;
end;
$$;

create trigger trg_wash_completion
  before update on wash_transactions
  for each row execute function handle_wash_completion();

-- ---------- Automation: apply soap_request decision to inventory + washer stock ----------
create or replace function handle_request_decision() returns trigger
language plpgsql security definer as $$
begin
  if new.status in ('approved','partial') and old.status = 'pending' then
    new.decided_at := now();
    update inventory set total_ml = total_ml - new.quantity_approved where id = new.inventory_id;

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

create trigger trg_request_decision
  before update on soap_requests
  for each row execute function handle_request_decision();
