import { Link, Route, Routes } from "react-router-dom";
import { Sprout } from "lucide-react";
import PublicLayout from "./layouts/PublicLayout";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import { ForgotPasswordPage, LoginPage, RegisterPage } from "./pages/AuthPages";
import Dashboard from "./pages/Dashboard";
import Detect from "./pages/Detect";
import HistoryPage, { ScanDetailPage } from "./pages/History";
import Diseases from "./pages/Diseases";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDiseases from "./pages/admin/AdminDiseases";
import { useI18n } from "./i18n";

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Sprout className="h-12 w-12 text-forest-700" />
      <h1 className="text-2xl font-bold text-forest-900">404 · {t("common.notFound")}</h1>
      <Link to="/" className="btn-primary">{t("common.goHome")}</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="detect" element={<Detect />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:id" element={<ScanDetailPage />} />
        <Route path="diseases" element={<Diseases />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute role="admin"><AdminUsers /></ProtectedRoute>} />
        <Route path="admin/diseases" element={<ProtectedRoute role="admin"><AdminDiseases /></ProtectedRoute>} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
