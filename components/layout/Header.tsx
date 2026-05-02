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

  const initials = user?.nama
    ? user.nama.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
    : 'U';

  return (
    <div className="header-wrapper">
      <div className="header-container">

        {/* LEFT */}
        <div className="header-left">
          <div className="header-logo">
            <Image src="/logo-upnvj.webp" alt="UPN Logo" width={46} height={46} />
          </div>
          <div className="header-divider-vert" />
          <div className="header-text">
            <p className="header-title">IKU &amp; Perjanjian Kerja</p>
            <p className="header-subtitle">UPN Veteran Jakarta</p>
          </div>
        </div>

        {/* RIGHT — only shown when logged in */}
        {user && (
          <div className="header-right">

            {/* Notification */}
            <button className="header-notif-btn" title="Notifikasi">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            {/* Profile Trigger */}
            <div ref={dropdownRef} className="header-profile-wrapper">
              <button
                className="header-profile-trigger"
                onClick={() => setProfileOpen((o) => !o)}
              >
                <div className="header-avatar-circle">
                  {initials}
                </div>
                <div className="header-profile-info">
                  <span className="header-profile-name">{user.nama}</span>
                  <span className="header-profile-role">{(user as any)?.role || (user as any)?.unitNama || 'Pengguna'}</span>
                </div>
                <svg
                  className={`header-chevron ${profileOpen ? 'open' : ''}`}
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="header-dropdown">
                  <div className="header-dropdown-header">
                    <div className="header-dropdown-avatar">{initials}</div>
                    <div>
                      <p className="header-dropdown-name">{user.nama}</p>
                      <p className="header-dropdown-email">{user.email || ''}</p>
                    </div>
                  </div>
                  <div className="header-dropdown-divider" />
                  <button onClick={handleLogout} className="header-dropdown-logout">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Keluar
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
