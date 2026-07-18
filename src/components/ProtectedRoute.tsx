import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw, XCircle } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const [status, setStatus] = useState<"loading" | "approved" | "pending" | "rejected">("loading");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const fetchFreshStatus = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    try {
      // Bypass any browser/service-worker cache by calling the REST endpoint directly
      // with cache: "no-store" and a cache-busting query parameter.
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tbl_profiles`);
      url.searchParams.set("select", "approval_status,rejection_reason");
      url.searchParams.set("user_id", "eq." + session.user.id);
      url.searchParams.set("limit", "1");
      url.searchParams.set("_", Date.now().toString());

      const res = await fetch(url.toString(), {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/vnd.pgrst.object+json",
        },
        cache: "no-store",
      });

      if (!res.ok) return;
      const data = await res.json();
      const s = data?.approval_status ?? "pending";
      setStatus(s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending");
      setRejectionReason(data?.rejection_reason ?? null);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setStatus("loading");
      return;
    }
    // Don't restart polling/subscription if we've already been approved.
    if (statusRef.current === "approved") return;

    fetchFreshStatus();

    channelRef.current = supabase
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

    intervalRef.current = setInterval(fetchFreshStatus, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session, fetchFreshStatus]);

  // Stop polling and realtime subscription immediately once approved.
  useEffect(() => {
    if (status === "approved") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  }, [status]);

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
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={fetchFreshStatus}
              disabled={refreshing}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Checking status..." : "Refresh status"}
            </Button>
            <Button variant="outline" onClick={signOut} className="w-full">Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
