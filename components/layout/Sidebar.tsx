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
    const isSuperAdminRole = isSuperAdmin && resolvedAuthRole === 'superadmin';

    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard", icon: LayoutDashboard },
      ...(isSuperAdminRole ? [
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
    <aside
      className="sticky top-16 min-h-[calc(100vh-64px)] w-[68px] shrink-0 bg-white lg:w-[220px]"
      style={{ borderRight: "1px solid #E07E26" }}
    >
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1.5 px-2 py-3 lg:px-3">
          {menus.map((menu) => {
            const isActive = currentActive === menu.key;
            const Icon = menu.icon;

            return (
              <Link
                key={menu.key}
                href={menu.href}
                className="group flex min-h-10 items-center justify-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium no-underline transition hover:bg-gray-50 lg:justify-start lg:px-2.5"
                style={{
                  color: isActive ? '#111827' : '#1f2937',
                  backgroundColor: isActive ? '#f8fafc' : 'transparent',
                  textDecoration: 'none',
                }}
                title={menu.label}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center"
                >
                  <Icon size={21} color="#ea580c" strokeWidth={2} />
                </span>
                <span className="hidden min-w-0 flex-1 leading-5 lg:block" style={{ color: isActive ? '#111827' : '#1f2937' }}>
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
