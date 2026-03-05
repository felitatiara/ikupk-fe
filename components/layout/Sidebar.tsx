"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  role?: 'admin' | 'user';
}

export default function Sidebar({ role = 'user' }: SidebarProps) {
  const pathname = usePathname();

  const getUserMenus = () => [
    { key: "beranda", label: "Beranda", href: "/dashboard" },
    { key: "monitoring", label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
    { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "/iku-pk" },
    { key: "validasi", label: "Validasi Indikator Kinerja Utama & Perjanjian Kerja", href: "/validasi-iku-pk" },
    { key: "pengajuan", label: "Pengajuan Indikator Kinerja Utama & Perjanjian Kerja", href: "/pengajuan-iku" },
    { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/target-iku-pk" },
  ];

  const getAdminMenus = () => [
    { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
    { key: "monitoring", label: "Monitoring Unit Kerja", href: "/admin/monitoring-unit-kerja" },
    { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/iku-pk" },
    { key: "validasi", label: "Validasi Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/validasi-iku-pk" },
    { key: "pengajuan", label: "Pengajuan Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/pengajuan-iku" },
    { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/target-iku-pk" },
  ];

  const menus = role === 'admin' ? getAdminMenus() : getUserMenus();

  const isCurrentPage = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const getActiveKey = () => {
    for (let menu of menus) {
      if (isCurrentPage(menu.href)) {
        return menu.key;
      }
    }
    return null;
  };

  const currentActive = getActiveKey();

  return (
    <aside
      style={{
        width: 240,
        backgroundColor: "#f8f9fa",
        borderRight: "1px solid #e5e7eb",
        height: "100%",
        overflowY: "auto",
        position: "sticky",
        top: 68,
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          padding: "20px 16px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Indikator Kinerja Utama & Perjanjian Kerja
        </h2>
        {role === 'admin' && (
          <div
            style={{
              fontSize: 11,
              color: "#FF7900",
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Dashboard Admin
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav
        style={{
          padding: "12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {menus.map((menu) => {
          const isActive = currentActive === menu.key;
          return (
            <Link
              key={menu.key}
              href={menu.href}
              style={{
                padding: "10px 12px",
                fontSize: 13,
                textDecoration: "none",
                borderRadius: 6,
                color: isActive ? "#FF7900" : "#6b7280",
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? "#FFF5F0" : "transparent",
                borderLeft: isActive ? "3px solid #FF7900" : "3px solid transparent",
                paddingLeft: isActive ? "9px" : "12px",
                transition: "all 0.2s ease",
                display: "block",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.color = "#FF7900";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#6b7280";
                }
              }}
            >
              {menu.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid #e5e7eb",
          marginTop: "auto",
        }}
      >
        <button
          onClick={() => {
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            window.location.href = '/auth/login';
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 13,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            backgroundColor: "white",
            color: "#6b7280",
            cursor: "pointer",
            fontWeight: 500,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#fee2e2";
            e.currentTarget.style.color = "#dc2626";
            e.currentTarget.style.borderColor = "#fecaca";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white";
            e.currentTarget.style.color = "#6b7280";
            e.currentTarget.style.borderColor = "#e5e7eb";
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
