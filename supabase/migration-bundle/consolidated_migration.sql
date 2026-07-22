
-- ============================================================================
-- Migration: 20260331003212_f2951aad-b372-424d-8cb5-88a12ee03975.sql
-- ============================================================================


-- Create enum for module permissions
CREATE TYPE public.app_module AS ENUM ('invoices', 'transactions', 'pnl', 'vat', 'paye', 'reports', 'users');
CREATE TYPE public.access_level AS ENUM ('none', 'view', 'edit', 'admin');

-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.tbl_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security guidelines)
CREATE TABLE public.tbl_user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module app_module NOT NULL,
  access access_level NOT NULL DEFAULT 'none',
  UNIQUE (user_id, module)
);

ALTER TABLE public.tbl_user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module app_module, _min_access access_level)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = _user_id
      AND module = _module
      AND CASE
        WHEN _min_access = 'view' THEN access IN ('view', 'edit', 'admin')
        WHEN _min_access = 'edit' THEN access IN ('edit', 'admin')
        WHEN _min_access = 'admin' THEN access = 'admin'
        ELSE true
      END
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = _user_id
      AND module = 'users'
      AND access = 'admin'
  )
$$;

-- Invoices table
CREATE TABLE public.tbl_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('paid', 'pending', 'overdue', 'draft')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_invoices ENABLE ROW LEVEL SECURITY;

-- Transactions table
CREATE TABLE public.tbl_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow')),
  category TEXT NOT NULL DEFAULT 'Uncategorized',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_transactions ENABLE ROW LEVEL SECURITY;

-- VAT returns table
CREATE TABLE public.tbl_vat_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  output_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  input_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('filed', 'due', 'overdue')),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_vat_returns ENABLE ROW LEVEL SECURITY;

-- PAYE employees table
CREATE TABLE public.tbl_paye_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  gross_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  ni NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_paye_employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tbl_profiles
CREATE POLICY "Users can view own profile" ON public.tbl_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.tbl_profiles FOR SELECT USING (public.is_user_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.tbl_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.tbl_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tbl_user_roles
CREATE POLICY "Users can view own roles" ON public.tbl_user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.tbl_user_roles FOR ALL USING (public.is_user_admin(auth.uid()));

-- RLS Policies for tbl_invoices
CREATE POLICY "Users can manage own invoices" ON public.tbl_invoices FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for tbl_transactions
CREATE POLICY "Users can manage own transactions" ON public.tbl_transactions FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for tbl_vat_returns
CREATE POLICY "Users can manage own vat returns" ON public.tbl_vat_returns FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for tbl_paye_employees
CREATE POLICY "Users can manage own employees" ON public.tbl_paye_employees FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_tbl_profiles_updated_at BEFORE UPDATE ON public.tbl_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tbl_invoices_updated_at BEFORE UPDATE ON public.tbl_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tbl_transactions_updated_at BEFORE UPDATE ON public.tbl_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tbl_vat_returns_updated_at BEFORE UPDATE ON public.tbl_vat_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tbl_paye_employees_updated_at BEFORE UPDATE ON public.tbl_paye_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile and grant admin to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.tbl_profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  SELECT COUNT(*) INTO user_count FROM public.tbl_profiles;

  IF user_count <= 1 THEN
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'admin'),
      (NEW.id, 'transactions', 'admin'),
      (NEW.id, 'pnl', 'admin'),
      (NEW.id, 'vat', 'admin'),
      (NEW.id, 'paye', 'admin'),
      (NEW.id, 'reports', 'admin'),
      (NEW.id, 'users', 'admin');
  ELSE
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'view'),
      (NEW.id, 'transactions', 'view'),
      (NEW.id, 'pnl', 'view'),
      (NEW.id, 'vat', 'view'),
      (NEW.id, 'paye', 'view'),
      (NEW.id, 'reports', 'view'),
      (NEW.id, 'users', 'none');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- Migration: 20260401155501_047dd582-554c-420c-b6a6-61fc5f28532c.sql
-- ============================================================================


-- Add approver columns to tbl_invoices
ALTER TABLE public.tbl_invoices ADD COLUMN approver1_id uuid;
ALTER TABLE public.tbl_invoices ADD COLUMN approver2_id uuid;
ALTER TABLE public.tbl_invoices ADD COLUMN approver1_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_invoices ADD COLUMN approver2_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_invoices ADD COLUMN created_by_name text NOT NULL DEFAULT '';

-- Add approver columns to tbl_transactions
ALTER TABLE public.tbl_transactions ADD COLUMN approver1_id uuid;
ALTER TABLE public.tbl_transactions ADD COLUMN approver2_id uuid;
ALTER TABLE public.tbl_transactions ADD COLUMN approver1_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_transactions ADD COLUMN approver2_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.tbl_transactions ADD COLUMN created_by_name text NOT NULL DEFAULT '';

-- Create notifications table
CREATE TABLE public.tbl_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tbl_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.tbl_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.tbl_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.tbl_notifications FOR INSERT
  WITH CHECK (true);

-- Update RLS on tbl_invoices: all authenticated can SELECT, owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage own invoices" ON public.tbl_invoices;

CREATE POLICY "All authenticated can view invoices"
  ON public.tbl_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own invoices"
  ON public.tbl_invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON public.tbl_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Approvers can update invoices assigned to them"
  ON public.tbl_invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = approver1_id OR auth.uid() = approver2_id);

CREATE POLICY "Users can delete own invoices"
  ON public.tbl_invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update RLS on tbl_transactions: all authenticated can SELECT, owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.tbl_transactions;

CREATE POLICY "All authenticated can view transactions"
  ON public.tbl_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own transactions"
  ON public.tbl_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON public.tbl_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Approvers can update transactions assigned to them"
  ON public.tbl_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = approver1_id OR auth.uid() = approver2_id);

CREATE POLICY "Users can delete own transactions"
  ON public.tbl_transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.tbl_notifications;


-- ============================================================================
-- Migration: 20260401155523_f691c978-744b-495a-a0fb-19de576787fd.sql
-- ============================================================================


DROP POLICY IF EXISTS "System can insert notifications" ON public.tbl_notifications;

CREATE POLICY "Authenticated can insert notifications"
  ON public.tbl_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON public.tbl_notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- Migration: 20260402095624_aa9e7c01-7a50-46f1-aab5-faeb8ad9d476.sql
-- ============================================================================


-- Add designation and signature_url to profiles
ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS designation text NOT NULL DEFAULT '';
ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS signature_url text NOT NULL DEFAULT '';

