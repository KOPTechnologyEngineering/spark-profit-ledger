ALTER TABLE public.tbl_profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tbl_profiles;