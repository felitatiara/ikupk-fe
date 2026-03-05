'use client';

import { useAuth } from '@/hooks/useAuth';
import TargetIKUPKContent from '@/features/target-iku-pk/TargetIKUPKContent';
import UserLayoutWrapper from '@/components/layout/UserLayoutWrapper';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserTargetPage() {
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

  return (
    <UserLayoutWrapper>
      <TargetIKUPKContent role="user" />
    </UserLayoutWrapper>
  );
}
