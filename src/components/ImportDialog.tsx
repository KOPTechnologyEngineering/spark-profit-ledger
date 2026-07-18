import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { normalizeHeader, parseImportRows, type ImportColumn, type ParsedImportRow } from "@/lib/import";
import { useToast } from "@/hooks/use-toast";

export type { ImportColumn };

interface ImportDialogProps {
  title: string;
  triggerLabel?: string;
  columns: ImportColumn[];
  /** One example row, in the same order as `columns`, used to build the downloadable template. */
  sampleRow: (string | number)[];
  onImport: (rows: Record<string, string | number>[]) => Promise<{ error?: string }>;
  onImported?: () => void;
}

export default function ImportDialog({ title, triggerLabel = "Import CSV", columns, sampleRow, onImport, onImported }: ImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const reset = () => {
    setFileName("");
    setParsed(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    downloadCSV(
      `${normalizeHeader(title)}_template.csv`,
      columns.map((c) => c.label),
      [sampleRow],
    );
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setParsed(parseImportRows(text, columns));
  };

  const validRows = parsed?.filter((r) => r.errors.length === 0) ?? [];
  const invalidCount = (parsed?.length ?? 0) - validRows.length;

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    const { error } = await onImport(validRows.map((r) => r.data));
    setImporting(false);
    if (error) {
      toast({ title: "Import failed", description: error, variant: "destructive" });
      return;
    }
    toast({
      title: "Import complete",
      description: `Imported ${validRows.length} row${validRows.length === 1 ? "" : "s"}.${invalidCount > 0 ? ` Skipped ${invalidCount} row${invalidCount === 1 ? "" : "s"} with errors.` : ""}`,
    });
    setOpen(false);
    reset();
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg bg-secondary/50 p-4">
            <div className="text-sm text-muted-foreground">
              Download the CSV template, fill it in, then upload it below.
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Download template
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
            <span className="text-sm text-muted-foreground truncate">{fileName || "No file selected"}</span>
          </div>

          {parsed && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-inflow"><CheckCircle2 className="h-4 w-4" /> {validRows.length} valid</span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-outflow"><AlertCircle className="h-4 w-4" /> {invalidCount} with errors (will be skipped)</span>
                )}
              </div>

              <div className="glass-card overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="px-3 py-2">Row</th>
                        {columns.map((c) => (
                          <th key={c.key} className="px-3 py-2">{c.label}</th>
                        ))}
                        <th className="px-3 py-2">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((r) => (
                        <tr key={r.index} className={`border-b border-border last:border-0 ${r.errors.length ? "bg-outflow-muted" : ""}`}>
                          <td className="px-3 py-2 text-muted-foreground">{r.index}</td>
                          {columns.map((c) => (
                            <td key={c.key} className="px-3 py-2 text-foreground">{String(r.data[c.key] ?? "—")}</td>
                          ))}
                          <td className="px-3 py-2 text-outflow text-xs">{r.errors.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Button type="button" className="w-full" onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing ? "Importing…" : `Import ${validRows.length} row${validRows.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
