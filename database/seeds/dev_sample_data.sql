-- ============================================================================
-- NECL Development Seed Data
-- WARNING: This file is for LOCAL DEVELOPMENT ONLY
-- DO NOT run this in production environments
-- ============================================================================

-- Note: Run this manually with: psql -f database/seeds/dev_sample_data.sql

-- Sample Client Companies
INSERT INTO public.client_companies (id, company_name, gstin, pan, registered_address, city, pincode, status)
VALUES 
  ('ca111111-1111-1111-1111-111111111111', 'ABC Traders Ltd', '36AAAAA0000A1Z5', 'AAAAA0000A', '123 Trade Street, Industrial Area', 'Visakhapatnam', '530001', 'ACTIVE'),
  ('ca222222-2222-2222-2222-222222222222', 'XYZ Industries Pvt Ltd', '36BBBBB0000B1Z5', 'BBBBB0000B', '456 Manufacturing Lane', 'Vijayawada', '520001', 'ACTIVE'),
  ('ca333333-3333-3333-3333-333333333333', 'LMN Steel & Alloys', '36CCCCC0000C1Z5', 'CCCCC0000C', '789 Steel Complex', 'Guntur', '522001', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Sample Vendor Companies
INSERT INTO public.vendor_companies (id, vendor_name, pan, gstin, address, status, onboarding_source)
VALUES
  ('va111111-1111-1111-1111-111111111111', 'Sri Sai Transport', 'SSSSS0000S', '36SSSSS0000S1Z5', 'Transport Nagar, Road No 5, Vijayawada', 'APPROVED', 'INVITED'),
  ('va222222-2222-2222-2222-222222222222', 'Sri Balaji Logistics', 'LLLLL0000L', '36LLLLL0000L1Z5', 'Logistics Hub, NH-16, Visakhapatnam', 'APPROVED', 'SELF_REGISTERED')
ON CONFLICT (id) DO NOTHING;

-- Sample Vehicles
INSERT INTO public.vehicles (id, registration_number, vehicle_type, rated_capacity_mt, minimum_capacity_mt, rc_number, status)
VALUES
  ('ve111111-1111-1111-1111-111111111111', 'AP 39 AB 1234', '32FT_MXL', 25.00, 15.00, 'RC123456789', 'ACTIVE'),
  ('ve222222-2222-2222-2222-222222222222', 'TS 09 UB 9988', '20FT_SXL', 15.00, 10.00, 'RC987654321', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Sample Vendor-Vehicle Links
INSERT INTO public.vendor_vehicle_links (vendor_id, vehicle_id, status)
VALUES
  ('va111111-1111-1111-1111-111111111111', 've111111-1111-1111-1111-111111111111', 'APPROVED'),
  ('va222222-2222-2222-2222-222222222222', 've222222-2222-2222-2222-222222222222', 'APPROVED')
ON CONFLICT (vendor_id, vehicle_id) DO NOTHING;

-- Sample Drivers
INSERT INTO public.drivers (id, primary_vendor_id, full_name, mobile, licence_number, licence_expiry_date, status)
VALUES
  ('da111111-1111-1111-1111-111111111111', 'va111111-1111-1111-1111-111111111111', 'Ramesh Kumar', '+919876543210', 'AP1220230001234', '2027-12-31', 'APPROVED'),
  ('da222222-2222-2222-2222-222222222222', 'va222222-2222-2222-2222-222222222222', 'Suresh Babu', '+919123456789', 'TS0920230005678', '2027-06-30', 'APPROVED')
ON CONFLICT (id) DO NOTHING;

-- Sample Requirement
INSERT INTO public.requirements (id, client_id, pickup_pincode, pickup_address, destination_pincode, destination_address, required_capacity_mt, vehicle_type, material_type, loading_datetime, status)
VALUES
  ('REQ-20261003-001', 'ca111111-1111-1111-1111-111111111111', '530001', 'Visakhapatnam Port, Gate 3', '500001', 'Hyderabad Warehouse 4, JNTU', 20.00, '32FT_MXL', 'STEEL_COILS', '2026-10-05 08:00:00+05:30', 'NEW_REQUIREMENT')
ON CONFLICT (id) DO NOTHING;

-- Sample Booking
INSERT INTO public.bookings (id, requirement_id, client_id, booking_status, payment_status)
VALUES
  ('BOK-20261003-015', 'REQ-20261003-001', 'ca111111-1111-1111-1111-111111111111', 'CLIENT_ACCEPTED', 'NOT_DUE')
ON CONFLICT (id) DO NOTHING;

-- Sample Trip
INSERT INTO public.trips (id, booking_id, vehicle_id, driver_id, vendor_id, vendor_rate, trip_status)
VALUES
  ('fa111111-1111-1111-1111-111111111111', 'BOK-20261003-015', 've111111-1111-1111-1111-111111111111', 'da111111-1111-1111-1111-111111111111', 'va111111-1111-1111-1111-111111111111', 28500.00, 'LORRY_ASSIGNED')
ON CONFLICT (id) DO NOTHING;

-- Development Note:
-- To load this seed data in your local Supabase instance:
-- 1. Ensure you're connected to your LOCAL database
-- 2. Run: psql <your-local-connection-string> -f database/seeds/dev_sample_data.sql
-- 3. Never run this against production!
