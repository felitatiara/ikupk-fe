"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import PageTransition from "@/components/layout/PageTransition";
import {
  getMasterSKP, type MasterSKPRow,
  getSkpPenilaiConfigs, getSkpPenilaiRoles, getSkpPenilaiUsers,
  upsertSkpPenilai, deleteSkpPenilai,
  type SkpPenilaiConfigRow, type SkpPenilaiRole, type SkpPenilaiUser,
} from "@/lib/api";

const CSS = `
  .mskp-hero { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px 32px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .mskp-hero-eyebrow { font-size: 11px; font-weight: 700; color: #ea580c; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .mskp-hero-title { font-size: 22px; font-weight: 800; color: #0f2f4f; margin: 0 0 6px; }
  .mskp-hero-sub { font-size: 13px; color: #6b7280; margin: 0; }
  .mskp-stats-card { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; display: flex; flex-direction: row; align-items: center; gap: 0; }
  .mskp-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 18px; }
  .mskp-stat + .mskp-stat { border-left: 1px solid #e5e7eb; }
  .mskp-stat-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .mskp-stat-val { font-size: 18px; font-weight: 800; color: #ea580c; }
  .mskp-stat-val--sm { font-size: 17px; font-weight: 700; }
  .mskp-toolbar { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 6px 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .mskp-tab { padding: 8px 20px; border-radius: 10px; border: none; background: transparent; color: #6b7280; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .mskp-tab:hover { background: #f9fafb; color: #374151; }
  .mskp-tab--active { background: #fff7ed; color: #ea580c; font-weight: 700; box-shadow: 0 1px 4px rgba(234,88,12,0.12); }
  .mskp-toolbar-sep { width: 1px; height: 24px; background: #f0f0f0; margin: 0 4px; }
  .mskp-toolbar-spacer { flex: 1; }
  .mskp-btn { padding: 9px 18px; border-radius: 12px; font-weight: 700; font-size: 13px; transition: all 0.15s; white-space: nowrap; cursor: pointer; }
  .mskp-btn:not(:disabled):hover { transform: translateY(-1px); opacity: 0.92; }
  .mskp-btn:not(:disabled):active { transform: translateY(0); opacity: 1; }
  .mskp-btn--primary { border: none; background: #16a34a; color: #fff; box-shadow: 0 3px 10px rgba(22,163,74,0.28); }
  .mskp-filter-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 16px 20px; margin-bottom: 16px; display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .mskp-filter-group { display: flex; flex-direction: column; gap: 4px; }
  .mskp-filter-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
  .mskp-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; font-size: 13px; color: #374151; background: #fff; cursor: pointer; outline: none; }
  .mskp-select:focus { border-color: #ea580c; box-shadow: 0 0 0 2px rgba(234,88,12,0.12); }
  .mskp-panel { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .mskp-panel-hdr { background: #0f2f4f; padding: 13px 20px; display: flex; align-items: center; justify-content: space-between; }
  .mskp-panel-hdr-title { color: #fff; font-weight: 700; font-size: 14px; }
  .mskp-panel-hdr-count { font-size: 12px; color: #94a3b8; }
  .mskp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .mskp-table thead th { padding: 10px 14px; font-size: 11px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.06em; background: #0f2f4f; border-bottom: 1px solid #1e4a6e; white-space: nowrap; }
  .mskp-table tbody tr { border-bottom: 1px solid #f3f4f6; transition: background 0.1s; }
  .mskp-table tbody tr:hover { background: #fafafa; }
  .mskp-table tbody td { padding: 10px 14px; font-size: 13px; color: #374151; vertical-align: middle; }
  .mskp-btn-edit { padding: 5px 12px; border-radius: 6px; border: 1px solid #d1d5db; background: white; color: #374151; font-weight: 600; font-size: 11px; cursor: pointer; transition: border-color 0.1s; }
  .mskp-btn-edit:hover { border-color: #9ca3af; }
  .mskp-btn-del { padding: 5px 12px; border-radius: 6px; border: none; background: #dc2626; color: #fff; font-weight: 600; font-size: 11px; cursor: pointer; }
  .mskp-btn-del:hover { opacity: 0.85; }
`;

