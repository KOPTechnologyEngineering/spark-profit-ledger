import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Shared cache keys for the tables that back "figures" shown across multiple
// pages (Dashboard, Transactions, Invoices, VAT, PAYE, Organizations,
// Recurring). Previously every page fetched these once on mount into local
// useState, so a change made on one page (or in a sibling tab that doesn't
// remount, e.g. Transactions' Recurring tab) never appeared elsewhere until
// a full browser refresh. Routing every read through these hooks means (a)
// simultaneous mounts of the same data share one request instead of firing
// duplicates, and (b) any mutation can call the matching invalidate*
// function below to make every mounted consumer refetch immediately.
export const QUERY_KEYS = {
  transactions: ["transactions"] as const,
  invoices: ["invoices"] as const,
  vatReturns: ["vat-returns"] as const,
  payeEmployees: ["paye-employees"] as const,
  organizations: ["organizations"] as const,
  recurringTransactions: ["recurring-transactions"] as const,
};

async function fetchTransactions() {
  const { data, error } = await supabase.from("tbl_transactions").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data || []) as Tables<"tbl_transactions">[];
}

async function fetchInvoices() {
  const { data, error } = await supabase.from("tbl_invoices").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Tables<"tbl_invoices">[];
}

async function fetchVatReturns() {
  const { data, error } = await supabase.from("tbl_vat_returns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Tables<"tbl_vat_returns">[];
}

async function fetchPayeEmployees() {
  const { data, error } = await supabase.from("tbl_paye_employees").select("*").order("name");
  if (error) throw error;
  return (data || []) as Tables<"tbl_paye_employees">[];
}

async function fetchOrganizations() {
  const { data, error } = await supabase
    .from("tbl_organizations")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Tables<"tbl_organizations">[];
}

async function fetchRecurringTransactions() {
  const { data, error } = await supabase
    .from("tbl_recurring_transactions")
    .select("*")
    .order("next_run_date", { ascending: true });
  if (error) throw error;
  return (data || []) as Tables<"tbl_recurring_transactions">[];
}

export function useTransactionsData() {
  return useQuery({ queryKey: QUERY_KEYS.transactions, queryFn: fetchTransactions });
}

export function useInvoicesData() {
  return useQuery({ queryKey: QUERY_KEYS.invoices, queryFn: fetchInvoices });
}

export function useVatReturnsData() {
  return useQuery({ queryKey: QUERY_KEYS.vatReturns, queryFn: fetchVatReturns });
}

export function usePayeEmployeesData() {
  return useQuery({ queryKey: QUERY_KEYS.payeEmployees, queryFn: fetchPayeEmployees });
}

export function useOrganizationsData() {
  return useQuery({ queryKey: QUERY_KEYS.organizations, queryFn: fetchOrganizations });
}

export function useRecurringTransactionsData() {
  return useQuery({ queryKey: QUERY_KEYS.recurringTransactions, queryFn: fetchRecurringTransactions });
}

export function useInvalidateFinancialData() {
  const queryClient = useQueryClient();
  return {
    invalidateTransactions: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions }),
    invalidateInvoices: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices }),
    invalidateVatReturns: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vatReturns }),
    invalidatePayeEmployees: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payeEmployees }),
    invalidateOrganizations: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations }),
    invalidateRecurringTransactions: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recurringTransactions }),
  };
}
