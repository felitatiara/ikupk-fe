"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  LucideIcon,
  PieChart,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { getRoleFeatureKeys } from "@/lib/api";

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
  const [sidebarState, setSidebarState] = useState<{
    primaryRoleLevel: number | null;
    allowedFeatureKeys: string[] | null;
  }>({ primaryRoleLevel: null, allowedFeatureKeys: null });

  const isSuperAdmin = (roleLevel ?? 99) === 0;

  useEffect(() => {
    try {
      const userStr = sessionStorage.getItem("user");
      if (!userStr) return;
      const user = JSON.parse(userStr);

      // Read primary role level from the roles array — unaffected by switchRole which only
      // overwrites roleLevel to the currently active role (e.g. dosen = 4 after switching).
      let primaryLevel: number | null = null;
      if (Array.isArray(user?.roles) && user.roles.length > 0) {
        const primary = user.roles.find((r: { isPrimary?: boolean }) => r.isPrimary) ?? user.roles[0];
        if (primary?.level != null) primaryLevel = primary.level as number;
      }

      const featuresFetch = user?.roleId
        ? getRoleFeatureKeys(user.roleId)
        : Promise.resolve<string[]>([]);

      featuresFetch
        .then(keys => setSidebarState({ primaryRoleLevel: primaryLevel, allowedFeatureKeys: keys }))
        .catch(() => setSidebarState({ primaryRoleLevel: primaryLevel, allowedFeatureKeys: null }));
    } catch {
      // ignore
    }
  }, []);

  const getMenus = (): MenuItem[] => {
    if (role === 'dekan' || role?.toLowerCase() === 'pimpinan') {
      return [
        { key: "beranda", label: "Beranda", href: "/pimpinan/dashboard", icon: LayoutDashboard },
        { key: "monitoring_dekan", label: "Monitoring Dekan", href: "/pimpinan/monitoring-dekan", icon: PieChart },
        { key: "monitoring", label: "Monitoring Indikator Kinerja", href: "/pimpinan/monitoring-unit-kerja", icon: BarChart3 },
        { key: "disposisi_manual", label: "Disposisi Manual", href: "/pimpinan/disposisi", icon: Send },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/pimpinan/iku-pk", icon: Target },
        { key: "verifikasi_capaian", label: "Verifikasi Capaian", href: "/pimpinan/validasi-realisasi", icon: CheckCircle2 },
        { key: "skp", label: "SKP", href: "/pimpinan/skp", icon: FileSpreadsheet },
      ];
    }

    if (role === 'user') {
      const isAtasan = (roleLevel ?? 4) < 4;
      // Use primaryRoleLevel from sessionStorage so switchRole doesn't affect this check.
      // Hide SKP from the user/dosen menu when:
      //   (a) primaryLevel < 3: user has a pimpinan workspace (/pimpinan/skp) — SKP lives there, OR
      //   (b) primaryLevel < 4 AND current active level ≥ 4: user has a pimpinan/atasan primary role
      //       (e.g. Kaprodi=3) but is currently viewing in Dosen/Tendik secondary-role mode.
      // Multi-role users only ever have ONE SKP page — the one for their highest role.
      const activeLevel = roleLevel ?? 4;
      const hasPimpinanPrimary = primaryRoleLevel !== null
        ? primaryRoleLevel < 3 || (primaryRoleLevel < 4 && activeLevel >= 4)
        : activeLevel < 3;
      return [
        { key: "beranda", label: "Beranda", href: "/user/dashboard", icon: LayoutDashboard },
        { key: "monitoring", label: "Monitoring Indikator Kinerja", href: "/user/monitoring-unit-kerja", icon: BarChart3 },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/user/iku-pk", icon: Target },
        ...(isAtasan ? [{ key: "verifikasi_capaian", label: "Verifikasi Capaian", href: "/user/validasi-realisasi", icon: CheckCircle2 }] : []),
        ...(!hasPimpinanPrimary ? [{ key: "skp", label: "SKP", href: "/user/skp", icon: FileSpreadsheet }] : []),
      ];
    }

    const resolvedAuthRole = (authRole || '').toLowerCase();
    const isAdminRole = isSuperAdmin && (resolvedAuthRole === 'superadmin' || resolvedAuthRole === 'admin');

    return [
      { key: "beranda", label: "Beranda", href: "/admin/dashboard", icon: LayoutDashboard },
      { key: "realisasi_biro_pku", label: "Verifikasi Biro PKU", href: "/admin/realisasi-biro-pku", icon: ClipboardCheck },
      ...(isAdminRole ? [
        { key: "master_indikator", label: "Master Indikator", href: "/admin/master-indikator", icon: Target },
        { key: "monitoring_target", label: "Monitoring Target", href: "/admin/monitoring-target", icon: PieChart },
        { key: "master_user", label: "Master User", href: "/admin/master-user", icon: UsersRound },
        { key: "master_role", label: "Master Role", href: "/admin/master-role", icon: KeyRound },
        { key: "master_data", label: "Master Data", href: "/admin/master-data", icon: Database },
        { key: "master_skp", label: "Master SKP", href: "/admin/master-skp", icon: FileSpreadsheet },
        { key: "rbac", label: "Konfigurasi Akses", href: "/admin/rbac", icon: ShieldCheck },
      ] : []),
    ];
  };

  const { primaryRoleLevel, allowedFeatureKeys } = sidebarState;
  const allMenus = getMenus();

  // Apply feature restrictions: if no keys configured (null or empty) → show all
  const menus = (allowedFeatureKeys === null || allowedFeatureKeys.length === 0)
    ? allMenus
    : allMenus.filter(m => m.key === 'beranda' || allowedFeatureKeys.includes(m.key));

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
