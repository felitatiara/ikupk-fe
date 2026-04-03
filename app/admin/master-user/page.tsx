"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUnits } from '@/lib/api';
import InputUserContent from "@/features/master-user/InputUserContent";

export default function AdminMasterUserPage() {
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
      if (fromSession.includes('fakultas')) {
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
        const isFakultas = normalizedUnit.includes('fakultas');
        setCanAccess(isFakultas);
        setCheckingAccess(false);
        if (!isFakultas) {
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
  if (!canAccess) return null;

  return <InputUserContent />;
}
