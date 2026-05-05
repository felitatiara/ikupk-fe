"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  role?: string;
  unitNama?: string;
  roleLevel?: number;
  authRole?: string;
}

export default function Sidebar({ role = 'admin', unitNama, roleLevel, authRole }: SidebarProps) {
  const pathname = usePathname();
  const resolvedUnitNama = unitNama ?? '';

  const isSuperAdmin = (roleLevel ?? 99) === 0;

  const getMenus = () => {
    // Pimpinan: Beranda, Monitoring, IKU, Validasi IKU PK
    if (role === 'dekan' || role?.toLowerCase() === 'pimpinan') {
      return [
        { key: "beranda", label: "Beranda", href: "/pimpinan/dashboard" },
        { key: "monitoring", label: "Monitoring Indikator Kinerja", href: "/pimpinan/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/pimpinan/iku-pk" },
        { key: "validasi", label: "Validasi IKU PK", href: "/pimpinan/validasi-iku-pk" },
        { key: "validasi_realisasi", label: "Validasi Realisasi", href: "/pimpinan/validasi-realisasi" },
        { key: "skp", label: "SKP", href: "/pimpinan/skp" },
      ];
    }

    // User biasa (level 2+): Beranda, Monitoring, IKU
    // roleLevel < 4 = kaprodi/kajur yang punya bawahan → tampilkan Validasi Realisasi
    if (role === 'user') {
      const isAtasan = (roleLevel ?? 4) < 4;
      return [
        { key: "beranda", label: "Beranda", href: "/user/dashboard" },
        { key: "monitoring", label: "Monitoring Indikator Kinerja", href: "/user/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/user/iku-pk" },
        ...(isAtasan ? [{ key: "validasi_realisasi", label: "Validasi Realisasi", href: "/user/validasi-realisasi" }] : []),
        { key: "skp", label: "SKP", href: "/user/skp" },
      ];
    }

    // Super Admin (roleLevel 0 + nama role superadmin): semua menu termasuk master
    const resolvedAuthRole = (authRole || '').toLowerCase();
    const isSuperAdminRole = isSuperAdmin && resolvedAuthRole === 'superadmin';

    // Admin (roleLevel 0 + nama role admin) atau fallback: Beranda, Monitoring, IKU, Validasi
    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard" },
      ...(isSuperAdminRole ? [
        { key: "master_indikator", label: "Master Indikator", href: "/admin/master-indikator" },
        { key: "master_user", label: "Master User", href: "/admin/master-user" },
        { key: "master_data", label: "Master Data", href: "/admin/master-data" },
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
