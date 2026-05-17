"use client";

import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import Header from '@/components/layout/Header';


export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.replace('/auth/login');
    }
  }, [isAuthenticated, loading]);

  return (
    <>
      <Header />


      <div className="app-shell">
        <Sidebar role="user" unitNama={user?.unitNama} roleLevel={user?.roleLevel} />
        <main className="app-main">
          {children}
        </main>
      </div>
    </>
  );
}