-- Add attachments column to transactions
ALTER TABLE public.tbl_transactions ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create storage bucket for signatures (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for transaction attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('transaction-attachments', 'transaction-attachments', false) ON CONFLICT (id) DO NOTHING;

-- Signatures: anyone can view
CREATE POLICY "Signatures are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

-- Signatures: users can upload their own
CREATE POLICY "Users can upload own signature"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Signatures: users can update their own
CREATE POLICY "Users can update own signature"
ON storage.objects FOR UPDATE
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Signatures: users can delete their own
CREATE POLICY "Users can delete own signature"
ON storage.objects FOR DELETE
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Transaction attachments: authenticated can view
CREATE POLICY "Authenticated can view transaction attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'transaction-attachments' AND auth.role() = 'authenticated');

-- Transaction attachments: authenticated can upload
CREATE POLICY "Authenticated can upload transaction attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transaction-attachments' AND auth.role() = 'authenticated');


-- ============================================================================
-- Migration: 20260402125240_cdf273a3-442b-448f-a55c-51f8886ff12e.sql
-- ============================================================================

-- Allow admins to delete any invoice
CREATE POLICY "Admins can delete invoices"
ON public.tbl_invoices
FOR DELETE
TO authenticated
USING (public.has_module_access(auth.uid(), 'invoices'::app_module, 'admin'::access_level));

-- Allow admins to delete any transaction
CREATE POLICY "Admins can delete transactions"
ON public.tbl_transactions
FOR DELETE
TO authenticated
USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level));


-- ============================================================================
-- Migration: 20260403213428_16bb1aa7-43d8-4c41-aff0-1350660dd0f0.sql
-- ============================================================================

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.tbl_profiles
FOR DELETE
TO authenticated
USING (public.is_user_admin(auth.uid()));

-- Allow admins to delete user roles
CREATE POLICY "Admins can delete roles"
ON public.tbl_user_roles
FOR DELETE
TO authenticated
USING (public.is_user_admin(auth.uid()));

-- ============================================================================
-- Migration: 20260404075134_bfa4419e-6f2d-4f67-ad12-478ee2f27e4a.sql
-- ============================================================================

ALTER TABLE public.tbl_profiles ADD COLUMN last_login_at timestamp with time zone DEFAULT NULL;

-- ============================================================================
-- Migration: 20260405092156_be2a139b-3d6c-4b87-9069-6b807a2936cf.sql
-- ============================================================================


ALTER TABLE public.tbl_paye_employees
ADD COLUMN IF NOT EXISTS designation text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT '';


-- ============================================================================
-- Migration: 20260405131552_6864290e-1a2e-4cb1-b40b-75b0d350b008.sql
-- ============================================================================

ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS session_timeout_minutes integer NOT NULL DEFAULT 15;

-- ============================================================================
-- Migration: 20260406072055_d99b30b6-9462-4a17-b0ac-105c7ec0378c.sql
-- ============================================================================

ALTER TABLE public.tbl_paye_employees ADD COLUMN IF NOT EXISTS gross_annual numeric NOT NULL DEFAULT 0;

-- ============================================================================
-- Migration: 20260406072207_5b217c4f-9dc9-4150-95f0-592859ed8a4e.sql
-- ============================================================================


-- Drop the overly restrictive ALL policy
DROP POLICY IF EXISTS "Users can manage own employees" ON public.tbl_paye_employees;

-- Authenticated users can view all employees
CREATE POLICY "All authenticated can view paye employees"
ON public.tbl_paye_employees FOR SELECT TO authenticated
USING (true);

-- Users can insert own employees
CREATE POLICY "Users can insert own paye employees"
ON public.tbl_paye_employees FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update own OR admin can update any
CREATE POLICY "Users or admins can update paye employees"
ON public.tbl_paye_employees FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR has_module_access(auth.uid(), 'paye'::app_module, 'admin'::access_level));

-- Users can delete own OR admin can delete any
CREATE POLICY "Users or admins can delete paye employees"
ON public.tbl_paye_employees FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_module_access(auth.uid(), 'paye'::app_module, 'admin'::access_level));


-- ============================================================================
-- Migration: 20260406205536_cf977821-efae-40b9-ad7d-584b2adf5d16.sql
-- ============================================================================


ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS is_approver boolean NOT NULL DEFAULT false;


-- ============================================================================
-- Migration: 20260602010321_ac6b61d7-143b-4f76-bd93-083cb3d7790b.sql
-- ============================================================================


-- Collections module tables

CREATE TABLE public.tbl_collection_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  default_sender_email TEXT NOT NULL DEFAULT '',
  internal_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  grace_period_days INT NOT NULL DEFAULT 0,
  max_reminders INT NOT NULL DEFAULT 5,
  escalation_thresholds JSONB NOT NULL DEFAULT '{"finance":14,"manager":21,"director":30,"legal":60}'::jsonb,
  pause_on_reply BOOLEAN NOT NULL DEFAULT true,
  stop_when_paid BOOLEAN NOT NULL DEFAULT true,
  business_days_only BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  customer_segment TEXT NOT NULL DEFAULT 'all',
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_amount NUMERIC,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  stop_conditions JSONB NOT NULL DEFAULT '["paid","disputed","paused","replied","written_off"]'::jsonb,
  internal_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_chase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_due',
  chase_stage TEXT NOT NULL DEFAULT 'none',
  assigned_to UUID,
  last_reminder_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  reminders_sent INT NOT NULL DEFAULT 0,
  rule_id UUID,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invoice_id)
);

CREATE TABLE public.tbl_collection_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chase_item_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  template_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  chase_item_id UUID,
  customer_name TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  days_overdue INT NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'finance_officer',
  reason TEXT NOT NULL DEFAULT '',
  assigned_to UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_payment_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  chase_item_id UUID,
  customer_name TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  promised_date DATE NOT NULL,
  amount_promised NUMERIC NOT NULL DEFAULT 0,
  reminder_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  chase_item_id UUID,
  customer_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  raised_by UUID,
  raised_by_name TEXT NOT NULL DEFAULT '',
  assigned_to UUID,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tbl_collection_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  invoice_id UUID,
  chase_item_id UUID,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  actor_id UUID,
  actor_name TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_chase_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_escalations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_payment_promises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_disputes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_collection_activity_logs TO authenticated;
GRANT ALL ON public.tbl_collection_settings TO service_role;
GRANT ALL ON public.tbl_collection_rules TO service_role;
GRANT ALL ON public.tbl_collection_email_templates TO service_role;
GRANT ALL ON public.tbl_collection_chase_items TO service_role;
GRANT ALL ON public.tbl_collection_reminders TO service_role;
GRANT ALL ON public.tbl_collection_escalations TO service_role;
GRANT ALL ON public.tbl_collection_payment_promises TO service_role;
GRANT ALL ON public.tbl_collection_disputes TO service_role;
GRANT ALL ON public.tbl_collection_activity_logs TO service_role;

-- RLS
ALTER TABLE public.tbl_collection_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_chase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_payment_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_collection_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies: reuse 'invoices' module access. All authenticated can view; edit access can write; admin can delete.
-- Settings (per-user)
CREATE POLICY "users manage own settings" ON public.tbl_collection_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper macro pattern via individual policies per table:
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tbl_collection_rules','tbl_collection_email_templates','tbl_collection_chase_items',
    'tbl_collection_reminders','tbl_collection_escalations','tbl_collection_payment_promises',
    'tbl_collection_disputes','tbl_collection_activity_logs'
  ]) LOOP
    EXECUTE format('CREATE POLICY "all auth can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "edit can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (has_module_access(auth.uid(), ''invoices''::app_module, ''edit''::access_level))', t);
    EXECUTE format('CREATE POLICY "edit can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (has_module_access(auth.uid(), ''invoices''::app_module, ''edit''::access_level))', t);
    EXECUTE format('CREATE POLICY "admin can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (has_module_access(auth.uid(), ''invoices''::app_module, ''admin''::access_level))', t);
  END LOOP;
