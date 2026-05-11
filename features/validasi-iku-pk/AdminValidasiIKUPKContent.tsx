"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import { getTargetsForValidation, updateTargetValidationStatus, TargetWithRepositoryFile } from "@/lib/api";
import { toast } from "sonner";

export type TargetValidasiRow = TargetWithRepositoryFile;

function statusBadge(status: TargetValidasiRow["statusValidasi"]) {
  const labels: Record<string, string> = {
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
  };
  return <span className={`badge-${status}`}>{labels[status]}</span>;
}

function openFile(url: string) {
  window.open(url, "_blank");
}

export default function AdminValidasiIKUPKContent() {
  const [data, setData] = useState<TargetValidasiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [catatanEdit, setCatatanEdit] = useState<Record<number, string>>({});

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    id: number;
    action: "approved" | "rejected";
    namaIndikator: string;
  }>({ open: false, id: 0, action: "approved", namaIndikator: "" });

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
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTargets();
  }, []);

  const unitOptions = ["semua", ...Array.from(new Set(data.map((r) => r.unitKerja)))];
  const periodeOptions = ["semua", ...Array.from(new Set(data.map((r) => r.periode)))];

  const filtered = data.filter((r) => {
    return (
      (filterUnit === "semua" || r.unitKerja === filterUnit) &&
      (filterPeriode === "semua" || r.periode === filterPeriode) &&
      (filterStatus === "semua" || r.statusValidasi === filterStatus)
    );
  });

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
      toast.success(action === "approved" ? "Target berhasil disetujui." : "Target berhasil ditolak.");
    } catch (err) {
      console.error("Failed to update validation status:", err);
      toast.error("Gagal memperbarui status validasi.");
    }
    setConfirmModal({ open: false, id: 0, action: "approved", namaIndikator: "" });
  };

  const handleDownload = (linkFile: string, namaFile: string) => {
    const link = document.createElement("a");
    link.href = linkFile;
    link.download = namaFile;
    link.click();
  };

  const total = data.length;
  const approved = data.filter((r) => r.statusValidasi === "approved").length;
  const pending = data.filter((r) => r.statusValidasi === "pending").length;
  const rejected = data.filter((r) => r.statusValidasi === "rejected").length;

  const statItems = [
    { label: "Total Target", value: total, color: "#6366f1", bg: "#eef2ff" },
    { label: "Menunggu", value: pending, color: "#d97706", bg: "#fef3c7" },
    { label: "Disetujui", value: approved, color: "#16a34a", bg: "#dcfce7" },
    { label: "Ditolak", value: rejected, color: "#dc2626", bg: "#fee2e2" },
  ];

  return (
    <div>
      <PageTransition>
        <p className="ikupk-header-text">
          Validasi Indikator Kinerja Utama &amp; Perjanjian Kinerja
        </p>

        {/* Info Banner */}
        <div className="info-banner-blue">
          <span className="icon-lg">📋</span>
          <p>
            <strong>Validasi Target IKU/PK</strong> — Periksa file target dari repository, lalu setujui atau tolak. Target yang disetujui akan menjadi dasar SKP pegawai.
          </p>
        </div>

        {/* Statistik */}
        <div className="stats-grid">
          {statItems.map((s) => (
            <div
              key={s.label}
              className="stat-card"
              style={{ borderLeft: `4px solid ${s.color}` }}
            >
              <p className="stat-card-label">{s.label}</p>
              <p className="stat-card-value" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="filter-card">
          <div className="filter-grid-3">
            <div>
              <label className="filter-label">Unit Kerja</label>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="filter-isi"
              >
                {unitOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua Unit" : opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="filter-label">Periode</label>
              <select
                value={filterPeriode}
                onChange={(e) => setFilterPeriode(e.target.value)}
                className="filter-isi"
              >
                {periodeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua Periode" : opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-isi"
              >
                <option value="semua">Semua Status</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabel Validasi */}
        <div className="table-section-card">
          <div className="table-section-header">
            <h3 className="table-section-title">Daftar Target untuk Validasi</h3>
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
              className="btn-green-sm"
            >
              Export Excel
            </button>
          </div>

          {loading ? (
            <p className="text-loading text-center" style={{ padding: 40 }}>Memuat data…</p>
          ) : filtered.length === 0 ? (
            <p className="text-empty">Tidak ada data untuk filter ini.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table-admin">
                <thead>
                  <tr>
                    {["No", "Unit Kerja", "Indikator", "Target", "File", "Status", "Aksi"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td className="text-center col-36">{row.no ?? idx + 1}</td>
                        <td className="td-unit col-140">{row.unitKerja}</td>
                        <td>
                          <p className="td-indikator-nama">{row.namaIndikator}</p>
                          <p className="td-indikator-kode">{row.kodeIndikator}</p>
                        </td>
                        <td className="text-center col-90">
                          {row.targetKuantitas !== null ? `${row.targetKuantitas} ${row.satuan}` : "—"}
                        </td>
                        <td className="col-140">
                          <div className="file-btn-group">
                            <button onClick={() => openFile(row.linkFile)} className="btn-action-blue">
                              👁️ Lihat File
                            </button>
                            <button onClick={() => handleDownload(row.linkFile, row.namaFile)} className="btn-action-gray">
                              📥 Unduh
                            </button>
                          </div>
                        </td>
                        <td>{statusBadge(row.statusValidasi)}</td>
                        <td className="col-120">
                          {row.statusValidasi === "pending" ? (
                            <div className="btn-row-center">
                              <button
                                onClick={() => openConfirm(row.id, "approved", row.namaIndikator)}
                                className="btn-action-green"
                              >
                                ✓ Setujui
                              </button>
                              <button
                                onClick={() => openConfirm(row.id, "rejected", row.namaIndikator)}
                                className="btn-action-red"
                              >
                                ✕ Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="status-done">Selesai</span>
                          )}
                        </td>
                      </tr>

                      {/* Row Catatan Admin (expandable) */}
                      {expandedId === row.id && (
                        <tr className="td-catatan-expanded">
                          <td colSpan={7} className="td-catatan-cell">
                            <label className="catatan-label">Catatan Admin</label>
                            <textarea
                              value={catatanEdit[row.id] ?? ""}
                              onChange={(e) =>
                                setCatatanEdit((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                              placeholder="Masukkan catatan validasi (opsional)"
                              className="catatan-textarea"
                            />
                            <button onClick={() => setExpandedId(null)} className="catatan-close-btn">
                              Tutup
                            </button>
                          </td>
                        </tr>
                      )}

                      {/* Tombol Lihat Catatan */}
                      {(catatanEdit[row.id] || row.catatanAdmin) && expandedId !== row.id && (
                        <tr className="td-catatan-expanded">
                          <td colSpan={7} className="td-catatan-preview">
                            <button onClick={() => setExpandedId(row.id)} className="btn-lihat-catatan">
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

        {/* Modal Konfirmasi */}
        {confirmModal.open && (
          <div
            className="confirm-overlay"
            onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
          >
            <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
              <h4 className="confirm-title">
                {confirmModal.action === "approved" ? "✓ Setujui Target" : "✕ Tolak Target"}
              </h4>
              <p className="confirm-name">
                <strong>{confirmModal.namaIndikator}</strong>
              </p>

              <div className="confirm-catatan">
                <label className="catatan-label">Catatan (opsional)</label>
                <textarea
                  value={catatanEdit[confirmModal.id] ?? ""}
                  onChange={(e) =>
                    setCatatanEdit((prev) => ({ ...prev, [confirmModal.id]: e.target.value }))
                  }
                  placeholder="Masukkan catatan untuk target ini"
                  className="catatan-textarea"
                  style={{ minHeight: 70 }}
                />
              </div>

              <div className="confirm-footer">
                <button
                  onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
                  className="btn-batal"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirm}
                  className={confirmModal.action === "approved" ? "btn-confirm-green" : "btn-confirm-red"}
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
