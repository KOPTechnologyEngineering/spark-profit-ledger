import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Search, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import SummaryTile from "@/components/SummaryTile";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type OrgRow = Tables<"tbl_organizations">;
type OrgType = "customer" | "vendor" | "both";

const emptyForm = {
  name: "",
  org_type: "customer" as OrgType,
  email: "",
  phone: "",
  address: "",
  vat_number: "",
  nature_of_business: "",
  notes: "",
};

const typeFilters = ["all", "customer", "vendor", "both"] as const;

const typeStyles: Record<OrgType, string> = {
  customer: "bg-inflow/10 text-inflow border-inflow/20",
  vendor: "bg-outflow/10 text-outflow border-outflow/20",
  both: "bg-primary/10 text-primary border-primary/20",
};

export default function Organizations() {
  const { user } = useAuth();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tbl_organizations")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data || []) as OrgRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (org: OrgRow) => {
    setEditing(org);
    setForm({
      name: org.name,
      org_type: org.org_type as OrgType,
      email: org.email || "",
      phone: org.phone || "",
      address: org.address || "",
      vat_number: org.vat_number || "",
      nature_of_business: (org as any).nature_of_business || "",
      notes: org.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      org_type: form.org_type,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      vat_number: form.vat_number.trim() || null,
      nature_of_business: form.nature_of_business.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("tbl_organizations").update(payload).eq("id", editing.id)
      : await supabase.from("tbl_organizations").insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Organization updated" : "Organization added");
    setDialogOpen(false);
    fetchOrgs();
  };

  const handleDelete = async (org: OrgRow) => {
    if (!confirm(`Delete "${org.name}"?`)) return;
    const { error } = await supabase
      .from("tbl_organizations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", org.id);
    if (error) return toast.error(error.message);
    toast.success("Organization removed");
    fetchOrgs();
  };

  const filtered = rows.filter((r) => {
    if (typeFilter !== "all" && r.org_type !== typeFilter) return false;
    if (search && !`${r.name} ${r.email || ""} ${r.vat_number || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const customerCount = rows.filter((r) => r.org_type === "customer" || r.org_type === "both").length;
  const vendorCount = rows.filter((r) => r.org_type === "vendor" || r.org_type === "both").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader title="Organizations" subtitle="Manage the customers and vendors you do business with">
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New organization
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile label="Total" value={String(rows.length)} />
        <SummaryTile label="Customers" value={String(customerCount)} tone="inflow" />
        <SummaryTile label="Vendors" value={String(vendorCount)} tone="outflow" />

      </div>


      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card"
      >
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or VAT number"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: typeof typeFilter) => setTypeFilter(v)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
              <SelectItem value="vendor">Vendors</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No organizations found. Click "New organization" to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">VAT number</TableHead>
                  <TableHead className="hidden xl:table-cell">Nature of business</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${typeStyles[org.org_type as OrgType]}`}>
                        {org.org_type}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{org.email || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{org.phone || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{org.vat_number || "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{(org as any).nature_of_business || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(org)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(org)}>
                        <Trash2 className="h-4 w-4 text-outflow" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit organization" : "New organization"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.org_type} onValueChange={(v: OrgType) => setForm({ ...form, org_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>VAT number</Label>
                <Input value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Nature of business</Label>
                <Input
                  placeholder="e.g. Software consultancy, Retail, Construction"
                  value={form.nature_of_business}
                  onChange={(e) => setForm({ ...form, nature_of_business: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save changes" : "Add organization"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
