import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import FullScreenSpinner from "@/components/FullScreenSpinner";
import AppLayout from "@/layouts/AppLayout";
import CollectionsLayout from "@/layouts/CollectionsLayout";

// Route-level code splitting: each page is its own chunk, downloaded on
// first visit rather than bundled into the initial load. AppLayout wraps its
// <Outlet /> in its own Suspense, so navigating between authenticated pages
// only shows a spinner in the content area (sidebar/header stay mounted);
// the Suspense below covers the very first load and the public routes that
// render outside AppLayout (auth, reset-password, unsubscribe).
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Transactions = lazy(() => import("@/pages/Transactions"));
const ProfitLoss = lazy(() => import("@/pages/ProfitLoss"));
const VAT = lazy(() => import("@/pages/VAT"));
const PAYE = lazy(() => import("@/pages/PAYE"));
const Reports = lazy(() => import("@/pages/Reports"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const Organizations = lazy(() => import("@/pages/Organizations"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const CollectionsDashboard = lazy(() => import("@/pages/collections/CollectionsDashboard"));
const ChaseQueue = lazy(() => import("@/pages/collections/ChaseQueue"));
const AutomationRules = lazy(() => import("@/pages/collections/AutomationRules"));
const EmailTemplates = lazy(() => import("@/pages/collections/EmailTemplates"));
const Escalations = lazy(() => import("@/pages/collections/Escalations"));
const PaymentPromises = lazy(() => import("@/pages/collections/PaymentPromises"));
const Disputes = lazy(() => import("@/pages/collections/Disputes"));
const CollectionsReports = lazy(() => import("@/pages/collections/CollectionsReports"));
const CollectionsSettings = lazy(() => import("@/pages/collections/CollectionsSettings"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/pnl" element={<ProfitLoss />} />
                <Route path="/vat" element={<VAT />} />
                <Route path="/paye" element={<PAYE />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/organizations" element={<Organizations />} />
                <Route path="/collections" element={<CollectionsLayout />}>

                  <Route index element={<CollectionsDashboard />} />
                  <Route path="queue" element={<ChaseQueue />} />
                  <Route path="rules" element={<AutomationRules />} />
                  <Route path="templates" element={<EmailTemplates />} />
                  <Route path="escalations" element={<Escalations />} />
                  <Route path="promises" element={<PaymentPromises />} />
                  <Route path="disputes" element={<Disputes />} />
                  <Route path="reports" element={<CollectionsReports />} />
                  <Route path="settings" element={<CollectionsSettings />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
