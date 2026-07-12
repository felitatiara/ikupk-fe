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

const JENIS_COLOR: Record<string, { bg: string; text: string }> = {
  Dosen: { bg: "#eff6ff", text: "#2563eb" },
  Tendik: { bg: "#f0fdf4", text: "#16a34a" },
  Mahasiswa: { bg: "#fefce8", text: "#ca8a04" },
  Alumni: { bg: "#faf5ff", text: "#7c3aed" },
  Mitra: { bg: "#f0fdfa", text: "#0d9488" },
};

interface ModalData {
  id?: number;
  jenisData: string;
  jumlah: string;
  tahun: string;
  keterangan: string;
}

const CSS = `
  .md-hero { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px 32px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .md-hero-eyebrow { font-size: 11px; font-weight: 700; color: #0d9488; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .md-hero-title { font-size: 22px; font-weight: 800; color: #0f2f4f; margin: 0 0 6px; }
  .md-hero-sub { font-size: 13px; color: #6b7280; margin: 0; }
  .md-stats-card { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; display: flex; flex-direction: row; align-items: center; gap: 0; }
  .md-stat-row { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 18px; }
  .md-stat-row + .md-stat-row { border-left: 1px solid #e5e7eb; }
  .md-stat-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .md-stat-val { font-size: 18px; font-weight: 800; color: #0d9488; }
  .md-toolbar { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 14px 20px; margin-bottom: 16px; display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .md-toolbar-group { display: flex; flex-direction: column; gap: 4px; }
  .md-select-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
  .md-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; font-size: 13px; color: #374151; background: #fff; cursor: pointer; outline: none; min-width: 130px; }
  .md-select:focus { border-color: #0d9488; box-shadow: 0 0 0 2px rgba(13,148,136,0.12); }
  .md-toolbar-spacer { flex: 1; }
  .md-btn { padding: 9px 18px; border-radius: 12px; font-weight: 700; font-size: 13px; transition: all 0.15s; white-space: nowrap; cursor: pointer; }
  .md-btn:not(:disabled):hover { transform: translateY(-1px); opacity: 0.92; }
  .md-btn:not(:disabled):active { transform: translateY(0); opacity: 1; }
  .md-btn--primary { border: none; background: #16a34a; color: #fff; box-shadow: 0 3px 10px rgba(22,163,74,0.28); }
  .md-table-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .md-table-hdr { background: #0f2f4f; padding: 13px 20px; display: flex; align-items: center; justify-content: space-between; }
  .md-table-hdr-title { color: #fff; font-weight: 700; font-size: 14px; }
  .md-table-hdr-count { font-size: 12px; color: #94a3b8; }
  .md-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .md-table thead th { padding: 10px 16px; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.06em; background: #0f2f4f; white-space: nowrap; border-bottom: 1px solid #1e4a6e; }
  .md-table tbody tr { border-bottom: 1px solid #f8f8f8; transition: background 0.1s; }
  .md-table tbody tr:hover { background: #fafafa; }
  .md-table tbody td { padding: 13px 16px; vertical-align: middle; }
  .md-table tfoot td { padding: 10px 16px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f0f0f0; background: #fafafa; }
  .md-btn-edit { padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; transition: border-color 0.1s; }
  .md-btn-edit:hover { border-color: #d1d5db; }
  .md-btn-del { padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #dc2626; color: #fff; }
  .md-btn-del:hover { opacity: 0.85; }
  @keyframes md-shimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }
  .md-skeleton { border-radius: 6px; background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 37%, #f0f0f0 63%); background-size: 800px 100%; animation: md-shimmer 1.4s infinite; }
`;

