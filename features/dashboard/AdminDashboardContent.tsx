"use client";

import { useEffect, useState } from "react";
import PageTransition from '@/components/layout/PageTransition';
import { getTargets } from '@/services/targetService';

interface TargetRow {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export default function AdminDashboardContent() {
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mockData: TargetRow[] = [
    {
      date: '02 Januari 2025',
      title: 'Perjanjian Kerja',
      sasaran: 'Pemberitahuan kegiatan melalui web Fakultas',
      capaian: '100%',
    },
    {
      date: '02 Januari 2025',
      title: 'Perjanjian Kerja',
      sasaran: 'Laporan Rapat Tinjauan Manajemen (RTM)',
      capaian: '100%',
    },
    {
      date: '02 Januari 2025',
      title: 'Perjanjian Kerja',
      sasaran: 'Penyelesaian LPI',
      capaian: '0%',
    },
    {
      date: '31 Maret 2025',
      title: 'Indikator Kinerja Utama',
      sasaran: 'Meningkatnya kualitas lulusan pendidikan tinggi',
      capaian: '0%',
    },
    {
      date: '31 Maret 2025',
      title: 'Indikator Kinerja Utama',
      sasaran: 'Persentase dosen yang berkegatan tridharma',
      capaian: '0%',
    },
    {
      date: '31 September 2025',
      title: 'Indikator Kinerja Utama',
      sasaran: 'Mahasiswa menghubiskan paling tidak 20 SKS diluar kampus',
      capaian: '0%',
    },
    {
      date: '31 September 2025',
      title: 'Indikator Kinerja Utama',
      sasaran: 'Mahasiswa inbound diterima Pertukaran Mahasiswa Internasional',
      capaian: '0%',
    },
  ];

  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(userStr));
  }, []);

  useEffect(() => {
    async function fetchTargets() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTargets();
        // Use mock data if API returns empty array
        setRows(data && data.length > 0 ? data : mockData);
      } catch (err) {
        // Use mock data on error
        setRows(mockData);
        setError(null);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchTargets();
    }
  }, [user]);

  if (!user) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div>
      <PageTransition>
        {/* Beranda Title */}
        <h2 style={{ color: "#FF7900", fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
          Beranda
        </h2>

        {/* NOTIF CARD - Target Baru */}
        <div
          style={{
            backgroundColor: "#dcfce7",
            borderRadius: 12,
            padding: 24,
            marginBottom: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #bbf7d0",
          }}
        >
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 16, color: "#15803d" }}>
              Target Baru
            </h3>
            <p style={{ fontSize: 14, color: "#3f6619", margin: 0 }}>
              Segera periksa target Indikator Kinerja Utama dan Perjanjian Kerja mu lalu lakukan penyesuaian sebelum tanggal 30 Oktober
            </p>
          </div>

          <button
            style={{
              backgroundColor: "#16a34a",
              color: "white",
              padding: "10px 28px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
              marginLeft: 20,
            }}
            onClick={() => console.log("Telusuri clicked")}
          >
            Telusuri
          </button>
        </div>

        {/* TABLE CARD */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 24,
              color: "#1f2937",
            }}
          >
            Target IKU dan PK
          </h3>

          {loading && <p style={{ color: "#9ca3af", padding: "24px" }}>Loading targets...</p>}
          {error && <p style={{ color: "red", padding: "24px" }}>Error: {error}</p>}

          {!loading && !error && rows.length === 0 && (
            <p style={{ color: "#9ca3af", padding: "24px", textAlign: "center" }}>
              Tidak ada data target
            </p>
          )}

          {!loading && !error && rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f9fafb",
                      borderBottom: "2px solid #e5e7eb",
                    }}
                  >
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Tanggal
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Target
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Sasaran Strategis
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Capaian
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <td style={{ padding: "16px", color: "#0284c7", fontWeight: 600 }}>
                        {row.date}
                      </td>
                      <td style={{ padding: "16px", color: "#374151" }}>
                        {row.title}
                      </td>
                      <td style={{ padding: "16px", color: "#374151" }}>
                        {row.sasaran}
                      </td>
                      <td
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          color: "#374151",
                          fontWeight: 600,
                        }}
                      >
                        {row.capaian}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <button
                          style={{
                            backgroundColor: row.capaian === "0%" ? "#fff7ed" : "#ecfdf5",
                            color: row.capaian === "0%" ? "#d97706" : "#059669",
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: row.capaian === "0%" ? "1px solid #fed7aa" : "1px solid #d1fae5",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {row.capaian === "0%" ? "Proses" : "Input"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
