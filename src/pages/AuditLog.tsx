import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
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

const PAGE_SIZE = 50;

// The tables the audit_row_change() trigger is attached to (see the
// audit_log_login_and_change migration). Used to populate the table filter
// without a separate round-trip.
const AUDITED_TABLES = [
  "tbl_transactions",
  "tbl_invoices",
  "tbl_organizations",
  "tbl_paye_employees",
  "tbl_vat_returns",
  "tbl_recurring_transactions",
  "tbl_profiles",
  "tbl_user_roles",
];

const fmt = (ts: string) => new Date(ts).toLocaleString("en-GB");
const stripTbl = (t: string) => t.replace(/^tbl_/, "");
const dayStart = (d: string) => `${d}T00:00:00.000Z`;
const dayEnd = (d: string) => `${d}T23:59:59.999Z`;

const NOISE_FIELDS = new Set(["updated_at", "created_at", "id"]);

function StatusPill({ ok, labelOk, labelBad }: { ok: boolean; labelOk: string; labelBad: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-inflow-muted text-inflow" : "bg-outflow-muted text-outflow"}`}>
      {ok ? labelOk : labelBad}
    </span>
  );
}

function OperationPill({ op }: { op: string }) {
  const cls = op === "INSERT" ? "bg-inflow-muted text-inflow" : op === "DELETE" ? "bg-outflow-muted text-outflow" : "bg-warning/15 text-warning";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{op}</span>;
}

function diffValues(row: ChangeRow): { field: string; oldVal: unknown; newVal: unknown }[] {
  const oldV = row.old_values || {};
  const newV = row.new_values || {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)])).sort();
  const out: { field: string; oldVal: unknown; newVal: unknown }[] = [];
  for (const k of keys) {
    if (NOISE_FIELDS.has(k)) continue;
    const a = (oldV as any)[k];
    const b = (newV as any)[k];
    if (row.operation === "UPDATE" && JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({ field: k, oldVal: a, newVal: b });
  }
  return out;
}

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-2 pt-3">
      <span className="text-xs text-muted-foreground">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 0}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={to >= total}>Next</Button>
      </div>
    </div>
  );
}

