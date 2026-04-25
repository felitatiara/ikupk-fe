'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
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
        const role = user.role?.toLowerCase() || '';

        if (role === 'admin' || role === 'superadmin') {
          router.push('/admin/dashboard');
        } else if (role === 'pimpinan') {
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
    <>
      <Header />

      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
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
          <section className="w-full max-w-[980px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:gap-6">

              {/* IMAGE */}
              <div className="relative w-full overflow-hidden rounded-xl aspect-[4/5] max-h-[400px]">
                <img
                  src="/fik.png"
                  alt="Fakultas Ilmu Komputer"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* FORM */}
              <div className="flex items-start lg:items-center">
                <div className="w-full max-w-[360px] lg:max-w-[420px]">

                  <h1 className="text-2xl font-extrabold text-[#f57c00] sm:text-3xl">
                    Selamat Datang!
                  </h1>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    Sign In
                  </p>

                  <form onSubmit={handleSubmit} className="mt-4 space-y-3">

                    <div>
                      <label className="block text-base font-semibold text-gray-700">
                        NIP
                      </label>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-300 bg-[#f4f4f4] px-3.5"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-base font-semibold text-gray-700">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-300 bg-[#f4f4f4] px-3.5"
                        required
                      />
                    </div>

                    {error && (
                      <p className="text-red-600">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="h-11 w-full rounded-xl bg-[#10b759] font-bold text-white"
                    >
                      {loading ? 'Signing In...' : 'Sign In'}
                    </button>

                  </form>
                </div>
              </div>

            </div>
          </section>
        </main>
      </div>
    </>
  );
}