END $$;

-- Triggers for updated_at
CREATE TRIGGER trg_collection_settings_updated BEFORE UPDATE ON public.tbl_collection_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_collection_rules_updated BEFORE UPDATE ON public.tbl_collection_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_collection_templates_updated BEFORE UPDATE ON public.tbl_collection_email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_collection_chase_updated BEFORE UPDATE ON public.tbl_collection_chase_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_collection_esc_updated BEFORE UPDATE ON public.tbl_collection_escalations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_collection_promises_updated BEFORE UPDATE ON public.tbl_collection_payment_promises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_collection_disputes_updated BEFORE UPDATE ON public.tbl_collection_disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_chase_invoice ON public.tbl_collection_chase_items(invoice_id);
CREATE INDEX idx_chase_status ON public.tbl_collection_chase_items(status);
CREATE INDEX idx_reminders_invoice ON public.tbl_collection_reminders(invoice_id);
CREATE INDEX idx_escalations_invoice ON public.tbl_collection_escalations(invoice_id);
CREATE INDEX idx_promises_invoice ON public.tbl_collection_payment_promises(invoice_id);
CREATE INDEX idx_disputes_invoice ON public.tbl_collection_disputes(invoice_id);
CREATE INDEX idx_activity_invoice ON public.tbl_collection_activity_logs(invoice_id);


-- ============================================================================
-- Migration: 20260602012622_email_infra.sql
-- ============================================================================

-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');


-- ============================================================================
-- Migration: 20260602012905_901c1d81-9040-440c-bda3-703662a7c39f.sql
-- ============================================================================

ALTER TABLE public.tbl_collection_reminders
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tbl_collection_reminders_chase_item
  ON public.tbl_collection_reminders(chase_item_id);
CREATE INDEX IF NOT EXISTS idx_tbl_collection_reminders_message_id
  ON public.tbl_collection_reminders(message_id);

-- ============================================================================
-- Migration: 20260620151552_452c090a-962b-4f50-9042-247ecfa45306.sql
-- ============================================================================


-- Recreate trigger so handle_new_user runs on every signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profile + roles for any auth user without a profile
INSERT INTO public.tbl_profiles (user_id, full_name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', ''),
       u.email
FROM auth.users u
LEFT JOIN public.tbl_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

INSERT INTO public.tbl_user_roles (user_id, module, access)
SELECT u.id, m.module, 'view'::access_level
FROM auth.users u
CROSS JOIN (VALUES
  ('invoices'::app_module),
  ('transactions'::app_module),
  ('pnl'::app_module),
  ('vat'::app_module),
  ('paye'::app_module),
  ('reports'::app_module),
  ('users'::app_module)
) AS m(module)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tbl_user_roles r
  WHERE r.user_id = u.id AND r.module = m.module
)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Migration: 20260620152549_182e7961-c1d7-4e3c-8102-943a80e167d1.sql
-- ============================================================================

ALTER TABLE public.tbl_invoices ADD COLUMN discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

COMMENT ON COLUMN public.tbl_invoices.discount_percentage IS 'Percentage discount applied to the invoice subtotal (0-100)';


-- ============================================================================
-- Migration: 20260717222018_4e848571-5597-48b8-bfe2-8fc117e1524a.sql
-- ============================================================================


-- Add approval status to profiles
ALTER TABLE public.tbl_profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Existing users become approved so nobody gets locked out
UPDATE public.tbl_profiles SET approval_status = 'approved', approved_at = COALESCE(approved_at, now()) WHERE approval_status = 'pending';

-- Update handle_new_user: first user auto-approved+admin, others pending with view-only defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.tbl_profiles;

  INSERT INTO public.tbl_profiles (user_id, full_name, email, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    CASE WHEN user_count = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN user_count = 0 THEN now() ELSE NULL END
  );

  IF user_count = 0 THEN
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'admin'),
      (NEW.id, 'transactions', 'admin'),
      (NEW.id, 'pnl', 'admin'),
      (NEW.id, 'vat', 'admin'),
      (NEW.id, 'paye', 'admin'),
      (NEW.id, 'reports', 'admin'),
      (NEW.id, 'users', 'admin');
  ELSE
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'view'),
      (NEW.id, 'transactions', 'view'),
      (NEW.id, 'pnl', 'view'),
      (NEW.id, 'vat', 'view'),
      (NEW.id, 'paye', 'view'),
      (NEW.id, 'reports', 'view'),
      (NEW.id, 'users', 'none');
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================================
-- Migration: 20260717222624_d1b81ce6-6cdb-4c0f-a05f-7c9fed964b55.sql
-- ============================================================================

ALTER TABLE public.tbl_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- Migration: 20260717222738_f2b27ee7-6113-446b-95a1-f13bf2987240.sql
-- ============================================================================


CREATE TABLE public.tbl_user_approval_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.tbl_user_approval_audit TO authenticated;
GRANT ALL ON public.tbl_user_approval_audit TO service_role;

ALTER TABLE public.tbl_user_approval_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users admins can view approval audit"
  ON public.tbl_user_approval_audit
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'users', 'admin'));

CREATE POLICY "Users admins can insert approval audit"
  ON public.tbl_user_approval_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_module_access(auth.uid(), 'users', 'admin')
    AND actor_user_id = auth.uid()
  );

CREATE INDEX idx_user_approval_audit_target ON public.tbl_user_approval_audit(target_user_id, created_at DESC);


-- ============================================================================
-- Migration: 20260718025112_2aac9b2d-2467-423d-8ffc-baa6233667cd.sql
-- ============================================================================

ALTER TABLE public.tbl_profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tbl_profiles;

-- ============================================================================
-- Migration: 20260718030000_fbe20923-a14c-41a5-a597-85c30ff540ff.sql
-- ============================================================================

-- Admins can approve/reject other users' sign-ups, change their session
-- timeout, and toggle their approver status. Without this policy, only the
-- row owner could UPDATE tbl_profiles (see "Users can update own profile"),
-- so an admin's UPDATE against another user's row silently matched zero
-- rows (no RLS error is raised) -- e.g. the "Approve" button on the pending
-- sign-up queue in User Management appeared to succeed (toast + audit log
-- entry) but never actually changed approval_status, leaving the user stuck
-- pending. The same gap silently no-op'd updateTimeout/updateApprover for
-- other users too.
CREATE POLICY "Admins can update all profiles"
  ON public.tbl_profiles
  FOR UPDATE
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));


-- ============================================================================
-- Migration: 20260718032036_34e9ce84-5985-400f-8b2d-ad463144b400.sql
-- ============================================================================

CREATE POLICY "Admins can update all profiles"
  ON public.tbl_profiles
  FOR UPDATE
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

-- ============================================================================
-- Migration: 20260718103819_d792841a-31b9-4fb3-8ee0-cbe3cdf38b42.sql
-- ============================================================================


-- =========================================================
-- 1. Replace overly-permissive SELECT policies (USING true)
-- =========================================================

-- tbl_invoices
DROP POLICY IF EXISTS "All authenticated can view invoices" ON public.tbl_invoices;
CREATE POLICY "Invoice module viewers can view invoices"
  ON public.tbl_invoices FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'invoices', 'view')
    OR user_id = auth.uid()
    OR approver1_id = auth.uid()
    OR approver2_id = auth.uid()
  );

