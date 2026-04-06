import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  designation: string;
  signature_url: string;
  is_approver: boolean;
  is_hidden: boolean;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.from("tbl_profiles").select("user_id, full_name, email, designation, signature_url, is_approver, is_hidden").then(({ data }) => {
      setProfiles((data as any) || []);
    });
  }, []);

  return profiles;
}
