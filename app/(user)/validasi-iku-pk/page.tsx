'use client';

import { useAuth } from '@/hooks/useAuth';
import ValidasiIKUPKContent from '@/features/validasi-iku-pk/ValidasiIKUPKContent';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <ValidasiIKUPKContent role="user" />;
}
