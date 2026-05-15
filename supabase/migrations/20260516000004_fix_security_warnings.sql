-- Fix Supabase Security Advisor Warnings
-- Run this in your Supabase Dashboard SQL Editor

ALTER FUNCTION public.refresh_fee_summary() SET search_path = public;
ALTER FUNCTION public.update_enrolled_students(UUID, UUID, INTEGER) SET search_path = public;
ALTER FUNCTION public.log_table_change() SET search_path = public;
ALTER FUNCTION public.update_vehicle_latest() SET search_path = public;

-- Also let's check for update_updated_at and set_paid_at
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.set_paid_at() SET search_path = public;
