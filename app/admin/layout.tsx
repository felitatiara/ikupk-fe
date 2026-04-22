"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout({
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
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(to right, #FF7900, #FF9A3C)",
          color: "white",
          padding: "12px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Image
                src="/logo-upnvj.webp"
                alt="Logo UPN Veteran Jakarta"
                width={44}
                height={44}
                sizes="44px"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>
                Indikator Kinerja Utama & Perjanjian Kerja
              </p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.95, lineHeight: 1.3 }}>
                UPN Veteran Jakarta
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                backgroundColor: "rgba(255,255,255,0.15)",
                cursor: "pointer",
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.25)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.15)")
              }
            >
              🔔
            </button>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: profileOpen ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.25)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = profileOpen ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)")
                }
              >
                👤
              </button>
              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 48,
                    right: 0,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    minWidth: 160,
                    overflow: 'hidden',
                    zIndex: 200,
                  }}
                >
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "0",
          display: "flex",
          gap: 0,
          minHeight: "calc(100vh - 68px)",
          backgroundColor: "#ffffff",
        }}
      >
          <Sidebar unitNama={user?.unitNama} unitId={user?.unitId} unitJenis={user?.unitJenis} authRole={user?.role} />
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
