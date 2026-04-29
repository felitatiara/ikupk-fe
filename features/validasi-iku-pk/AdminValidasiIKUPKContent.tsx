"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import { getTargetsForValidation, updateTargetValidationStatus, TargetWithRepositoryFile } from "@/lib/api";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
export type TargetValidasiRow = TargetWithRepositoryFile;

// ─────────────────────────────────────────────
//  Mock Data — ganti dengan API call nanti
// ─────────────────────────────────────────────
const MOCK_TARGETS_VALIDASI: TargetValidasiRow[] = [
  {
    id: 1,
    no: 1,
    unitKerja: "Fakultas Ilmu Komputer",
    namaIndikator: "Jumlah publikasi ilmiah internasional",
    kodeIndikator: "IKU.1.1",
    targetKuantitas: 2,
    satuan: "Artikel",
    linkFile: "http://localhost:3002/repository/targets/IKU-1-1-2025.pdf",
    namaFile: "IKU-1-1-2025.pdf",
    periode: "2025",
    statusValidasi: "pending",
  },
  {
    id: 2,
    no: 2,
    unitKerja: "Lembaga Penelitian",
    namaIndikator: "Jumlah penelitian berbasis industri",
    kodeIndikator: "IKU.2.1",
    targetKuantitas: 5,
    satuan: "Proyek",
    linkFile: "http://localhost:3002/repository/targets/IKU-2-1-2025.pdf",
    namaFile: "IKU-2-1-2025.pdf",
    periode: "2025",
    statusValidasi: "pending",
  },
  {
    id: 3,
    no: 3,
    unitKerja: "Rektorat",
    namaIndikator: "Persentase mahasiswa aktif mengikuti kegiatan kompetisi",
    kodeIndikator: "PK.1.2",
    targetKuantitas: 75,
    satuan: "%",
    linkFile: "http://localhost:3002/repository/targets/PK-1-2-2025.pdf",
    namaFile: "PK-1-2-2025.pdf",
    periode: "2025",
    statusValidasi: "approved",
    catatanAdmin: "Target sudah sesuai dengan standar",
  },
];

