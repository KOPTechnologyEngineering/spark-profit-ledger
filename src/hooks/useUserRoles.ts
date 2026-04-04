import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("tbl_user_roles")
      .select("module, access")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.module] = r.access; });
        setRoles(map);
        setLoading(false);
      });
  }, [user]);

  const hasAdmin = (module: string) => roles[module] === "admin";
  const hasEdit = (module: string) => ["edit", "admin"].includes(roles[module] || "");
  const hasView = (module: string) => ["view", "edit", "admin"].includes(roles[module] || "");
  const hasNone = (module: string) => !roles[module] || roles[module] === "none";

  return { roles, loading, hasAdmin, hasEdit, hasView, hasNone };
}
