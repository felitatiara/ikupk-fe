"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import Header from '@/components/layout/Header';


export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
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
        <Sidebar role="user" unitNama={user?.unitNama} />
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
