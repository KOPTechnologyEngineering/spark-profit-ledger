import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import CollectionsLayout from "@/layouts/CollectionsLayout";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import Transactions from "@/pages/Transactions";
import ProfitLoss from "@/pages/ProfitLoss";
import VAT from "@/pages/VAT";
import PAYE from "@/pages/PAYE";
import Reports from "@/pages/Reports";
import UserManagement from "@/pages/UserManagement";
import Organizations from "@/pages/Organizations";
import Approvals from "@/pages/Approvals";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import CollectionsDashboard from "@/pages/collections/CollectionsDashboard";
import ChaseQueue from "@/pages/collections/ChaseQueue";
import AutomationRules from "@/pages/collections/AutomationRules";
import EmailTemplates from "@/pages/collections/EmailTemplates";
import Escalations from "@/pages/collections/Escalations";
import PaymentPromises from "@/pages/collections/PaymentPromises";
import Disputes from "@/pages/collections/Disputes";
import CollectionsReports from "@/pages/collections/CollectionsReports";
import CollectionsSettings from "@/pages/collections/CollectionsSettings";
import Unsubscribe from "@/pages/Unsubscribe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
