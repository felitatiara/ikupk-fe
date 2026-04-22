'use client';

import { useAuth } from './useAuth';
import { User } from '@/types';

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useIsAdmin(): boolean {
  const user = useUser();
  const role = user?.role?.toLowerCase() || '';
  return role === 'admin' || role === 'superadmin';
}

export function useIsSuperAdmin(): boolean {
  const user = useUser();
  const role = user?.role?.toLowerCase() || '';
  return (role === 'admin' || role === 'superadmin') && user?.unitId === 1;
}
