
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
