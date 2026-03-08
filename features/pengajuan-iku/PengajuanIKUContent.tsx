"use client";

import { useState } from "react";
import PageTransition from "@/components/layout/PageTransition";

interface PengajuanRow {
  id: number;
  unitKerja: string;
  waktuPengajuan: string;
  target: string;
  sasaranStrategis: string;
  status: "Belum Disetujui" | "Menunggu SK";
  aksi: "Proses" | "Detail";
}

interface PengajuanIKUContentProps {
  role?: 'admin' | 'user';
}

export default function PengajuanIKUContent({ role = 'user' }: PengajuanIKUContentProps) {
  const [rows] = useState<PengajuanRow[]>([
    { id: 1, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Perjanjian Kerja", sasaranStrategis: "Pemberitaan kegiatan melalui web Fakultas", status: "Belum Disetujui", aksi: "Proses" },
    { id: 2, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Perjanjian Kerja", sasaranStrategis: "Laporan Rapat Tinjauan Manajemen (RTM)", status: "Belum Disetujui", aksi: "Proses" },
    { id: 3, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Perjanjian Kerja", sasaranStrategis: "Penyelesaian LPJ", status: "Menunggu SK", aksi: "Detail" },
    { id: 4, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Indikator Kinerja Utama", sasaranStrategis: "Hasil lulusan mendapatkan pekerjaan", status: "Belum Disetujui", aksi: "Proses" },
    { id: 5, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Indikator Kinerja Utama", sasaranStrategis: "Persentase dosen yang berkegiatan tridharma", status: "Belum Disetujui", aksi: "Proses" },
    { id: 6, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Indikator Kinerja Utama", sasaranStrategis: "Mahasiswa menghabiskan paling tidak 20 SKS diluar kampus", status: "Menunggu SK", aksi: "Detail" },
    { id: 7, unitKerja: "FIK", waktuPengajuan: "25 Desember 2024", target: "Indikator Kinerja Utama", sasaranStrategis: "Mahasiswa inbound diterima Pertukaran Mahasiswa Internasional", status: "Menunggu SK", aksi: "Detail" },
  ]);

  const [filterUnitKerja, setFilterUnitKerja] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterTarget, setFilterTarget] = useState("semua");

  const unitKerjaOptions = [
    "semua",
    ...Array.from(new Set(rows.map((item) => item.unitKerja))),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(new Set(rows.map((item) => item.waktuPengajuan.split(" ").slice(-1)[0]))),
  ];

  const targetOptions = [
    "semua",
    ...Array.from(new Set(rows.map((item) => item.target))),
  ];

  const filteredRows = rows.filter((item) => {
    const year = item.waktuPengajuan.split(" ").slice(-1)[0] || "";
    const matchUnit = filterUnitKerja === "semua" || item.unitKerja === filterUnitKerja;
    const matchPeriode = filterPeriode === "semua" || year === filterPeriode;
    const matchTarget = filterTarget === "semua" || item.target === filterTarget;
    return matchUnit && matchPeriode && matchTarget;
  });

  const handleResetFilter = () => {
    setFilterUnitKerja("semua");
    setFilterPeriode("semua");
    setFilterTarget("semua");
  };

  const handleAction = (row: PengajuanRow) => {
    console.log(`${row.aksi} clicked for`, row.id);
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Target Indikator Kinerja Utama & Perjanjian Kerja
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Target Indikator Kinerja Utama & Perjanjian Kerja
          </h3>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Unit Kerja</label>
                <select
                  value={filterUnitKerja}
                  onChange={(e) => setFilterUnitKerja(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 14, color: "#374151" }}
                >
                  {unitKerjaOptions.map((option) => (
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

            <div style={{ maxWidth: 420 }}>
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
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
            </div>
          </div>

          <h4 style={{ fontSize: 18, color: "#111827", marginBottom: 12, fontWeight: 700 }}>Target IKU dan PK</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700, color: "#3b82f6", borderBottom: "1px solid #e5e7eb" }}>Waktu Pengajuan</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Target</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Sasaran Strategis</th>
                  <th style={{ textAlign: "center", padding: "12px 14px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                  <th style={{ textAlign: "center", padding: "12px 14px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px 14px", color: "#2563eb", fontWeight: 600 }}>{item.waktuPengajuan}</td>
                      <td style={{ padding: "12px 14px", color: "#374151" }}>{item.target}</td>
                      <td style={{ padding: "12px 14px", color: "#4b5563" }}>{item.sasaranStrategis}</td>
                      <td style={{ padding: "12px 14px", textAlign: "center", color: item.status === "Belum Disetujui" ? "#ea580c" : "#f59e0b", fontWeight: 700 }}>
                        {item.status}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <button
                          onClick={() => handleAction(item)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            border: `1px solid ${item.aksi === "Proses" ? "#fb923c" : "#86efac"}`,
                            backgroundColor: item.aksi === "Proses" ? "#fff7ed" : "#ecfdf5",
                            color: item.aksi === "Proses" ? "#f97316" : "#16a34a",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          {item.aksi}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#9ca3af" }}>
                      Tidak ada data pengajuan
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
