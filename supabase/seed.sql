-- WashOS Car Wash ERP — Realistic Seed Dataset
-- Run this in your Supabase SQL editor after schema.sql.

-- 1. Suppliers
insert into suppliers (id, name, contact, email, products, address)
values
  ('a1111111-1111-1111-1111-111111111111', 'Chemtech PLC', '+251 11 234 5678', 'sales@chemtech.et', 'LARGO Foam Shampoo, Glass Cleaner, Engine Degreaser', 'Bole Sub-city, Woreda 03, Addis Ababa'),
  ('a2222222-2222-2222-2222-222222222222', 'AutoCare Import & Dist.', '+251 11 345 6789', 'info@autocare.et', 'Tire Shine Gel, Carnauba Wax, Microfiber Towels', 'Nifas Silk Lafto, Addis Ababa'),
  ('a3333333-3333-3333-3333-333333333333', 'Habesha Chemical Industries', '+251 11 456 7890', 'contact@habeshachem.com', 'Heavy Duty Degreaser, Acid Wash, Upholstery Cleaner', 'Kaliti Industrial Zone, Addis Ababa')
on conflict (id) do nothing;

-- 2. Store Inventory
insert into inventory (id, product_name, category, total_ml, min_stock_ml, supplier, supplier_id, batch_number, purchase_date, expiry_date, unit_cost, cost)
values
  ('b1111111-1111-1111-1111-111111111111', 'LARGO Foam Detergent Concentrate', 'Soap', 38500, 10000, 'Chemtech PLC', 'a1111111-1111-1111-1111-111111111111', 'BATCH-2026-04', '2026-04-10', '2027-04-10', 0.188, 9400),
  ('b2222222-2222-2222-2222-222222222222', 'Tire Shine Silicone Gel', 'Finishing', 12400, 6000, 'AutoCare Import & Dist.', 'a2222222-2222-2222-2222-222222222222', 'BATCH-2026-03', '2026-03-15', '2027-09-15', 0.320, 4800),
  ('b3333333-3333-3333-3333-333333333333', 'Crystal Clear Glass Cleaner', 'Interior', 14800, 5000, 'Chemtech PLC', 'a1111111-1111-1111-1111-111111111111', 'BATCH-2026-05', '2026-05-02', '2027-11-02', 0.150, 3000),
  ('b4444444-4444-4444-4444-444444444444', 'Heavy Duty Engine Degreaser', 'Soap', 3200, 8000, 'Habesha Chemical Industries', 'a3333333-3333-3333-3333-333333333333', 'BATCH-2026-01', '2026-01-20', '2026-10-20', 0.220, 3300),
  ('b5555555-5555-5555-5555-555555555555', 'Carnauba Liquid Gloss Wax', 'Finishing', 8500, 4000, 'AutoCare Import & Dist.', 'a2222222-2222-2222-2222-222222222222', 'BATCH-2026-04', '2026-04-18', '2027-08-18', 0.450, 4500)
on conflict (id) do nothing;

-- 3. Purchase Orders
insert into purchase_orders (id, po_number, supplier_id, supplier_name, inventory_id, product_name, qty_ml, unit_cost, status, ordered_at, received_at, notes)
values
  ('c1111111-1111-1111-1111-111111111111', 'PO-1001', 'a1111111-1111-1111-1111-111111111111', 'Chemtech PLC', 'b1111111-1111-1111-1111-111111111111', 'LARGO Foam Detergent Concentrate', 50000, 0.188, 'received', now() - interval '14 days', now() - interval '11 days', '50L bulk barrel delivery'),
  ('c2222222-2222-2222-2222-222222222222', 'PO-1002', 'a2222222-2222-2222-2222-222222222222', 'AutoCare Import & Dist.', 'b2222222-2222-2222-2222-222222222222', 'Tire Shine Silicone Gel', 15000, 0.320, 'received', now() - interval '7 days', now() - interval '4 days', 'Restocked for weekend rush'),
  ('c3333333-3333-3333-3333-333333333333', 'PO-1003', 'a3333333-3333-3333-3333-333333333333', 'Habesha Chemical Industries', 'b4444444-4444-4444-4444-444444444444', 'Heavy Duty Engine Degreaser', 20000, 0.220, 'pending', now() - interval '2 days', null, 'Urgent: Degreaser stock critical')
on conflict (id) do nothing;

-- 4. Customers
insert into customers (id, full_name, phone, notes)
values
  ('d1111111-1111-1111-1111-111111111111', 'Alemayehu Tadesse', '+251 91 123 4567', 'VIP Customer · Prefers full wash + engine steam'),
  ('d2222222-2222-2222-2222-222222222222', 'Bethlehem Haile', '+251 92 234 5678', 'Weekly regular (Tucson)'),
  ('d3333333-3333-3333-3333-333333333333', 'Kassahun Worku', '+251 93 345 6789', 'Sino Truck fleet owner · Monthly account'),
  ('d4444444-4444-4444-4444-444444444444', 'Samrawit Girma', '+251 94 456 7890', 'Toyota Vitz · Prefers hand dry with clean microfiber'),
  ('d5555555-5555-5555-5555-555555555555', 'Dawit Kebede', '+251 91 567 8901', 'Trailer logistics operator · Frequent visits')
on conflict (id) do nothing;

-- 5. Vehicles
insert into vehicles (id, plate, customer_id, vehicle_type_id)
values
  ('e1111111-1111-1111-1111-111111111111', 'AA-A-12345', 'd1111111-1111-1111-1111-111111111111', 'small'),
  ('e2222222-2222-2222-2222-222222222222', 'AA-B-67890', 'd2222222-2222-2222-2222-222222222222', 'small'),
  ('e3333333-3333-3333-3333-333333333333', 'AA-C-11111', 'd3333333-3333-3333-3333-333333333333', 'medium'),
  ('e4444444-4444-4444-4444-444444444444', 'AA-D-22222', 'd4444444-4444-4444-4444-444444444444', 'small'),
  ('e5555555-5555-5555-5555-555555555555', 'AA-E-33333', 'd5555555-5555-5555-5555-555555555555', 'large')
on conflict (plate) do nothing;

-- 6. Expenses
insert into expenses (id, category, amount, description, incurred_on)
values
  ('f1111111-1111-1111-1111-111111111111', 'utilities', 4200, 'Water utility bill for wash bays (Month 1)', current_date - interval '10 days'),
  ('f2222222-2222-2222-2222-222222222222', 'maintenance', 3500, 'High-pressure washer pump hose & nozzle replacement', current_date - interval '6 days'),
  ('f3333333-3333-3333-3333-333333333333', 'inventory_cost', 9400, 'LARGO 50L bulk purchase PO-1001 payment', current_date - interval '11 days'),
  ('f4444444-4444-4444-4444-444444444444', 'payroll', 18500, 'Weekly washer commission and staff base allowances', current_date - interval '3 days'),
  ('f5555555-5555-5555-5555-555555555555', 'other', 1200, 'Facility cleaning supplies and tea/coffee for customer lounge', current_date - interval '1 day')
on conflict (id) do nothing;