function skpStatusBadge(status: MasterSKPRow["statusSKP"]) {
  const map = {
    draft: { label: "Draft", bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
    submitted: { label: "Diajukan", bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
    approved: { label: "Disetujui", bg: "#dcfce7", color: "#166534", border: "#86efac" },
    rejected: { label: "Ditolak", bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  };
  const s = map[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
      backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

function progressBar(current: number, total: number) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>{current}/{total} indikator</span>
        <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, backgroundColor: "#e5e7eb", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.4s ease",
          backgroundColor: pct === 100 ? "#16a34a" : pct >= 50 ? "#2563eb" : "#d97706",
        }} />
      </div>
    </div>
  );
}

export default function MasterSKPContent() {
  const [activeTab, setActiveTab] = useState<"status" | "penilai">("status");

  const [data, setData] = useState<MasterSKPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  const [penilaiConfigs, setPenilaiConfigs] = useState<SkpPenilaiConfigRow[]>([]);
  const [penilaiLoading, setPenilaiLoading] = useState(false);
  const [penilaiModal, setPenilaiModal] = useState<{
    open: boolean;
    editId: number | null;
    roleId: number | string;
    checkerUserId: number | string;
    pihakKeduaUserId: number | string;
    penilaiEKPUserId: number | string;
    roles: SkpPenilaiRole[];
    users: SkpPenilaiUser[];
    loadingOptions: boolean;
  }>({ open: false, editId: null, roleId: "", checkerUserId: "", pihakKeduaUserId: "", penilaiEKPUserId: "", roles: [], users: [], loadingOptions: false });
  const [penilaiSaving, setPenilaiSaving] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try { setData(await getMasterSKP()); }
      catch (err) { console.error("Failed to fetch master SKP:", err); setData([]); }
      finally { setLoading(false); }
    }
    fetchAll();
  }, []);

  useEffect(() => {
    if (activeTab !== "penilai") return;
    setPenilaiLoading(true);
    getSkpPenilaiConfigs()
      .then((configs) => setPenilaiConfigs(configs))
      .finally(() => setPenilaiLoading(false));
  }, [activeTab]);

  const openPenilaiModal = (config?: SkpPenilaiConfigRow) => {
    setPenilaiModal({
      open: true, editId: config?.id ?? null,
      roleId: config?.roleId ?? "", checkerUserId: config?.checkerUserId ?? "",
      pihakKeduaUserId: config?.pihakKeduaUserId ?? "", penilaiEKPUserId: config?.penilaiUserId ?? "",
      roles: [], users: [], loadingOptions: true,
    });
    Promise.all([getSkpPenilaiRoles(), getSkpPenilaiUsers()]).then(([roles, users]) => {
      setPenilaiModal((prev) => ({ ...prev, roles, users, loadingOptions: false }));
    });
  };

  const savePenilai = async () => {
    if (!penilaiModal.roleId) return;
    setPenilaiSaving(true);
    try {
      await upsertSkpPenilai(Number(penilaiModal.roleId), {
        checkerUserId: penilaiModal.checkerUserId ? Number(penilaiModal.checkerUserId) : null,
        pihakKeduaUserId: penilaiModal.pihakKeduaUserId ? Number(penilaiModal.pihakKeduaUserId) : null,
        penilaiUserId: penilaiModal.penilaiEKPUserId ? Number(penilaiModal.penilaiEKPUserId) : null,
      });
      const configs = await getSkpPenilaiConfigs();
      setPenilaiConfigs(configs);
      setPenilaiModal({ open: false, editId: null, roleId: "", checkerUserId: "", pihakKeduaUserId: "", penilaiEKPUserId: "", roles: [], users: [], loadingOptions: false });
    } finally {
      setPenilaiSaving(false);
    }
  };

  const removePenilai = async (id: number) => {
    await deleteSkpPenilai(id);
    setPenilaiConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  const unitOptions = ["semua", ...Array.from(new Set(data.map((r) => r.unitKerja)))];
  const periodeOptions = ["semua", ...Array.from(new Set(data.map((r) => r.periode)))];

  const filtered = data.filter((r) =>
    (filterUnit === "semua" || r.unitKerja === filterUnit) &&
    (filterPeriode === "semua" || r.periode === filterPeriode) &&
    (filterStatus === "semua" || r.statusSKP === filterStatus)
  );

  const total = data.length;
  const approved = data.filter((r) => r.statusSKP === "approved").length;
  const submitted = data.filter((r) => r.statusSKP === "submitted").length;
  const draft = data.filter((r) => r.statusSKP === "draft").length;

  const closePenilaiModal = () =>
    setPenilaiModal({ open: false, editId: null, roleId: "", checkerUserId: "", pihakKeduaUserId: "", penilaiEKPUserId: "", roles: [], users: [], loadingOptions: false });

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>
      <style>{CSS}</style>
      <PageTransition>

        {/* ── Hero Card ── */}
        <div className="mskp-hero">
          <div>
            <h2 className="ikupk-card-title">Master SKP</h2>
            <p className="mskp-hero-sub">Kelola status SKP pegawai dan konfigurasi pejabat penilai kinerja.</p>
          </div>
          <div className="mskp-stats-card">
            <div className="mskp-stat">
              <span className="mskp-stat-label">Total</span>
              <span className="mskp-stat-val">{loading ? "—" : total}</span>
            </div>
            <div className="mskp-stat">
              <span className="mskp-stat-label">Disetujui</span>
              <span className="mskp-stat-val--sm" style={{ color: "#166534" }}>{loading ? "—" : approved}</span>
            </div>
            <div className="mskp-stat">
              <span className="mskp-stat-label">Diajukan</span>
              <span className="mskp-stat-val--sm" style={{ color: "#1d4ed8" }}>{loading ? "—" : submitted}</span>
            </div>
            <div className="mskp-stat">
              <span className="mskp-stat-label">Draft</span>
              <span className="mskp-stat-val--sm" style={{ color: "#6b7280" }}>{loading ? "—" : draft}</span>
            </div>
          </div>
        </div>

        {/* ── Tab Toolbar ── */}
        <div className="mskp-toolbar">
          <button
            className={`mskp-tab${activeTab === "status" ? " mskp-tab--active" : ""}`}
            onClick={() => setActiveTab("status")}
          >
            Status SKP Pegawai
          </button>
          <button
            className={`mskp-tab${activeTab === "penilai" ? " mskp-tab--active" : ""}`}
            onClick={() => setActiveTab("penilai")}
          >
            Konfigurasi Penilai
          </button>
          <div className="mskp-toolbar-spacer" />
          {activeTab === "penilai" && (
            <button className="mskp-btn mskp-btn--primary" onClick={() => openPenilaiModal()}>
              + Tambah Konfigurasi
            </button>
          )}
        </div>

        {/* ══ TAB: STATUS SKP PEGAWAI ══ */}
        {activeTab === "status" && (
          <>
            {/* Filter */}
            <div className="mskp-filter-card">
              <div className="mskp-filter-group">
                <span className="mskp-filter-label">Unit Kerja</span>
                <select className="mskp-select" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                  {unitOptions.map(o => <option key={o} value={o}>{o === "semua" ? "Semua Unit" : o}</option>)}
                </select>
              </div>
              <div className="mskp-filter-group">
                <span className="mskp-filter-label">Periode</span>
                <select className="mskp-select" value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)}>
                  {periodeOptions.map(o => <option key={o} value={o}>{o === "semua" ? "Semua Periode" : o}</option>)}
                </select>
              </div>
              <div className="mskp-filter-group">
                <span className="mskp-filter-label">Status SKP</span>
                <select className="mskp-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="semua">Semua Status</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Diajukan</option>
                  <option value="approved">Disetujui</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="mskp-panel">
              <div className="mskp-panel-hdr">
                <span className="mskp-panel-hdr-title">Daftar SKP Pegawai</span>
                {!loading && <span className="mskp-panel-hdr-count">{filtered.length} pegawai</span>}
              </div>
              {loading ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Memuat data…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📋</div>
                  <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>Tidak ada data</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>Tidak ada data untuk filter ini.</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="mskp-table" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        {["No", "NIP", "Nama Pegawai", "Unit Kerja", "Periode", "Progres Validasi", "Rata Capaian", "Status SKP"].map(h => (
                          <th key={h} style={{ textAlign: h === "No" || h === "Periode" || h === "Rata Capaian" ? "center" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, idx) => (
                        <tr key={row.id}>
                          <td style={{ textAlign: "center", width: 36, color: "#9ca3af" }}>{idx + 1}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{row.nip}</td>
                          <td style={{ fontWeight: 600 }}>{row.namaPegawai}</td>
                          <td style={{ fontSize: 11, color: "#6b7280" }}>{row.unitKerja}</td>
                          <td style={{ textAlign: "center" }}>{row.periode}</td>
                          <td style={{ minWidth: 160 }}>{progressBar(row.tervalidasi, row.jumlahIndikator)}</td>
                          <td style={{
                            textAlign: "center", fontWeight: 700,
                            color: row.rataCapaian !== null
                              ? row.rataCapaian >= 76 ? "#16a34a" : row.rataCapaian >= 51 ? "#d97706" : "#dc2626"
                              : "#9ca3af",
                          }}>
                            {row.rataCapaian !== null ? `${row.rataCapaian.toFixed(1)}%` : "—"}
                          </td>
                          <td>{skpStatusBadge(row.statusSKP)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ TAB: KONFIGURASI PENILAI ══ */}
        {activeTab === "penilai" && (
          <div className="mskp-panel">
            <div className="mskp-panel-hdr">
              <span className="mskp-panel-hdr-title">Pejabat Penilai Kinerja per Jabatan</span>
              <span className="mskp-panel-hdr-count">{penilaiConfigs.length} konfigurasi</span>
            </div>
            {penilaiLoading ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Memuat data…</div>
            ) : penilaiConfigs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                <p style={{ fontSize: 13 }}>Belum ada konfigurasi. Klik &quot;Tambah Konfigurasi&quot; untuk mulai.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="mskp-table">
                  <thead>
                    <tr>
                      {["No", "Jabatan (Role)", "Level", "Checker", "Pihak Kedua (Rencana SKP)", "Pejabat Penilai (EKP)", "Aksi"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {penilaiConfigs.map((row, idx) => (
                      <tr key={row.id}>
                        <td style={{ textAlign: "center", width: 36, color: "#9ca3af" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: "#1f2937" }}>{row.roleName}</td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, background: "#f3f4f6", color: "#374151", fontWeight: 600, fontSize: 11 }}>
                            L{row.roleLevel}
                          </span>
                        </td>
                        <td>{row.checkerNama ?? <span style={{ color: "#9ca3af" }}>—</span>}</td>
                        <td>{row.pihakKeduaNama ?? <span style={{ color: "#9ca3af" }}>Belum diset</span>}</td>
                        <td>{row.penilaiNama ?? <span style={{ color: "#9ca3af" }}>Belum diset</span>}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => openPenilaiModal(row)} className="mskp-btn-edit">Edit</button>
                            <button onClick={() => removePenilai(row.id)} className="mskp-btn-del">Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Modal Tambah/Edit Penilai ── */}
        {penilaiModal.open && createPortal(
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={closePenilaiModal}
          >
            <div
              style={{ backgroundColor: "white", borderRadius: 14, padding: "28px 32px", maxWidth: 520, width: "92%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 style={{ margin: "0 0 4px", fontSize: 18, color: "#1f2937", fontWeight: 700 }}>
                {penilaiModal.editId ? "Edit Konfigurasi Penilai" : "Tambah Konfigurasi Penilai"}
              </h4>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>
                Tetapkan siapa pejabat penilai kinerja untuk jabatan ini.
              </p>

              {penilaiModal.loadingOptions ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>Memuat data…</div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                      Jabatan (Role) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={penilaiModal.roleId}
                      onChange={(e) => setPenilaiModal((p) => ({ ...p, roleId: e.target.value }))}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1f2937", background: "white" }}
                    >
                      <option value="">— Pilih jabatan —</option>
                      {penilaiModal.roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.unitNama})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0 16px" }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>
                    Rencana SKP
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Checker
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#6b7280" }}>— memvalidasi sebelum pihak kedua menandatangani</span>
                    </label>
                    <select
                      value={penilaiModal.checkerUserId}
                      onChange={(e) => setPenilaiModal((p) => ({ ...p, checkerUserId: e.target.value }))}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1f2937", background: "white" }}
                    >
                      <option value="">— Tidak ada checker —</option>
                      {penilaiModal.users.map((u) => (
                        <option key={u.id} value={u.id}>{u.nama}{u.jabatan ? ` (${u.jabatan})` : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                      Pihak Kedua (Penjabat)
                    </label>
                    <select
                      value={penilaiModal.pihakKeduaUserId}
                      onChange={(e) => setPenilaiModal((p) => ({ ...p, pihakKeduaUserId: e.target.value }))}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1f2937", background: "white" }}
                    >
                      <option value="">— Pilih Pihak Kedua —</option>
                      {penilaiModal.users.map((u) => (
                        <option key={u.id} value={u.id}>{u.nama}{u.jabatan ? ` (${u.jabatan})` : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0 16px" }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>
                    Formulir EKP
                  </p>

                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                      Pejabat Penilai Kinerja
                    </label>
                    <select
                      value={penilaiModal.penilaiEKPUserId}
                      onChange={(e) => setPenilaiModal((p) => ({ ...p, penilaiEKPUserId: e.target.value }))}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#1f2937", background: "white" }}
                    >
                      <option value="">— Pilih Pejabat Penilai —</option>
                      {penilaiModal.users.map((u) => (
                        <option key={u.id} value={u.id}>{u.nama}{u.jabatan ? ` (${u.jabatan})` : ""}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={closePenilaiModal}
                  style={{ padding: "10px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  onClick={savePenilai}
                  disabled={!penilaiModal.roleId || penilaiSaving || penilaiModal.loadingOptions}
                  style={{
                    padding: "10px 22px", borderRadius: 8, border: "none",
                    background: (penilaiSaving || penilaiModal.loadingOptions) ? "#9ca3af" : "#16a34a",
                    color: "white", fontWeight: 600, fontSize: 13,
                    cursor: (penilaiSaving || penilaiModal.loadingOptions) ? "not-allowed" : "pointer",
                  }}
                >
                  {penilaiSaving ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      </PageTransition>
    </div>
  );
}