-- tbl_transactions
DROP POLICY IF EXISTS "All authenticated can view transactions" ON public.tbl_transactions;
CREATE POLICY "Transaction module viewers can view transactions"
  ON public.tbl_transactions FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'transactions', 'view')
    OR user_id = auth.uid()
    OR approver1_id = auth.uid()
    OR approver2_id = auth.uid()
  );

-- tbl_paye_employees
DROP POLICY IF EXISTS "All authenticated can view paye employees" ON public.tbl_paye_employees;
CREATE POLICY "PAYE module viewers can view employees"
  ON public.tbl_paye_employees FOR SELECT TO authenticated
  USING (
    public.has_module_access(auth.uid(), 'paye', 'view')
    OR user_id = auth.uid()
  );

-- Collection tables (all invoice-scoped)
DROP POLICY IF EXISTS "all auth can view tbl_collection_activity_logs" ON public.tbl_collection_activity_logs;
CREATE POLICY "invoice viewers can view collection activity logs"
  ON public.tbl_collection_activity_logs FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_chase_items" ON public.tbl_collection_chase_items;
CREATE POLICY "invoice viewers can view collection chase items"
  ON public.tbl_collection_chase_items FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_disputes" ON public.tbl_collection_disputes;
CREATE POLICY "invoice viewers can view collection disputes"
  ON public.tbl_collection_disputes FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_email_templates" ON public.tbl_collection_email_templates;
CREATE POLICY "invoice viewers can view collection email templates"
  ON public.tbl_collection_email_templates FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_escalations" ON public.tbl_collection_escalations;
CREATE POLICY "invoice viewers can view collection escalations"
  ON public.tbl_collection_escalations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_payment_promises" ON public.tbl_collection_payment_promises;
CREATE POLICY "invoice viewers can view collection payment promises"
  ON public.tbl_collection_payment_promises FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_reminders" ON public.tbl_collection_reminders;
CREATE POLICY "invoice viewers can view collection reminders"
  ON public.tbl_collection_reminders FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

DROP POLICY IF EXISTS "all auth can view tbl_collection_rules" ON public.tbl_collection_rules;
CREATE POLICY "invoice viewers can view collection rules"
  ON public.tbl_collection_rules FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'invoices', 'view') OR user_id = auth.uid());

-- =========================================================
-- 2. tbl_notifications: prevent spoofed inserts
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.tbl_notifications;
CREATE POLICY "Users can create notifications for self or approvers"
  ON public.tbl_notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tbl_profiles p
        WHERE p.user_id = tbl_notifications.user_id
          AND p.is_approver = true
      )
    )
  );

-- =========================================================
-- 3. Storage: signatures bucket - stop broad listing
-- =========================================================
DROP POLICY IF EXISTS "Signatures are publicly accessible" ON storage.objects;
CREATE POLICY "Users can list own signature files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================================================
-- 4. Storage: transaction-attachments - scope to owner folder
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload transaction attachments" ON storage.objects;

CREATE POLICY "Users read own transaction attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_module_access(auth.uid(), 'transactions', 'admin')
    )
  );

CREATE POLICY "Users upload own transaction attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transaction-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own transaction attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transaction-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_module_access(auth.uid(), 'transactions', 'admin')
    )
  );

-- =========================================================
-- 5. SECURITY DEFINER functions: fix search_path + revoke public execute
-- =========================================================

-- Add fixed search_path to functions missing it
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- Revoke execute from anon/authenticated for functions that must not be publicly callable.
-- Keep public.has_module_access and public.is_user_admin executable by authenticated
-- (they are invoked from RLS policies and must run as the calling role).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_user_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, app_module, access_level) FROM anon, PUBLIC;


-- ============================================================================
-- Migration: 20260718110233_436c16a0-5f08-4077-99c2-49a52cecca48.sql
-- ============================================================================


CREATE TABLE public.tbl_password_reset_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwreset_email_time ON public.tbl_password_reset_attempts (lower(email), attempted_at DESC);
CREATE INDEX idx_pwreset_ip_time ON public.tbl_password_reset_attempts (ip, attempted_at DESC);

GRANT ALL ON public.tbl_password_reset_attempts TO service_role;

ALTER TABLE public.tbl_password_reset_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.tbl_password_reset_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- Migration: 20260718111512_205c3400-4029-4ef6-b1d2-76a8025c9631.sql
-- ============================================================================


-- tbl_profiles: re-scope to authenticated
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.tbl_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.tbl_profiles;

CREATE POLICY "Admins can update all profiles" ON public.tbl_profiles
  FOR UPDATE TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Admins can view all profiles" ON public.tbl_profiles
  FOR SELECT TO authenticated
  USING (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can insert own profile" ON public.tbl_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.tbl_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON public.tbl_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- tbl_user_roles: re-scope to authenticated
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.tbl_user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.tbl_user_roles;

CREATE POLICY "Admins can manage all roles" ON public.tbl_user_roles
  FOR ALL TO authenticated
  USING (public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_user_admin(auth.uid()));

CREATE POLICY "Users can view own roles" ON public.tbl_user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- tbl_notifications: re-scope to authenticated
DROP POLICY IF EXISTS "Users can update own notifications" ON public.tbl_notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.tbl_notifications;

CREATE POLICY "Users can update own notifications" ON public.tbl_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.tbl_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Email/service tables: re-scope service_role policies from public to service_role
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('email_send_log','email_send_state','suppressed_emails','email_unsubscribe_tokens')
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Signatures bucket: restrict RLS so users read only their own signature; admins can read all
DROP POLICY IF EXISTS "Users can view own signatures" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own signature" ON storage.objects;

CREATE POLICY "Users can view own signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND public.is_user_admin(auth.uid()));

CREATE POLICY "Users can upload own signature" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own signature" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own signature" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Revoke EXECUTE on SECURITY DEFINER functions that should only run from triggers/cron
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- Migration: 20260718111959_d1035e0c-ebb1-44de-85a5-e578060c7370.sql
-- ============================================================================

-- Convert helper role-check functions to SECURITY INVOKER so signed-in users
-- no longer execute a SECURITY DEFINER function. They only read the caller's
-- own rows from tbl_user_roles, which the "select own roles" RLS policy already
-- permits under invoker rights.

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module app_module, _min_access access_level)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = _user_id
      AND module = _module
      AND CASE
        WHEN _min_access = 'view' THEN access IN ('view', 'edit', 'admin')
        WHEN _min_access = 'edit' THEN access IN ('edit', 'admin')
        WHEN _min_access = 'admin' THEN access = 'admin'
        ELSE true
      END
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_user_roles
    WHERE user_id = _user_id
      AND module = 'users'
      AND access = 'admin'
  )
$function$;

-- ============================================================================
-- Migration: 20260718113105_7d70ae01-cc40-40a4-bb53-fddb6273be73.sql
-- ============================================================================


CREATE TABLE public.tbl_recurring_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('inflow','outflow')),
  category text NOT NULL DEFAULT 'Uncategorized',
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_run_date date NOT NULL,
  end_date date,
  last_run_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_recurring_transactions TO authenticated;
GRANT ALL ON public.tbl_recurring_transactions TO service_role;

