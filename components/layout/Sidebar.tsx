"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  activeMenu?: string;
  onMenuChange?: (menuKey: string) => void;
}

export default function Sidebar({ activeMenu, onMenuChange }: SidebarProps) {
  const pathname = usePathname();

  const menus = [
    { key: "beranda", label: "Beranda", href: "/dashboard" },
    { key: "monitoring", label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
    { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "/iku-pk" },
    { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "/targets" },
  ];

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
