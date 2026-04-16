"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

interface SidebarProps {
  activeMenu?: string;
  onMenuChange?: (menuKey: string) => void;
}


  const pathname = usePathname();
  const { user } = useContext(AuthContext) || {};

  function getMenusByRole(role?: string) {
    if (role === "Super Admin") {
      return [
        { key: "beranda", label: "Beranda", href: "/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/iku-pk" },
        { key: "validasi", label: "Validasi IKU PK", href: "/validasi-iku-pk" },
        { key: "pengajuan", label: "Pengajuan Target IKU PK", href: "/pengajuan-iku" },
        { key: "master-indikator", label: "Master Indikator", href: "/master-indikator" },
        { key: "master-user", label: "Master User", href: "/master-user" },
      ];
    }
    if (role === "Admin") {
      return [
        { key: "beranda", label: "Beranda", href: "/dashboard" },
        { key: "monitoring", label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
        { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/iku-pk" },
        { key: "validasi", label: "Validasi IKU PK", href: "/validasi-iku-pk" },
        { key: "pengajuan", label: "Pengajuan Target IKU PK", href: "/pengajuan-iku" },
        { key: "master-indikator", label: "Master Indikator", href: "/master-indikator" },
      ];
    }
    // Default: User
    return [
      { key: "beranda", label: "Beranda", href: "/dashboard" },
      { key: "monitoring", label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
      { key: "iku_pk", label: "Indikator Kinerja Utama", href: "/iku-pk" },
      { key: "validasi", label: "Validasi IKU PK", href: "/validasi-iku-pk" },
      { key: "pengajuan", label: "Pengajuan Target IKU PK", href: "/pengajuan-iku" },
    ];
  }

  // Jika role bukan Admin/Super Admin, treat as User
  const effectiveRole = user?.role === "Admin" || user?.role === "Super Admin" ? user.role : "User";
  const menus = getMenusByRole(effectiveRole);
  const currentActive = activeMenu || (pathname?.startsWith("/monitoring-unit-kerja") ? "monitoring" : pathname?.startsWith("/dashboard") ? "beranda" : "");

  return (
    <aside className="w-64 bg-white border-r">
      <div className="mb-6 p-6 font-bold text-orange-600">
        <div className="text-sm text-gray-500">Indikator Kinerja Utama & Perjanjian Kerja</div>
      </div>

      <nav className="space-y-5 px-5">
        {menus.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className={`mb-4 block w-full text-left text-sm ${
              currentActive === m.key
                ? "font-bold text-orange-600"
                : "text-gray-600 hover:text-orange-600"
            }`}
            onClick={() => onMenuChange?.(m.key)}
          >
            {m.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

