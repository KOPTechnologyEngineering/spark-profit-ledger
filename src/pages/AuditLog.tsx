import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { useUserRoles } from "@/hooks/useUserRoles";
import PageHeader from "@/components/PageHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert } from "lucide-react";

interface LoginRow {
  id: string;
  user_id: string | null;
  email: string;
  event: string;
  status: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ChangeRow {
  id: string;
  table_name: string;
  record_id: string | null;
  operation: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

const PAGE_SIZE = 200;

function StatusPill({ ok, labelOk, labelBad }: { ok: boolean; labelOk: string; labelBad: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        ok ? "bg-inflow-muted text-inflow" : "bg-outflow-muted text-outflow"
      }`}
    >
      {ok ? labelOk : labelBad}
    </span>
  );
}

function OperationPill({ op }: { op: string }) {
  const cls =
    op === "INSERT" ? "bg-inflow-muted text-inflow" : op === "DELETE" ? "bg-outflow-muted text-outflow" : "bg-warning/15 text-warning";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{op}</span>;
}

const fmt = (ts: string) => new Date(ts).toLocaleString("en-GB");

// Fields not worth showing as "changes" (bump on every write).
const NOISE_FIELDS = new Set(["updated_at", "created_at", "id"]);

function diffValues(row: ChangeRow): { field: string; oldVal: unknown; newVal: unknown }[] {
  const oldV = row.old_values || {};
  const newV = row.new_values || {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)])).sort();
  const out: { field: string; oldVal: unknown; newVal: unknown }[] = [];
  for (const k of keys) {
    if (NOISE_FIELDS.has(k)) continue;
    const a = (oldV as any)[k];
    const b = (newV as any)[k];
    if (row.operation === "UPDATE" && JSON.stringify(a) === JSON.stringify(b)) continue; // unchanged
    out.push({ field: k, oldVal: a, newVal: b });
  }
  return out;
}

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export default function AuditLog() {
  const { toast } = useToast();
  const { hasAdmin, loading: rolesLoading } = useUserRoles();
  const isAdmin = hasAdmin("users");

  const [loading, setLoading] = useState(true);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [profileEmails, setProfileEmails] = useState<Record<string, string>>({});

  // login filters
  const [loginEvent, setLoginEvent] = useState("all");
  const [loginStatus, setLoginStatus] = useState("all");
  const [loginSearch, setLoginSearch] = useState("");

  // change filters
  const [changeTable, setChangeTable] = useState("all");
  const [changeOp, setChangeOp] = useState("all");
  const [detail, setDetail] = useState<ChangeRow | null>(null);

  useEffect(() => {
    if (rolesLoading || !isAdmin) return;
    (async () => {
      setLoading(true);
      const [loginRes, changeRes, profRes] = await Promise.all([
        supabase.from("tbl_login_audit").select("*").order("created_at", { ascending: false }).limit(PAGE_SIZE),
        supabase.from("tbl_change_audit").select("*").order("changed_at", { ascending: false }).limit(PAGE_SIZE),
        supabase.from("tbl_profiles").select("user_id, email"),
      ]);
      if (loginRes.error) toast({ title: "Couldn't load login audit", description: friendlyErrorMessage(loginRes.error), variant: "destructive" });
      if (changeRes.error) toast({ title: "Couldn't load change audit", description: friendlyErrorMessage(changeRes.error), variant: "destructive" });
      setLogins((loginRes.data as LoginRow[]) || []);
      setChanges((changeRes.data as ChangeRow[]) || []);
      const map: Record<string, string> = {};
      ((profRes.data as any[]) || []).forEach((p) => { map[p.user_id] = p.email; });
      setProfileEmails(map);
      setLoading(false);
    })();
  }, [rolesLoading, isAdmin, toast]);

  const filteredLogins = useMemo(() => {
    const q = loginSearch.trim().toLowerCase();
    return logins.filter(
      (r) =>
        (loginEvent === "all" || r.event === loginEvent) &&
        (loginStatus === "all" || r.status === loginStatus) &&
        (!q || r.email.toLowerCase().includes(q) || (r.ip || "").includes(q)),
    );
  }, [logins, loginEvent, loginStatus, loginSearch]);

  const changeTables = useMemo(
    () => Array.from(new Set(changes.map((c) => c.table_name))).sort(),
    [changes],
  );
  const filteredChanges = useMemo(
    () =>
      changes.filter(
        (c) => (changeTable === "all" || c.table_name === changeTable) && (changeOp === "all" || c.operation === changeOp),
      ),
    [changes, changeTable, changeOp],
  );

  if (!rolesLoading && !isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Audit Log" subtitle="System login and change history" />
        <div className="glass-card flex items-center gap-3 p-8 text-muted-foreground">
          <ShieldAlert className="h-5 w-5 text-warning" />
          You need Users-module admin access to view the audit log.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Audit Log" subtitle="System login and change history" />

      <Tabs defaultValue="logins">
        <TabsList>
          <TabsTrigger value="logins">Login Audit</TabsTrigger>
          <TabsTrigger value="changes">Change Audit</TabsTrigger>
        </TabsList>

        {/* ---- LOGIN AUDIT ---- */}
        <TabsContent value="logins" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search email or IP..."
              value={loginSearch}
              onChange={(e) => setLoginSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={loginEvent} onValueChange={setLoginEvent}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>
            <Select value={loginStatus} onValueChange={setLoginStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="glass-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogins.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No login events found.</TableCell></TableRow>
                  ) : (
                    filteredLogins.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{fmt(r.created_at)}</TableCell>
                        <TableCell>{r.email || "—"}</TableCell>
                        <TableCell className="capitalize">{r.event}</TableCell>
                        <TableCell><StatusPill ok={r.status === "success"} labelOk="Success" labelBad="Failed" /></TableCell>
                        <TableCell className="text-muted-foreground">{r.ip || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---- CHANGE AUDIT ---- */}
        <TabsContent value="changes" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={changeTable} onValueChange={setChangeTable}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {changeTables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={changeOp} onValueChange={setChangeOp}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All operations</SelectItem>
                <SelectItem value="INSERT">Insert</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="glass-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Changed by</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChanges.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No changes recorded.</TableCell></TableRow>
                  ) : (
                    filteredChanges.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap">{fmt(c.changed_at)}</TableCell>
                        <TableCell>{c.changed_by ? (profileEmails[c.changed_by] || c.changed_by.slice(0, 8)) : "System"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.table_name.replace(/^tbl_/, "")}</TableCell>
                        <TableCell><OperationPill op={c.operation} /></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.record_id ? c.record_id.slice(0, 8) : "—"}</TableCell>
                        <TableCell><Button variant="outline" size="sm" onClick={() => setDetail(c)}>View changes</Button></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Change detail: field-level old -> new */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {detail?.operation} on {detail?.table_name?.replace(/^tbl_/, "")}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="text-xs text-muted-foreground">
                {fmt(detail.changed_at)} · by {detail.changed_by ? (profileEmails[detail.changed_by] || detail.changed_by) : "System"} · record {detail.record_id || "—"}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Old value</TableHead>
                      <TableHead>New value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffValues(detail).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No field-level changes.</TableCell></TableRow>
                    ) : (
                      diffValues(detail).map((d) => (
                        <TableRow key={d.field}>
                          <TableCell className="font-mono text-xs">{d.field}</TableCell>
                          <TableCell className="text-outflow break-all">{detail.operation === "INSERT" ? "—" : cell(d.oldVal)}</TableCell>
                          <TableCell className="text-inflow break-all">{detail.operation === "DELETE" ? "—" : cell(d.newVal)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
