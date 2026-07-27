import { useQuery } from "@tanstack/react-query";
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

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("tbl_profiles")
    .select("user_id, full_name, email, designation, signature_url, is_approver, is_hidden");
  if (error) throw error;
  return (data as Profile[]) || [];
}

// Was a plain useState+useEffect fetch that discarded the query error
// entirely (`.then(({ data }) => ...)`), so an RLS rejection silently
// produced an empty list instead of a visible failure -- exactly how the
// "No approver could be found" RLS gap went undiagnosed. React Query surfaces
// the error instead of swallowing it, matching the pattern in useUserRoles.
export function useProfiles() {
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 30_000,
  });
  return profiles;
}
