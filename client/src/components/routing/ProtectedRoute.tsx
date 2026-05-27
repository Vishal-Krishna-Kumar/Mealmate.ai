import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMe } from '@/hooks/useAuth';

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const { isError } = useMe();

  // If /auth/me rejects (token invalid/expired), the api 401 interceptor clears auth.
  useEffect(() => {
    /* no-op: useMe runs side effects via store */
  }, [isError]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/recipes" replace />;
  return <Outlet />;
}
