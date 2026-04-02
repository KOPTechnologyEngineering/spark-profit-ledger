import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  designation: string;
  signature_url: string;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.from("tbl_profiles").select("user_id, full_name, email, designation, signature_url").then(({ data }) => {
      setProfiles((data as any) || []);
    });
  }, []);

  return profiles;
}
