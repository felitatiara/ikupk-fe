'use client';

import { useAuth } from './useAuth';
import { User } from '@/types';

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useIsAdmin(): boolean {
  const user = useUser();
  return user?.role === 'admin' || user?.role === 'pku';
}

export function useIsAdminPKU(): boolean {
  const user = useUser();
  return user?.role === 'admin' && user?.unitId === 4;
}
