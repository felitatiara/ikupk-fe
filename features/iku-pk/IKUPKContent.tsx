"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { getIKUList } from "@/services/ikuService";

export interface IKUPKData {
  id: number;
  nama: string;
  kode: string;
  jenis: string;
  targets: any[];
}

export default function IKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [data, setData] = useState<IKUPKData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIKU() {
      try {
        setLoading(true);
        const ikuData = await getIKUList();
        setData(ikuData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load IKU');
      } finally {
        setLoading(false);
      }
    }

    fetchIKU();
  }, []);

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Indikator Kinerja Utama & Perjanjian Kerja
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Daftar IKU & PK
          </h3>

          {loading && <p>Loading...</p>}
          {error && <p style={{ color: "red" }}>Error: {error}</p>}

          {!loading && !error && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Kode</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Nama</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Jenis</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length > 0 ? (
                    data.map((iku) => (
                      <tr key={iku.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "16px", color: "#0284c7", fontWeight: 600 }}>{iku.kode}</td>
                        <td style={{ padding: "16px", color: "#374151" }}>{iku.nama}</td>
                        <td style={{ padding: "16px", color: "#374151" }}>{iku.jenis}</td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <button style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "6px 12px", borderRadius: 6, border: "1px solid #d1fae5", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            Lihat
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                        Tidak ada data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
