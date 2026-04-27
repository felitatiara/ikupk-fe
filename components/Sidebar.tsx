"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activeMenu?: string;
  onMenuChange?: (menuKey: string) => void;
  unitNama?: string;
  authRole?: string;
}

export default function Sidebar({ activeMenu, onMenuChange, unitNama, authRole }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const role = (authRole || user?.role || "").toLowerCase();
  const isSuperAdmin = (user?.roleLevel ?? 99) === 0;

  function getMenus() {
    if (role === "superadmin" && isSuperAdmin) {
      return [
        { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/admin/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/admin/iku-pk" },
        { key: "validasi", label: "Validasi IKU PK", href: "/admin/validasi-iku-pk" },
        { key: "target-iku-pk", label: "Target IKU PK", href: "/admin/target-iku-pk" },
        { key: "master-indikator", label: "Master Indikator", href: "/admin/master-indikator" },
        { key: "master-user", label: "Master User", href: "/admin/master-user" },
      ];
    }
    if (role === "admin" && isSuperAdmin) {
      return [
        { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/admin/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/admin/iku-pk" },
        { key: "validasi", label: "Validasi IKU PK", href: "/admin/validasi-iku-pk" },
        { key: "target-iku-pk", label: "Target IKU PK", href: "/admin/target-iku-pk" },
        { key: "master-indikator", label: "Master Indikator", href: "/admin/master-indikator" },
      ];
    }
    // User biasa / admin non-FIK
    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
      { key: "monitoring", label: "Monitoring Unit Kerja", href: "/admin/monitoring-unit-kerja" },
      { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/admin/iku-pk" },
      { key: "validasi", label: "Validasi IKU PK", href: "/admin/validasi-iku-pk" },
    ];
  }

  const menus = getMenus();

  const isActive = (href: string) => {
    if (activeMenu) {
      return menus.find((m) => m.href === href)?.key === activeMenu;
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100%",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #f3f4f6",
        padding: "24px 0",
        flexShrink: 0,
      }}
    >
      {/* Unit info */}
      {unitNama && (
        <div
          style={{
            padding: "0 20px 16px",
            borderBottom: "1px solid #f3f4f6",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Unit</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>
            {unitNama}
          </p>
          {role && (
            <span
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 99,
                background: role === "superadmin" ? "#fef3c7" : role === "admin" ? "#dbeafe" : "#f3f4f6",
                color: role === "superadmin" ? "#92400e" : role === "admin" ? "#1d4ed8" : "#6b7280",
                textTransform: "capitalize",
              }}
            >
              {role}
            </span>
          )}
        </div>
      )}

      <nav style={{ padding: "0 12px" }}>
        {menus.map((m) => {
          const active = isActive(m.href);
          return (
            <Link
              key={m.key}
              href={m.href}
              onClick={() => onMenuChange?.(m.key)}
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 4,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "#FF7900" : "#6b7280",
                backgroundColor: active ? "#fff7ed" : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                borderLeft: active ? "3px solid #FF7900" : "3px solid transparent",
              }}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
