import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import PageMeta from "@/components/PageMeta";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { data: loginData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (loginData.user) {
          const { data: profile } = await supabase
            .from("tbl_profiles")
            .select("approval_status")
            .eq("user_id", loginData.user.id)
            .maybeSingle();
          const status = (profile as any)?.approval_status;
          if (status === "pending") {
            toast({ title: "Awaiting approval", description: "Your account is pending admin approval." });
          } else if (status === "rejected") {
            toast({ title: "Access denied", description: "Your account request was rejected.", variant: "destructive" });
          } else {
            await supabase.from("tbl_profiles").update({ last_login_at: new Date().toISOString() } as any).eq("user_id", loginData.user.id);
            toast({ title: "Welcome back!", description: "Successfully signed in." });
          }
        }
      } else if (mode === "signup") {
        const { data: signupData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (signupData.user?.id) {
          supabase.functions
            .invoke("send-transactional-email", {
              body: {
                templateName: "welcome",
                recipientEmail: email,
                idempotencyKey: `welcome-${signupData.user.id}`,
                templateData: {
                  recipientName: fullName || email.split("@")[0],
                  appUrl: window.location.origin,
                },
              },
            })
            .catch((e) => console.warn("Welcome email failed", e));

          supabase.functions
            .invoke("notify-admins-new-signup", {
              body: {
                newUserId: signupData.user.id,
                newUserEmail: email,
                newUserName: fullName || email.split("@")[0],
                appUrl: window.location.origin,
              },
            })
            .catch((e) => console.warn("Admin notification failed", e));
        }
        toast({ title: "Account created!", description: "Your account is awaiting admin approval. You'll get access once approved." });
      } else {
        const { data, error } = await supabase.functions.invoke("request-password-reset", {
          body: { email, redirectTo: `${window.location.origin}/reset-password` },
        });
        if (error) {
          const ctx: any = (error as any).context;
          let msg = error.message;
          try {
            const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
            if (parsed?.error) msg = parsed.error;
          } catch {}
          throw new Error(msg);
        }
        if ((data as any)?.error) throw new Error((data as any).error);
        toast({
          title: "Check your email",
          description: "If an account exists for this email, a reset link has been sent.",
        });
        setMode("login");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "login" ? "Sign in to your account" : mode === "signup" ? "Create your account" : "Reset your password";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <PageMeta title="Sign in | KOP Ledger" description="Sign in to KOP Ledger to manage invoices, transactions, VAT, PAYE and collections." path="/auth" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 font-heading text-3xl font-bold text-foreground">KOP Ledger</h1>
          <p className="mt-1 text-muted-foreground">{title}</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {mode === "forgot" ? (
              <button
                onClick={() => setMode("login")}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="font-medium text-primary hover:underline"
                >
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
