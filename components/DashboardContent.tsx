"use client";

import { useEffect, useState } from "react";
import PageTransition from '@/components/PageTransition';
import { getTargets } from '@/lib/api';

interface TargetRow {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export default function DashboardContent() {
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load targets');
        setRows([]);
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
        {/* Breadcrumb */}
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Beranda
        </p>

        {/* NOTIF CARD */}
        <div
          style={{
            backgroundColor: "#e8f5e9",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #c8e6c9",
          }}
        >
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 4, fontSize: 16, color: "#1b5e20" }}>
              Target Baru!
            </h3>
            <p style={{ fontSize: 14, color: "#2e7d32", margin: 0 }}>
              Segera periksa target Indikator Kinerja Utama dan Perjanjian Kinerja mu lalu lakukan penyesuaian sebelum tanggal 30 Oktober
            </p>
          </div>

          <button
            style={{
              backgroundColor: "#16a34a",
              color: "white",
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
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
              marginBottom: 20,
              color: "#1f2937",
            }}
          >
            Target IKU dan PK
          </h3>

          {loading && <p>Loading targets...</p>}
          {error && <p style={{ color: "red" }}>Error: {error}</p>}

          {!loading && !error && (
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
                  {rows.length > 0 ? (
                    rows.map((row, index) => (
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
                              backgroundColor: "#ecfdf5",
                              color: "#059669",
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "1px solid #d1fae5",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Input
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "24px",
                          textAlign: "center",
                          color: "#9ca3af",
                        }}
                      >
                        Tidak ada data target
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