ALTER TABLE public.tbl_recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recurring transactions"
  ON public.tbl_recurring_transactions FOR SELECT TO authenticated
  USING (has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

CREATE POLICY "Insert recurring transactions"
  ON public.tbl_recurring_transactions FOR INSERT TO authenticated
  WITH CHECK (has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) AND user_id = auth.uid());

CREATE POLICY "Update recurring transactions"
  ON public.tbl_recurring_transactions FOR UPDATE TO authenticated
  USING (has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

CREATE POLICY "Delete recurring transactions"
  ON public.tbl_recurring_transactions FOR DELETE TO authenticated
  USING (has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());

CREATE TRIGGER update_recurring_transactions_updated_at
  BEFORE UPDATE ON public.tbl_recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- Migration: 20260718113949_4a92bf44-df9b-46ce-9d88-4dadf060c744.sql
-- ============================================================================

ALTER TABLE public.tbl_transactions ADD COLUMN IF NOT EXISTS recurring_transaction_id UUID REFERENCES public.tbl_recurring_transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tbl_transactions_recurring_id ON public.tbl_transactions(recurring_transaction_id);

-- ============================================================================
-- Migration: 20260718114151_902c6eb8-363f-4014-9b76-d22c0f377fce.sql
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tbl_transactions_recurring_date
  ON public.tbl_transactions (recurring_transaction_id, date)
  WHERE recurring_transaction_id IS NOT NULL;

-- ============================================================================
-- Migration: 20260718114246_6f45c562-8e6b-4b0a-bc5c-b8f257486104.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tbl_recurring_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  processed INT NOT NULL DEFAULT 0,
  created INT NOT NULL DEFAULT 0,
  error TEXT
);

GRANT SELECT ON public.tbl_recurring_run_log TO authenticated;
GRANT ALL ON public.tbl_recurring_run_log TO service_role;

ALTER TABLE public.tbl_recurring_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recurring run log"
  ON public.tbl_recurring_run_log
  FOR SELECT
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions', 'admin'));

CREATE INDEX IF NOT EXISTS idx_recurring_run_log_run_at ON public.tbl_recurring_run_log(run_at DESC);

-- ============================================================================
-- Migration: 20260718114856_184e4f54-e1ea-4fcb-a367-7fe21cec04f3.sql
-- ============================================================================

CREATE TABLE public.tbl_recurring_run_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_log_id UUID NOT NULL REFERENCES public.tbl_recurring_run_log(id) ON DELETE CASCADE,
  recurring_transaction_id UUID NOT NULL REFERENCES public.tbl_recurring_transactions(id) ON DELETE CASCADE,
  created_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_recurring_run_details TO authenticated;
GRANT ALL ON public.tbl_recurring_run_details TO service_role;

ALTER TABLE public.tbl_recurring_run_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recurring run details"
ON public.tbl_recurring_run_details
FOR SELECT
TO authenticated
USING (public.has_module_access(auth.uid(), 'transactions'::public.app_module, 'admin'::public.access_level));

-- ============================================================================
-- Migration: 20260718115636_1591abf6-bf40-442c-a416-761c8c2bac8c.sql
-- ============================================================================


CREATE TABLE public.tbl_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'customer' CHECK (org_type IN ('customer','vendor','both')),
  email TEXT,
  phone TEXT,
  address TEXT,
  vat_number TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tbl_organizations TO authenticated;
GRANT ALL ON public.tbl_organizations TO service_role;

ALTER TABLE public.tbl_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own organizations"
  ON public.tbl_organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_tbl_organizations_updated_at
  BEFORE UPDATE ON public.tbl_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tbl_organizations_user ON public.tbl_organizations(user_id) WHERE deleted_at IS NULL;


-- ============================================================================
-- Migration: 20260718115847_b017a3b8-8218-4cc6-ad86-7afa848a2fc3.sql
-- ============================================================================


ALTER TABLE public.tbl_transactions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.tbl_organizations(id) ON DELETE SET NULL;

ALTER TABLE public.tbl_recurring_transactions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.tbl_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tbl_transactions_organization_id ON public.tbl_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tbl_recurring_transactions_organization_id ON public.tbl_recurring_transactions(organization_id);


-- ============================================================================
-- Migration: 20260718134402_3b0a6a4e-416d-4777-8fd4-e4a64d986d48.sql
-- ============================================================================

ALTER TABLE public.tbl_organizations ADD COLUMN IF NOT EXISTS nature_of_business text;

-- ============================================================================
-- Migration: 20260718150000_de7ce4ad-fde9-4624-a1ee-0629754c378d.sql
-- ============================================================================

-- tbl_organizations had no admin/module-access bypass on SELECT/UPDATE/DELETE
-- (only "auth.uid() = user_id"), so each user could only ever see/edit/delete
-- organizations they personally created -- a teammate got an empty or
-- partial customer/vendor list and would duplicate records without knowing
-- why. Only tbl_transactions and tbl_recurring_transactions reference
-- organization_id (both under the 'transactions' module; tbl_invoices does
-- not), so 'transactions' is the correct anchor module. Mirrors the exact
-- pattern already used for tbl_recurring_transactions, which references the
-- same tbl_organizations rows. INSERT is left as owner-only: creating a row
-- always sets your own user_id, so there's no "can't see a teammate's data"
-- problem on insert the way there is for the other three operations.

DROP POLICY IF EXISTS "Users view own organizations" ON public.tbl_organizations;
CREATE POLICY "View organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own organizations" ON public.tbl_organizations;
CREATE POLICY "Update organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own organizations" ON public.tbl_organizations;
CREATE POLICY "Delete organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());


-- ============================================================================
-- Migration: 20260718184956_4f914275-0b3d-46e9-81a9-ed64b444ba0c.sql
-- ============================================================================

-- Fix pending_user_data_access: new signups get 'none' access until approved.
-- On approval, grant default 'view' roles (unless already customized).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.tbl_profiles;

  INSERT INTO public.tbl_profiles (user_id, full_name, email, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    CASE WHEN user_count = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN user_count = 0 THEN now() ELSE NULL END
  );

  IF user_count = 0 THEN
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'admin'),
      (NEW.id, 'transactions', 'admin'),
      (NEW.id, 'pnl', 'admin'),
      (NEW.id, 'vat', 'admin'),
      (NEW.id, 'paye', 'admin'),
      (NEW.id, 'reports', 'admin'),
      (NEW.id, 'users', 'admin');
  ELSE
    -- Pending users get NO data access until an admin approves them.
    INSERT INTO public.tbl_user_roles (user_id, module, access)
    VALUES
      (NEW.id, 'invoices', 'none'),
      (NEW.id, 'transactions', 'none'),
      (NEW.id, 'pnl', 'none'),
      (NEW.id, 'vat', 'none'),
      (NEW.id, 'paye', 'none'),
      (NEW.id, 'reports', 'none'),
      (NEW.id, 'users', 'none');
  END IF;

  RETURN NEW;
END;
$function$;

