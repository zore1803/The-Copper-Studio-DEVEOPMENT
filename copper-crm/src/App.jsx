import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";
import LoadingScreen from "./components/LoadingScreen";

// Every route is code-split so the initial bundle stays small and a hard
// refresh only downloads the chunk for the page you're on, not the whole app.
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const ClientLayout = lazy(() => import("./layouts/ClientLayout"));

const Companies = lazy(() => import("./pages/crm/Companies"));
const CompanyDetail = lazy(() => import("./pages/crm/CompanyDetail"));
const Contacts = lazy(() => import("./pages/crm/Contacts"));
const ContactDetail = lazy(() => import("./pages/crm/ContactDetail"));
const ProjectsList = lazy(() => import("./pages/projects/ProjectsList"));
const ProjectDetail = lazy(() => import("./pages/projects/ProjectDetail"));
const ProjectTimeline = lazy(() => import("./pages/projects/ProjectTimeline"));
const TimelinePage = lazy(() => import("./pages/projects/TimelinePage"));
const ProjectFiles = lazy(() => import("./pages/projects/ProjectFiles"));
const KanbanBoard = lazy(() => import("./pages/projects/KanbanBoard"));
const Payments = lazy(() => import("./pages/billing/Payments"));
const Invoices = lazy(() => import("./pages/billing/Invoices"));
const Coupons = lazy(() => import("./pages/billing/Coupons"));
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const ClientBillingPage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientBillingPage })));
const ClientDocumentsPage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientDocumentsPage })));
const ClientMeetingsPage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientMeetingsPage })));
const ClientPurchasesPage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientPurchasesPage })));
const ClientSettingsPage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientSettingsPage })));
const ClientSupportPage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientSupportPage })));
const ClientTimelinePage = lazy(() => import("./pages/client/ClientPages").then((m) => ({ default: m.ClientTimelinePage })));
const LoginPage = lazy(() => import("./pages/auth/AuthPages").then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import("./pages/auth/AuthPages").then((m) => ({ default: m.ForgotPasswordPage })));
const SetPasswordPage = lazy(() => import("./pages/auth/AuthPages").then((m) => ({ default: m.SetPasswordPage })));
const SettingsPage = lazy(() => import("./pages/admin/AdminWorkflows").then((m) => ({ default: m.SettingsPage })));
const SettingsProfilePage = lazy(() => import("./pages/admin/AdminWorkflows").then((m) => ({ default: m.SettingsProfilePage })));
const SettingsTriggerTemplatePage = lazy(() => import("./pages/admin/AdminWorkflows").then((m) => ({ default: m.SettingsTriggerTemplatePage })));
const SettingsDataFieldsPage = lazy(() => import("./pages/admin/AdminWorkflows").then((m) => ({ default: m.SettingsDataFieldsPage })));
const SettingsPricingPage = lazy(() => import("./pages/admin/AdminWorkflows").then((m) => ({ default: m.SettingsPricingPage })));
const TasksPage = lazy(() => import("./pages/admin/AdminWorkflows").then((m) => ({ default: m.TasksPage })));
const DatabaseTablesPage = lazy(() => import("./pages/admin/AdminTabs").then((m) => ({ default: m.DatabaseTablesPage })));
const ProposalGeneratorPage = lazy(() => import("./pages/admin/AdminTabs").then((m) => ({ default: m.ProposalGeneratorPage })));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const CommunicationCenter = lazy(() => import("./pages/admin/CommunicationCenter"));
const DocumentCenter = lazy(() => import("./pages/admin/DocumentCenter"));
const PublicPackages = lazy(() => import("./pages/public/PublicPackages"));

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
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
              <Route index element={<AnalyticsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="companies" element={<Companies />} />
              <Route path="companies/:companyId" element={<CompanyDetail />} />
              <Route path="companies/:companyId/projects/:projectId" element={<ProjectDetail />} />
              <Route path="companies/:companyId/projects/:projectId/tasks" element={<ProjectTimeline />} />
              <Route path="companies/:companyId/projects/:projectId/files" element={<ProjectFiles />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="contacts/:contactId" element={<ContactDetail />} />
              <Route path="projects" element={<ProjectsList />} />
              <Route path="timeline" element={<TimelinePage />} />
              <Route path="kanban" element={<KanbanBoard />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="payments" element={<Payments />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="services" element={<Navigate to="/admin/services/proposal-generator" replace />} />
              <Route path="services/coupon-generator" element={<Navigate to="/admin/coupons" replace />} />
              <Route path="services/proposal-generator" element={<ProposalGeneratorPage />} />
              <Route path="services/communications" element={<Navigate to="/admin/communication/email-templates" replace />} />
              <Route path="documents" element={<DocumentCenter />} />
              <Route path="documents/company-folders" element={<Navigate to="/admin/documents" replace />} />
              <Route path="documents/project-folders" element={<Navigate to="/admin/documents" replace />} />
              <Route path="communication/email-templates" element={<CommunicationCenter mode="email" />} />
              <Route path="communication/whatsapp-templates" element={<CommunicationCenter mode="whatsapp" />} />
              <Route path="proposal-generator" element={<Navigate to="/admin/services/proposal-generator" replace />} />
              <Route path="database" element={<DatabaseTablesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/profile" element={<SettingsProfilePage />} />
              <Route path="settings/trigger-template" element={<SettingsTriggerTemplatePage />} />
              <Route path="settings/data-fields" element={<SettingsDataFieldsPage />} />
              <Route path="settings/pricing" element={<SettingsPricingPage />} />
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
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
