import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, UserPlus, Trash2, Clock, Check, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";

const modules = ["invoices", "transactions", "pnl", "vat", "paye", "reports", "users"] as const;
const accessLevels = ["none", "view", "edit", "admin"] as const;
const timeoutOptions = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  roles: Record<string, string>;
  session_timeout_minutes: number;
  is_hidden: boolean;
  is_approver: boolean;
  approval_status: string;
}


export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<Record<string, string>>(
    Object.fromEntries(modules.map((m) => [m, "view"]))
  );
  const [addLoading, setAddLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<UserProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();
  const { hasAdmin, loading: rolesLoading } = useUserRoles();
  const [activeTab, setActiveTab] = useState("users");
  const autoSwitchedToPending = useRef(false);
  const { user } = useAuth();

  const deleteUser = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { targetUserId: userId },
    });
    if (error) {
      toast({ title: "Couldn't delete user", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    if (data?.mode === "anonymized") {
      toast({
        title: "User's identity removed",
        description: "This account has invoices, transactions, or payroll records that must be retained by law, so their name and email were erased instead of deleting the account outright.",
      });
    } else {
      toast({ title: "User deleted" });
    }
    fetchUsers();
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: profilesError } = await supabase.from("tbl_profiles").select("*");
    const { data: roles, error: rolesError } = await supabase.from("tbl_user_roles").select("*");
    if (profilesError || rolesError) {
      toast({ title: "Couldn't load users", description: friendlyErrorMessage(profilesError || rolesError), variant: "destructive" });
      setLoading(false);
      return;
    }

    if (profiles) {
      const mapped: UserProfile[] = profiles.map((p: any) => {
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.user_id);
        const roleMap: Record<string, string> = {};
        userRoles.forEach((r: any) => { roleMap[r.module] = r.access; });
        return { user_id: p.user_id, full_name: p.full_name, email: p.email, is_active: p.is_active, last_login_at: (p as any).last_login_at || null, roles: roleMap, session_timeout_minutes: (p as any).session_timeout_minutes ?? 15, is_hidden: (p as any).is_hidden ?? false, is_approver: (p as any).is_approver ?? false, approval_status: (p as any).approval_status ?? "approved" };
      });
      setUsers(mapped);
    }
    setLoading(false);
  };

  const fetchAuditLog = async () => {
    const { data, error } = await supabase
      .from("tbl_user_approval_audit" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Couldn't load approval history", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    if (!data) return;
    const rows = data as any[];
    const ids = Array.from(new Set(rows.flatMap((r) => [r.target_user_id, r.actor_user_id]).filter(Boolean)));
    let profileMap: Record<string, { full_name: string; email: string }> = {};
    if (ids.length) {
      const { data: profs, error: profsError } = await supabase.from("tbl_profiles").select("user_id, full_name, email").in("user_id", ids);
      if (profsError) {
        toast({ title: "Couldn't load approval history", description: friendlyErrorMessage(profsError), variant: "destructive" });
        return;
      }
      (profs || []).forEach((p: any) => { profileMap[p.user_id] = { full_name: p.full_name, email: p.email }; });
    }
    setAuditLog(rows.map((r) => ({ ...r, target: profileMap[r.target_user_id], actor: profileMap[r.actor_user_id] })));
  };

  useEffect(() => { fetchUsers(); fetchAuditLog(); }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      // Sign up the new user via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newName }, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;

      // Update roles if the user was created (trigger auto-creates default roles)
      if (data.user) {
        for (const mod of modules) {
          await supabase
            .from("tbl_user_roles")
            .update({ access: newRoles[mod] as any })
            .eq("user_id", data.user.id)
            .eq("module", mod as any);
        }
      }

      toast({ title: "User created", description: `${newEmail} has been added.` });
      setAddOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRoles(Object.fromEntries(modules.map((m) => [m, "view"])));
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Couldn't create user", description: friendlyErrorMessage(error), variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const updateRole = async (userId: string, module: string, access: string) => {
    const { error } = await supabase
      .from("tbl_user_roles")
      .update({ access: access as any })
      .eq("user_id", userId)
      .eq("module", module as any);
    if (error) {
      toast({ title: "Couldn't update permission", description: friendlyErrorMessage(error), variant: "destructive" });
    } else {
      // If both invoices and transactions are none, auto-disable approver
      if (module === "invoices" || module === "transactions") {
        const updatedUser = users.find(u => u.user_id === userId);
        if (updatedUser) {
          const invoicesAccess = module === "invoices" ? access : (updatedUser.roles["invoices"] || "none");
          const transactionsAccess = module === "transactions" ? access : (updatedUser.roles["transactions"] || "none");
          if (invoicesAccess === "none" && transactionsAccess === "none") {
            await supabase.from("tbl_profiles").update({ is_approver: false } as any).eq("user_id", userId);
          }
        }
      }
      toast({ title: "Permission updated", description: `Access to ${module} has been updated.` });
      fetchUsers();
    }
  };

  const updateTimeout = async (userId: string, minutes: number) => {
    const { error } = await supabase
      .from("tbl_profiles")
      .update({ session_timeout_minutes: minutes } as any)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Couldn't update session timeout", description: friendlyErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Session timeout updated", description: `Set to ${minutes} minutes.` });
      fetchUsers();
    }
  };

  const updateApprover = async (userId: string, checked: boolean) => {
    const { error } = await supabase
      .from("tbl_profiles")
      .update({ is_approver: checked } as any)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Couldn't update approver status", description: friendlyErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Approver status updated", description: checked ? "This user can now approve records." : "This user can no longer approve records." });
      fetchUsers();
    }
  };

  const setApproval = async (userId: string, status: "approved" | "rejected", reason?: string) => {
    const patch: any = { approval_status: status };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = user?.id;
      patch.rejection_reason = null;
    } else {
      patch.rejection_reason = reason?.trim() || null;
    }
    const { error } = await supabase.from("tbl_profiles").update(patch).eq("user_id", userId);
    if (error) {
      toast({
        title: status === "approved" ? "Couldn't approve user" : "Couldn't reject user",
        description: friendlyErrorMessage(error),
        variant: "destructive",
      });
    } else {
      await supabase.from("tbl_user_approval_audit" as any).insert({
        target_user_id: userId,
        actor_user_id: user?.id,
        action: status,
        reason: status === "rejected" ? (reason?.trim() || null) : null,
      });
      const target = users.find((u) => u.user_id === userId);
      if (target?.email) {
        const isApproved = status === "approved";
        supabase.functions
          .invoke("send-transactional-email", {
            body: {
              templateName: isApproved ? "account-approved" : "account-rejected",
              recipientEmail: target.email,
              targetUserId: userId,
              idempotencyKey: `account-${status}-${userId}-${Date.now()}`,
              templateData: {
                recipientName: target.full_name || target.email.split("@")[0],
                ...(isApproved ? {} : { rejectionReason: reason?.trim() || null }),
                appUrl: window.location.origin,
              },
            },
          })
          .catch((e) => console.warn(`${status} email failed`, e));
      }
      toast({
        title: status === "approved" ? "User approved" : "User rejected",
        description: status === "approved" ? "They now have access to the app." : "They have been notified of the decision.",
      });
      fetchUsers();
      fetchAuditLog();
    }
  };


  const visibleUsers = users.filter((u) => !u.is_hidden && u.approval_status === "approved");
  const pendingUsers = users.filter((u) => !u.is_hidden && u.approval_status === "pending");

  // On first load only: if sign-ups are waiting, open the Pending Approvals tab
  // so they aren't hidden behind a click. Never yanks the tab afterwards.
  useEffect(() => {
    if (loading || rolesLoading || autoSwitchedToPending.current) return;
    autoSwitchedToPending.current = true;
    if (hasAdmin("users") && pendingUsers.length > 0) setActiveTab("pending");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rolesLoading]);


  const accessColor = (level: string) => {
    switch (level) {
      case "admin": return "text-primary";
      case "edit": return "text-chart-3";
      case "view": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="User Management" subtitle="Manage users and module-level permissions">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Smith" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jane@company.com" required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> Module Permissions</Label>
                {modules.map((mod) => (
                  <div key={mod} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-foreground">{mod === "pnl" ? "Profit & Loss" : mod}</span>
                    <Select value={newRoles[mod]} onValueChange={(v) => setNewRoles({ ...newRoles, [mod]: v })}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {accessLevels.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={addLoading}>
                {addLoading ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {hasAdmin("users") && (
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              Pending Approvals
              {pendingUsers.length > 0 && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">{pendingUsers.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="pending" className="mt-0">
        {pendingUsers.length > 0 ? (
          <div className="glass-card p-4 md:p-6 space-y-3 border border-warning/30">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="font-heading text-lg font-semibold text-foreground">Pending approvals ({pendingUsers.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingUsers.map((u) => (
                <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setApproval(u.user_id, "approved")} className="gap-1">
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejectTarget(u); setRejectReason(""); }} className="gap-1 text-destructive hover:text-destructive">
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>

                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">No pending sign-ups.</div>
        )}
        </TabsContent>
        <TabsContent value="users" className="mt-0">
        <div className="glass-card overflow-hidden">

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                   <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
                   <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Login</th>
                  {modules.map((m) => (
                    <th key={m} className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {m === "pnl" ? "P&L" : m}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Approver</th>
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Timeout</th>
                  {hasAdmin("users") && <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u, i) => (
                  <motion.tr
                    key={u.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString()
                        : <span className="italic text-muted-foreground/60">Never</span>}
                    </td>
                    
                    {modules.map((mod) => (
                      <td key={mod} className="px-3 py-3 text-center">
                        <Select value={u.roles[mod] || "none"} onValueChange={(v) => updateRole(u.user_id, mod, v)}>
                          <SelectTrigger className={`w-24 text-xs capitalize ${accessColor(u.roles[mod] || "none")}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {accessLevels.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const invoicesRole = u.roles["invoices"] || "none";
                        const transactionsRole = u.roles["transactions"] || "none";
                        const canBeApprover = invoicesRole !== "none" || transactionsRole !== "none";
                        return (
                          <Checkbox
                            checked={u.is_approver}
                            disabled={!canBeApprover}
                            onCheckedChange={(checked) => updateApprover(u.user_id, !!checked)}
                            className={!canBeApprover ? "opacity-50 cursor-not-allowed" : ""}
                          />
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Select value={String(u.session_timeout_minutes)} onValueChange={(v) => updateTimeout(u.user_id, Number(v))}>
                        <SelectTrigger className="w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeoutOptions.map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    {hasAdmin("users") && (
                      <td className="px-3 py-3 text-center">
                        {u.user_id !== user?.id ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove {u.full_name || u.email}'s account and access. If they have invoices, transactions, or payroll records on file, those are kept for legal record-keeping and their name/email are erased instead of the account being deleted outright. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(u.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-xs text-muted-foreground">You</span>
                        )}
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </TabsContent>
        <TabsContent value="audit" className="mt-0">
          <div className="glass-card p-4 md:p-6 space-y-3">
            <h3 className="font-heading text-lg font-semibold text-foreground">Approval audit log</h3>
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approval decisions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left">When</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">By</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{r.target?.full_name || r.target?.email || r.target_user_id.slice(0, 8)}</td>
                        <td className={`px-3 py-2 capitalize font-medium ${r.action === "approved" ? "text-primary" : "text-destructive"}`}>{r.action}</td>
                        <td className="px-3 py-2">{r.actor?.full_name || r.actor?.email || "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reject {rejectTarget?.full_name || rejectTarget?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to the user)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Unable to verify company affiliation. Please contact HR."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!rejectTarget) return;
                await setApproval(rejectTarget.user_id, "rejected", rejectReason);
                setRejectTarget(null);
              }}
            >
              Reject user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
