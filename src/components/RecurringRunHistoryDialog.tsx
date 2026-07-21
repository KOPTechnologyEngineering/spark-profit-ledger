import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";

type RunLog = {
  id: string;
  run_at: string;
  triggered_by: string;
  processed: number;
  created: number;
  error: string | null;
};

type RunDetail = {
  id: string;
  run_log_id: string;
  created_count: number;
  recurring_transaction: { description: string } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function runStatus(run: RunLog): string {
  if (run.error) return "failed";
  if (run.created > 0) return "success";
  return "no changes";
}

export default function RecurringRunHistoryDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [detailsByRun, setDetailsByRun] = useState<Record<string, RunDetail[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      setExpandedId(null);

      const { data: runsData, error: runsErr } = await supabase
        .from("tbl_recurring_run_log")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(25);
      if (runsErr) {
        toast({ title: "Couldn't load run history", description: friendlyErrorMessage(runsErr), variant: "destructive" });
        setRuns([]);
        setDetailsByRun({});
        setLoading(false);
        return;
      }
      setRuns((runsData as RunLog[]) || []);

      const runIds = (runsData ?? []).map((r) => r.id);
      if (runIds.length === 0) {
        setDetailsByRun({});
        setLoading(false);
        return;
      }

      const { data: detailsData, error: detailsErr } = await supabase
        .from("tbl_recurring_run_details")
        .select("id, run_log_id, created_count, recurring_transaction:tbl_recurring_transactions(description)")
        .in("run_log_id", runIds);
      if (detailsErr) {
        toast({ title: "Couldn't load run details", description: friendlyErrorMessage(detailsErr), variant: "destructive" });
        setDetailsByRun({});
      } else {
        const grouped: Record<string, RunDetail[]> = {};
        for (const d of (detailsData as unknown as RunDetail[]) || []) {
          (grouped[d.run_log_id] ??= []).push(d);
        }
        setDetailsByRun(grouped);
      }
      setLoading(false);
    };

    load();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recurring run history</DialogTitle>
        </DialogHeader>
        {loading ? (
          <LoadingSpinner />
        ) : runs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No runs recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Run at</TableHead>
                <TableHead>Triggered by</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const details = detailsByRun[run.id] ?? [];
                const isExpanded = expandedId === run.id;
                const canExpand = details.length > 0 || !!run.error;
                return (
                  <Fragment key={run.id}>
                    <TableRow
                      className={canExpand ? "cursor-pointer" : undefined}
                      onClick={() => canExpand && setExpandedId(isExpanded ? null : run.id)}
                    >
                      <TableCell>
                        {canExpand &&
                          (isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(run.run_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm capitalize text-muted-foreground">{run.triggered_by}</TableCell>
                      <TableCell className="text-right tabular-nums">{run.processed}</TableCell>
                      <TableCell className="text-right tabular-nums">{run.created}</TableCell>
                      <TableCell>
                        <StatusBadge status={runStatus(run)} />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={5} className="bg-secondary/40">
                          {run.error && <p className="mb-2 text-sm text-outflow">{run.error}</p>}
                          {details.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                              {details.map((d) => (
                                <li key={d.id} className="flex justify-between gap-4 text-muted-foreground">
                                  <span className="truncate">{d.recurring_transaction?.description ?? "Deleted schedule"}</span>
                                  <span className="tabular-nums">{d.created_count} created</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            !run.error && <p className="text-sm text-muted-foreground">No transactions were due.</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
