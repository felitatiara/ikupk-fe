"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getAllBaselineData,
  upsertBaselineData,
  updateBaselineData,
  deleteBaselineData,
  BaselineData,
} from "../../lib/api";
import { toast } from "sonner";

const JENIS_DATA_OPTIONS = ["Dosen", "Tendik", "Mahasiswa", "Alumni", "Mitra"];

const TAHUN_OPTIONS = Array.from({ length: 6 }, (_, i) =>
  String(new Date().getFullYear() - 2 + i)
);

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  color: "#374151",
  width: "100%",
  boxSizing: "border-box",
};

interface ModalData {
  id?: number;
  jenisData: string;
  jumlah: string;
  tahun: string;
  keterangan: string;
}

export default function MasterDataContent() {
  const [dataList, setDataList] = useState<BaselineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));
  const [filterJenis, setFilterJenis] = useState<string>("all");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"tambah" | "edit">("tambah");
  const [modalData, setModalData] = useState<ModalData>({
    jenisData: "Dosen",
    jumlah: "",
    tahun: String(new Date().getFullYear()),
    keterangan: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<BaselineData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllBaselineData();
      setDataList(data);
    } catch {
      setError("Gagal memuat data. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = dataList.filter((d) => {
    if (filterTahun !== "all" && d.tahun !== filterTahun) return false;
    if (filterJenis !== "all" && d.jenisData !== filterJenis) return false;
    return true;
  });

  const openTambah = () => {
    setModalData({
      jenisData: "Dosen",
      jumlah: "",
      tahun: String(new Date().getFullYear()),
      keterangan: "",
    });
    setModalMode("tambah");
    setModalOpen(true);
  };

  const openEdit = (row: BaselineData) => {
    setModalData({
      id: row.id,
      jenisData: row.jenisData,
      jumlah: String(row.jumlah),
      tahun: row.tahun,
      keterangan: row.keterangan ?? "",
    });
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!modalData.jumlah || isNaN(Number(modalData.jumlah)) || Number(modalData.jumlah) < 0) {
      toast.error("Jumlah harus berupa angka positif.");
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "tambah") {
        await upsertBaselineData({
          jenisData: modalData.jenisData,
          jumlah: Number(modalData.jumlah),
          tahun: modalData.tahun,
          keterangan: modalData.keterangan || null,
        });
      } else {
        await updateBaselineData(modalData.id!, {
          jenisData: modalData.jenisData,
          jumlah: Number(modalData.jumlah),
          tahun: modalData.tahun,
          keterangan: modalData.keterangan || null,
        });
      }
      toast.success(modalMode === "tambah" ? "Data berhasil ditambahkan." : "Data berhasil diperbarui.");
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteBaselineData(deleteTarget.id);
      toast.success("Data berhasil dihapus.");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error("Gagal menghapus: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      {/* Delete Confirm Modal */}
      {deleteTarget && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => !deleteLoading && setDeleteTarget(null)}
        >
          <div
            style={{
              backgroundColor: "white", borderRadius: 12, padding: 28,
              width: 400, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937", textAlign: "center" }}>
              Hapus Data
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 8, lineHeight: 1.6 }}>
              Anda akan menghapus data:
            </p>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1f2937" }}>
                {deleteTarget.jenisData}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                {deleteTarget.jumlah.toLocaleString("id-ID")} orang | Tahun {deleteTarget.tahun}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="btn-outline"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: "6px 24px", borderRadius: 6, border: "none",
                  backgroundColor: deleteLoading ? "#9ca3af" : "#dc2626",
                  color: "white", fontSize: 13, fontWeight: 600,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
              >
                {deleteLoading ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add/Edit Modal */}
      {modalOpen && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "white", borderRadius: 12, padding: 28,
              width: 500, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)", boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", textAlign: "center", marginBottom: 4 }}>
              {modalMode === "tambah" ? "Tambah Data Baseline" : "Edit Data Baseline"}
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
              Data demografi yang digunakan sebagai acuan perhitungan target indikator.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Tahun</label>
                <select
                  value={modalData.tahun}
                  onChange={(e) => setModalData((p) => ({ ...p, tahun: e.target.value }))}
                  style={inputStyle}
                >
                  {TAHUN_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Jenis Data</label>
                <select
                  value={modalData.jenisData}
                  onChange={(e) => setModalData((p) => ({ ...p, jenisData: e.target.value }))}
                  style={inputStyle}
                >
                  {JENIS_DATA_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Jumlah (Orang)</label>
              <input
                type="number"
                min={0}
                value={modalData.jumlah}
                onChange={(e) => setModalData((p) => ({ ...p, jumlah: e.target.value }))}
                placeholder="contoh: 150"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Keterangan (opsional)</label>
              <input
                type="text"
                value={modalData.keterangan}
                onChange={(e) => setModalData((p) => ({ ...p, keterangan: e.target.value }))}
                placeholder="contoh: Data per semester ganjil"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="btn-outline"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-main"
                style={{ backgroundColor: saving ? "#9ca3af" : undefined }}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main Content */}
      <div>
        <nav className="breadcrumb page" aria-label="Breadcrumb">
          <a href="/admin/master-data">Master Data</a>
        </nav>
        <div className="page-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <h3>Data Baseline</h3>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                Data dosen, tendik, dan mahasiswa sebagai acuan perhitungan target indikator.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="filter" style={{ marginBottom: 16 }}>
            <div className="filter-content">
              <label className="filter-content-label">Tahun</label>
              <select
                value={filterTahun}
                onChange={(e) => setFilterTahun(e.target.value)}
                className="filter-isi"
              >
                <option value="all">Semua Tahun</option>
                {TAHUN_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="filter-content">
              <label className="filter-content-label">Jenis Data</label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="filter-isi"
              >
                <option value="all">Semua Jenis</option>
                {JENIS_DATA_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <button className="btn-main" style={{ alignItems: "flex-end", marginLeft: "auto", marginTop: "auto" }} onClick={openTambah}>
              + Tambah Data
            </button>
          </div>

          {loading && <p style={{ color: "#6b7280", fontSize: 14 }}>Memuat data...</p>}
          {error && <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>}

          {!loading && !error && (
            <div className="table-wrapper">
              <table className="table-universal">
                <thead>
                  <tr>
                    <th style={{ width: "5%", minWidth: 50, textAlign: "center" }}>No</th>
                    <th style={{ width: "25%", minWidth: 100, textAlign: "center" }}>Jenis Data</th>
                    <th style={{ width: "20%", minWidth: 80, textAlign: "center" }}>Jumlah (Orang)</th>
                    <th style={{ width: "15%", minWidth: 80, textAlign: "center" }}>Tahun</th>
                    <th style={{ minWidth: 120 }}>Keterangan</th>
                    <th style={{ width: "15%", minWidth: 100, textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#9ca3af" }}>
                        Belum ada data baseline. Klik &quot;+ Tambah Data&quot; untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => (
                      <tr key={row.id}>
                        <td style={{ textAlign: "center" }}>{idx + 1}</td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            background: row.jenisData === "Dosen" ? "#dbeafe" : row.jenisData === "Tendik" ? "#d1fae5" : row.jenisData === "Mahasiswa" ? "#fef9c3" : "#f3e8ff",
                            color: row.jenisData === "Dosen" ? "#1d4ed8" : row.jenisData === "Tendik" ? "#15803d" : row.jenisData === "Mahasiswa" ? "#92400e" : "#7c3aed",
                          }}>
                            {row.jenisData}
                          </span>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 700, color: "#1d4ed8", fontSize: 14 }}>
                          {row.jumlah.toLocaleString("id-ID")}
                        </td>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>{row.tahun}</td>
                        <td style={{ color: "#6b7280", fontSize: 12 }}>{row.keterangan ?? "-"}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 10, justifyContent: "center", padding: "10px" }}>
                            <button
                              onClick={() => openEdit(row)}
                              className="btn-small"
                              style={{ border: "1px solid #86efac", backgroundColor: "#dcfce7", color: "#16a34a" }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-small"
                              onClick={() => setDeleteTarget(row)}
                              style={{ border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#dc2626" }}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} style={{ fontSize: 12, color: "#9ca3af" }}>
                      Menampilkan {filtered.length} dari {dataList.length} data baseline.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
