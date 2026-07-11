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

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function skpStatusBadge(status: MasterSKPRow["statusSKP"]) {
  const map = {
    draft: { label: "Draft", bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
    submitted: { label: "Diajukan", bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
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

function progressBar(current: number, total: number) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>{current}/{total} indikator</span>
        <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, backgroundColor: "#e5e7eb", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            backgroundColor: pct === 100 ? "#16a34a" : pct >= 50 ? "#2563eb" : "#d97706",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function MasterSKPContent({ role = "admin" }: { role?: string }) {
  const [activeTab, setActiveTab] = useState<"status" | "penilai">("status");

  // ── Tab: Status SKP ──
  const [data, setData] = useState<MasterSKPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  // ── Tab: Konfigurasi Penilai ──
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

  // ── Fetch data dari API ──
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const rows = await getMasterSKP();
        setData(rows);
      } catch (err) {
        console.error("Failed to fetch master SKP:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Load configs saat tab penilai aktif
  useEffect(() => {
    if (activeTab !== "penilai") return;
    setPenilaiLoading(true);
    getSkpPenilaiConfigs()
      .then((configs) => setPenilaiConfigs(configs))
      .finally(() => setPenilaiLoading(false));
  }, [activeTab]);

  const openPenilaiModal = (config?: SkpPenilaiConfigRow) => {
    setPenilaiModal({
      open: true,
      editId: config?.id ?? null,
      roleId: config?.roleId ?? "",
      checkerUserId: config?.checkerUserId ?? "",
      pihakKeduaUserId: config?.pihakKeduaUserId ?? "",
      penilaiEKPUserId: config?.penilaiUserId ?? "",
      roles: [],
      users: [],
      loadingOptions: true,
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

  // ── Options ──
  const unitOptions = ["semua", ...Array.from(new Set(data.map((r) => r.unitKerja)))];
  const periodeOptions = ["semua", ...Array.from(new Set(data.map((r) => r.periode)))];

  const filtered = data.filter((r) => {
    return (
      (filterUnit === "semua" || r.unitKerja === filterUnit) &&
      (filterPeriode === "semua" || r.periode === filterPeriode) &&
      (filterStatus === "semua" || r.statusSKP === filterStatus)
    );
  });

  // ── Stats ──
  const total = data.length;
  const approved = data.filter((r) => r.statusSKP === "approved").length;
  const submitted = data.filter((r) => r.statusSKP === "submitted").length;
  const draft = data.filter((r) => r.statusSKP === "draft").length;

  const th: React.CSSProperties = {
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    textAlign: "left",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
    verticalAlign: "middle",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: "8px 8px 0 0",
    border: "1px solid",
    borderColor: active ? "#e5e7eb" : "transparent",
    borderBottom: active ? "1px solid white" : "1px solid #e5e7eb",
    background: active ? "white" : "transparent",
    color: active ? "#FF7900" : "#6b7280",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: "pointer",
    marginBottom: -1,
  });

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Master SKP
        </p>

        {/* ── Tab switcher ── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
          <button style={tabStyle(activeTab === "status")} onClick={() => setActiveTab("status")}>
            Status SKP Pegawai
          </button>
          <button style={tabStyle(activeTab === "penilai")} onClick={() => setActiveTab("penilai")}>
            Konfigurasi Penilai
          </button>
        </div>

        {/* ══════════════════════════════════════════
            TAB: KONFIGURASI PEJABAT PENILAI KINERJA
        ══════════════════════════════════════════ */}
        {activeTab === "penilai" && (
          <div className="page-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", margin: 0 }}>
                  Pejabat Penilai Kinerja per Jabatan
                </h3>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
                  Tetapkan siapa yang menandatangani Rencana SKP &amp; Formulir EKP untuk setiap jabatan.
                </p>
              </div>
              <button
                onClick={() => openPenilaiModal()}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "none",
                  background: "#FF7900", color: "white", fontWeight: 600,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                + Tambah Konfigurasi
              </button>
            </div>

            {penilaiLoading ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data…</p>
            ) : penilaiConfigs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                <p style={{ fontSize: 13 }}>Belum ada konfigurasi. Klik &quot;Tambah Konfigurasi&quot; untuk mulai.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["No", "Jabatan (Role)", "Level", "Checker", "Pihak Kedua (Rencana SKP)", "Pejabat Penilai (EKP)", "Aksi"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12, color: "#374151", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", textAlign: "left", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {penilaiConfigs.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 14px", fontSize: 12, textAlign: "center", width: 36, color: "#374151" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#1f2937" }}>{row.roleName}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, textAlign: "center" }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, background: "#f3f4f6", color: "#374151", fontWeight: 600, fontSize: 11 }}>
                            L{row.roleLevel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#374151" }}>{row.checkerNama ?? <span style={{ color: "#9ca3af" }}>—</span>}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#374151" }}>{row.pihakKeduaNama ?? <span style={{ color: "#9ca3af" }}>Belum diset</span>}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#374151" }}>{row.penilaiNama ?? <span style={{ color: "#9ca3af" }}>Belum diset</span>}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => openPenilaiModal(row)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, fontSize: 11, cursor: "pointer" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removePenilai(row.id)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", fontWeight: 600, fontSize: 11, cursor: "pointer" }}
                            >
                              Hapus
                            </button>
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

        {/* ══════════════════════════════════════════
            TAB: STATUS SKP PEGAWAI (existing)
        ══════════════════════════════════════════ */}
        {activeTab === "status" && (
        <div className="page-card">

        {/* ── Ringkasan statistik ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {[
            { label: "Total Pegawai", value: total, color: "#6366f1", bg: "#eef2ff" },
            { label: "Draft", value: draft, color: "#6b7280", bg: "#f9fafb" },
            { label: "Diajukan", value: submitted, color: "#2563eb", bg: "#dbeafe" },
            { label: "Disetujui", value: approved, color: "#1DB362", bg: "#E6F6EA" },
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
            {[
              { label: "Unit Kerja", value: filterUnit, setter: setFilterUnit, options: unitOptions },
              { label: "Periode", value: filterPeriode, setter: setFilterPeriode, options: periodeOptions },
              {
                label: "Status SKP",
                value: filterStatus,
                setter: setFilterStatus,
                options: [
                  { value: "semua", label: "Semua Status" },
                  { value: "draft", label: "Draft" },
                  { value: "submitted", label: "Diajukan" },
                  { value: "approved", label: "Disetujui" },
                  { value: "rejected", label: "Ditolak" },
                ],
              },
            ].map((f) => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>
                  {f.label}
                </label>
                <select
                  value={f.value}
                  onChange={(e) => f.setter(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
                >
                  {(f.options as Array<string | { value: string; label: string }>).map((opt) => {
                    const val = typeof opt === "string" ? opt : opt.value;
                    const lbl = typeof opt === "string" ? (opt === "semua" ? "Semua" : opt) : opt.label;
                    return <option key={val} value={val}>{lbl}</option>;
                  })}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabel ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 20 }}>
            Daftar SKP Pegawai
          </h3>

          {loading ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data…</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Tidak ada data untuk filter ini.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr>
                    {["No", "NIP", "Nama Pegawai", "Unit Kerja", "Periode", "Progres Validasi", "Rata Capaian", "Status SKP"].map(
                      (h) => <th key={h} style={th}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={{ ...td, textAlign: "center", width: 36 }}>{idx + 1}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{row.nip}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{row.namaPegawai}</td>
                      <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{row.unitKerja}</td>
                      <td style={{ ...td, textAlign: "center" }}>{row.periode}</td>
                      <td style={{ ...td, minWidth: 160 }}>{progressBar(row.tervalidasi, row.jumlahIndikator)}</td>
                      <td
                        style={{
                          ...td,
                          textAlign: "center",
                          fontWeight: 700,
                          color: row.rataCapaian !== null
                            ? row.rataCapaian >= 76 ? "#16a34a" : row.rataCapaian >= 51 ? "#d97706" : "#dc2626"
                            : "#9ca3af",
                        }}
                      >
                        {row.rataCapaian !== null ? `${row.rataCapaian.toFixed(1)}%` : "—"}
                      </td>
                      <td style={td}>{skpStatusBadge(row.statusSKP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>
        )} {/* end activeTab === "status" */}

        {/* Modals are rendered via portal to escape PageTransition's CSS transform */}
        {penilaiModal.open && createPortal(
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => setPenilaiModal({ open: false, editId: null, roleId: "", checkerUserId: "", pihakKeduaUserId: "", penilaiEKPUserId: "", roles: [], users: [], loadingOptions: false })}
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
                <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>
                  Memuat data…
                </div>
              ) : (
                <>
                  {/* Jabatan */}
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

                  {/* Divider Rencana SKP */}
                  <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0 16px" }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#FF7900", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>
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

                  {/* Divider EKP */}
                  <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0 16px" }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#FF7900", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>
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
                  onClick={() => setPenilaiModal({ open: false, editId: null, roleId: "", checkerUserId: "", pihakKeduaUserId: "", penilaiEKPUserId: "", roles: [], users: [], loadingOptions: false })}
                  style={{ padding: "10px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  onClick={savePenilai}
                  disabled={!penilaiModal.roleId || penilaiSaving || penilaiModal.loadingOptions}
                  style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: (penilaiSaving || penilaiModal.loadingOptions) ? "#9ca3af" : "#16a34a", color: "white", fontWeight: 600, fontSize: 13, cursor: (penilaiSaving || penilaiModal.loadingOptions) ? "not-allowed" : "pointer" }}
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
