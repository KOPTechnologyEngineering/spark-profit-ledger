import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, XCircle } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const [status, setStatus] = useState<"loading" | "approved" | "pending" | "rejected">("loading");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { setStatus("loading"); return; }
    let cancelled = false;
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("tbl_profiles")
        .select("approval_status, rejection_reason")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const s = (data as any)?.approval_status ?? "pending";
      setStatus(s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending");
      setRejectionReason((data as any)?.rejection_reason ?? null);
    };
    fetchStatus();

    const channel = supabase
      .channel(`profile-approval-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tbl_profiles", filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const s = (payload.new as any)?.approval_status ?? "pending";
          setStatus(s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending");
          setRejectionReason((payload.new as any)?.rejection_reason ?? null);
        }
      )
      .subscribe();

    const interval = setInterval(fetchStatus, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [session]);

  if (loading || (session && status === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  if (status !== "approved") {
    const rejected = status === "rejected";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="glass-card w-full max-w-md p-8 text-center space-y-4">
          <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${rejected ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
            {rejected ? <XCircle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {rejected ? "Access denied" : "Awaiting approval"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {rejected
              ? "Your account request was rejected. Please contact an administrator."
              : "Your account has been created and is pending approval from an administrator. You'll be notified once approved."}
          </p>
          {rejected && rejectionReason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1">Reason from admin</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{rejectionReason}</p>
            </div>
          )}
          <Button variant="outline" onClick={signOut} className="w-full">Sign out</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
