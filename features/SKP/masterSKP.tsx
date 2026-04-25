"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { getMasterSKP, updateUserSKPStatus, type MasterSKPRow } from "@/lib/api";

// ─────────────────────────────────────────────
//  Mock data  — fallback jika API belum siap
// ─────────────────────────────────────────────
const MOCK_MASTER: MasterSKPRow[] = [
  {
    id: 1,
    userId: 1,
    nip: "198501012010011001",
    namaPegawai: "Dr. Ahmad Fauzi, M.Kom",
    jabatan: "Dosen",
    unitKerja: "Fakultas Ilmu Komputer",
    periode: "2025",
    jumlahIndikator: 4,
    tervalidasi: 4,
    statusSKP: "submitted",
    rataCapaian: 87.5,
  },
  {
    id: 2,
    userId: 2,
    nip: "199001052015041002",
    namaPegawai: "Siti Rahmawati, S.T., M.T.",
    jabatan: "Dosen",
    unitKerja: "Fakultas Ilmu Komputer",
    periode: "2025",
    jumlahIndikator: 3,
    tervalidasi: 2,
    statusSKP: "draft",
    rataCapaian: null,
  },
  {
    id: 3,
    userId: 3,
    nip: "197803122005011003",
    namaPegawai: "Prof. Budi Santoso, Ph.D",
    jabatan: "Dosen",
    unitKerja: "Lembaga Penelitian",
    periode: "2025",
    jumlahIndikator: 5,
    tervalidasi: 5,
    statusSKP: "approved",
    rataCapaian: 95.2,
  },
];

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
  const [data, setData] = useState<MasterSKPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    id: number;
    action: "approved" | "rejected";
    nama: string;
  }>({ open: false, id: 0, action: "approved", nama: "" });

  // ── Fetch data dari API ──
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const rows = await getMasterSKP();
        setData(rows);
      } catch (err) {
        console.error("Failed to fetch master SKP:", err);
        setData(MOCK_MASTER);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

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

  // ── Actions ──
  const openConfirm = (id: number, action: "approved" | "rejected", nama: string) => {
    setConfirmModal({ open: true, id, action, nama });
  };

  const handleConfirm = async () => {
    const { id, action } = confirmModal;
    const row = data.find(r => r.id === id);
    try {
      await updateUserSKPStatus(row?.userId ?? id, action, row?.periode);
      setData((prev) =>
        prev.map((r) => (r.id === id ? { ...r, statusSKP: action } : r))
      );
    } catch (err) {
      console.error("Failed to update SKP status:", err);
      // Tetap update UI secara optimistic
      setData((prev) =>
        prev.map((r) => (r.id === id ? { ...r, statusSKP: action } : r))
      );
    }
    setConfirmModal({ open: false, id: 0, action: "approved", nama: "" });
  };

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

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Master SKP  
        </p>

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
                    {["No", "NIP", "Nama Pegawai", "Unit Kerja", "Periode", "Progres Validasi", "Rata Capaian", "Status SKP", "Aksi"].map(
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
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {row.statusSKP === "submitted" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => openConfirm(row.id, "approved", row.namaPegawai)}
                              style={{
                                padding: "5px 12px",
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
                              onClick={() => openConfirm(row.id, "rejected", row.namaPegawai)}
                              style={{
                                padding: "5px 12px",
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
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            {row.statusSKP === "approved" ? "Sudah disetujui" : row.statusSKP === "rejected" ? "Sudah ditolak" : "Belum diajukan"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
</div>
        {/* ── Modal konfirmasi ── */}
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
                maxWidth: 420,
                width: "90%",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: 16, color: "#1f2937" }}>
                {confirmModal.action === "approved" ? "✓ Setujui SKP" : "✕ Tolak SKP"}
              </h4>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>
                Anda akan{" "}
                <strong style={{ color: confirmModal.action === "approved" ? "#16a34a" : "#dc2626" }}>
                  {confirmModal.action === "approved" ? "menyetujui" : "menolak"}
                </strong>{" "}
                SKP dari <strong>{confirmModal.nama}</strong>. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
                  style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
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