export default function AuditLog() {
  const { toast } = useToast();
  const { hasAdmin, loading: rolesLoading } = useUserRoles();
  const isAdmin = hasAdmin("users");

  const [profileEmails, setProfileEmails] = useState<Record<string, string>>({});

  // ---- login audit state ----
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [loginCount, setLoginCount] = useState(0);
  const [loginPage, setLoginPage] = useState(0);
  const [loginLoading, setLoginLoading] = useState(true);
  const [loginEvent, setLoginEvent] = useState("all");
  const [loginStatus, setLoginStatus] = useState("all");
  const [loginSearch, setLoginSearch] = useState("");
  const [loginSearchApplied, setLoginSearchApplied] = useState("");
  const [loginFrom, setLoginFrom] = useState("");
  const [loginTo, setLoginTo] = useState("");

  // ---- change audit state ----
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [changePage, setChangePage] = useState(0);
  const [changeLoading, setChangeLoading] = useState(true);
  const [changeTable, setChangeTable] = useState("all");
  const [changeOp, setChangeOp] = useState("all");
  const [changeFrom, setChangeFrom] = useState("");
  const [changeTo, setChangeTo] = useState("");
  const [detail, setDetail] = useState<ChangeRow | null>(null);

  // Actor-id -> email map (small; loaded once).
  useEffect(() => {
    if (rolesLoading || !isAdmin) return;
    supabase.from("tbl_profiles").select("user_id, email").then(({ data }) => {
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((p) => { map[p.user_id] = p.email; });
      setProfileEmails(map);
    });
  }, [rolesLoading, isAdmin]);

  // Debounce the free-text search; reset to first page when it changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoginSearchApplied(loginSearch.trim());
      setLoginPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [loginSearch]);

  // Fetch login audit page (server-side filter + paginate).
  useEffect(() => {
    if (rolesLoading || !isAdmin) return;
    (async () => {
      setLoginLoading(true);
      let q = supabase.from("tbl_login_audit").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (loginEvent !== "all") q = q.eq("event", loginEvent);
      if (loginStatus !== "all") q = q.eq("status", loginStatus);
      if (loginSearchApplied) q = q.or(`email.ilike.%${loginSearchApplied}%,ip.ilike.%${loginSearchApplied}%`);
      if (loginFrom) q = q.gte("created_at", dayStart(loginFrom));
      if (loginTo) q = q.lte("created_at", dayEnd(loginTo));
      const start = loginPage * PAGE_SIZE;
      const { data, count, error } = await q.range(start, start + PAGE_SIZE - 1);
      if (error) toast({ title: "Couldn't load login audit", description: friendlyErrorMessage(error), variant: "destructive" });
      setLogins((data as LoginRow[]) || []);
      setLoginCount(count || 0);
      setLoginLoading(false);
    })();
  }, [rolesLoading, isAdmin, loginEvent, loginStatus, loginSearchApplied, loginFrom, loginTo, loginPage, toast]);

  // Fetch change audit page.
  useEffect(() => {
    if (rolesLoading || !isAdmin) return;
    (async () => {
      setChangeLoading(true);
      let q = supabase.from("tbl_change_audit").select("*", { count: "exact" }).order("changed_at", { ascending: false });
      if (changeTable !== "all") q = q.eq("table_name", changeTable);
      if (changeOp !== "all") q = q.eq("operation", changeOp);
      if (changeFrom) q = q.gte("changed_at", dayStart(changeFrom));
      if (changeTo) q = q.lte("changed_at", dayEnd(changeTo));
      const start = changePage * PAGE_SIZE;
      const { data, count, error } = await q.range(start, start + PAGE_SIZE - 1);
      if (error) toast({ title: "Couldn't load change audit", description: friendlyErrorMessage(error), variant: "destructive" });
      setChanges((data as ChangeRow[]) || []);
      setChangeCount(count || 0);
      setChangeLoading(false);
    })();
  }, [rolesLoading, isAdmin, changeTable, changeOp, changeFrom, changeTo, changePage, toast]);

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
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input placeholder="Email or IP..." value={loginSearch} onChange={(e) => setLoginSearch(e.target.value)} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Event</Label>
              <Select value={loginEvent} onValueChange={(v) => { setLoginEvent(v); setLoginPage(0); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={loginStatus} onValueChange={(v) => { setLoginStatus(v); setLoginPage(0); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={loginFrom} onChange={(e) => { setLoginFrom(e.target.value); setLoginPage(0); }} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={loginTo} onChange={(e) => { setLoginTo(e.target.value); setLoginPage(0); }} className="w-40" />
            </div>
          </div>

          {loginLoading ? (
            <LoadingSpinner />
          ) : (
            <>
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
                    {logins.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No login events found.</TableCell></TableRow>
                    ) : (
                      logins.map((r) => (
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
              <Pagination page={loginPage} total={loginCount} onPage={setLoginPage} />
            </>
          )}
        </TabsContent>

        {/* ---- CHANGE AUDIT ---- */}
        <TabsContent value="changes" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Table</Label>
              <Select value={changeTable} onValueChange={(v) => { setChangeTable(v); setChangePage(0); }}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {AUDITED_TABLES.map((t) => <SelectItem key={t} value={t}>{stripTbl(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Operation</Label>
              <Select value={changeOp} onValueChange={(v) => { setChangeOp(v); setChangePage(0); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All operations</SelectItem>
                  <SelectItem value="INSERT">Insert</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={changeFrom} onChange={(e) => { setChangeFrom(e.target.value); setChangePage(0); }} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={changeTo} onChange={(e) => { setChangeTo(e.target.value); setChangePage(0); }} className="w-40" />
            </div>
          </div>

          {changeLoading ? (
            <LoadingSpinner />
          ) : (
            <>
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
                    {changes.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No changes recorded.</TableCell></TableRow>
                    ) : (
                      changes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap">{fmt(c.changed_at)}</TableCell>
                          <TableCell>{c.changed_by ? (profileEmails[c.changed_by] || c.changed_by.slice(0, 8)) : "System"}</TableCell>
                          <TableCell className="font-mono text-xs">{stripTbl(c.table_name)}</TableCell>
                          <TableCell><OperationPill op={c.operation} /></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{c.record_id ? c.record_id.slice(0, 8) : "—"}</TableCell>
                          <TableCell><Button variant="outline" size="sm" onClick={() => setDetail(c)}>View changes</Button></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={changePage} total={changeCount} onPage={setChangePage} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Change detail: field-level old -> new */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {detail?.operation} on {detail && stripTbl(detail.table_name)}
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
