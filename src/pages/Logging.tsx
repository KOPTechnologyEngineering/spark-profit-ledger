import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { refreshLogLevel } from "@/lib/logger";
import PageHeader from "@/components/PageHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import TablePagination, { DEFAULT_PAGE_SIZE } from "@/components/TablePagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, Trash2 } from "lucide-react";

const LEVELS = ["TRACE", "DEBUG", "INFO", "EVENT", "WARN", "ERROR", "FATAL"] as const;
const LEVEL_NUM: Record<string, number> = {
  TRACE: 10, DEBUG: 20, INFO: 30, EVENT: 40, WARN: 50, ERROR: 60, FATAL: 70, OFF: 99,
};
const SETTING_LEVELS = [...LEVELS, "OFF"] as const;

interface LogRow {
  id: string;
  ts: string;
  level: string;
  level_num: number;
  source: string;
  logger: string | null;
  message: string;
  correlation_id: string | null;
  session_id: string | null;
  user_id: string | null;
  user_email: string | null;
  http_method: string | null;
  endpoint: string | null;
  query: string | null;
  status_code: number | null;
  duration_ms: number | null;
  cs_bytes: number | null;
  sc_bytes: number | null;
  request_at: string | null;
  response_at: string | null;
  client_ip: string | null;
  user_agent: string | null;
  error_code: string | null;
  error_detail: string | null;
  context: Record<string, unknown> | null;
  app_version: string | null;
  environment: string | null;
}

interface SettingRow {
  id: string;
  scope: string;
  user_id: string | null;
  level: string;
  retention_days: number;
  enabled: boolean;
}

const fmt = (ts: string) => new Date(ts).toLocaleString("en-GB");
const dayStart = (d: string) => `${d}T00:00:00.000Z`;
const dayEnd = (d: string) => `${d}T23:59:59.999Z`;

