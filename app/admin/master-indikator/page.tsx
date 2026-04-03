  "use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MasterIndikatorContent from '@/features/master-indikator/MasterIndikatorContent';
import { getUnits } from '@/lib/api';
import { useState } from 'react';

export default function MasterIndikatorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [canAccess, setCanAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (loading) return;

      if (!user || user.role !== 'admin') {
        if (!cancelled) {
          setCanAccess(false);
          setCheckingAccess(false);
          router.replace('/admin/dashboard');
        }
        return;
      }

      const fromSession = user.unitNama?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';
      if (fromSession.includes('biro pku')) {
        if (!cancelled) {
          setCanAccess(true);
          setCheckingAccess(false);
        }
        return;
      }

      try {
        const units = await getUnits();
        if (cancelled) return;
        const currentUnit = units.find((u) => u.id === user.unitId);
        const normalizedUnit = (currentUnit?.nama ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
        const isBiroPku = normalizedUnit.includes('biro pku');
        setCanAccess(isBiroPku);
        setCheckingAccess(false);
        if (!isBiroPku) {
          router.replace('/admin/dashboard');
        }
      } catch {
        if (cancelled) return;
        setCanAccess(false);
        setCheckingAccess(false);
        router.replace('/admin/dashboard');
      }
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (loading || checkingAccess) return null;
  if (!canAccess) {
    return null;
  }

  return <MasterIndikatorContent />;
}
