'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  ChevronDown,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/services/notificationService';

export default function Header() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { logout, user, token } = useAuth();
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    const data = await getNotifications(token);
    setNotifications(data);
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const initials = user?.nama
    ? user.nama.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : 'U';

  const roleLabel = user?.role || user?.unitNama || 'Pengguna';

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <header
      className="sticky top-0 z-[100] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur"
      style={{ borderBottom: '1px solid #E07E26' }}
    >
      <div className="mx-auto flex h-20 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
            <Image src="/logo-upnvj.webp" alt="UPN Logo" width={34} height={34} />
          </div>
          <div className="hidden h-9 w-px bg-gray-200 sm:block" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold tracking-[-0.01em]" style={{ color: '#111827' }}>
              Indikator Kinerja Utama &amp; Perjanjian Kerja
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: '#ff7900' }}>
              <ShieldCheck size={13} />
              UPN Veteran Jakarta
            </div>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <div ref={notifRef} className="relative">
              <button
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 transition hover:border-orange-200 hover:bg-orange-50"
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
                <div className="absolute right-0 top-[calc(100%+10px)] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#111827' }}>
                        Notifikasi
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: '#6b7280' }}>
                        {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-xs font-bold transition hover:bg-sky-100"
                        style={{ color: '#0369a1' }}
                        type="button"
                      >
                        <CheckCheck size={14} />
                        Tandai
                      </button>
                    )}
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                          <Bell size={20} color="#9ca3af" />
                        </div>
                        <div className="text-sm font-semibold" style={{ color: '#6b7280' }}>
                          Tidak ada notifikasi
                        </div>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => !n.isRead && handleMarkRead(n.id)}
                          className="flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50"
                          style={{ backgroundColor: n.isRead ? '#ffffff' : '#fff7ed' }}
                          type="button"
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: n.type === 'tenggat_1hari' ? '#fef2f2' : '#ffedd5' }}
                          >
                            <AlertCircle size={17} color={n.type === 'tenggat_1hari' ? '#dc2626' : '#f97316'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-xs leading-5"
                              style={{
                                color: '#374151',
                                fontWeight: n.isRead ? 500 : 700,
                              }}
                            >
                              {n.message}
                            </div>
                            <div className="mt-1 text-[11px]" style={{ color: '#9ca3af' }}>
                              {formatDate(n.createdAt)}
                            </div>
                          </div>
                          {!n.isRead && (
                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ff7900]" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div ref={dropdownRef} className="relative">
              <button
                className="flex h-10 items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 py-1 pl-1 pr-2 transition hover:border-orange-200 hover:bg-orange-50 sm:pr-3"
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
                <div className="absolute right-0 top-[calc(100%+10px)] w-[260px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
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
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
