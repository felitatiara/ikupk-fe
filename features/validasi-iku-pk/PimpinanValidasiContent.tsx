"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import { getPimpinanValidasi, updateTargetStatus } from "@/lib/api";
import type { PimpinanValidasiRow } from "@/lib/api";

interface ValidasiData {
  id: number;
  tenggat: string;
  target: string;
  sasaranStrategis: string;
  capaian: number;
  status: string;
}

export default function PimpinanValidasiContent() {
  const [data, setData] = useState<ValidasiData[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  useEffect(() => {
    async function fetchData() {
      try {
        const userStr = sessionStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);
        const rows: PimpinanValidasiRow[] = await getPimpinanValidasi(user.roleId);
        const mapped: ValidasiData[] = rows.map((r) => ({
          id: r.id,
          tenggat: r.tahun,
          target: r.target,
          sasaranStrategis: r.sasaranStrategis,
          capaian: r.capaian,
          status: r.status,
        }));
        setData(mapped);
      } catch (err) {
        console.error("Failed to fetch pimpinan validasi data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const targetOptions = [
    "semua",
    ...Array.from(new Set(data.map((item) => item.target))),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(new Set(data.map((item) => item.tenggat))),
  ];

  const handleValidate = async (id: number) => {
    try {
      await updateTargetStatus(id, "disposisi");
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "disposisi" } : item
        )
      );
    } catch (err) {
      console.error("Failed to validate:", err);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await updateTargetStatus(id, "rejected");
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "rejected" } : item
        )
      );
    } catch (err) {
      console.error("Failed to reject:", err);
    }
  };

  const handleResetFilter = () => {
    setFilterTarget("semua");
    setFilterPeriode("semua");
    setFilterStatus("semua");
  };

  const exportToExcel = () => {
    const rows = shownRows.map((item, i) => ({
      No: i + 1,
      Tahun: item.tenggat,
      Target: item.target,
      "Sasaran Strategis": item.sasaranStrategis,
      "Capaian (%)": item.capaian,
      Status: item.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Validasi Pimpinan");
    XLSX.writeFile(wb, `Validasi_Pimpinan_${new Date().getFullYear()}.xlsx`);
  };

  const filteredData = data.filter((item) => {
    const matchTarget = filterTarget === "semua" || item.target === filterTarget;
    const matchPeriode = filterPeriode === "semua" || item.tenggat === filterPeriode;
    const matchStatus = filterStatus === "semua" || item.status === filterStatus;
    return matchTarget && matchPeriode && matchStatus;
  });

  const shownRows = filteredData.filter((item) => item.status === "pending_pimpinan");

  const tableHeaderStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "12px 14px",
    fontWeight: 700,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Validasi Indikator Kinerja Utama & Perjanjian Kerja
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Validasi Target IKU & PK
          </h3>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Target</label>
                <select
                  value={filterTarget}
                  onChange={(e) => setFilterTarget(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 14, color: "#374151" }}
                >
                  {targetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "semua" ? "Semua" : option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Periode</label>
                <select
                  value={filterPeriode}
                  onChange={(e) => setFilterPeriode(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 14, color: "#374151" }}
                >
                  {periodeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "semua" ? "Semua" : option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={handleResetFilter}
                style={{ background: "white", color: "#10b759", border: "1px solid #10b759", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Reset Filter
              </button>
              <button
                style={{ background: "#10b759", color: "white", border: "none", borderRadius: 6, padding: "8px 22px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Cari
              </button>
              <button
                onClick={exportToExcel}
                style={{ background: "#10b759", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Export Excel
              </button>
            </div>
          </div>

          {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

          {!loading && (
            <div style={{ overflowX: "auto" }}>
              <h4 style={{ fontSize: 18, color: "#111827", marginBottom: 12, fontWeight: 700 }}>Target Menunggu Validasi</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Tahun</th>
                    <th style={tableHeaderStyle}>Target</th>
                    <th style={tableHeaderStyle}>Sasaran Strategis</th>
                    <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Capaian</th>
                    <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.length > 0 ? (
                    shownRows.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "12px 14px", color: "#2563eb", fontWeight: 600 }}>{item.tenggat}</td>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>{item.target}</td>
                        <td style={{ padding: "12px 14px", color: "#4b5563" }}>{item.sasaranStrategis}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", color: "#111827", fontWeight: 700 }}>{item.capaian}%</td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button
                              onClick={() => handleValidate(item.id)}
                              style={{
                                backgroundColor: "#ecfdf5",
                                color: "#16a34a",
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: "1px solid #86efac",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleReject(item.id)}
                              style={{
                                backgroundColor: "#fef2f2",
                                color: "#dc2626",
                                padding: "4px 10px",
                                borderRadius: 4,
                                border: "1px solid #fca5a5",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              Tolak
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#9ca3af" }}>
                        Tidak ada target yang menunggu validasi
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
