'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from "next/image";

export default function Header() {
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout, user } = useAuth();
  const router = useRouter();

  // Close dropdown when clicking outside
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
    router.push('/auth/login');
  };

  return (
    <div className="header-wrapper">
  <div className="header-container">

    {/* LEFT */}
    <div className="header-left">
      <div className="header-logo">
        <Image src="/logo-upnvj.webp" alt="UPN Logo" width={44} height={44} />
      </div>

      <div className="header-text">
        <p className="header-title">
          Indikator Kinerja Utama & Perjanjian Kerja
        </p>
        <p className="header-subtitle">
          UPN Veteran Jakarta
        </p>
      </div>
    </div>

    {/* RIGHT */}
    <div className="header-right">
      
      
      {/* PROFILE */}
      <div ref={dropdownRef} className="header-profile-section">
        
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="header-username-btn"
        >
          {user?.nama || "Nama User"}
        </button>
    {/* NOTIFICATION */}
      <button className="header-icon-btn">
        🔔
      </button>

        <div
          className="header-profile-avatar"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <img src="/image.png" alt="Profile" />
        </div>

        {/* DROPDOWN */}
        {profileOpen && (
          <div className="header-dropdown-menu">
            <button
              onClick={handleLogout}
              className="header-logout-btn"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </div>

  </div>
</div>
  );
}
