'use client';

import { useAuth } from './useAuth';
import { User } from '@/types';

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useIsAdmin(): boolean {
  const user = useUser();
  return (user?.roleLevel ?? 99) === 0;
}

export function useIsSuperAdmin(): boolean {
  const user = useUser();
  return (user?.roleLevel ?? 99) === 0;
}
