import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.from("tbl_profiles").select("user_id, full_name, email").then(({ data }) => {
      setProfiles(data || []);
    });
  }, []);

  return profiles;
}
