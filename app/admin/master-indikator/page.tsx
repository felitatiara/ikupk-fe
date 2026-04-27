  "use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MasterIndikatorContent from '@/features/master-indikator/MasterIndikatorContent';
import MasterIndikatorLayout from './MasterIndikatorLayout';
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

      if (!user) {
        if (!cancelled) {
          setCanAccess(false);
          setCheckingAccess(false);
          router.replace('/admin/dashboard');
        }
        return;
      }

      const isSuperAdmin = (user.roleLevel ?? 99) === 0;

      if (!cancelled) {
        setCanAccess(isSuperAdmin);
        setCheckingAccess(false);
        if (!isSuperAdmin) {
          router.replace('/admin/dashboard');
        }
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

  return (
    <MasterIndikatorLayout>
      <MasterIndikatorContent />
    </MasterIndikatorLayout>
  );
}

