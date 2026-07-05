'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUpcomingDeadlines,
  type NotificationItem,
  type UpcomingDeadlineItem,
} from '@/services/notificationService';

export default function Header() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadlineItem[]>([]);
  const [switchingRoleId, setSwitchingRoleId] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { logout, user, token, switchRole } = useAuth();
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    const [data, deadlines] = await Promise.all([
      getNotifications(token),
      getUpcomingDeadlines(token),
    ]);
    setNotifications(data);
    setUpcomingDeadlines(deadlines);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const timeout = setTimeout(() => {
      void fetchNotifications();
    }, 0);
    const id = setInterval(() => {
      void fetchNotifications();
    }, 60_000);

    return () => {
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, [fetchNotifications, token]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.replace('/auth/login');
  };

  const handleSwitchRole = async (roleId: number) => {
    setSwitchingRoleId(roleId);
    try {
      const newLevel = await switchRole(roleId);
      setProfileOpen(false);
      if (newLevel === 0) {
        router.replace('/admin/dashboard');
      } else if (newLevel === 1) {
        router.replace('/pimpinan/dashboard');
      } else {
        router.replace('/user/dashboard');
      }
    } catch {
      // ignore
    } finally {
      setSwitchingRoleId(null);
    }
  };

  const handleMarkRead = async (id: number) => {
    if (!token) return;
    await markNotificationRead(id, token);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    await markAllNotificationsRead(token);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length + upcomingDeadlines.length;

  const initials = user?.nama
    ? user.nama.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : 'U';

  const roleLabel = user?.role || user?.unitNama || 'Pengguna';

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <header className="app-header">
      <div className="mx-auto flex h-[72px] w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark">
            <Image src="/logo-upnvj.webp" alt="UPN Logo" width={34} height={34} />
          </div>
          <div className="hidden h-9 w-px bg-gray-200 sm:block" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold" style={{ color: '#101828' }}>
              Indikator Kinerja Utama &amp; Perjanjian Kinerja
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: '#0f9f6e' }}>
              <ShieldCheck size={13} />
              UPN Veteran Jakarta
            </div>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <div ref={notifRef} className="relative">
              <button
                className="icon-button relative"
                title="Notifikasi"
                onClick={() => setNotifOpen((o) => !o)}
                type="button"
              >
                <Bell size={19} color="#4b5563" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold leading-none"
                    style={{ color: '#ffffff' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)]"
                  style={{
                    width: 'min(380px, calc(100vw - 24px))',
                    background: '#ffffff',
                    borderRadius: 20,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <div style={{ padding: '18px 20px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: 18, fontWeight: 800, color: '#111827',
                        borderBottom: '3px solid #3b82f6',
                        paddingBottom: 2, display: 'inline-block',
                      }}>
                        Notifikasi
                      </span>
                      {unreadCount > 0 && (
                        <span style={{
                          background: '#ef4444', color: '#fff',
                          fontSize: 11, fontWeight: 700,
                          padding: '2px 9px', borderRadius: 99,
                        }}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ maxHeight: 400, overflowY: 'auto', padding: '0 16px 16px' }}>
                    {/* Empty state */}
                    {upcomingDeadlines.length === 0 && notifications.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: '#f3f4f6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 12px',
                        }}>
                          <Bell size={22} color="#9ca3af" />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                          Tidak ada notifikasi
                        </div>
                      </div>
                    )}

                    {/* Upcoming deadline cards */}
                    {upcomingDeadlines.map((item) => {
                      const isOverdue  = item.daysUntil < 0;
                      const isToday    = item.daysUntil === 0;
                      const isTomorrow = item.daysUntil === 1;

                      const cardBg      = isOverdue || isToday ? '#fef2f2' : item.daysUntil <= 3 ? '#fff7ed' : '#fefce8';
                      const accentColor = isOverdue || isToday ? '#dc2626'  : item.daysUntil <= 3 ? '#ea580c' : '#ca8a04';
                      const sisaLabel   = isOverdue
                        ? `Lewat ${Math.abs(item.daysUntil)} hari`
                        : isToday    ? 'Hari ini!'
                        : isTomorrow ? 'Besok!'
                        : `${item.daysUntil} hari lagi`;

                      const tenggatFormatted = (() => {
                        const d = new Date(item.tenggat);
                        if (isNaN(d.getTime())) return item.tenggat;
                        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                      })();

                      const shownL1s   = (item.l1Names ?? []).slice(0, 3);
                      const extraCount = (item.l1Names ?? []).length - shownL1s.length;

                      return (
                        <div key={`${item.indikatorId}-${item.tahun}`} style={{ marginBottom: 10 }}>
                          {/* Label above card: L0 name + tenggat date */}
                          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4, paddingLeft: 2 }}>
                            {item.indikatorNama} · Tenggat {tenggatFormatted}
                          </div>

                          {/* Card */}
                          <div style={{
                            background: cardBg, borderRadius: 12, padding: '12px 14px',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}>
                            {/* L1 names — left side */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {shownL1s.length > 0 ? (
                                <>
                                  {shownL1s.map((name, i) => (
                                    <div key={i} style={{
                                      fontSize: 13, fontWeight: 700, color: '#111827',
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      lineHeight: 1.5,
                                    }}>
                                      {name}
                                    </div>
                                  ))}
                                  {extraCount > 0 && (
                                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                      +{extraCount} lainnya
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                  {item.indikatorNama}
                                </div>
                              )}
                            </div>

                            {/* Days label — right side */}
                            <span style={{ fontSize: 13, fontWeight: 800, color: accentColor, flexShrink: 0, textAlign: 'right' }}>
                              {sisaLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* DB notification history */}
                    {notifications.length > 0 && (
                      <div style={{ marginTop: upcomingDeadlines.length > 0 ? 8 : 0 }}>
                        {upcomingDeadlines.length > 0 && (
                          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>
                            Riwayat
                          </div>
                        )}
                        {notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => !n.isRead && handleMarkRead(n.id)}
                            style={{
                              width: '100%', textAlign: 'left', background: 'none', border: 'none',
                              padding: 0, marginBottom: 8, cursor: n.isRead ? 'default' : 'pointer',
                            }}
                            type="button"
                          >
                            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4, paddingLeft: 2 }}>
                              {formatDate(n.createdAt)}
                            </div>
                            <div style={{
                              background: n.isRead ? '#f9fafb' : '#fff7ed',
                              borderRadius: 12,
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}>
                              <span style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: '#374151', flex: 1, minWidth: 0 }}>
                                {n.message}
                              </span>
                              {!n.isRead && (
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', flexShrink: 0, display: 'block' }} />
                              )}
                            </div>
                          </button>
                        ))}
                        {notifications.some(n => !n.isRead) && (
                          <button
                            onClick={handleMarkAllRead}
                            style={{
                              width: '100%', marginTop: 4,
                              padding: '8px', borderRadius: 10,
                              border: '1px solid #e5e7eb', background: '#f9fafb',
                              fontSize: 12, fontWeight: 600, color: '#6b7280',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                            type="button"
                          >
                            <CheckCheck size={13} />
                            Tandai semua sudah dibaca
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div ref={dropdownRef} className="relative">
              <button
                className="profile-trigger"
                onClick={() => setProfileOpen((o) => !o)}
                type="button"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff7900] to-[#10b759] text-xs font-bold shadow-sm" style={{ color: '#ffffff' }}>
                  {initials}
                </div>
                <div className="hidden min-w-0 text-left md:block">
                  <div className="max-w-[160px] truncate text-xs font-bold" style={{ color: '#111827' }}>
                    {user.nama}
                  </div>
                  <div className="max-w-[160px] truncate text-[11px] font-semibold capitalize" style={{ color: '#6b7280' }}>
                    {roleLabel}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  color={profileOpen ? '#ff7900' : '#9ca3af'}
                  className={`transition ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {profileOpen && (
                <div className="surface-popover absolute right-0 top-[calc(100%+10px)] w-[260px] overflow-hidden">
                  <div className="bg-gradient-to-br from-orange-50 to-green-50 px-4 py-4 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff7900] to-[#10b759] text-sm font-bold" style={{ color: '#ffffff' }}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold" style={{ color: '#111827' }}>
                          {user.nama}
                        </div>
                        <div className="truncate text-xs" style={{ color: '#6b7280' }}>
                          {user.email || roleLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                  {user.roles && user.roles.length > 1 && (
                    <div className="border-t border-gray-100 px-4 py-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9ca3af' }}>
                        Ganti Peran
                      </div>
                      <div className="space-y-1">
                        {user.roles.map((r) => {
                          const isActive = r.id === user.roleId;
                          const isSwitching = switchingRoleId === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              disabled={isActive || isSwitching}
                              onClick={() => handleSwitchRole(r.id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition"
                              style={{
                                background: isActive ? '#f0fdf4' : 'transparent',
                                color: isActive ? '#15803d' : '#374151',
                                cursor: isActive ? 'default' : 'pointer',
                                border: isActive ? '1px solid #bbf7d0' : '1px solid transparent',
                              }}
                            >
                              <RefreshCw size={13} className={isSwitching ? 'animate-spin' : ''} style={{ color: isActive ? '#15803d' : '#9ca3af', flexShrink: 0 }} />
                              <div className="min-w-0">
                                <div className="truncate capitalize">{r.name}</div>
                                {r.unitNama && (
                                  <div className="truncate text-[10px] font-normal" style={{ color: '#9ca3af' }}>{r.unitNama}</div>
                                )}
                              </div>
                              {isActive && (
                                <span className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#dcfce7', color: '#15803d' }}>
                                  Aktif
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-gray-100">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold transition hover:bg-red-50"
                      style={{ color: '#dc2626' }}
                      type="button"
                    >
                      <LogOut size={17} />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
