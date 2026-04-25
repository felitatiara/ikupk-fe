"use client";

import { useState, useEffect, useRef } from "react";
import PageTransition from "@/components/layout/PageTransition";

// ─────────────────────────────────────────────
//  Types  (akan diganti dengan data dari API)
// ─────────────────────────────────────────────
export interface SKPRow {
  id: number;
  no: number;
  kodeIndikator: string;
  namaIndikator: string;
  sasaranStrategis: string;
  /** Target kuantitas dari disposisi */
  targetKuantitas: number | null;
  satuan: string;
  /** Realisasi dari data realisasi */
  realisasiKuantitas: number | null;
  /** 0–100 */
  capaianPersen: number | null;
  /** pending | validated | rejected */
  status: "pending" | "validated" | "rejected";
  periode: string;
}

export interface SKPUser {
  nip: string;
  nama: string;
  jabatan: string;
  unitKerja: string;
  tahun: string;
}

// ─────────────────────────────────────────────
//  Mock data  — ganti dengan API call nanti
// ─────────────────────────────────────────────
const MOCK_USER: SKPUser = {
  nip: "198501012010011001",
  nama: "— (dari sesi login) —",
  jabatan: "— (dari data unit) —",
  unitKerja: "— (dari data unit) —",
  tahun: new Date().getFullYear().toString(),
};

const MOCK_ROWS: SKPRow[] = [
  {
    id: 1,
    no: 1,
    kodeIndikator: "IKU.1.1",
    namaIndikator: "Jumlah publikasi ilmiah internasional",
    sasaranStrategis: "Peningkatan kualitas riset dan inovasi",
    targetKuantitas: 2,
    satuan: "Artikel",
    realisasiKuantitas: null,
    capaianPersen: null,
    status: "pending",
    periode: "2025",
  },
  {
    id: 2,
    no: 2,
    kodeIndikator: "IKU.2.3",
    namaIndikator: "Persentase mahasiswa lulus tepat waktu",
    sasaranStrategis: "Peningkatan kualitas pembelajaran",
    targetKuantitas: 80,
    satuan: "%",
    realisasiKuantitas: null,
    capaianPersen: null,
    status: "pending",
    periode: "2025",
  },
];

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function nilaiCapaian(persen: number | null): { nilai: string; predikat: string; color: string } {
  if (persen === null) return { nilai: "—", predikat: "Belum ada data", color: "#6b7280" };
  if (persen >= 100) return { nilai: persen.toFixed(1), predikat: "Sangat Baik", color: "#16a34a" };
  if (persen >= 76) return { nilai: persen.toFixed(1), predikat: "Baik", color: "#2563eb" };
  if (persen >= 51) return { nilai: persen.toFixed(1), predikat: "Cukup", color: "#d97706" };
  return { nilai: persen.toFixed(1), predikat: "Kurang", color: "#dc2626" };
}

