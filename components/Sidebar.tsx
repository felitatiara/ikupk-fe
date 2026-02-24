"use client";

import Link from "next/link";

interface SidebarProps {
  activeMenu?: string;
  onMenuChange?: (menuKey: string) => void;
}

export default function Sidebar({ activeMenu, onMenuChange }: SidebarProps) {
  const menus = [
    { key: "beranda", label: "Beranda", href: "/dashboard" },
    { key: "monitoring", label: "Monitoring Unit Kerja", href: "#" },
    { key: "iku_pk", label: "Indikator Kinerja Utama & Perjanjian Kerja", href: "#" },
    { key: "target", label: "Target Indikator Kinerja Utama & Perjanjian Kerja", href: "#" },
  ];

  const handleMenuClick = (menuKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    onMenuChange?.(menuKey);
  };

  return (
    <aside className="w-64 bg-white border-r">
      <div className="mb-6 p-6 font-bold text-orange-600">
        <div className="text-sm text-gray-500">Indikator Kinerja Utama & Perjanjian Kerja</div>
      </div>

      <nav className="space-y-5 px-5">
        {menus.map((m) => (
          <button
            key={m.key}
            onClick={(e) => handleMenuClick(m.key, e)}
            className={`mb-4 block w-full text-left text-sm ${
              activeMenu === m.key
                ? "font-bold text-orange-600"
                : "text-gray-600 hover:text-orange-600"
            }`}
          >
            {m.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
