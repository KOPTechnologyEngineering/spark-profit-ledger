import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import PageMeta from "@/components/PageMeta";

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; msg: string }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; msg: string };

const HEADINGS: Record<State["kind"], string> = {
  loading: "Checking your link…",
  valid: "Unsubscribe from emails",
  submitting: "Unsubscribing…",
  success: "You're unsubscribed",
  already: "Already unsubscribed",
  invalid: "Something went wrong",
  error: "Something went wrong",
};

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", msg: "Missing token in URL." });
      return;
    }
    (async () => {
      try {
        const url =
          import.meta.env.VITE_SUPABASE_URL +
          "/functions/v1/handle-email-unsubscribe?token=" +
          encodeURIComponent(token);
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();
        if (res.ok && data.valid) setState({ kind: "valid" });
        else if (data.reason === "already_unsubscribed")
          setState({ kind: "already" });
        else setState({ kind: "invalid", msg: data.error || "Invalid token." });
      } catch (e: any) {
        setState({ kind: "invalid", msg: e?.message || "Network error." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke(
      "handle-email-unsubscribe",
      { body: { token } },
    );
    if (error) return setState({ kind: "error", msg: error.message });
    if (data?.success) setState({ kind: "success" });
    else if (data?.reason === "already_unsubscribed")
      setState({ kind: "already" });
    else setState({ kind: "error", msg: data?.error || "Failed to unsubscribe." });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <PageMeta title="Unsubscribe | KOP Ledger" description="Unsubscribe from KOP Ledger email notifications." path="/unsubscribe" />
      <div className="glass-card w-full max-w-md p-8 text-center space-y-4">
        {state.kind === "loading" && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
        {state.kind === "valid" && <MailX className="h-10 w-10 mx-auto text-warning" />}
        {state.kind === "submitting" && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
        {state.kind === "success" && <CheckCircle2 className="h-10 w-10 mx-auto text-inflow" />}
        {state.kind === "already" && <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground" />}
        {(state.kind === "invalid" || state.kind === "error") && <XCircle className="h-10 w-10 mx-auto text-outflow" />}

        <h1 className="text-xl font-semibold">{HEADINGS[state.kind]}</h1>

        {state.kind === "valid" && (
          <>
            <p className="text-sm text-muted-foreground">
              Confirm to stop receiving emails from KOP Ledger at this address.
            </p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state.kind === "success" && (
          <p className="text-sm text-muted-foreground">
            You will no longer receive emails from KOP Ledger at this address.
          </p>
        )}
        {state.kind === "already" && (
          <p className="text-sm text-muted-foreground">
            This address is already removed from our mailing list.
          </p>
        )}
        {(state.kind === "invalid" || state.kind === "error") && (
          <p className="text-sm text-muted-foreground">{state.msg}</p>
        )}
      </div>
    </main>
  );
}
