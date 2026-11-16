import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../services/types";
import { PageLoader } from "./ui";

export default function ProtectedRoute({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, loading, loggedOut } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
