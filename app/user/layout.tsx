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


      {/* PAGE CONTENT */}
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "0",
          display: "flex",
          gap: 0,
          minHeight: "calc(100vh - 68px)",
        }}
      >
        <Sidebar role="user" unitNama={user?.unitNama} roleLevel={user?.roleLevel} />
        <main
          style={{
            flex: 1,
            padding: "24px 32px",
            overflowY: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </>
  );
}
