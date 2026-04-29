"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import { getRealisasiForValidasi, updateRealisasiStatus, ValidasiRow } from "@/lib/api";

export interface ValidasiData {
  id: number;
  tenggat: string;
  target: string;
  sasaranStrategis: string;
  capaian: number;
  status: "pending" | "validated";
}

interface ValidasiIKUPKContentProps {
  role?: 'admin' | 'user';
}

export default function ValidasiIKUPKContent({ role = 'user' }: ValidasiIKUPKContentProps) {
  const [data, setData] = useState<ValidasiData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const rows: ValidasiRow[] = await getRealisasiForValidasi();
        const mapped: ValidasiData[] = rows.map((r) => ({
          id: r.id,
          tenggat: r.tahun,
          target: r.target,
          sasaranStrategis: r.sasaranStrategis,
          capaian: r.realisasiAngka,
          status: r.status === 'validated' ? 'validated' : 'pending',
        }));
        setData(mapped);
      } catch (err) {
        console.error('Failed to fetch validasi data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  const targetOptions = [
    "semua",
    ...Array.from(new Set(data.map((item) => item.target))),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(
      new Set(data.map((item) => item.tenggat.split(" ").slice(-1)[0]))
    ),
  ];

  const handleValidate = async (id: number) => {
    try {
      await updateRealisasiStatus(id, 'validated');
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "validated" } : item
        )
      );
    } catch (err) {
      console.error('Failed to validate:', err);
    }
  };

  const handleResetFilter = () => {
    setFilterTarget("semua");
    setFilterPeriode("semua");
    setFilterStatus("semua");
  };

  const exportToExcel = () => {
    const rows = filteredData.map((item, i) => ({
      No: i + 1,
      Tahun: item.tenggat,
      Target: item.target,
      "Sasaran Strategis": item.sasaranStrategis,
      "Capaian (%)": item.capaian,
      Status: item.status === "validated" ? "Tervalidasi" : "Menunggu Validasi",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Validasi IKU PK");
    XLSX.writeFile(wb, `Validasi_IKU_PK_${new Date().getFullYear()}.xlsx`);
  };

  const filteredData = data.filter((item) => {
    const matchTarget = filterTarget === "semua" || item.target === filterTarget;
    const year = item.tenggat.split(" ").slice(-1)[0] || "";
    const matchPeriode = filterPeriode === "semua" || year === filterPeriode;
    const statusLabel = item.status === "validated" ? "validated" : "pending";
    const matchStatus = filterStatus === "semua" || filterStatus === statusLabel;
    return matchTarget && matchPeriode && matchStatus;
  });

  const shownRows = filteredData.filter((item) => item.status !== "validated");

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
            Validasi Indikator Kinerja Utama & Perjanjian Kerja
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

            <div style={{ maxWidth: 420, marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 14, color: "#374151" }}
              >
                <option value="semua">Semua</option>
                <option value="pending">Menunggu Validasi</option>
                <option value="validated">Tervalidasi</option>
              </select>
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

          <div style={{ overflowX: "auto" }}>
            <h4 style={{ fontSize: 18, color: "#111827", marginBottom: 12, fontWeight: 700 }}>Target IKU dan PK</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Tenggat</th>
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
                          Validasi
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#9ca3af" }}>
                      Tidak ada data untuk divalidasi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
