"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { getIKUList } from "@/services/ikuService";
import { useRouter } from "next/navigation";

export interface IKUPKData {
  id: number;
  nama: string;
  kode: string;
  jenis: string;
  targets: any[];
}

interface IKUTableRow {
  id: string;
  tenggat: string;
  target: string;
  sasaranStrategis: string;
  capaian: number;
  aksi: "Input" | "Proses" | "Disposisi";
}

function parseCapaian(value: any): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace("%", "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toLabelDate(dateValue: any): string {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getPeriodYear(dateValue: any): string {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return String(date.getFullYear());
}

const MOCK_ROWS: IKUTableRow[] = [
  { id: "1", tenggat: "02 Januari 2025", target: "Perjanjian Kerja", sasaranStrategis: "Pemberitahuan kegiatan melalui web Fakultas", capaian: 100, aksi: "Input" },
  { id: "2", tenggat: "02 Januari 2025", target: "Perjanjian Kerja", sasaranStrategis: "Laporan Rapat Tinjauan Manajemen (RTM)", capaian: 100, aksi: "Input" },
  { id: "3", tenggat: "02 Januari 2025", target: "Perjanjian Kerja", sasaranStrategis: "Penyelesaian LPI", capaian: 0, aksi: "Input" },
  { id: "4", tenggat: "31 Maret 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Meningkatnya kualitas lulusan pendidikan tinggi", capaian: 0, aksi: "Proses" },
  { id: "5", tenggat: "31 Maret 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Persentase dosen yang berkegatan tridharma", capaian: 0, aksi: "Input" },
  { id: "6", tenggat: "31 September 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Mahasiswa menghabiskan paling tidak 20 SKS diluar kampus", capaian: 0, aksi: "Input" },
  { id: "7", tenggat: "31 September 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Mahasiswa inbound diterima Pertukaran Mahasiswa Internasional", capaian: 0, aksi: "Input" },
];

const MOCK_DISPOSISI: IKUTableRow[] = [
  { id: "d1", tenggat: "31 Maret 2025", target: "Indikator Kinerja Utama", sasaranStrategis: "Hasil lulusan mendapatkan pekerjaan", capaian: 55, aksi: "Disposisi" },
  { id: "d2", tenggat: "31 September 2025", target: "Perjanjian Kerja", sasaranStrategis: "Penyelesaian Laporan Tahunan", capaian: 30, aksi: "Disposisi" },
];

