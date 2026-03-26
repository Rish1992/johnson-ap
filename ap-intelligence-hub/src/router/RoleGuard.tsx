import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/user';

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
