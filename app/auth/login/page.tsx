'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, user: authUser } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      const userStr = sessionStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (user) {
        const userRole = user.role?.toLowerCase() || '';
        if (userRole === 'admin' || userRole === 'superadmin') {
          router.push('/admin/dashboard');
        } else if (userRole === 'pimpinan') {
          router.push('/pimpinan/dashboard');
        } else {
          router.push('/user/dashboard');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <div
        style={{
          background: 'linear-gradient(to right, #FF7900, #FF9A3C)',
          color: 'white',
          padding: '12px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Image
                src="/logo-upnvj.webp"
                alt="Logo UPN Veteran Jakarta"
                width={44}
                height={44}
                sizes="44px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>
                Indikator Kinerja Utama & Perjanjian Kerja
              </p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.95, lineHeight: 1.3 }}>
                UPN Veteran Jakarta
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              type="button"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')
              }
            >
              🔔
            </button>
            <button
              type="button"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')
              }
            >
              👤
            </button>
          </div>
        </div>
      </div>

      <main
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          padding: '24px 32px',
          minHeight: 'calc(100vh - 68px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
          <section
            className="w-full max-w-[980px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6"
            style={{ marginTop: '-16px' }}
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:gap-6">
              <div className="relative w-full overflow-hidden rounded-xl aspect-[4/5] max-h-[400px]">
              <img
                src="/fik.png"
                alt="Fakultas Ilmu Komputer"
                className="h-full w-full object-cover"
              />
            </div>

              <div className="flex items-start lg:items-center">
                <div className="w-full max-w-[360px] lg:max-w-[420px]">
                <h1 className="text-2xl font-extrabold leading-none text-[#f57c00] sm:text-3xl">Selamat Datang!</h1>
                <p className="mt-1 text-2xl font-bold leading-none text-gray-900">Sign In</p>

                <form onSubmit={handleSubmit} className="mt-3 space-y-3 sm:mt-4">
                  <div>
                    <label className="mb-1 block text-base font-semibold text-gray-700 sm:text-lg">NIP</label>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="192827192738"
                      className="h-11 w-full rounded-xl border border-gray-300 bg-[#f4f4f4] px-3.5 text-base text-gray-800 outline-none transition focus:border-[#f57c00] focus:ring-2 focus:ring-[#f57c00]/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-base font-semibold text-gray-700 sm:text-lg">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="* * * * * *"
                      className="h-11 w-full rounded-xl border border-gray-300 bg-[#f4f4f4] px-3.5 text-base text-gray-800 outline-none transition focus:border-[#f57c00] focus:ring-2 focus:ring-[#f57c00]/20"
                      required
                    />
                  </div>

                  {error && <p className="text-base text-red-600">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 min-w-[128px] rounded-xl bg-[#10b759] px-6 text-base font-bold text-white transition hover:brightness-95 disabled:opacity-60"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </button>

                  <p className="pt-1 text-sm text-gray-700">
                    Belum punya akun?{' '}
                    <Link href="#" className="font-semibold text-[#f57c00] hover:underline">
                      Sign Up
                    </Link>
                  </p>
                </form>
                </div>
              </div>
            </div>
          </section>
      </main>
    </div>
  );
}