function statusBadge(status: SKPRow["status"]) {
  const map = {
    pending: { label: "Menunggu Validasi", bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
    validated: { label: "Tervalidasi", bg: "#dcfce7", color: "#166534", border: "#86efac" },
    rejected: { label: "Ditolak", bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  };
  const s = map[status];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
function loadUserFromSession(): SKPUser {
  try {
    if (typeof window === "undefined") return MOCK_USER;
    const raw = sessionStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      return {
        nip: u.nip ?? "—",
        nama: u.nama ?? "—",
        jabatan: u.role ?? "—",
        unitKerja: u.unitNama ?? "—",
        tahun: new Date().getFullYear().toString(),
      };
    }
  } catch {
    // session tidak tersedia
  }
  return MOCK_USER;
}

export default function SKPContent() {
  const [userData] = useState<SKPUser>(loadUserFromSession);
  const [rows, setRows] = useState<SKPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const printRef = useRef<HTMLDivElement>(null);

  // ── TODO: Ganti mock data dengan API call ketika integrasi siap ──
  // useEffect(() => {
  //   async function fetchSKP() {
  //     setLoading(true);
  //     try {
  //       const data = await getSKPByUser();   // endpoint: GET /skp/me
  //       setRows(data);
  //     } catch (err) {
  //       console.error("Failed to fetch SKP:", err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   fetchSKP();
  // }, []);

  useEffect(() => {
    // Sementara pakai mock
    setTimeout(() => {
      setRows(MOCK_ROWS);
      setLoading(false);
    }, 300);
  }, []);

  // ── Filter ──
  const periodeOptions = ["semua", ...Array.from(new Set(rows.map((r) => r.periode)))];

  const filtered = rows.filter((r) => {
    const matchPeriode = filterPeriode === "semua" || r.periode === filterPeriode;
    const matchStatus = filterStatus === "semua" || r.status === filterStatus;
    return matchPeriode && matchStatus;
  });

  const allValidated = filtered.length > 0 && filtered.every((r) => r.status === "validated");

  // ── Print / export (aktif ketika realisasi & validasi sudah berjalan) ──
  const handleCetak = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>SKP – ${userData.nama}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12px; margin: 0; color: #000; }
          .wrap { padding: 32px 48px; }
          h1 { text-align: center; font-size: 14px; text-transform: uppercase; margin-bottom: 4px; }
          .sub { text-align: center; font-size: 11px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #000; padding: 6px 8px; }
          th { background: #f3f3f3; text-align: center; font-size: 11px; }
          td { font-size: 11px; }
          .info-grid { display: grid; grid-template-columns: 160px 8px 1fr; gap: 2px 4px; margin-bottom: 16px; }
          .signature { display: flex; justify-content: flex-end; margin-top: 40px; }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1px solid #000; margin: 48px 0 4px; }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  // ─────────────── Render ───────────────
  const th: React.CSSProperties = {
    padding: "10px 12px",
    fontWeight: 700,
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    textAlign: "left",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "top",
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Sasaran Kinerja Pegawai (SKP)
        </p>

        {/* ── Info banner integrasi ── */}
        <div
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>⏳</span>
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>Template SKP</strong> — Data capaian akan terisi otomatis setelah realisasi dan
            validasi IKU/PK selesai diproses oleh admin.
          </p>
        </div>

        {/* ── Card identitas pegawai ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 16 }}>
                Identitas Pegawai
              </h3>
              {[
                ["NIP", userData.nip],
                ["Nama", userData.nama],
                ["Jabatan", userData.jabatan],
                ["Unit Kerja", userData.unitKerja],
                ["Tahun Penilaian", userData.tahun],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 0, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ width: 140, color: "#6b7280", flexShrink: 0 }}>{label}</span>
                  <span style={{ width: 12, color: "#6b7280", flexShrink: 0 }}>:</span>
                  <span style={{ color: "#1f2937", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Tombol cetak — aktif hanya jika semua tervalidasi */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <button
                onClick={handleCetak}
                disabled={!allValidated}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: allValidated ? "#FF7900" : "#d1d5db",
                  color: allValidated ? "white" : "#9ca3af",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: allValidated ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                🖨️ Cetak / Unduh SKP
              </button>
              {!allValidated && (
                <span style={{ fontSize: 11, color: "#6b7280", textAlign: "right" }}>
                  Tersedia setelah semua indikator tervalidasi
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Filter ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>
                Periode
              </label>
              <select
                value={filterPeriode}
                onChange={(e) => setFilterPeriode(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                {periodeOptions.map((p) => (
                  <option key={p} value={p}>{p === "semua" ? "Semua Periode" : p}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option value="semua">Semua Status</option>
                <option value="pending">Menunggu Validasi</option>
                <option value="validated">Tervalidasi</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Tabel SKP ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 20 }}>
            Rincian Sasaran Kinerja
          </h3>

          {loading ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data SKP…</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
              Belum ada data SKP untuk filter yang dipilih.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr>
                    {["No", "Kode", "Indikator / Sasaran Strategis", "Target", "Realisasi", "Capaian (%)", "Predikat", "Status"].map(
                      (h) => <th key={h} style={th}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const cap = nilaiCapaian(row.capaianPersen);
                    return (
                      <tr key={row.id} style={{ transition: "background 0.15s" }}>
                        <td style={{ ...td, textAlign: "center", width: 36 }}>{row.no}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11, width: 80 }}>{row.kodeIndikator}</td>
                        <td style={{ ...td }}>
                          <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{row.namaIndikator}</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#6b7280", marginTop: 2 }}>{row.sasaranStrategis}</p>
                        </td>
                        <td style={{ ...td, textAlign: "center", width: 90 }}>
                          {row.targetKuantitas !== null
                            ? `${row.targetKuantitas} ${row.satuan}`
                            : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                        <td style={{ ...td, textAlign: "center", width: 90 }}>
                          {row.realisasiKuantitas !== null
                            ? `${row.realisasiKuantitas} ${row.satuan}`
                            : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                        <td style={{ ...td, textAlign: "center", width: 90, fontWeight: 700, color: cap.color }}>
                          {cap.nilai}
                        </td>
                        <td style={{ ...td, width: 110, color: cap.color, fontWeight: 600, fontSize: 11 }}>
                          {cap.predikat}
                        </td>
                        <td style={{ ...td, width: 140 }}>{statusBadge(row.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Preview dokumen SKP (untuk cetak) ── */}
        <div style={{ display: "none" }}>
          <div ref={printRef}>
            <div className="wrap">
              <h1>SASARAN KINERJA PEGAWAI</h1>
              <p className="sub">
                Periode Penilaian: 1 Januari {userData.tahun} s/d 31 Desember {userData.tahun}
              </p>

              {/* Identitas */}
              <table>
                <tbody>
                  {[
                    ["NIP", userData.nip],
                    ["Nama", userData.nama],
                    ["Jabatan", userData.jabatan],
                    ["Unit Kerja", userData.unitKerja],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td style={{ width: 160, fontWeight: 600 }}>{label}</td>
                      <td style={{ width: 12 }}>:</td>
                      <td>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Tabel kinerja */}
              <table style={{ marginTop: 20 }}>
                <thead>
                  <tr>
                    {["No", "Kode", "Indikator Kinerja", "Sasaran Strategis", "Target", "Realisasi", "Capaian (%)", "Predikat", "Status"].map(
                      (h) => <th key={h}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cap = nilaiCapaian(row.capaianPersen);
                    return (
                      <tr key={row.id}>
                        <td style={{ textAlign: "center" }}>{row.no}</td>
                        <td>{row.kodeIndikator}</td>
                        <td>{row.namaIndikator}</td>
                        <td>{row.sasaranStrategis}</td>
                        <td style={{ textAlign: "center" }}>
                          {row.targetKuantitas !== null ? `${row.targetKuantitas} ${row.satuan}` : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {row.realisasiKuantitas !== null ? `${row.realisasiKuantitas} ${row.satuan}` : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>{cap.nilai}</td>
                        <td>{cap.predikat}</td>
                        <td>{row.status === "validated" ? "Tervalidasi" : row.status === "rejected" ? "Ditolak" : "Pending"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Tanda tangan */}
              <div className="signature">
                <div className="sig-box">
                  <p style={{ margin: 0 }}>
                    __________, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p style={{ margin: "4px 0 0" }}>Pejabat Penilai,</p>
                  <div className="sig-line" />
                  <p style={{ margin: 0, fontWeight: 600 }}>NIP. ___________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
