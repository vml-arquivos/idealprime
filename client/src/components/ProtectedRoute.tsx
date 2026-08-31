import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { hasPermission, type PermissionKey } from "@shared/permissions";

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
  permission?: PermissionKey;
}

export function ProtectedRoute({ children, adminOnly = false, permission }: Props) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const hasAccess = !permission || hasPermission(user?.permissions, permission, user?.role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`, { replace: true });
      return;
    }
    if (user.accountType === "BUYER") {
      setLocation("/portal", { replace: true });
      return;
    }
    if ((adminOnly && user.role !== "admin") || !hasAccess) {
      setLocation("/dashboard", { replace: true });
    }
  }, [loading, user, adminOnly, permission, hasAccess, location, setLocation]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user || user.accountType === "BUYER" || (adminOnly && user.role !== "admin") || !hasAccess) return null;
  return <>{children}</>;
}
