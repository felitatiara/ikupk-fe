"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getUnits } from "@/lib/api";

interface SidebarProps {
  role?: string;
  unitNama?: string;
  unitId?: number;
  unitJenis?: string;
  authRole?: string;
}

export default function Sidebar({ role = 'admin', unitNama, unitId, unitJenis, authRole }: SidebarProps) {
  const pathname = usePathname();
  const [resolvedUnitNama, setResolvedUnitNama] = useState<string>(unitNama ?? '');

  useEffect(() => {
    let cancelled = false;

    if (unitNama && unitNama.trim()) {
      setResolvedUnitNama(unitNama);
      return;
    }

    if (!unitId) {
      setResolvedUnitNama('');
      return;
    }

    getUnits()
      .then((units) => {
        if (cancelled) return;
        const found = units.find((u) => u.id === unitId);
        setResolvedUnitNama(found?.nama ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedUnitNama('');
      });

    return () => {
      cancelled = true;
    };
  }, [unitNama, unitId]);

  const normalizedUnit = useMemo(
    () => resolvedUnitNama.toLowerCase().replace(/\s+/g, ' ').trim(),
    [resolvedUnitNama]
  );

  const isSuperAdmin = (authRole?.toLowerCase() === 'admin' || authRole?.toLowerCase() === 'superadmin') && Number(unitId) === 1;

  const getMenus = () => {
    if (role === 'dekan' || role?.toLowerCase() === 'pimpinan') {
      return [
        { key: "beranda", label: "Beranda", href: "/pimpinan/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/pimpinan/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/pimpinan/iku-pk" },
        { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/pimpinan/targets" },
      ];
    }

    if (role === 'user') {
      return [
        { key: "beranda", label: "Beranda", href: "/user/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/user/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/user/iku-pk" },
      ];
    }

    // Admin menus
    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
      { key: "monitoring", label: "Monitoring", href: "/admin/monitoring-unit-kerja" },
      { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/admin/iku-pk" },
      { key: "validasi", label: "Validasi IKU PK", href: "/admin/validasi-iku-pk" },
      { key: "target_iku_pk", label: "Target IKU PK", href: "/admin/target-iku-pk" },
      ...(isSuperAdmin ? [
        { key: "master_indikator", label: "Master Indikator", href: "/admin/master-indikator" },
        { key: "master_data", label: "Master Data", href: "/admin/master-data" },
        { key: "master_user", label: "Master User", href: "/admin/master-user" }
      ] : []),
    ];
  };

  const menus = getMenus();

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
        width: 180,
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
        {role?.toLowerCase() === 'admin' && (
          <div
            style={{
              fontSize: 11,
              color: "#FF7900",
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Dashboard Admin
            {resolvedUnitNama && (
              <span style={{ display: 'block', fontSize: 10, color: '#6b7280', fontWeight: 500, marginTop: 2 }}>
                {resolvedUnitNama}
              </span>
            )}
          </div>
        )}
        {role === 'user' && (
          <div
            style={{
              fontSize: 11,
              color: "#FF7900",
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Dashboard User
            {resolvedUnitNama && (
              <span style={{ display: 'block', fontSize: 10, color: '#6b7280', fontWeight: 500, marginTop: 2 }}>
                {resolvedUnitNama}
              </span>
            )}
          </div>
        )}
        {(role === 'dekan' || role?.toLowerCase() === 'pimpinan') && (
          <div
            style={{
              fontSize: 11,
              color: "#FF7900",
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Dashboard Pimpinan
            {resolvedUnitNama && (
              <span style={{ display: 'block', fontSize: 10, color: '#6b7280', fontWeight: 500, marginTop: 2 }}>
                {resolvedUnitNama}
              </span>
            )}
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

    </aside>
  );
}
