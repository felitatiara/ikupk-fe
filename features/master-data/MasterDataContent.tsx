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

  /* ─── Jenis Badge ─── */
  const JenisBadge = ({ jenis }: { jenis: string }) => {
    const c = JENIS_COLOR[jenis] ?? { bg: "#f3f4f6", text: "#6b7280" };
    return (
      <span style={{
        background: c.bg, color: c.text, fontSize: 11, fontWeight: 700,
        padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap"
      }}>
        {jenis}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

      {/* ── Delete Confirm Portal ── */}
      {deleteTarget && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}
          onClick={() => !deleteLoading && setDeleteTarget(null)}>
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
        }}
          onClick={() => !saving && setModalOpen(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "32px 28px", width: 480, maxWidth: "94vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
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

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="ikupk-card-title">Master Data Baseline</h3>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            Data dosen, tendik, dan mahasiswa sebagai acuan perhitungan target indikator.
          </p>
        </div>
        <button onClick={openTambah} className="btn btn-success"
          style={{ fontWeight: 700, borderRadius: 8, fontSize: 13, padding: "9px 20px", whiteSpace: "nowrap" }}>
          + Tambah Data
        </button>
      </div>

      {/* ── Summary Cards ── */}
      {!loading && !error && (
        <div className="row g-3 mb-4">
          {[
            { label: "Total Data", value: filtered.length, sub: "entri", color: "#2563eb", bg: "#eff6ff" },
            { label: "Total Orang", value: filtered.reduce((a, d) => a + d.jumlah, 0).toLocaleString("id-ID"), sub: "orang", color: "#16a34a", bg: "#f0fdf4" },
            { label: "Dosen", value: filtered.filter(d => d.jenisData === "Dosen").reduce((a, d) => a + d.jumlah, 0).toLocaleString("id-ID"), sub: "orang", color: "#2563eb", bg: "#eff6ff" },
            { label: "Mahasiswa", value: filtered.filter(d => d.jenisData === "Mahasiswa").reduce((a, d) => a + d.jumlah, 0).toLocaleString("id-ID"), sub: "orang", color: "#ca8a04", bg: "#fefce8" },
          ].map((s, i) => (
            <div className="col-6 col-md-3" key={i}>
              <div style={{
                background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, padding: "16px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)", height: "100%"
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 6
                }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter Row ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Tahun</div>
          <select className="form-select form-select-sm" style={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 13, minWidth: 120 }}
            value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
            <option value="all">Semua</option>
            {TAHUN_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Jenis</div>
          <select className="form-select form-select-sm" style={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 13, minWidth: 140 }}
            value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
            <option value="all">Semua Jenis</option>
            {JENIS_DATA_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                  {["No", "Jenis Data", "Jumlah", "Tahun", "Keterangan", "Aksi"].map((h, i) => (
                    <th key={i} style={{
                      padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af",
                      textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i === 0 || i >= 2 ? "center" : "left",
                      background: "#fafafa", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap"
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "56px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📊</div>
                    <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>Belum Ada Data</div>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>Klik "Tambah Data" untuk mulai mengisi.</div>
                  </td></tr>
                ) : filtered.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f8f8f8", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "13px 16px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ padding: "13px 16px" }}><JenisBadge jenis={row.jenisData} /></td>
                    <td style={{ padding: "13px 16px", textAlign: "center", fontWeight: 700, fontSize: 15, color: "#2563eb" }}>
                      {row.jumlah.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <span style={{
                        background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700,
                        padding: "3px 10px", borderRadius: 20
                      }}>{row.tahun}</span>
                    </td>
                    <td style={{ padding: "13px 16px", color: "#6b7280", fontSize: 12 }}>{row.keterangan ?? "—"}</td>
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button onClick={() => openEdit(row)}
                          style={{
                            padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            border: "1px solid #e5e7eb", background: "#fff", color: "#374151"
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "#d1d5db")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                          Edit
                        </button>
                        <button onClick={() => setDeleteTarget(row)}
                          style={{
                            padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            border: "1px solid #fca5a5", background: "#fff7f7", color: "#dc2626"
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#fff7f7")}>
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid #f0f0f0", background: "#fafafa" }}>
                    <td colSpan={6} style={{ padding: "10px 16px", fontSize: 12, color: "#9ca3af" }}>
                      Menampilkan <b>{filtered.length}</b> dari <b>{dataList.length}</b> data
                    </td>
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
