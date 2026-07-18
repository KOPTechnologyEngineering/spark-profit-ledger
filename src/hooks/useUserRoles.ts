import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

async function fetchUserRoles(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("tbl_user_roles")
    .select("module, access")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((r) => { map[r.module] = r.access; });
  return map;
}

// Was a plain useState+useEffect fetch, independently re-run by every one of
// the ~16 components that call this hook -- e.g. a single page rendering a
// PageHeader, a table, and an action button could each mount their own copy
// and fire 3 identical requests. React Query shares one cache entry per
// queryKey, so simultaneous mounts are coalesced into a single request and
// a short staleTime avoids re-fetching on quick page-to-page navigation.
export function useUserRoles() {
  const { user } = useAuth();
  const { data: roles = {}, isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: () => fetchUserRoles(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });

  // Client-side role checks only gate the UI (hide/disable buttons); the
  // real authorization boundary is Postgres RLS, so failing closed to "no
  // access" on a fetch error (roles defaults to {}) matches the original
  // hook's behaviour and is safe.
  const hasAdmin = (module: string) => roles[module] === "admin";
  const hasEdit = (module: string) => ["edit", "admin"].includes(roles[module] || "");
  const hasView = (module: string) => ["view", "edit", "admin"].includes(roles[module] || "");
  const hasNone = (module: string) => !roles[module] || roles[module] === "none";

  return { roles, loading: !!user && isLoading, hasAdmin, hasEdit, hasView, hasNone };
}