-- On approval transition, grant default 'view' access to any modules still at 'none'.
CREATE OR REPLACE FUNCTION public.grant_default_roles_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.approval_status = 'approved'
     AND (OLD.approval_status IS DISTINCT FROM 'approved') THEN
    UPDATE public.tbl_user_roles
       SET access = 'view'
     WHERE user_id = NEW.user_id
       AND module IN ('invoices','transactions','pnl','vat','paye','reports')
       AND access = 'none';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_default_roles_on_approval ON public.tbl_profiles;
CREATE TRIGGER trg_grant_default_roles_on_approval
AFTER UPDATE OF approval_status ON public.tbl_profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_default_roles_on_approval();

-- Add approval gate helper used to harden RLS on sensitive tables.
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tbl_profiles
    WHERE user_id = _user_id AND approval_status = 'approved'
  )
$$;

-- Belt-and-braces: revoke any 'view'+ access currently held by pending/rejected users
-- so previously-signed-up accounts also lose direct API access until approved.
UPDATE public.tbl_user_roles ur
   SET access = 'none'
  FROM public.tbl_profiles p
 WHERE ur.user_id = p.user_id
   AND p.approval_status <> 'approved'
   AND ur.module IN ('invoices','transactions','pnl','vat','paye','reports','users')
   AND ur.access <> 'none';


-- ============================================================================
-- Migration: 20260718193859_add_pension_contributions_to_paye.sql
-- ============================================================================

ALTER TABLE public.tbl_paye_employees
  ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill existing rows so pension figures and net_pay reflect the new
-- formula immediately, rather than staying at 0 / the old net_pay until
-- each employee is next edited. Mirrors calcUKDeductions in src/pages/PAYE.tsx:
-- qualifying earnings are gross_annual clamped to the 6,240-50,270 band,
-- employee 5% / employer 3%, divided by 12 for the monthly figures shown.
UPDATE public.tbl_paye_employees
SET
  pension_employee = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.05 / 12)::numeric, 2),
  pension_employer = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.03 / 12)::numeric, 2);

UPDATE public.tbl_paye_employees
SET net_pay = ROUND((gross_pay - tax - ni - pension_employee)::numeric, 2);


-- ============================================================================
-- Migration: 20260718214920_fix_read_email_batch_enqueued_at.sql
-- ============================================================================

-- read_email_batch dropped pgmq's enqueued_at column, but process-email-queue
-- relies on msg.enqueued_at as its TTL fallback whenever a message's own JSON
-- payload lacks queued_at ("PGMQ's enqueued_at which is always set by the
-- queue"). Since the RPC never returned that column, the fallback was always
-- undefined and TTL expiry silently never triggered via that path. Not
-- currently exploitable (today's only producer, send-transactional-email,
-- always sets queued_at), but a real latent gap for any other producer.
-- CREATE OR REPLACE can't change a function's return column list, so this
-- drops and recreates it.

DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT);

CREATE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB, enqueued_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message, r.enqueued_at FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;


-- ============================================================================
-- Migration: 20260720232039_5eaace80-3e56-46ed-99cc-a9e7f707c465.sql
-- ============================================================================

-- Consolidated pending migrations

DROP POLICY IF EXISTS "Users view own organizations" ON public.tbl_organizations;
CREATE POLICY "View organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own organizations" ON public.tbl_organizations;
CREATE POLICY "Update organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own organizations" ON public.tbl_organizations;
CREATE POLICY "Delete organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());

ALTER TABLE public.tbl_paye_employees
  ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.tbl_paye_employees
SET
  pension_employee = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.05 / 12)::numeric, 2),
  pension_employer = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.03 / 12)::numeric, 2);

UPDATE public.tbl_paye_employees
SET net_pay = ROUND((gross_pay - tax - ni - pension_employee)::numeric, 2);

DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT);

CREATE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB, enqueued_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message, r.enqueued_at FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

-- ============================================================================
-- Migration: 20260720232627_db0b236c-a6bc-4606-8851-a04f7afa3c89.sql
-- ============================================================================


-- 1) Gate has_module_access and is_user_admin on approval_status = 'approved'
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module app_module, _min_access access_level)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tbl_user_roles ur
    JOIN public.tbl_profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.module = _module
      AND p.approval_status = 'approved'
      AND CASE
        WHEN _min_access = 'view' THEN ur.access IN ('view', 'edit', 'admin')
        WHEN _min_access = 'edit' THEN ur.access IN ('edit', 'admin')
        WHEN _min_access = 'admin' THEN ur.access = 'admin'
        ELSE true
      END
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tbl_user_roles ur
    JOIN public.tbl_profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.module = 'users'
      AND ur.access = 'admin'
      AND p.approval_status = 'approved'
  )
$function$;

-- 2) Add INSERT/UPDATE policies for tbl_recurring_run_log so the record is explicit.
--    Writes happen from the edge function (service_role, bypasses RLS). Deny by default
--    for authenticated users by not granting any policy — but the linter wants an
--    explicit stance. Add a restrictive policy that always denies non-admin writes
--    and allows admin writes for completeness / manual admin correction.
DROP POLICY IF EXISTS "Transaction admins can insert run logs" ON public.tbl_recurring_run_log;
CREATE POLICY "Transaction admins can insert run logs"
  ON public.tbl_recurring_run_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level));

DROP POLICY IF EXISTS "Transaction admins can update run logs" ON public.tbl_recurring_run_log;
CREATE POLICY "Transaction admins can update run logs"
  ON public.tbl_recurring_run_log
  FOR UPDATE
  TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level))
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level));

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC/anon/authenticated.
--    These are called only from triggers or from edge functions via service_role.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_roles_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_user_approved(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_approved(uuid) TO service_role;


-- ============================================================================
-- Migration: 20260721000737_consolidated_pending_migrations.sql
-- ============================================================================

-- Consolidated script combining three migrations that were authored via
-- Claude Code (no direct Supabase connection from that session) and were
-- never applied to the live database. Run this once via Lovable (or the
-- Supabase Studio SQL Editor) to bring production in line with the
-- individual migration files already committed to this repo:
--   - 20260718150000_de7ce4ad-fde9-4624-a1ee-0629754c378d.sql
--   - 20260718193859_add_pension_contributions_to_paye.sql
--   - 20260718214920_fix_read_email_batch_enqueued_at.sql
-- Everything below is idempotent (IF NOT EXISTS / DROP ... IF EXISTS /
-- CREATE OR REPLACE-style guards), so it's safe to run even if one or two
-- of the three have already been applied by some other means.

-- ============================================================
-- 1. tbl_organizations RLS fix
-- Previously scoped to "auth.uid() = user_id" only on SELECT/UPDATE/DELETE,
-- so each user could only ever see/edit/delete organizations they personally
-- created -- a teammate got an empty or partial customer/vendor list and
-- would duplicate records without knowing why. Mirrors the pattern already
-- used for tbl_recurring_transactions, which references the same rows.
-- INSERT stays owner-only: creating a row always sets your own user_id.
-- ============================================================

DROP POLICY IF EXISTS "Users view own organizations" ON public.tbl_organizations;
CREATE POLICY "View organizations"
  ON public.tbl_organizations FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'view'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own organizations" ON public.tbl_organizations;
CREATE POLICY "Update organizations"
  ON public.tbl_organizations FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid())
  WITH CHECK (public.has_module_access(auth.uid(), 'transactions'::app_module, 'edit'::access_level) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own organizations" ON public.tbl_organizations;
CREATE POLICY "Delete organizations"
  ON public.tbl_organizations FOR DELETE TO authenticated
  USING (public.has_module_access(auth.uid(), 'transactions'::app_module, 'admin'::access_level) OR user_id = auth.uid());

-- ============================================================
-- 2. PAYE pension columns + backfill
-- Adds employee/employer pension contribution columns and backfills
-- existing employee rows so their pension figures and net_pay reflect the
-- standard UK auto-enrolment formula (5% employee / 3% employer on
-- qualifying earnings, £6,240-£50,270 band) immediately, rather than only
-- after each employee's next edit. Mirrors calcUKDeductions in
-- src/pages/PAYE.tsx.
-- ============================================================

ALTER TABLE public.tbl_paye_employees
  ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE public.tbl_paye_employees
SET
  pension_employee = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.05 / 12)::numeric, 2),
  pension_employer = ROUND((GREATEST(0, LEAST(gross_annual, 50270) - 6240) * 0.03 / 12)::numeric, 2);

