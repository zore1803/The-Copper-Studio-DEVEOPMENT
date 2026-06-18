import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import ClientLayout from "./layouts/ClientLayout";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";

import Dashboard from "./pages/Dashboard";
import Companies from "./pages/crm/Companies";
import CompanyDetail from "./pages/crm/CompanyDetail";
import Contacts from "./pages/crm/Contacts";
import ContactDetail from "./pages/crm/ContactDetail";
import ProjectsList from "./pages/projects/ProjectsList";
import ProjectDetail from "./pages/projects/ProjectDetail";
import ProjectTimeline from "./pages/projects/ProjectTimeline";
import ProjectFiles from "./pages/projects/ProjectFiles";
import KanbanBoard from "./pages/projects/KanbanBoard";
import Orders from "./pages/billing/Orders";
import Invoices from "./pages/billing/Invoices";
import Coupons from "./pages/billing/Coupons";
import ClientDashboard from "./pages/client/ClientDashboard";
import {
  ClientBillingPage,
  ClientDocumentsPage,
  ClientMeetingsPage,
  ClientPurchasesPage,
  ClientSettingsPage,
  ClientSupportPage,
  ClientTimelinePage
} from "./pages/client/ClientPages";
import { ForgotPasswordPage, LoginPage, SetPasswordPage } from "./pages/auth/AuthPages";
import {
  SettingsPage,
  TasksPage
} from "./pages/admin/AdminWorkflows";
import { AnalyticsPage, DatabaseTablesPage, ProposalGeneratorPage, ServicesPage } from "./pages/admin/AdminTabs";
import CommunicationCenter from "./pages/admin/CommunicationCenter";
import DocumentCenter from "./pages/admin/DocumentCenter";
import ClientProjectsPage from "./pages/admin/ClientProjectsPage";
import PublicPackages from "./pages/public/PublicPackages";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/client-secure-onboarding/access-setup" element={<SetPasswordPage />} />
          <Route path="/packages" element={<PublicPackages />} />
          <Route path="/pricing" element={<PublicPackages />} />

          {/* Admin */}
          <Route element={<ProtectedRoute role="superadmin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="companies" element={<Companies />} />
              <Route path="companies/:companyId" element={<CompanyDetail />} />
              <Route path="companies/:companyId/projects/:projectId" element={<ProjectDetail />} />
              <Route path="companies/:companyId/projects/:projectId/tasks" element={<ProjectTimeline />} />
              <Route path="companies/:companyId/projects/:projectId/files" element={<ProjectFiles />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="contacts/:contactId" element={<ContactDetail />} />
              <Route path="projects" element={<ProjectsList />} />
              <Route path="timeline" element={<ProjectsList />} />
              <Route path="kanban" element={<KanbanBoard />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="payments" element={<Orders mode="payments" />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="services" element={<Navigate to="/admin/services/proposal-generator" replace />} />
              <Route path="services/coupon-generator" element={<ServicesPage />} />
              <Route path="services/proposal-generator" element={<ProposalGeneratorPage />} />
              <Route path="services/communications" element={<Navigate to="/admin/communication/email-templates" replace />} />
              <Route path="documents/company-folders" element={<DocumentCenter mode="company" />} />
              <Route path="documents/project-folders" element={<DocumentCenter mode="project" />} />
              <Route path="communication/email-templates" element={<CommunicationCenter mode="email" />} />
              <Route path="communication/whatsapp-templates" element={<CommunicationCenter mode="whatsapp" />} />
              <Route path="proposal-generator" element={<Navigate to="/admin/services/proposal-generator" replace />} />
              <Route path="database" element={<DatabaseTablesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="client-projects" element={<ClientProjectsPage />} />
            </Route>
          </Route>

          {/* Client Portal */}
          <Route element={<ProtectedRoute role="user" />}>
            <Route path="/client" element={<ClientLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="purchases" element={<ClientPurchasesPage />} />
              <Route path="projects" element={<ClientTimelinePage />} />
              <Route path="meetings" element={<ClientMeetingsPage />} />
              <Route path="documents" element={<ClientDocumentsPage />} />
              <Route path="invoices" element={<ClientBillingPage />} />
              <Route path="support" element={<ClientSupportPage />} />
              <Route path="profile" element={<ClientSettingsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
