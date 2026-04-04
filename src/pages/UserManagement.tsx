import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, UserPlus, Trash2 } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

const modules = ["invoices", "transactions", "pnl", "vat", "paye", "reports", "users"] as const;
const accessLevels = ["none", "view", "edit", "admin"] as const;

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  roles: Record<string, string>;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState<Record<string, string>>(
    Object.fromEntries(modules.map((m) => [m, "view"]))
  );
  const [addLoading, setAddLoading] = useState(false);
  const { toast } = useToast();
  const { hasAdmin } = useUserRoles();
  const { user } = useAuth();

  const deleteUser = async (userId: string) => {
    const { error: rolesErr } = await supabase.from("tbl_user_roles").delete().eq("user_id", userId);
    const { error: profileErr } = await supabase.from("tbl_profiles").delete().eq("user_id", userId);
    if (rolesErr || profileErr) {
      toast({ title: "Error", description: (rolesErr || profileErr)!.message, variant: "destructive" });
    } else {
      toast({ title: "User deleted" });
      fetchUsers();
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("tbl_profiles").select("*");
    const { data: roles } = await supabase.from("tbl_user_roles").select("*");

    if (profiles) {
      const mapped: UserProfile[] = profiles.map((p: any) => {
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.user_id);
        const roleMap: Record<string, string> = {};
        userRoles.forEach((r: any) => { roleMap[r.module] = r.access; });
        return { user_id: p.user_id, full_name: p.full_name, email: p.email, is_active: p.is_active, last_login_at: (p as any).last_login_at || null, roles: roleMap };
      });
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      // Sign up the new user via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newName } },
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
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Permission updated for ${module}` });
      fetchUsers();
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage users and module-level permissions</p>
        </div>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
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
                  {hasAdmin("users") && <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
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
                                  This will remove {u.full_name || u.email} and all their permissions. This cannot be undone.
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
      )}
    </div>
  );
}