// ─────────────────────────────────────────────
//  Helper Functions
// ─────────────────────────────────────────────
function statusBadge(status: TargetValidasiRow["statusValidasi"]) {
  const map = {
    pending: { label: "Menunggu", bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
    approved: { label: "Disetujui", bg: "#dcfce7", color: "#166534", border: "#86efac" },
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

function openFile(url: string) {
  window.open(url, "_blank");
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function AdminValidasiIKUPKContent() {
  const [data, setData] = useState<TargetValidasiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [catatanEdit, setCatatanEdit] = useState<Record<number, string>>({});

  // Modal untuk approve/reject
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    id: number;
    action: "approved" | "rejected";
    namaIndikator: string;
  }>({ open: false, id: 0, action: "approved", namaIndikator: "" });

  // ── TODO: Ganti dengan API call ──
  useEffect(() => {
    async function fetchTargets() {
      setLoading(true);
      try {
        const rows = await getTargetsForValidation();
        const withNo = rows.map((row, idx) => ({
          ...row,
          no: idx + 1,
          statusValidasi: row.statusValidasi as "pending" | "approved" | "rejected",
        }));
        setData(withNo);
        const notes: Record<number, string> = {};
        withNo.forEach((row) => {
          notes[row.id] = row.catatanAdmin ?? "";
        });
        setCatatanEdit(notes);
      } catch (err) {
        console.error("Failed to fetch targets:", err);
        setData(MOCK_TARGETS_VALIDASI);
        const notes: Record<number, string> = {};
        MOCK_TARGETS_VALIDASI.forEach((row) => {
          notes[row.id] = row.catatanAdmin ?? "";
        });
        setCatatanEdit(notes);
      } finally {
        setLoading(false);
      }
    }
    fetchTargets();
  }, []);

  // ── Options ──
  const unitOptions = ["semua", ...Array.from(new Set(data.map((r) => r.unitKerja)))];
  const periodeOptions = ["semua", ...Array.from(new Set(data.map((r) => r.periode)))];

  const filtered = data.filter((r) => {
    return (
      (filterUnit === "semua" || r.unitKerja === filterUnit) &&
      (filterPeriode === "semua" || r.periode === filterPeriode) &&
      (filterStatus === "semua" || r.statusValidasi === filterStatus)
    );
  });

  // ── Actions ──
  const openConfirm = (id: number, action: "approved" | "rejected", nama: string) => {
    setConfirmModal({ open: true, id, action, namaIndikator: nama });
  };

  const handleConfirm = async () => {
    const { id, action } = confirmModal;
    try {
      await updateTargetValidationStatus(id, action, catatanEdit[id]);
      setData((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, statusValidasi: action, catatanAdmin: catatanEdit[id] }
            : r
        )
      );
    } catch (err) {
      console.error("Failed to update validation status:", err);
    }
    setConfirmModal({ open: false, id: 0, action: "approved", namaIndikator: "" });
  };

  const handleDownload = (linkFile: string, namaFile: string) => {
    // Attempt to download file
    const link = document.createElement("a");
    link.href = linkFile;
    link.download = namaFile;
    link.click();
  };

  // ── Stats ──
  const total = data.length;
  const approved = data.filter((r) => r.statusValidasi === "approved").length;
  const pending = data.filter((r) => r.statusValidasi === "pending").length;
  const rejected = data.filter((r) => r.statusValidasi === "rejected").length;

  const th: React.CSSProperties = {
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    textAlign: "left",
  };
  const td: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "top",
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Validasi Indikator Kinerja Utama & Perjanjian Kerja
        </p>

        {/* ── Info Banner ── */}
        <div
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>📋</span>
          <p style={{ margin: 0, fontSize: 13, color: "#1e40af" }}>
            <strong>Validasi Target IKU/PK</strong> — Periksa file target dari repository, lalu setujui atau tolak. Target yang disetujui akan menjadi dasar SKP pegawai.
          </p>
        </div>

        {/* ── Statistik ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {[
            { label: "Total Target", value: total, color: "#6366f1", bg: "#eef2ff" },
            { label: "Menunggu", value: pending, color: "#d97706", bg: "#fef3c7" },
            { label: "Disetujui", value: approved, color: "#16a34a", bg: "#dcfce7" },
            { label: "Ditolak", value: rejected, color: "#dc2626", bg: "#fee2e2" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                backgroundColor: "white",
                borderRadius: 10,
                padding: "16px 20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                borderLeft: `4px solid ${s.color}`,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{s.label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>
                Unit Kerja
              </label>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                {unitOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua Unit" : opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>
                Periode
              </label>
              <select
                value={filterPeriode}
                onChange={(e) => setFilterPeriode(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                {periodeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua Periode" : opt}</option>
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
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Tabel Validasi ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", margin: 0 }}>
              Daftar Target untuk Validasi
            </h3>
            <button
              onClick={() => {
                const rows = filtered.map((r, i) => ({
                  No: i + 1,
                  "Unit Kerja": r.unitKerja,
                  "Nama Indikator": r.namaIndikator,
                  "Kode Indikator": r.kodeIndikator,
                  "Target Kuantitas": r.targetKuantitas,
                  Satuan: r.satuan,
                  Periode: r.periode,
                  "Status Validasi": r.statusValidasi === "approved" ? "Disetujui" : r.statusValidasi === "rejected" ? "Ditolak" : "Menunggu",
                  "Catatan Admin": r.catatanAdmin ?? "",
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Validasi Admin");
                XLSX.writeFile(wb, `Validasi_Admin_${new Date().getFullYear()}.xlsx`);
              }}
              style={{ background: "#10b759", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Export Excel
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data…</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Tidak ada data untuk filter ini.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                <thead>
                  <tr>
                    {["No", "Unit Kerja", "Indikator", "Target", "File", "Status", "Aksi"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td style={{ ...td, textAlign: "center", width: 36 }}>{row.no ?? idx + 1}</td>
                        <td style={{ ...td, fontSize: 11, color: "#6b7280", width: 140 }}>{row.unitKerja}</td>
                        <td style={{ ...td }}>
                          <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{row.namaIndikator}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{row.kodeIndikator}</p>
                        </td>
                        <td style={{ ...td, textAlign: "center", width: 90 }}>
                          {row.targetKuantitas !== null ? `${row.targetKuantitas} ${row.satuan}` : "—"}
                        </td>
                        <td style={{ ...td, width: 140 }}>
                          <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                            <button
                              onClick={() => openFile(row.linkFile)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "1px solid #2563eb",
                                backgroundColor: "white",
                                color: "#2563eb",
                                fontWeight: 600,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              👁️ Lihat File
                            </button>
                            <button
                              onClick={() => handleDownload(row.linkFile, row.namaFile)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "1px solid #6b7280",
                                backgroundColor: "white",
                                color: "#374151",
                                fontWeight: 600,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              📥 Unduh
                            </button>
                          </div>
                        </td>
                        <td style={td}>{statusBadge(row.statusValidasi)}</td>
                        <td style={{ ...td, width: 120 }}>
                          {row.statusValidasi === "pending" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => openConfirm(row.id, "approved", row.namaIndikator)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  backgroundColor: "#dcfce7",
                                  color: "#166534",
                                  fontWeight: 600,
                                  fontSize: 11,
                                  cursor: "pointer",
                                }}
                              >
                                ✓ Setujui
                              </button>
                              <button
                                onClick={() => openConfirm(row.id, "rejected", row.namaIndikator)}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  backgroundColor: "#fee2e2",
                                  color: "#991b1b",
                                  fontWeight: 600,
                                  fontSize: 11,
                                  cursor: "pointer",
                                }}
                              >
                                ✕ Tolak
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>Selesai</span>
                          )}
                        </td>
                      </tr>

                      {/* Row Catatan Admin (expandable) */}
                      {expandedId === row.id && (
                        <tr style={{ backgroundColor: "#f9fafb" }}>
                          <td colSpan={7} style={{ padding: 14 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 12, marginBottom: 8, color: "#374151", fontWeight: 600 }}>
                                Catatan Admin
                              </label>
                              <textarea
                                value={catatanEdit[row.id] ?? ""}
                                onChange={(e) =>
                                  setCatatanEdit((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                placeholder="Masukkan catatan validasi (opsional)"
                                style={{
                                  width: "100%",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  padding: "8px 12px",
                                  fontSize: 13,
                                  fontFamily: "inherit",
                                  color: "#374151",
                                  minHeight: 80,
                                  resize: "vertical",
                                }}
                              />
                              <button
                                onClick={() => setExpandedId(null)}
                                style={{
                                  marginTop: 10,
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  backgroundColor: "white",
                                  color: "#374151",
                                  fontWeight: 600,
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                Tutup
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Tombol Lihat Catatan (jika ada) */}
                      {(catatanEdit[row.id] || row.catatanAdmin) && expandedId !== row.id && (
                        <tr style={{ backgroundColor: "#f9fafb" }}>
                          <td colSpan={7} style={{ padding: "8px 14px" }}>
                            <button
                              onClick={() => setExpandedId(row.id)}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                border: "none",
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                                fontWeight: 600,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              💬 Lihat Catatan
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Modal Konfirmasi ── */}
        {confirmModal.open && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 28,
                maxWidth: 450,
                width: "90%",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: 16, color: "#1f2937" }}>
                {confirmModal.action === "approved" ? "✓ Setujui Target" : "✕ Tolak Target"}
              </h4>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
                <strong>{confirmModal.namaIndikator}</strong>
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>
                  Catatan (opsional)
                </label>
                <textarea
                  value={catatanEdit[confirmModal.id] ?? ""}
                  onChange={(e) =>
                    setCatatanEdit((prev) => ({ ...prev, [confirmModal.id]: e.target.value }))
                  }
                  placeholder="Masukkan catatan untuk target ini"
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    padding: "8px 12px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "#374151",
                    minHeight: 70,
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 7,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "white",
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 7,
                    border: "none",
                    backgroundColor: confirmModal.action === "approved" ? "#16a34a" : "#dc2626",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {confirmModal.action === "approved" ? "Setujui" : "Tolak"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageTransition>
    </div>
  );
}