export default function MasterDataContent() {
  const [dataList, setDataList] = useState<BaselineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));
  const [filterJenis, setFilterJenis] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"tambah" | "edit">("tambah");
  const [modalData, setModalData] = useState<ModalData>({
    jenisData: "Dosen", jumlah: "", tahun: String(new Date().getFullYear()), keterangan: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaselineData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { setDataList(await getAllBaselineData()); }
    catch { setError("Gagal memuat data. Pastikan server berjalan."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = dataList.filter((d) => {
    if (filterTahun !== "all" && d.tahun !== filterTahun) return false;
    if (filterJenis !== "all" && d.jenisData !== filterJenis) return false;
    return true;
  });

  const openTambah = () => {
    setModalData({ jenisData: "Dosen", jumlah: "", tahun: String(new Date().getFullYear()), keterangan: "" });
    setModalMode("tambah"); setModalOpen(true);
  };
  const openEdit = (row: BaselineData) => {
    setModalData({ id: row.id, jenisData: row.jenisData, jumlah: String(row.jumlah), tahun: row.tahun, keterangan: row.keterangan ?? "" });
    setModalMode("edit"); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!modalData.jumlah || isNaN(Number(modalData.jumlah)) || Number(modalData.jumlah) < 0) {
      toast.error("Jumlah harus berupa angka positif."); return;
    }
    setSaving(true);
    try {
      if (modalMode === "tambah") {
        await upsertBaselineData({ jenisData: modalData.jenisData, jumlah: Number(modalData.jumlah), tahun: modalData.tahun, keterangan: modalData.keterangan || null });
      } else {
        await updateBaselineData(modalData.id!, { jenisData: modalData.jenisData, jumlah: Number(modalData.jumlah), tahun: modalData.tahun, keterangan: modalData.keterangan || null });
      }
      toast.success(modalMode === "tambah" ? "Data berhasil ditambahkan." : "Data berhasil diperbarui.");
      setModalOpen(false); fetchData();
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteBaselineData(deleteTarget.id);
      toast.success("Data berhasil dihapus."); setDeleteTarget(null); fetchData();
    } catch (err) {
      toast.error("Gagal menghapus: " + (err instanceof Error ? err.message : String(err)));
    } finally { setDeleteLoading(false); }
  };

  const JenisBadge = ({ jenis }: { jenis: string }) => {
    const c = JENIS_COLOR[jenis] ?? { bg: "#f3f4f6", text: "#6b7280" };
    return (
      <span style={{
        background: c.bg, color: c.text, fontSize: 11, fontWeight: 700,
        padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap"
      }}>{jenis}</span>
    );
  };

  const totalOrang = dataList.reduce((a, d) => a + d.jumlah, 0);
  const totalDosen = dataList.filter(d => d.jenisData === "Dosen").reduce((a, d) => a + d.jumlah, 0);
  const totalMhs = dataList.filter(d => d.jenisData === "Mahasiswa").reduce((a, d) => a + d.jumlah, 0);

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Delete Confirm Portal ── */}
      {deleteTarget && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }} onClick={() => !deleteLoading && setDeleteTarget(null)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "32px 28px", width: 400, maxWidth: "92vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: "#fef2f2",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px"
            }}>🗑️</div>
            <h5 style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 6px", color: "#111" }}>Hapus Data?</h5>
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{
              background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10,
              padding: "14px 16px", textAlign: "center", marginBottom: 24
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4 }}>
                <JenisBadge jenis={deleteTarget.jenisData} />
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {deleteTarget.jumlah.toLocaleString("id-ID")} orang · Tahun {deleteTarget.tahun}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                className="btn btn-light" style={{ fontWeight: 600, borderRadius: 8, padding: "8px 22px" }}>
                Batal
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="btn btn-danger" style={{ fontWeight: 600, borderRadius: 8, padding: "8px 22px" }}>
                {deleteLoading ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add / Edit Modal ── */}
      {modalOpen && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }} onClick={() => !saving && setModalOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "32px 28px", width: 480, maxWidth: "94vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 24 }}>
              <h5 style={{ fontWeight: 800, fontSize: 17, margin: "0 0 4px", color: "#111" }}>
                {modalMode === "tambah" ? "Tambah Data Baseline" : "Edit Data Baseline"}
              </h5>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                Data demografi acuan perhitungan target indikator.
              </p>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                  Tahun <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select className="form-select" style={{ borderRadius: 8, fontSize: 13, borderColor: "#e5e7eb" }}
                  value={modalData.tahun} onChange={e => setModalData(p => ({ ...p, tahun: e.target.value }))}>
                  {TAHUN_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                  Jenis Data <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select className="form-select" style={{ borderRadius: 8, fontSize: 13, borderColor: "#e5e7eb" }}
                  value={modalData.jenisData} onChange={e => setModalData(p => ({ ...p, jenisData: e.target.value }))}>
                  {JENIS_DATA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                  Jumlah (Orang) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input type="number" min={0} className="form-control" style={{ borderRadius: 8, fontSize: 13, borderColor: "#e5e7eb" }}
                  value={modalData.jumlah} onChange={e => setModalData(p => ({ ...p, jumlah: e.target.value }))}
                  placeholder="contoh: 150" />
              </div>
              <div className="col-12">
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
                  Keterangan <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>(opsional)</span>
                </label>
                <input type="text" className="form-control" style={{ borderRadius: 8, fontSize: 13, borderColor: "#e5e7eb" }}
                  value={modalData.keterangan} onChange={e => setModalData(p => ({ ...p, keterangan: e.target.value }))}
                  placeholder="contoh: Data per semester ganjil" />
              </div>
            </div>
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModalOpen(false)} disabled={saving}
                className="btn btn-light" style={{ fontWeight: 600, borderRadius: 8, padding: "8px 22px", fontSize: 13 }}>
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="btn btn-success" style={{ fontWeight: 600, borderRadius: 8, padding: "8px 22px", fontSize: 13 }}>
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Hero Card ── */}
      <div className="md-hero">
        <div>
          <h2 className="ikupk-card-title">Master Data</h2>
          <p className="md-hero-sub">Data dosen, tendik, dan mahasiswa sebagai acuan perhitungan target indikator.</p>
        </div>
        <div className="md-stats-card">
          <div className="md-stat-row">
            <span className="md-stat-label">Total Entri</span>
            <span className="md-stat-val">{loading ? "—" : dataList.length}</span>
          </div>
          <div className="md-stat-row">
            <span className="md-stat-label">Total Orang</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
              {loading ? "—" : totalOrang.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="md-stat-row">
            <span className="md-stat-label">Dosen</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>
              {loading ? "—" : totalDosen.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="md-stat-row">
            <span className="md-stat-label">Mahasiswa</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ca8a04" }}>
              {loading ? "—" : totalMhs.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="md-toolbar">
        <div className="md-toolbar-group">
          <span className="md-select-label">Tahun</span>
          <select className="md-select" value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
            <option value="all">Semua</option>
            {TAHUN_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="md-toolbar-group">
          <span className="md-select-label">Jenis</span>
          <select className="md-select" value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
            <option value="all">Semua Jenis</option>
            {JENIS_DATA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="md-toolbar-spacer" />
        <button className="md-btn md-btn--primary" onClick={openTambah}>+ Tambah Data</button>
      </div>

      {/* ── Table Card ── */}
      <div className="md-table-card">
        <div className="md-table-hdr">
          <span className="md-table-hdr-title">Data Baseline</span>
          {!loading && <span className="md-table-hdr-count">{filtered.length} entri ditampilkan</span>}
        </div>

        {loading && (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "#9ca3af" }}>
            <div className="spinner-border spinner-border-sm text-secondary me-2" />
            <span style={{ fontSize: 14 }}>Memuat data...</span>
          </div>
        )}

        {error && (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>Gagal Memuat</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>{error}</div>
          </div>
        )}

        {!loading && !error && (
          <div style={{ overflowX: "auto" }}>
            <table className="md-table">
              <thead>
                <tr>
                  {["No", "Jenis Data", "Jumlah", "Tahun", "Keterangan", "Aksi"].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 0 || i >= 2 ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "56px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📊</div>
                    <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>Belum Ada Data</div>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>Klik &quot;Tambah Data&quot; untuk mulai mengisi.</div>
                  </td></tr>
                ) : filtered.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td><JenisBadge jenis={row.jenisData} /></td>
                    <td style={{ textAlign: "center", fontWeight: 700, fontSize: 15, color: "#0d9488" }}>
                      {row.jumlah.toLocaleString("id-ID")}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                        {row.tahun}
                      </span>
                    </td>
                    <td style={{ color: "#6b7280", fontSize: 12 }}>{row.keterangan ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button onClick={() => openEdit(row)} className="md-btn-edit">Edit</button>
                        <button onClick={() => setDeleteTarget(row)} className="md-btn-del">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={6}>Menampilkan <b>{filtered.length}</b> dari <b>{dataList.length}</b> data</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
