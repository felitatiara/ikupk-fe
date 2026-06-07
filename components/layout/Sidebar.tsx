"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LucideIcon,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";

interface SidebarProps {
  role?: string;
  unitNama?: string;
  roleLevel?: number;
  authRole?: string;
}

interface MenuItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export default function Sidebar({ role = 'admin', roleLevel, authRole }: SidebarProps) {
  const pathname = usePathname();

  const isSuperAdmin = (roleLevel ?? 99) === 0;

  const getMenus = (): MenuItem[] => {
    if (role === 'dekan' || role?.toLowerCase() === 'pimpinan') {
      return [
        { key: "beranda", label: "Beranda", href: "/pimpinan/dashboard", icon: LayoutDashboard },
        { key: "monitoring", label: "Monitoring Indikator Kinerja", href: "/pimpinan/monitoring-unit-kerja", icon: BarChart3 },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/pimpinan/iku-pk", icon: Target },
        { key: "validasi_realisasi", label: "Validasi Realisasi", href: "/pimpinan/validasi-realisasi", icon: CheckCircle2 },
        { key: "skp", label: "SKP", href: "/pimpinan/skp", icon: FileSpreadsheet },
      ];
    }

    if (role === 'user') {
      const isAtasan = (roleLevel ?? 4) < 4;
      return [
        { key: "beranda", label: "Beranda", href: "/user/dashboard", icon: LayoutDashboard },
        { key: "monitoring", label: "Monitoring Indikator Kinerja", href: "/user/monitoring-unit-kerja", icon: BarChart3 },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/user/iku-pk", icon: Target },
        ...(isAtasan ? [{ key: "validasi_realisasi", label: "Validasi Realisasi", href: "/user/validasi-realisasi", icon: CheckCircle2 }] : []),
        { key: "skp", label: "SKP", href: "/user/skp", icon: FileSpreadsheet },
      ];
    }

    const resolvedAuthRole = (authRole || '').toLowerCase();
    const isAdminRole = isSuperAdmin && (resolvedAuthRole === 'superadmin' || resolvedAuthRole === 'admin');

    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard", icon: LayoutDashboard },
      { key: "realisasi_biro_pku", label: "Verifikasi Biro PKU", href: "/admin/realisasi-biro-pku", icon: ClipboardCheck },
      ...(isAdminRole ? [
        { key: "master_indikator", label: "Master Indikator", href: "/admin/master-indikator", icon: Target },
        { key: "master_user", label: "Master User", href: "/admin/master-user", icon: UsersRound },
        { key: "master_data", label: "Master Data", href: "/admin/master-data", icon: Database },
      ] : []),
    ];
  };

  const menus = getMenus();

  const isCurrentPage = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const getActiveKey = () => {
    for (const menu of menus) {
      if (isCurrentPage(menu.href)) {
        return menu.key;
      }
    }
    return null;
  };

  const currentActive = getActiveKey();

  return (
    <aside className="app-sidebar">
      <div className="flex h-full flex-col">
        <div className="sidebar-brand hidden lg:block">
          <div className="sidebar-brand__eyebrow">
            <Sparkles size={13} />
            Workspace
          </div>
          <div className="sidebar-brand__title">
            {role === 'user' ? 'Unit Kerja' : role === 'pimpinan' ? 'Pimpinan' : 'Admin'}
          </div>
          <div className="sidebar-brand__subtitle">
            {role === 'user' ? 'Kelola capaian dan realisasi' : 'Pantau kinerja IKUPK'}
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-2 py-3 lg:px-3">
          {menus.map((menu) => {
            const isActive = currentActive === menu.key;
            const Icon = menu.icon;

            return (
              <Link
                key={menu.key}
                href={menu.href}
                className={`sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
                title={menu.label}
              >
                <span className="sidebar-link__icon">
                  <Icon size={19} strokeWidth={2.2} />
                </span>
                <span className="sidebar-link__label">
                  {menu.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