export default function IKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const router = useRouter();
  const [data, setData] = useState<IKUPKData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<IKUTableRow | null>(null);
  const [realisasi, setRealisasi] = useState("");
  const [keterangan, setKeterangan] = useState("");

  useEffect(() => {
    async function fetchIKU() {
      try {
        setLoading(true);
        const ikuData = await getIKUList();
        setData(ikuData);
      } catch (err) {
        // silently fall back to mock
      } finally {
        setLoading(false);
      }
    }

    fetchIKU();
  }, []);

  const allRows: IKUTableRow[] = data.flatMap((iku) => {
    const targets = Array.isArray(iku.targets) ? iku.targets : [];
    return targets.map((target: any, index: number) => {
      const tenggatRaw =
        target?.tenggat ?? target?.deadline ?? target?.createdAt ?? target?.updatedAt ?? null;
      const capaian = parseCapaian(
        target?.capaianPersen ?? target?.capaian ?? target?.progress ?? 0
      );
      const statusRaw = String(target?.status ?? "").toLowerCase();

      let aksi: IKUTableRow["aksi"] = "Input";
      if (statusRaw.includes("disposisi")) {
        aksi = "Disposisi";
      } else if (capaian > 0 && capaian < 100) {
        aksi = "Proses";
      }

      return {
        id: `${iku.id}-${target?.id ?? index}`,
        tenggat: toLabelDate(tenggatRaw),
        target: iku.jenis || target?.targetNama || "Indikator Kinerja Utama",
        sasaranStrategis: target?.sasaranStrategis || iku.nama,
        capaian,
        aksi,
      };
    });
  });

  const useMock = !loading && data.length === 0;
  const allRowsFinal: IKUTableRow[] = useMock ? MOCK_ROWS : allRows;
  const disposisiRowsFinal: IKUTableRow[] = useMock ? MOCK_DISPOSISI : [];

  const filteredFinal = allRowsFinal.filter((row) => {
    const matchTarget = filterTarget === "semua" || row.target === filterTarget;
    const matchPeriode = filterPeriode === "semua" || row.tenggat.toLowerCase().includes(filterPeriode);
    const matchStatus = filterStatus === "semua" || row.aksi.toLowerCase() === filterStatus.toLowerCase();
    return matchTarget && matchPeriode && matchStatus;
  });

  const targetRows = filteredFinal.filter((row) => row.aksi !== "Disposisi");
  const disposisiRows = useMock
    ? disposisiRowsFinal
    : filteredFinal.filter((row) => row.aksi === "Disposisi");

  const targetOptions = [
    "semua",
    ...Array.from(new Set(allRowsFinal.map((r) => r.target))).filter(Boolean),
  ];

  const periodOptions = [
    "semua",
    ...Array.from(
      new Set(allRowsFinal.map((r) => {
        const match = r.tenggat.match(/\d{4}/);
        return match ? match[0] : "-";
      }))
    ).filter((y) => y !== "-"),
  ];

  const onResetFilters = () => {
    setFilterTarget("semua");
    setFilterPeriode("semua");
    setFilterStatus("semua");
  };

  const handleActionClick = (row: IKUTableRow) => {
    setSelectedRow(row);
    setRealisasi("");
    setKeterangan("");
    setModalOpen(true);
  };

  const handleModalSubmit = () => {
    setModalOpen(false);
    setSelectedRow(null);
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Indikator Kinerja Utama &amp; Perjanjian Kerja
        </p>

        {/* REKAM DATA MODAL */}
        {modalOpen && selectedRow && (
          <div
            style={{
              position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setModalOpen(false)}
          >
            <div
              style={{
                backgroundColor: "white", borderRadius: 12, padding: 28,
                width: 480, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#1f2937" }}>Rekam Data</h3>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                {selectedRow.sasaranStrategis}
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Tahun</label>
                <input
                  type="text"
                  defaultValue="2025"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Target</label>
                <input
                  type="text"
                  defaultValue={selectedRow.target}
                  readOnly
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, backgroundColor: "#f9fafb", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Realisasi (%)</label>
                <input
                  type="number"
                  min={0} max={100}
                  value={realisasi}
                  onChange={(e) => setRealisasi(e.target.value)}
                  placeholder="Masukkan persentase realisasi"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Keterangan</label>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Tambahkan keterangan (opsional)"
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleModalSubmit}
                  style={{ padding: "8px 24px", borderRadius: 6, border: "none", backgroundColor: "#16a34a", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Indikator Kinerja Utama & Perjanjian Kerja
          </h3>

          <div style={{ background: "#ffffff", borderRadius: 8, padding: 0, marginBottom: 26 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Target</label>
                <select
                  value={filterTarget}
                  onChange={(e) => setFilterTarget(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
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
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
                >
                  {periodOptions.map((period) => (
                    <option key={period} value={period}>
                      {period === "semua" ? "Semua" : period}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ maxWidth: 400, marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
              >
                <option value="semua">Semua</option>
                <option value="input">Input</option>
                <option value="proses">Proses</option>
                <option value="disposisi">Disposisi</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={onResetFilters}
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
          </div>

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
                    {targetRows.length > 0 ? (
                      targetRows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 600 }}>{row.tenggat}</td>
                          <td style={{ padding: "10px 12px", color: "#374151" }}>{row.target}</td>
                          <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.sasaranStrategis}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#111827" }}>{Math.round(row.capaian)}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button
                              onClick={() => handleActionClick(row)}
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

              <h4 style={{ fontSize: 16, color: "#111827", marginBottom: 12, fontWeight: 700 }}>Disposisi Target IKU dan PK</h4>
              <div style={{ overflowX: "auto" }}>
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
                    {disposisiRows.length > 0 ? (
                      disposisiRows.map((row) => (
                        <tr key={`disp-${row.id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 600 }}>{row.tenggat}</td>
                          <td style={{ padding: "10px 12px", color: "#374151" }}>{row.target}</td>
                          <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.sasaranStrategis}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#111827" }}>{Math.round(row.capaian)}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button
                              onClick={() => handleActionClick(row)}
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
                              Disposisi
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#9ca3af" }}>
                          Tidak ada data disposisi
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
