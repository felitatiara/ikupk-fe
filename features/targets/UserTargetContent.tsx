"use client";

import { useState } from "react";
import PageTransition from "@/components/layout/PageTransition";

interface TargetRow {
  id: string;
  waktuCapaian: string;
  target: string;
  sasaranStrategis: string;
  status: "Selesai" | "Status Diproses";
}

interface SubIndikator {
  label: string;
  kriterias: string[];
  bobot: string;
  targetFisik: string;
}

interface TargetDetail {
  id: string;
  targetType: string;
  ikuLabel: string;
  targetUniversitas: string;
  subIndikators: SubIndikator[];
  catatan: string;
}

const MOCK_ROWS: TargetRow[] = [
  { id: "1", waktuCapaian: "02 Januari 2025", target: "Perjanjian Kerja", sasaranStrategis: "Pemberitahuan kegiatan melalui web Fakultas", status: "Selesai" },
  { id: "2", waktuCapaian: "02 Januari 2025", target: "Perjanjian Kerja", sasaranStrategis: "Laporan Rapat Tinjauan Manajemen (RTM)", status: "Selesai" },
  { id: "3", waktuCapaian: "31 Maret 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Meningkatnya kualitas lulusan pendidikan tinggi", status: "Status Diproses" },
  { id: "4", waktuCapaian: "31 Maret 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Persentase dosen yang berkegatan tridharma di PT", status: "Status Diproses" },
  { id: "5", waktuCapaian: "31 September 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Mahasiswa menghabiskan paling tidak 20 SKS diluar kampus", status: "Selesai" },
];

const MOCK_DETAILS: Record<string, TargetDetail> = {
  "1": {
    id: "1",
    targetType: "Perjanjian Kerja",
    ikuLabel: "Pemberitahuan kegiatan melalui web Fakultas",
    targetUniversitas: "100%",
    subIndikators: [
      { label: "1.1.1 Pemberitahuan kegiatan diunggah sebelum pelaksanaan", kriterias: ["H-7 sebelum kegiatan", "H-3 sebelum kegiatan"], bobot: "50%", targetFisik: "100%" },
    ],
    catatan: "Pastikan semua kegiatan diunggah sesuai jadwal yang telah ditetapkan.",
  },
  "2": {
    id: "2",
    targetType: "Perjanjian Kerja",
    ikuLabel: "Laporan Rapat Tinjauan Manajemen (RTM)",
    targetUniversitas: "100%",
    subIndikators: [
      { label: "1.2.1 Laporan RTM diterbitkan tepat waktu", kriterias: ["Tanpa Kriteria"], bobot: "100%", targetFisik: "100%" },
    ],
    catatan: "Laporan harus diterbitkan paling lambat 14 hari setelah RTM berlangsung.",
  },
  "3": {
    id: "3",
    targetType: "Indikator Kinerja Utama",
    ikuLabel: "Hasil Lulusan",
    targetUniversitas: "≥75%",
    subIndikators: [
      {
        label: "1.1.1 Hasil Lulusan Mendapatkan Pekerjaan",
        kriterias: ["< 6 Bulan dan >1.2 UMP", "7 s.d 12 Bulan dan >1.2 UMP", "< 6 Bulan dan < 1.2 UMP", "7 s.d 12 Bulan dan >1.2 UMP"],
        bobot: "40%",
        targetFisik: "60%",
      },
      {
        label: "1.1.2 Hasil Lulusan Melanjutkan Studi",
        kriterias: ["Tanpa Kriteria"],
        bobot: "30%",
        targetFisik: "15%",
      },
      {
        label: "1.1.3 Hasil Lulusan Menjadi Wiraswasta",
        kriterias: ["< 6 Bulan dan >1.2 UMP", "7 s.d 12 Bulan dan >1.2 UMP"],
        bobot: "30%",
        targetFisik: "10%",
      },
    ],
    catatan: "Target lulusan dihitung dari jumlah lulusan yang terserap di dunia kerja dan studi lanjut dalam satu tahun akademik.",
  },
  "4": {
    id: "4",
    targetType: "Indikator Kinerja Utama",
    ikuLabel: "Dosen Tridharma",
    targetUniversitas: "≥50%",
    subIndikators: [
      {
        label: "4.1.1 Dosen melaksanakan pengajaran",
        kriterias: ["Minimal 12 SKS per semester"],
        bobot: "50%",
        targetFisik: "80%",
      },
      {
        label: "4.1.2 Dosen melaksanakan penelitian",
        kriterias: ["Min 1 penelitian per tahun"],
        bobot: "30%",
        targetFisik: "70%",
      },
      {
        label: "4.1.3 Dosen melaksanakan pengabdian masyarakat",
        kriterias: ["Min 1 pengabdian per tahun"],
        bobot: "20%",
        targetFisik: "60%",
      },
    ],
    catatan: "Seluruh dosen tetap wajib melaksanakan Tridharma Perguruan Tinggi sesuai regulasi.",
  },
  "5": {
    id: "5",
    targetType: "Indikator Kinerja Utama",
    ikuLabel: "Program MBKM",
    targetUniversitas: "≥30%",
    subIndikators: [
      {
        label: "2.1.1 Mahasiswa mengikuti MBKM di luar kampus",
        kriterias: ["Min 20 SKS kegiatan luar kampus"],
        bobot: "100%",
        targetFisik: "35%",
      },
    ],
    catatan: "Dihitung dari mahasiswa aktif angkatan 2022 ke atas.",
  },
};

