'use client';
import { useEffect, useState } from 'react';

interface TargetIKUPKAdminProps {
  apiBaseUrl?: string;
}

export default function TargetIKUPKAdmin({ apiBaseUrl = 'http://localhost:4000' }: TargetIKUPKAdminProps) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTarget, setFilterTarget] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${apiBaseUrl}/targets/admin/pku`);
        if (!response.ok) throw new Error('Gagal mengambil data');
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal mengambil data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [apiBaseUrl]);

  const handleResetFilter = () => {
    setFilterTarget('semua');
    setFilterStatus('semua');
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  // Debug: log data awal
  console.log('Data dari API:', data);

  // Flatten data untuk tampilan tabel
  const flatData = data.flatMap((indikator: any) =>
    indikator.targets.map((target: any) => ({
      ...target,
      indikatorNama: indikator.indikatorNama,
      indikatorKode: indikator.indikatorKode,
      indikatorJenis: indikator.indikatorJenis,
      indikatorTipe: indikator.indikatorTipe,
      parentId: indikator.parentId,
    }))
  );

  console.log('Flat data:', flatData);

  // Sementara tampilkan semua data dulu, tanpa filter parentId
  const inputData = flatData;

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-6">Indikator Kinerja Utama & Perjanjian Kerja</h2>

      {/* Filter Section */}
      <div className="bg-white rounded shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Target</label>
            <select
              value={filterTarget}
              onChange={(e) => setFilterTarget(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="semua">Semua</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Periode</label>
            <select className="w-full border rounded px-3 py-2">
              <option value="semua">Semua</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="semua">Semua</option>
            <option value="input">Input</option>
            <option value="disposisi">Disposisi</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleResetFilter}
            className="px-6 py-2 border border-green-500 text-green-500 rounded hover:bg-green-50"
          >
            Reset Filter
          </button>
          <button className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Cari
          </button>
        </div>
      </div>

      {/* Target IKU dan PK Section */}
      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4">Target IKU dan PK</h3>
        <button className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Tambah Target
        </button>
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-3 text-left">Tenggat</th>
                <th className="border px-4 py-3 text-left">Target</th>
                <th className="border px-4 py-3 text-left">Sasaran Strategis</th>
                <th className="border px-4 py-3 text-center">Capaian</th>
                <th className="border px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {inputData.length > 0 ? (
                inputData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 border-b">
                    <td className="border px-4 py-3 text-blue-600 font-medium cursor-pointer">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: '2-digit'
                      }) : '-'}
                    </td>
                    <td className="border px-4 py-3">
                      <div className="font-medium">{row.indikatorJenis}</div>
                    </td>
                    <td className="border px-4 py-3 text-sm">{row.indikatorNama}</td>
                    <td className="border px-4 py-3 text-center font-semibold text-green-600">
                      100%
                    </td>
                    <td className="border px-4 py-3 text-center">
                      <button className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm">
                        Input
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="border px-4 py-3 text-center text-gray-500">
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

  );
}
