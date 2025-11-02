import { Navigate, useLocation } from 'react-router-dom';

import type { Role } from '../types';
import { useAuth } from '../hooks/useAuth';

interface RequireRoleProps {
  allowed: Role[];
  children: JSX.Element;
}

export function RequireRole({ allowed, children }: RequireRoleProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return null;
  }

  const role = user.role;
  const isSuperadmin = role === 'superadmin';
  const isAllowed = isSuperadmin || allowed.includes(role);

  if (!isAllowed) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