UPDATE public.tbl_paye_employees
SET net_pay = ROUND((gross_pay - tax - ni - pension_employee)::numeric, 2);

-- ============================================================
-- 3. read_email_batch RPC fix
-- The RPC wrapper dropped pgmq's enqueued_at column, but
-- process-email-queue relies on msg.enqueued_at as its TTL fallback
-- whenever a queued message's own JSON payload lacks queued_at ("PGMQ's
-- enqueued_at which is always set by the queue"). CREATE OR REPLACE can't
-- change a function's return column list, so this drops and recreates it.
-- ============================================================

DROP FUNCTION IF EXISTS public.read_email_batch(TEXT, INT, INT);

CREATE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB, enqueued_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message, r.enqueued_at FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;


-- ============================================================================
-- Migration: 20260721004806_widen_user_approval_audit_actions.sql
-- ============================================================================

-- tbl_user_approval_audit's action column only allowed 'approved'/'rejected'.
-- The new delete-user edge function needs to log its two possible outcomes
-- ('deleted' when a user has no linked financial records and their auth
-- record is fully removed, 'anonymized' when they do and only their
-- identifying details are scrubbed) into this same admin-actions audit
-- trail, rather than inventing a second table for it.

ALTER TABLE public.tbl_user_approval_audit DROP CONSTRAINT IF EXISTS tbl_user_approval_audit_action_check;
ALTER TABLE public.tbl_user_approval_audit ADD CONSTRAINT tbl_user_approval_audit_action_check
  CHECK (action IN ('approved', 'rejected', 'deleted', 'anonymized'));


-- ============================================================================
-- Migration: 20260721070732_schedule_recurring_transactions_cron.sql
-- ============================================================================

-- SUPERSEDED: a second migration (20260721071210_e06a5b6d-...sql, applied
-- ~13 minutes after this one) scheduled the same job name with different
-- parameters (02:15 UTC, 'email_queue_service_role_key'). Since cron.schedule
-- upserts by job name and migrations apply in filename order, that one is
-- what's actually live in production -- this migration's schedule was
-- immediately overwritten, and the "REQUIRED MANUAL STEP" below was never
-- acted on and is moot. See 20260721112545_consolidate_recurring_transactions_cron.sql
-- for the current, accurate state. Left as-is (not rewritten) since it
-- already executed in production; this note is just for future readers.
--
-- Recurring transactions were never actually processed automatically: the
-- process-recurring-transactions edge function supports being triggered by a
-- cron job (it accepts the service-role key as an alternative to a user
-- session, see its own auth-guard comment), but no such job was ever created.
-- The only real caller in the app is the manual "Run now" button in
-- RecurringTransactionsTab.tsx. This adds the missing daily trigger, using
-- the same pg_cron + pg_net + supabase_vault pattern already proven by the
-- process-email-queue job (20260602012622_email_infra.sql).
--
-- pg_net / pg_cron / supabase_vault are already enabled by
-- 20260602012622_email_infra.sql, so they are not re-created here.
--
-- REQUIRED MANUAL STEP (not committed here, since it's a live secret):
-- before this job can succeed, run once in the Supabase SQL editor:
--   select vault.create_secret(
--     '<your service_role key from Project Settings > API>',
--     'recurring_transactions_service_role_key',
--     'Service role key used by the process-recurring-transactions cron trigger'
--   );
-- To revert this migration's schedule: select cron.unschedule('process-recurring-transactions-daily');

DO $$
BEGIN
  PERFORM cron.unschedule('process-recurring-transactions-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet, nothing to remove
END $$;

SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 1 * * *', -- 01:15 UTC daily, after midnight has rolled over everywhere the app is used
  $$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'recurring_transactions_service_role_key'
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);


-- ============================================================================
-- Migration: 20260721071210_e06a5b6d-af88-480d-9f20-3387a42fd8e9.sql
-- ============================================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-recurring-transactions-daily') THEN
    PERFORM cron.unschedule('process-recurring-transactions-daily');
  END IF;
END $$;

-- Schedule the recurring transactions processor daily at 02:15 UTC
SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $cron$
);

-- ============================================================================
-- Migration: 20260721112545_consolidate_recurring_transactions_cron.sql
-- ============================================================================

-- Two migrations both scheduled a 'process-recurring-transactions-daily'
-- pg_cron job within seconds of each other on 2026-07-21:
--   20260721070732_schedule_recurring_transactions_cron.sql (this session,
--     01:15 UTC, expected a dedicated 'recurring_transactions_service_role_key'
--     vault secret that was never actually created)
--   20260721071210_e06a5b6d-....sql (Lovable, 02:15 UTC, reuses the existing
--     'email_queue_service_role_key' vault secret from the email-queue cron job)
-- Since pg_cron's cron.schedule upserts by job name and migrations apply in
-- filename order, the second (Lovable's) migration is what actually ended up
-- live in production -- the first migration's manual "create this vault
-- secret" instructions were never acted on and are moot.
--
-- This migration is the single source of truth going forward: it re-applies
-- the working configuration (Lovable's schedule/secret) explicitly, so
-- there's no ambiguity for anyone reading the migrations folder about which
-- of the two prior migrations reflects reality. No new manual step is
-- required -- 'email_queue_service_role_key' already exists and is already
-- proven to work (it's what powers the working transactional-email cron job).
-- To revert: select cron.unschedule('process-recurring-transactions-daily');

DO $$
BEGIN
  PERFORM cron.unschedule('process-recurring-transactions-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *', -- 02:15 UTC daily
  $$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $$
);


-- ============================================================================
-- Migration: 20260721145850_add_transaction_vat_treatment.sql
-- ============================================================================

-- H-2: VAT calculation applied a flat 20% to every transaction with no way
-- to mark a transaction zero-rated, exempt, or outside the scope of VAT.
-- Adds a per-transaction VAT treatment so output/input VAT can be computed
-- only on standard-rated amounts. Defaults to 'standard' so existing rows
-- keep their current (20%-on-everything) VAT treatment unchanged.
ALTER TABLE public.tbl_transactions
  ADD COLUMN vat_treatment TEXT NOT NULL DEFAULT 'standard'
    CHECK (vat_treatment IN ('standard', 'zero_rated', 'exempt', 'out_of_scope'));


-- ============================================================================
-- Migration: 20260721234343_prevent_self_approval.sql
-- ============================================================================

-- M-10: the transaction/invoice creator could not select themselves as an
-- approver via the app's own UI (ApproverSelect.tsx already excludes the
-- current user from both dropdowns), but nothing enforced this server-side
-- -- a direct API call could still set approver1_id/approver2_id to the
-- creator's own user_id, defeating the two-approver maker-checker control
-- entirely. Adds a CHECK constraint so this is enforced regardless of caller.
--
-- NOT VALID skips validating existing rows (some may already violate this
-- from before the client-side guard existed) so the migration can't fail on
-- historical data; it still applies to every new insert/update from here on.
-- Existing rows can be validated and cleaned up separately with
-- ALTER TABLE ... VALIDATE CONSTRAINT once confirmed clean.
ALTER TABLE public.tbl_transactions
  ADD CONSTRAINT tbl_transactions_approver_not_creator
  CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
  NOT VALID;

ALTER TABLE public.tbl_invoices
  ADD CONSTRAINT tbl_invoices_approver_not_creator
  CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
  NOT VALID;


-- ============================================================================
-- Migration: 20260722001825_5c142717-5f0f-405a-979c-09755d125e75.sql
-- ============================================================================

-- 1) REQUIRED NOW -- transaction save is broken without this column.
ALTER TABLE public.tbl_transactions
  ADD COLUMN IF NOT EXISTS vat_treatment TEXT NOT NULL DEFAULT 'standard'
    CHECK (vat_treatment IN ('standard', 'zero_rated', 'exempt', 'out_of_scope'));

-- 2) Closes a maker-checker gap (self-approval). Safe even if already applied.
DO $$
BEGIN
  ALTER TABLE public.tbl_transactions
    ADD CONSTRAINT tbl_transactions_approver_not_creator
    CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'tbl_transactions_approver_not_creator already exists, skipping';
