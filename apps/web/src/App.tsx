import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ApprovalsPage } from "@/pages/ApprovalsPage";
import { AuditPage } from "@/pages/AuditPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { IncidentDetailPage } from "@/pages/IncidentDetailPage";
import { IncidentsPage } from "@/pages/IncidentsPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { LoginPage } from "@/pages/LoginPage";

function AppRoutes() {
  const { token } = useAuth();
  if (!token) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
