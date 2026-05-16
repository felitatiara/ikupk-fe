"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import InputUserContent from "@/features/master-user/InputUserContent";

export default function AdminMasterUserPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = () => {
      if (loading) return;

      const isSuperAdmin = (user?.roleLevel ?? 99) === 0 || (user?.role ?? '').toLowerCase() === 'admin';

      if (!cancelled) {
        setCanAccess(isSuperAdmin);
        setCheckingAccess(false);
        if (!isSuperAdmin) router.replace('/admin/dashboard');
      }
    };

    checkAccess();
    return () => { cancelled = true; };
  }, [user, loading, router]);

  if (loading || checkingAccess) return null;
  if (!canAccess) return null;

  return <InputUserContent />;
}
