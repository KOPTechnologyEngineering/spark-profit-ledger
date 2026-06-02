
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