export default function UserTargetContent() {
  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<TargetDetail | null>(null);
  const [catatan, setCatatan] = useState("");

  const targetOptions = [
    "semua",
    ...Array.from(new Set(MOCK_ROWS.map((r) => r.target))),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(new Set(MOCK_ROWS.map((r) => {
      const match = r.waktuCapaian.match(/\d{4}/);
      return match ? match[0] : "-";
    }))).filter((y) => y !== "-"),
  ];

  const filteredRows = MOCK_ROWS.filter((row) => {
    const matchTarget = filterTarget === "semua" || row.target === filterTarget;
    const matchPeriode = filterPeriode === "semua" || row.waktuCapaian.includes(filterPeriode);
    return matchTarget && matchPeriode;
  });

  const handleAksiClick = (row: TargetRow) => {
    const detail = MOCK_DETAILS[row.id];
    if (detail) {
      setSelectedDetail(detail);
      setCatatan(detail.catatan);
      setModalOpen(true);
    }
  };

  const handleSimpan = () => {
    setModalOpen(false);
    setSelectedDetail(null);
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Target Indikator Kinerja Utama &amp; Perjanjian Kerja
        </p>

        {/* PENGAJUAN TARGET MODAL */}
        {modalOpen && selectedDetail && (
          <div
            style={{
              position: "fixed", inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "flex-start", justifyContent: "center",
              zIndex: 1000, overflowY: "auto", padding: "40px 16px",
            }}
            onClick={() => setModalOpen(false)}
          >
            <div
              style={{
                backgroundColor: "white", borderRadius: 12,
                padding: 28, width: 600, maxWidth: "96vw",
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
                Pengajuan Target
              </h3>

              {/* Target type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Target</label>
                  <input
                    value={selectedDetail.targetType}
                    readOnly
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f9fafb", boxSizing: "border-box" }}
                  />
                </div>
                <div />
              </div>

              {/* Indikator info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Indikator Kinerja Utama</label>
                  <input
                    value={selectedDetail.ikuLabel}
                    readOnly
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f9fafb", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Target Universitas</label>
                  <input
                    value={selectedDetail.targetUniversitas}
                    readOnly
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f9fafb", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Sub indikators */}
              {selectedDetail.subIndikators.map((sub, si) => (
                <div key={si} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 10 }}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      Sub Indikator Kinerja Kegiatan
                    </label>
                    <div style={{ fontSize: 12, color: "#1f2937", fontWeight: 600, padding: "6px 10px", backgroundColor: "#f3f4f6", borderRadius: 4 }}>
                      {sub.label}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "start" }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Kriteria</label>
                      {sub.kriterias.map((k, ki) => (
                        <div key={ki} style={{ fontSize: 12, color: "#4b5563", padding: "4px 8px", backgroundColor: "#f9fafb", borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 4 }}>
                          {k}
                        </div>
                      ))}
                    </div>
                    <div style={{ minWidth: 80 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Bobot</label>
                      <div style={{ fontSize: 12, color: "#374151", padding: "4px 8px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, textAlign: "center" }}>
                        {sub.bobot}
                      </div>
                    </div>
                    <div style={{ minWidth: 90 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Target Fisik</label>
                      <div style={{ fontSize: 12, color: "#374151", padding: "4px 8px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, textAlign: "center" }}>
                        {sub.targetFisik}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Catatan */}
              <div style={{ marginTop: 16, marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Catatan</label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={3}
                  style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 13, resize: "vertical", color: "#374151", boxSizing: "border-box" }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSimpan}
                  style={{ padding: "8px 28px", borderRadius: 6, border: "none", backgroundColor: "#FF7900", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Ajukan
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Target IKU dan PK
          </h3>

          {/* Filter bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Target</label>
              <select
                value={filterTarget}
                onChange={(e) => setFilterTarget(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
              >
                {targetOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua" : opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Periode</label>
              <select
                value={filterPeriode}
                onChange={(e) => setFilterPeriode(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
              >
                {periodeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua" : opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 20 }}>
            <button
              onClick={() => { setFilterTarget("semua"); setFilterPeriode("semua"); }}
              style={{ background: "white", color: "#10b759", border: "1px solid #10b759", borderRadius: 4, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Reset Filter
            </button>
            <button
              style={{ background: "#10b759", color: "white", border: "none", borderRadius: 4, padding: "8px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Cari
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Waktu Capaian</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Target</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Sasaran Strategis</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                  <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 600 }}>{row.waktuCapaian}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{row.target}</td>
                      <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.sasaranStrategis}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 12px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: row.status === "Selesai" ? "#dcfce7" : "#fff7ed",
                          color: row.status === "Selesai" ? "#16a34a" : "#c2410c",
                          border: `1px solid ${row.status === "Selesai" ? "#86efac" : "#fed7aa"}`,
                        }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <button
                          onClick={() => handleAksiClick(row)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 4,
                            border: "none",
                            backgroundColor: row.status === "Status Diproses" ? "#FF7900" : "#10b759",
                            color: "white",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          {row.status === "Status Diproses" ? "Pengajuan Target" : "Lihat Detail"}
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
      </PageTransition>
    </div>
  );
}
