'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import Header from '@/components/layout/Header';


export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/admin/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-8 py-4 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg bg-white border border-orange-100 p-1.5"
          >
            <Image
              src="/logo-upnvj.webp"
              alt="Logo UPN Veteran Jakarta"
              width={28}
              height={28}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <span className="font-bold text-xl text-gray-800">IKU-PK</span>
        </div>
        <Link
          href="/auth/login"
          className="px-6 py-2 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #FF7900, #FF9A3C)',
          }}
        >
          Login
        </Link>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h1
              className="text-5xl font-bold mb-6 leading-tight"
              style={{ color: '#1a1a1a' }}
            >
              Sistem Pemantauan <br />
              <span style={{ background: 'linear-gradient(135deg, #FF7900, #FF9A3C)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                Indikator Kinerja
              </span>
            </h1>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Platform terintegrasi untuk monitoring dan evaluasi Indikator Kinerja Utama (IKU) dan Program Kegiatan (PK) secara real-time. Tingkatkan transparansi dan akuntabilitas organisasi Anda.
            </p>

            <div className="flex gap-4">
              <Link
                href="/auth/login"
                className="px-8 py-3 rounded-lg font-semibold text-white transition-transform transform hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #FF7900, #FF9A3C)',
                }}
              >
                Mulai Sekarang
              </Link>
              <a
                href="#features"
                className="px-8 py-3 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors"
              >
                Pelajari Lebih Lanjut
              </a>
            </div>
          </div>

          {/* Right - Illustration */}
          <div className="flex items-center justify-center">
            <div
              className="w-full aspect-square rounded-2xl flex items-center justify-center text-white text-6xl font-bold"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 121, 0, 0.1), rgba(255, 154, 60, 0.1))',
                border: '2px solid rgba(255, 121, 0, 0.2)',
              }}
            >
              📊
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="bg-white py-20 mt-20">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center mb-4">Fitur Unggulan</h2>
          <p className="text-center text-gray-600 mb-16">
            Semua yang Anda butuhkan untuk mengelola KPI secara efektif
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-bold mb-3">Dashboard Real-time</h3>
              <p className="text-gray-600">
                Pantau semua KPI dan pencapaian target dengan visualisasi data yang interaktif dan mudah dipahami.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-3">Manajemen Multi-Role</h3>
              <p className="text-gray-600">
                Kontrol akses berbasis peran dengan fitur admin dan user yang terpisah untuk keamanan maksimal.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-bold mb-3">Pelaporan Komprehensif</h3>
              <p className="text-gray-600">
                Buat laporan detail tentang pencapaian target dan validasi IKU dengan mudah dan cepat.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-bold mb-3">Sinkronisasi Data</h3>
              <p className="text-gray-600">
                Integrasikan data dari berbagai unit kerja dengan sistem sinkronisasi otomatis yang handal.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-xl font-bold mb-3">Keamanan Tingkat Enterprise</h3>
              <p className="text-gray-600">
                Perlindungan data dengan enkripsi end-to-end dan audit trail lengkap untuk setiap transaksi.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="p-8 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-3">Performa Optimal</h3>
              <p className="text-gray-600">
                Aplikasi yang cepat dan responsif untuk pengalaman pengguna terbaik di semua perangkat.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 py-20 mt-20">
        <div className="max-w-4xl mx-auto px-8 text-center text-white">
          <h2 className="text-4xl font-bold mb-6">Siap untuk Memulai?</h2>
          <p className="text-xl mb-8 opacity-90">
            Daftar sekarang dan tingkatkan transparansi KPI organisasi Anda
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-8 py-4 rounded-lg font-bold text-lg bg-white text-indigo-600 hover:bg-opacity-90 transition-all transform hover:scale-105"
          >
            Masuk ke Aplikasi
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg bg-white border border-orange-100 p-1"
                >
                  <Image
                    src="/logo-upnvj.webp"
                    alt="Logo UPN Veteran Jakarta"
                    width={24}
                    height={24}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-bold">IKU-PK</span>
              </div>
              <p className="text-gray-400">
                Sistem monitoring Indikator Kinerja Utama dan Program Kegiatan.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Produk</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Dashboard
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Monitoring
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Laporan
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Perusahaan</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Tentang
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Hubungi
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Dukungan
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Privasi
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Syarat Layanan
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8">
            <p className="text-center text-gray-400">
              © 2025 IKU-PK. Semua hak dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
