"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getUnits } from "@/lib/api";

interface SidebarProps {
  role?: 'admin' | 'user' | 'dekan';
  unitNama?: string;
  unitId?: number;
  authRole?: 'user' | 'admin' | 'pku';
}

export default function Sidebar({ role = 'admin', unitNama, unitId, authRole }: SidebarProps) {
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

  const canAccessMasterIndikator = role === 'admin' && authRole === 'admin' && normalizedUnit.includes('biro pku');

  const getMenus = () => {
    if (role === 'dekan') {
      return [
        { key: "beranda", label: "Beranda", href: "/dekan/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/dekan/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "/dekan/iku-pk" },
        { key: "validasi", label: "Validasi Indikator Kinerja Utama & Perjanjian Kerja", href: "/dekan/validasi-iku-pk" },
        { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/dekan/targets" },
      ];
    }

    if (role === 'user') {
      return [
        { key: "beranda", label: "Beranda", href: "/user/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/user/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "/user/iku-pk" },
        { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/user/targets" },
      ];
    }
    
    // Admin menus
    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
      { key: "master_user", label: "Master User", href: "/admin/master-user" },
      ...(canAccessMasterIndikator ? [{ key: "master_indikator", label: "Master Indikator Kinerja Utama", href: "/admin/master-indikator" }] : []),
      { key: "monitoring", label: "Monitoring Unit Kerja", href: "/admin/monitoring-unit-kerja" },
      { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/iku-pk" },
      { key: "validasi", label: "Validasi Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/validasi-iku-pk" },
      { key: "pengajuan", label: "Pengajuan Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/pengajuan-iku" },
      { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/admin/target-iku-pk" },
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
          </div>
        )}
        {role === 'dekan' && (
          <div
            style={{
              fontSize: 11,
              color: "#FF7900",
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Dashboard Dekan
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
