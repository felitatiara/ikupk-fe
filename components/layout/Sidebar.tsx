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
        { key: "SKP", label: "SKP", href: "/pimpinan/skp" }
      ];
    }

    if (role === 'user') {
      return [
        { key: "beranda", label: "Beranda", href: "/user/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/user/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/user/iku-pk" },
        { key: "SKP", label: "SKP", href: "/user/skp" }

      ];
    }

    // Admin menus
    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
      { key: "monitoring", label: "Monitoring", href: "/admin/monitoring-unit-kerja" },
      { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/admin/iku-pk" },
      { key: "validasi", label: "Validasi IKU PK", href: "/admin/validasi-iku-pk" },
      ...(isSuperAdmin ? [
        { key: "master_indikator", label: "Master Indikator", href: "/admin/master-indikator" },
        { key: "master_data", label: "Master Data", href: "/admin/master-data" },
        { key: "master_user", label: "Master User", href: "/admin/master-user" },
        { key: "skp", label: "Master SKP", href: "/admin/master-skp" }
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
    <aside className="sidebar-wrapper">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          Indikator Kinerja Utama & Perjanjian Kerja
        </h2>
        {role?.toLowerCase() === 'admin' && (
          <div className="sidebar-subtitle">
            Dashboard Admin
            {resolvedUnitNama && (
              <span className="sidebar-unit-name">
                {resolvedUnitNama}
              </span>
            )}
          </div>
        )}
        {role === 'user' && (
          <div className="sidebar-subtitle">
            Dashboard User
            {resolvedUnitNama && (
              <span className="sidebar-unit-name">
                {resolvedUnitNama}
              </span>
            )}
          </div>
        )}
        {(role === 'dekan' || role?.toLowerCase() === 'pimpinan') && (
          <div className="sidebar-subtitle">
            Dashboard Pimpinan
            {resolvedUnitNama && (
              <span className="sidebar-unit-name">
                {resolvedUnitNama}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        {menus.map((menu) => {
          const isActive = currentActive === menu.key;
          return (
            <Link
              key={menu.key}
              href={menu.href}
              className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
            >
              {menu.label}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
