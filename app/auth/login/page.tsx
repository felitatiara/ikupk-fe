'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Eye, EyeOff, IdCard, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        const level: number = user.roleLevel ?? 4;
        if (level === 0) {
          router.push('/admin/dashboard');
        } else if (level === 1) {
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
      <div className="min-h-screen bg-white">
        <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[2000px] items-center justify-center py-8 sm:px-4 lg:px-6">
              <section className="w-full max-w-[1040px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="grid min-h-[540px] lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative hidden overflow-hidden bg-[#E07E26] lg:block">
                <Image
                  src="/fik.png"
                  alt="Fakultas Ilmu Komputer"
                  fill
                  priority
                  sizes="(min-width: 1024px) 540px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b2f22]/90 via-[#0b2f22]/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur" style={{ color: '#ffffff' }}>
                    <ShieldCheck size={16} />
                    Fakultas Ilmu Komputer
                  </div>
                  <div className="max-w-[420px] text-[32px] font-bold leading-tight" style={{ color: '#ffffff' }}>
                    Pelaporan Kinerja Indikator Kinerja Utama dan Perjanjian Kinerja Dekan
                  </div>
                  <div className="mt-3 max-w-[430px] text-sm leading-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    Masuk untuk mengelola indikator, validasi capaian, dan memantau proses IKUPK Fakultas Ilmu Komputer.
                  </div>
                </div>
              </div>

              <div className="flex items-center px-4 py-8 sm:px-6 lg:px-8">
                <div className="w-full">
                  <div className="mb-8 lg:hidden">
                    <div className="relative h-44 overflow-hidden rounded-xl">
                      <Image
                        src="/fik.png"
                        alt="Fakultas Ilmu Komputer"
                        fill
                        priority
                        sizes="(max-width: 1023px) 100vw, 0px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#E07E26]/75 to-transparent" />
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#FF7900' }}>
                      Selamat Datang
                    </div>
                    <h2 className="mb-3 text-[28px] font-bold leading-tight text-gray-950">
                      Masuk
                    </h2>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4.5">
                    <div>
                      <label htmlFor="nip" className="mb-3 block text-xs font-bold uppercase tracking-[0.06em] text-gray-600">
                        NIP
                      </label>
                      <div className="group flex h-11 items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-3.5 transition hover:border-gray-400 focus-within:border-[#FF7900] focus-within:bg-white focus-within:ring-4 focus-within:ring-green-100/50 focus-within:shadow-sm">
                        <IdCard size={18} className="shrink-0 text-gray-500 transition group-focus-within:text-[#FF7900]" />
                        <input
                          id="nip"
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-full w-full border-0 bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400"
                          placeholder="Masukkan NIP"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="mb-3 block text-xs font-bold uppercase tracking-[0.06em] text-gray-600">
                        Password
                      </label>
                      <div className="group flex h-11 items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-3.5 transition hover:border-gray-400 focus-within:border-[#FF7900] focus-within:bg-white focus-within:ring-4 focus-within:ring-green-100/50 focus-within:shadow-sm">
                        <LockKeyhole size={18} className="shrink-0 text-gray-500 transition group-focus-within:text-[#FF7900]" />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-full w-full border-0 bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400"
                          placeholder="Masukkan password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                          aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700">
                        <AlertCircle size={19} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-login py-2 px-5"
                      style={{ color: '#ffffff' }}
                    >
                      <span style={{ color: '#ffffff' }}>
                        {loading ? 'Memproses...' : 'Masuk'}
                      </span>
                      {!loading && <ArrowRight size={18} className="transition group-hover:translate-x-1" />}
                    </button>

                    <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3.5 mt-4">
                      <div className="text-xs font-medium leading-5 text-orange-900" style={{ color: '#92400e' }}>
                        Pastikan NIP dan password sesuai dengan akun yang terdaftar pada sistem IKUPK.
                      </div>
                    </div>
                  </form>

                  <div className="mt-5 text-center text-xs font-medium" style={{ color: '#d1d5db' }}>
                    Fakultas Ilmu Komputer — UPN Veteran Jakarta
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
