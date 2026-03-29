"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { getIkuPk } from '@/lib/api';
import type { IkuPkRow } from '@/lib/api';

interface TargetRow {
  id: number;
  tenggat: string;
  target: string;
  sasaranStrategis: string;
  capaian: number;
  targetUniversitas: number;
  aksi: "Input" | "Proses";
}

export default function UserDashboardContent() {
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);

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
        const data: IkuPkRow[] = await getIkuPk(user.unitId);
        setRows(data.map((item) => ({
          id: item.id,
          tenggat: item.tahun,
          target: item.target,
          sasaranStrategis: item.sasaranStrategis,
          capaian: item.capaian,
          targetUniversitas: item.targetUniversitas,
          aksi: item.capaian > 0 ? "Proses" as const : "Input" as const,
        })));
      } catch {
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

          {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

          {!loading && (
            <div>
              <h4 style={{ fontSize: 16, color: "#111827", marginBottom: 12, fontWeight: 700 }}>Target IKU dan PK</h4>
              <div style={{ overflowX: "auto", marginBottom: 26 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Tenggat</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Target</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Sasaran Strategis</th>
                      <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Capaian</th>
                      <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 600 }}>{row.tenggat}</td>
                          <td style={{ padding: "10px 12px", color: "#374151" }}>{row.target}</td>
                          <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.sasaranStrategis}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#111827" }}>{Math.round(row.capaian)}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: "1px solid #86efac",
                                backgroundColor: "#ecfdf5",
                                color: "#16a34a",
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              {row.aksi}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#9ca3af" }}>
                          Tidak ada data target
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
