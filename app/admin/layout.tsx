"use client";

import Sidebar from "@/components/layout/Sidebar";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

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
              👤
            </button>
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
        }}
      >
          <Sidebar unitNama={user?.unitNama} unitId={user?.unitId} authRole={user?.role} />
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
