// Supabase browser client.
//
// (This file used to carry a Lovable "automatically generated -- do not edit"
// header. The project is now self-managed, so it is maintained by hand.)
//
// The instrumented fetch wrapper captures every Supabase request into the
// application log (see src/lib/instrumentedFetch.ts).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { instrumentedFetch } from '@/lib/instrumentedFetch';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: instrumentedFetch,
  },
});
