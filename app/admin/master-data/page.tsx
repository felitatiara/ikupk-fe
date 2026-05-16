"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MasterDataContent from "@/features/master-data/MasterDataContent";

export default function AdminMasterDataPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (loading) return;

      const isSuperAdmin = (user?.roleLevel ?? 99) === 0 || (user?.role ?? '').toLowerCase() === 'admin';

      if (!user || !isSuperAdmin) {
        if (!cancelled) {
          setCanAccess(false);
          setCheckingAccess(false);
          router.replace('/admin/dashboard');
        }
        return;
      }

      if (!cancelled) {
        setCanAccess(true);
        setCheckingAccess(false);
      }
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (loading || checkingAccess) return null;
  if (!canAccess) return null;

  return <MasterDataContent />;
}