function LevelPill({ level }: { level: string }) {
  const cls =
    level === "ERROR" || level === "FATAL"
      ? "bg-outflow-muted text-outflow"
      : level === "WARN"
        ? "bg-warning/15 text-warning"
        : level === "EVENT"
          ? "bg-primary/10 text-primary"
          : level === "INFO"
            ? "bg-inflow-muted text-inflow"
            : "bg-secondary text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

export default function Logging() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasAdmin, loading: rolesLoading } = useUserRoles();
  const isAdmin = hasAdmin("users");

  const [profiles, setProfiles] = useState<{ user_id: string; email: string }[]>([]);

  // ---- settings ----
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [globalRow, setGlobalRow] = useState<SettingRow | null>(null);
  const [overrides, setOverrides] = useState<SettingRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [newOverrideUser, setNewOverrideUser] = useState("");
  const [newOverrideLevel, setNewOverrideLevel] = useState<string>("DEBUG");

  // ---- viewer ----
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [logPageSize, setLogPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [logsLoading, setLogsLoading] = useState(true);
  const [fLevel, setFLevel] = useState("all");
  const [fSource, setFSource] = useState("all");
  const [fUser, setFUser] = useState("all");
  const [fMethod, setFMethod] = useState("all");
  const [fStatus, setFStatus] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [fSearchApplied, setFSearchApplied] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [detail, setDetail] = useState<LogRow | null>(null);

  const loadSettings = async () => {
    setSettingsLoading(true);
    const { data, error } = await supabase.from("tbl_log_settings").select("*");
    if (error) {
      toast({ title: "Couldn't load log settings", description: friendlyErrorMessage(error), variant: "destructive" });
    } else {
      const rows = (data as SettingRow[]) || [];
      setGlobalRow(rows.find((r) => r.scope === "global") ?? null);
      setOverrides(rows.filter((r) => r.scope === "user"));
    }
    setSettingsLoading(false);
  };

  useEffect(() => {
    if (rolesLoading || !isAdmin) return;
    supabase.from("tbl_profiles").select("user_id, email").then(({ data }) => {
      setProfiles(((data as any[]) || []).map((p) => ({ user_id: p.user_id, email: p.email })));
    });
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, isAdmin]);

  // Debounced free-text search.
  useEffect(() => {
    const t = setTimeout(() => {
      setFSearchApplied(fSearch.trim());
      setLogPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [fSearch]);

  // Fetch a page of logs (server-side filter + paginate).
  useEffect(() => {
    if (rolesLoading || !isAdmin) return;
    (async () => {
      setLogsLoading(true);
      let q = supabase.from("tbl_app_log").select("*", { count: "exact" }).order("ts", { ascending: false });
      if (fLevel !== "all") q = q.gte("level_num", LEVEL_NUM[fLevel]);
      if (fSource !== "all") q = q.eq("source", fSource);
      if (fUser !== "all") q = q.eq("user_id", fUser);
      if (fMethod !== "all") q = q.eq("http_method", fMethod);
      if (fStatus.trim() && Number.isFinite(Number(fStatus))) q = q.eq("status_code", Number(fStatus));
      if (fSearchApplied) {
        const s = fSearchApplied;
        q = q.or(`message.ilike.%${s}%,endpoint.ilike.%${s}%,correlation_id.ilike.%${s}%`);
      }
      if (fFrom) q = q.gte("ts", dayStart(fFrom));
      if (fTo) q = q.lte("ts", dayEnd(fTo));
      const start = logPage * logPageSize;
      const { data, count, error } = await q.range(start, start + logPageSize - 1);
      if (error) toast({ title: "Couldn't load logs", description: friendlyErrorMessage(error), variant: "destructive" });
      setLogs((data as LogRow[]) || []);
      setLogCount(count || 0);
      setLogsLoading(false);
    })();
  }, [rolesLoading, isAdmin, fLevel, fSource, fUser, fMethod, fStatus, fSearchApplied, fFrom, fTo, logPage, logPageSize, toast]);

  const saveGlobal = async () => {
    if (!globalRow) return;
    setSaving(true);
    const { error } = await supabase
      .from("tbl_log_settings")
      .update({
        level: globalRow.level,
        enabled: globalRow.enabled,
        retention_days: globalRow.retention_days,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("id", globalRow.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save settings", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Log settings saved", description: `Application level is now ${globalRow.level}.` });
    void refreshLogLevel();
    void loadSettings();
  };

  const addOverride = async () => {
    if (!newOverrideUser) return;
    const { error } = await supabase.from("tbl_log_settings").insert({
      scope: "user",
      user_id: newOverrideUser,
      level: newOverrideLevel,
      updated_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Couldn't add override", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    setNewOverrideUser("");
    toast({ title: "Override added" });
    void refreshLogLevel();
    void loadSettings();
  };

  const updateOverride = async (row: SettingRow, level: string) => {
    const { error } = await supabase
      .from("tbl_log_settings")
      .update({ level, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Couldn't update override", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    void refreshLogLevel();
    void loadSettings();
  };

  const removeOverride = async (row: SettingRow) => {
    const { error } = await supabase.from("tbl_log_settings").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Couldn't remove override", description: friendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Override removed" });
    void refreshLogLevel();
    void loadSettings();
  };

  const emailFor = (id: string | null) =>
    id ? profiles.find((p) => p.user_id === id)?.email ?? id.slice(0, 8) : "—";

  if (!rolesLoading && !isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Logging" subtitle="Application log levels and log viewer" />
        <div className="glass-card flex items-center gap-3 p-8 text-muted-foreground">
          <ShieldAlert className="h-5 w-5 text-warning" />
          You need Users-module admin access to view application logs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Logging" subtitle="Application log levels and log viewer" />

      <Tabs defaultValue="viewer">
        <TabsList>
          <TabsTrigger value="viewer">Log Viewer</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ---------------- LOG VIEWER ---------------- */}
        <TabsContent value="viewer" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Message, endpoint or correlation id..."
                value={fSearch}
                onChange={(e) => setFSearch(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min level</Label>
              <Select value={fLevel} onValueChange={(v) => { setFLevel(v); setLogPage(0); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}+</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={fSource} onValueChange={(v) => { setFSource(v); setLogPage(0); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="edge">Edge</SelectItem>
                  <SelectItem value="db">DB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">User</Label>
              <Select value={fUser} onValueChange={(v) => { setFUser(v); setLogPage(0); }}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Method</Label>
              <Select value={fMethod} onValueChange={(v) => { setFMethod(v); setLogPage(0); }}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Input
                placeholder="e.g. 500"
                value={fStatus}
                onChange={(e) => { setFStatus(e.target.value); setLogPage(0); }}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={fFrom} onChange={(e) => { setFFrom(e.target.value); setLogPage(0); }} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={fTo} onChange={(e) => { setFTo(e.target.value); setLogPage(0); }} className="w-40" />
            </div>
          </div>

          {logsLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="glass-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ms</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No log entries found.</TableCell></TableRow>
                    ) : (
                      logs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{fmt(r.ts)}</TableCell>
                          <TableCell><LevelPill level={r.level} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                          <TableCell className="max-w-40 truncate">{r.user_email || "—"}</TableCell>
                          <TableCell className="text-xs">{r.http_method || "—"}</TableCell>
                          <TableCell className="max-w-56 truncate font-mono text-xs">{r.endpoint || "—"}</TableCell>
                          <TableCell className="text-xs">{r.status_code ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.duration_ms ?? "—"}</TableCell>
                          <TableCell className="max-w-72 truncate">{r.message}</TableCell>
                          <TableCell><Button variant="outline" size="sm" onClick={() => setDetail(r)}>Details</Button></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={logPage}
                pageSize={logPageSize}
                total={logCount}
                onPageChange={setLogPage}
                onPageSizeChange={(s) => { setLogPageSize(s); setLogPage(0); }}
              />
            </>
          )}
        </TabsContent>

        {/* ---------------- SETTINGS ---------------- */}
        <TabsContent value="settings" className="space-y-6">
          {settingsLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="glass-card space-y-4 p-6">
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">Application-wide</h3>
                  <p className="text-sm text-muted-foreground">
                    Entries at this severity and above are recorded for everyone. Raise an individual
                    user below to troubleshoot without increasing volume for the whole application.
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Log level</Label>
                    <Select
                      value={globalRow?.level ?? "WARN"}
                      onValueChange={(v) => setGlobalRow((g) => (g ? { ...g, level: v } : g))}
                    >
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SETTING_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Retention (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={globalRow?.retention_days ?? 30}
                      onChange={(e) =>
                        setGlobalRow((g) => (g ? { ...g, retention_days: Number(e.target.value) } : g))
                      }
                      className="w-28"
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      checked={globalRow?.enabled ?? true}
                      onCheckedChange={(c) => setGlobalRow((g) => (g ? { ...g, enabled: c } : g))}
                      id="logging-enabled"
                    />
                    <Label htmlFor="logging-enabled" className="text-sm">Logging enabled</Label>
                  </div>
                  <Button onClick={saveGlobal} disabled={saving || !globalRow}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Entries older than the retention period are purged nightly.
                </p>
              </div>

              <div className="glass-card space-y-4 p-6">
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">Per-user overrides</h3>
                  <p className="text-sm text-muted-foreground">
                    A user's override replaces the application-wide level for that user only.
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">User</Label>
                    <Select value={newOverrideUser} onValueChange={setNewOverrideUser}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="Select a user" /></SelectTrigger>
                      <SelectContent>
                        {profiles
                          .filter((p) => !overrides.some((o) => o.user_id === p.user_id))
                          .map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Level</Label>
                    <Select value={newOverrideLevel} onValueChange={setNewOverrideLevel}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SETTING_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={addOverride} disabled={!newOverrideUser}>Add override</Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overrides.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No per-user overrides.</TableCell></TableRow>
                      ) : (
                        overrides.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>{emailFor(o.user_id)}</TableCell>
                            <TableCell>
                              <Select value={o.level} onValueChange={(v) => updateOverride(o, v)}>
                                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {SETTING_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeOverride(o)} aria-label="Remove override">
                                <Trash2 className="h-4 w-4 text-outflow" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Entry detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {detail?.level} · {detail?.logger || detail?.source}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <p className="break-words">{detail.message}</p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                {([
                  ["Time", fmt(detail.ts)],
                  ["Level", detail.level],
                  ["Source", detail.source],
                  ["User", detail.user_email || "—"],
                  ["Method", detail.http_method || "—"],
                  ["Status", detail.status_code ?? "—"],
                  ["Duration (ms)", detail.duration_ms ?? "—"],
                  ["cs-bytes", detail.cs_bytes ?? "—"],
                  ["sc-bytes", detail.sc_bytes ?? "—"],
                  ["Request at", detail.request_at ? fmt(detail.request_at) : "—"],
                  ["Response at", detail.response_at ? fmt(detail.response_at) : "—"],
                  ["Client IP", detail.client_ip || "—"],
                  ["Correlation", detail.correlation_id || "—"],
                  ["Session", detail.session_id || "—"],
                  ["Environment", detail.environment || "—"],
                ] as [string, string | number][]).map(([k, v]) => (
                  <div key={k}>
                    <span className="block text-muted-foreground">{k}</span>
                    <span className="break-all font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>

              {detail.endpoint && (
                <div>
                  <span className="block text-xs text-muted-foreground">Endpoint</span>
                  <code className="break-all text-xs">{detail.endpoint}{detail.query ? `?${detail.query}` : ""}</code>
                </div>
              )}

              {detail.error_detail && (
                <div>
                  <span className="block text-xs text-muted-foreground">
                    Error{detail.error_code ? ` (${detail.error_code})` : ""}
                  </span>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-secondary p-3 text-xs text-outflow">
                    {detail.error_detail}
                  </pre>
                </div>
              )}

              {detail.context && (
                <div>
                  <span className="block text-xs text-muted-foreground">Context</span>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-secondary p-3 text-xs">
                    {JSON.stringify(detail.context, null, 2)}
                  </pre>
                </div>
              )}

              {detail.user_agent && (
                <div>
                  <span className="block text-xs text-muted-foreground">User agent</span>
                  <span className="break-all text-xs">{detail.user_agent}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
