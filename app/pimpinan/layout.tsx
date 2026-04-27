"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import Header from '@/components/layout/Header';

export default function PimpinanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/landing');
  };
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
        <Sidebar role="pimpinan" unitNama={user?.unitNama} />
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
