-- Migration Patch for WashOS
-- Safe to execute against existing Supabase database.

-- 1. Create missing tables if they don't exist
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
  created_by uuid references profiles(id)
);

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

-- 2. Add columns to wash_transactions
alter table wash_transactions add column if not exists receipt_number text;
alter table wash_transactions add column if not exists payment_method text not null default 'cash';
alter table wash_transactions add column if not exists payment_status text not null default 'paid';
alter table wash_transactions add column if not exists services jsonb default '[]'::jsonb;
alter table wash_transactions add column if not exists bay_number int default 1;

-- 3. Fix trigger for wash completion (fire on INSERT or UPDATE)
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

-- 4. Secure Admin RPCs with role verification
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
