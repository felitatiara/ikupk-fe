'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const userMenu = [
  { name: 'Beranda', path: '/user/dashboard' },
  { name: 'Monitoring Unit Kerja', path: '/user/monitoring-unit-kerja' },
  { name: 'Indikator Kinerja Utama & Perjanjian Kerja', path: '/user/iku-pk' },

  { name: 'Target Indikator Kinerja Utama & Perjanjian Kerja', path: '/user/target-iku-pk' },
];

export default function UserSidebar() {
  const pathname = usePathname();

  const isCurrentPage = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  return (
    <aside
      style={{
        width: 240,
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #e5e7eb',
        height: '100%',
        overflowY: 'auto',
        position: 'sticky',
        top: 68,
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#374151',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Indikator Kinerja Utama & Perjanjian Kerja
        </h2>
      </div>

      {/* Navigation Menu */}
      <nav
        style={{
          padding: '12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {userMenu.map((menu) => {
          const isActive = isCurrentPage(menu.path);
          return (
            <Link
              key={menu.path}
              href={menu.path}
              style={{
                padding: '10px 12px',
                fontSize: 13,
                textDecoration: 'none',
                borderRadius: 6,
                color: isActive ? '#FF7900' : '#6b7280',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? '#FFF5F0' : 'transparent',
                borderLeft: isActive ? '3px solid #FF7900' : '3px solid transparent',
                paddingLeft: isActive ? '9px' : '12px',
                transition: 'all 0.2s ease',
                display: 'block',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#FF7900';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              {menu.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