END $$;

DO $$
BEGIN
  ALTER TABLE public.tbl_invoices
    ADD CONSTRAINT tbl_invoices_approver_not_creator
    CHECK (approver1_id IS DISTINCT FROM user_id AND approver2_id IS DISTINCT FROM user_id)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'tbl_invoices_approver_not_creator already exists, skipping';
END $$;

-- ============================================================================
-- Migration: 20260722002016_2cef7a17-6291-4bcc-8c75-5c0ff2a9816a.sql
-- ============================================================================


-- 1) Profile: protect privileged columns from self-edit
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins may change anything
  IF public.is_user_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Non-admin (including the profile owner) cannot change privileged columns
  NEW.approval_status  := OLD.approval_status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.approved_at      := OLD.approved_at;
  NEW.approved_by      := OLD.approved_by;
  NEW.is_approver      := OLD.is_approver;
  NEW.is_active        := OLD.is_active;
  NEW.is_hidden        := OLD.is_hidden;
  NEW.email            := OLD.email;
  NEW.user_id          := OLD.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.tbl_profiles;
CREATE TRIGGER trg_protect_profile_privileges
BEFORE UPDATE ON public.tbl_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- 2) Approver-only updates on invoices: restrict which columns may change
CREATE OR REPLACE FUNCTION public.restrict_invoice_approver_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Owners and module editors/admins can freely edit; also allow service_role/no-auth internal callers
  IF uid IS NULL
     OR uid = OLD.user_id
     OR public.has_module_access(uid, 'invoices'::app_module, 'edit'::access_level) THEN
    RETURN NEW;
  END IF;

  -- Otherwise caller is an approver-only. Force all non-approval columns to remain unchanged.
  NEW.user_id             := OLD.user_id;
  NEW.invoice_number      := OLD.invoice_number;
  NEW.client              := OLD.client;
  NEW.amount              := OLD.amount;
  NEW.due_date            := OLD.due_date;
  NEW.items               := OLD.items;
  NEW.discount_percentage := OLD.discount_percentage;
  NEW.approver1_id        := OLD.approver1_id;
  NEW.approver2_id        := OLD.approver2_id;
  NEW.created_at          := OLD.created_at;
  -- Allowed to change: approver1_status, approver2_status, status, updated_at
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_invoice_approver_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_invoice_approver_updates ON public.tbl_invoices;
CREATE TRIGGER trg_restrict_invoice_approver_updates
BEFORE UPDATE ON public.tbl_invoices
FOR EACH ROW EXECUTE FUNCTION public.restrict_invoice_approver_updates();

-- 3) Approver-only updates on transactions: restrict which columns may change
CREATE OR REPLACE FUNCTION public.restrict_transaction_approver_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL
     OR uid = OLD.user_id
     OR public.has_module_access(uid, 'transactions'::app_module, 'edit'::access_level) THEN
    RETURN NEW;
  END IF;

  NEW.user_id                 := OLD.user_id;
  NEW.description             := OLD.description;
  NEW.amount                  := OLD.amount;
  NEW.type                    := OLD.type;
  NEW.category                := OLD.category;
  NEW.date                    := OLD.date;
  NEW.attachment_url          := OLD.attachment_url;
  NEW.vat_treatment           := OLD.vat_treatment;
  NEW.organization_id         := OLD.organization_id;
  NEW.recurring_transaction_id:= OLD.recurring_transaction_id;
  NEW.approver1_id            := OLD.approver1_id;
  NEW.approver2_id            := OLD.approver2_id;
  NEW.created_at              := OLD.created_at;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restrict_transaction_approver_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restrict_transaction_approver_updates ON public.tbl_transactions;
CREATE TRIGGER trg_restrict_transaction_approver_updates
BEFORE UPDATE ON public.tbl_transactions
FOR EACH ROW EXECUTE FUNCTION public.restrict_transaction_approver_updates();


-- ============================================================================
-- Migration: 20260722002144_56353b0e-874c-4115-86fd-26ca7baab043.sql
-- ============================================================================


UPDATE public.tbl_profiles
SET signature_url = regexp_replace(
  split_part(signature_url, '?', 1),
  '^.*/storage/v1/object/sign/signatures/', ''
)
WHERE signature_url LIKE '%/storage/v1/object/sign/signatures/%';


-- ============================================================================
-- Migration: 20260722093902_add2711b-05cf-43c9-a704-8359fe8dcb78.sql
-- ============================================================================


-- Helper to seed/update the recurring cron shared secret in vault
CREATE OR REPLACE FUNCTION public.set_recurring_cron_secret(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  sid uuid;
BEGIN
  SELECT id INTO sid FROM vault.secrets WHERE name = 'recurring_cron_secret';
  IF sid IS NULL THEN
    PERFORM vault.create_secret(_value, 'recurring_cron_secret');
  ELSE
    PERFORM vault.update_secret(sid, _value, 'recurring_cron_secret');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_recurring_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_recurring_cron_secret(text) TO service_role;

-- Remove the broken legacy cron job (anon key) and re-schedule the daily job
-- to send the shared X-Cron-Secret header pulled from vault.
DO $$ BEGIN
  PERFORM cron.unschedule('process-recurring-transactions');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('process-recurring-transactions-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-recurring-transactions-daily',
  '15 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://cublznofafajedpswsmd.supabase.co/functions/v1/process-recurring-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'recurring_cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  );
  $cron$
);

