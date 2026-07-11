"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PageTransition from "@/components/layout/PageTransition";
import { getAllRoles, createRole, updateRole, deleteRole, RoleOption } from "@/lib/api";
import { toast } from "sonner";

const LEVEL_LABEL: Record<number, string> = {
  0: "Admin / Super Admin",
  1: "Pimpinan (Dekan, WD, dll)",
  2: "Kepala Jurusan",
  3: "Koordinator Prodi",
  4: "Dosen / Tendik",
};

const LEVEL_COLOR: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  1: { bg: "#dbeafe", border: "#bfdbfe", text: "#1e40af" },
  2: { bg: "#ede9fe", border: "#ddd6fe", text: "#5b21b6" },
  3: { bg: "#d1fae5", border: "#a7f3d0", text: "#065f46" },
  4: { bg: "#f3f4f6", border: "#e5e7eb", text: "#374151" },
};

interface FormData {
  id?: number;
  name: string;
  unitNama: string;
  level: number;
}

const blankForm = (): FormData => ({ name: "", unitNama: "", level: 4 });

export default function MasterRoleContent() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<number | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"tambah" | "edit">("tambah");
  const [form, setForm] = useState<FormData>(blankForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleOption | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refreshData = () => {
    setLoading(true);
    getAllRoles()
      .then(data => {
        const sorted = [...data].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "id") || a.unitNama.localeCompare(b.unitNama, "id"));
        setRoles(sorted);
      })
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refreshData(); }, []);

  const openTambah = () => { setForm(blankForm()); setModalMode("tambah"); setModalOpen(true); };
  const openEdit = (role: RoleOption) => { setForm({ id: role.id, name: role.name, unitNama: role.unitNama, level: role.level }); setModalMode("edit"); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nama role wajib diisi."); return; }
    setSaving(true);
    try {
      if (form.id) {
        await updateRole(form.id, { name: form.name.trim(), unitNama: form.unitNama.trim(), level: form.level });
        toast.success("Role berhasil diperbarui.");
      } else {
        await createRole({ name: form.name.trim(), unitNama: form.unitNama.trim(), level: form.level });
        toast.success("Role berhasil ditambahkan.");
      }
      setModalOpen(false);
      refreshData();
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
      const res = await deleteRole(deleteTarget.id);
      if (res.deleted) {
        toast.success("Role berhasil dihapus.");
        setDeleteTarget(null);
        refreshData();
      } else {
        toast.error(res.reason ?? "Role tidak dapat dihapus.");
        setDeleteTarget(null);
      }
    } catch {
      toast.error("Gagal menghapus role.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = roles.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.name.toLowerCase().includes(q) || r.unitNama.toLowerCase().includes(q);
    const matchLevel = filterLevel === "all" || r.level === filterLevel;
    return matchQ && matchLevel;
  });

  const fInput: React.CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px",
    fontSize: 13, color: "#111", width: "100%", background: "#fff", outline: "none", boxSizing: "border-box",
  };
  const fLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 };

  const levelOptions = [0, 1, 2, 3, 4];

  return (
    <PageTransition>
      <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

        {/* ── Delete Confirm ── */}
        {deleteTarget && createPortal(
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => !deleteLoading && setDeleteTarget(null)}
          >
            <div
              style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", width: 400, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>🗑️</div>
              <h5 style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 4px", color: "#111" }}>Hapus Role?</h5>
              <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Role yang masih digunakan pengguna tidak dapat dihapus.</p>
              <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "14px 16px", textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4 }}>{deleteTarget.name}</div>
                {deleteTarget.unitNama && <div style={{ fontSize: 12, color: "#6b7280" }}>{deleteTarget.unitNama}</div>}
                <div style={{ marginTop: 8 }}>
                  {(() => {
                    const c = LEVEL_COLOR[deleteTarget.level] ?? LEVEL_COLOR[4];
                    return (
                      <span style={{ fontSize: 11, fontWeight: 700, background: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: 20, padding: "2px 10px" }}>
                        {LEVEL_LABEL[deleteTarget.level] ?? `Level ${deleteTarget.level}`}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}
                >Batal</button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: deleteLoading ? "#d1d5db" : "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: deleteLoading ? "not-allowed" : "pointer" }}
                >{deleteLoading ? "Menghapus…" : "Hapus"}</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Modal Tambah / Edit ── */}
        {modalOpen && createPortal(
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}
            onClick={() => !saving && setModalOpen(false)}
          >
            <div
              style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", width: 460, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}
            >
              <h5 style={{ fontWeight: 800, fontSize: 18, margin: "0 0 20px", color: "#111" }}>
                {modalMode === "tambah" ? "Tambah Role" : "Edit Role"}
              </h5>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={fLabel}>Nama Role <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    style={fInput}
                    placeholder="contoh: Dosen, Koordinator Prodi"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={fLabel}>Unit / Jabatan</label>
                  <input
                    style={fInput}
                    placeholder="contoh: S1 Sistem Informasi, FIK"
                    value={form.unitNama}
                    onChange={e => setForm(p => ({ ...p, unitNama: e.target.value }))}
                  />
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>Kosongkan jika tidak ada unit spesifik (misal: Dekan)</p>
                </div>

                <div>
                  <label style={fLabel}>Level Hierarki <span style={{ color: "#dc2626" }}>*</span></label>
                  <select
                    style={{ ...fInput, cursor: "pointer" }}
                    value={form.level}
                    onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) }))}
                  >
                    {levelOptions.map(lv => (
                      <option key={lv} value={lv}>Level {lv} — {LEVEL_LABEL[lv]}</option>
                    ))}
                  </select>
                  {(() => {
                    const c = LEVEL_COLOR[form.level] ?? LEVEL_COLOR[4];
                    return (
                      <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: c.bg, border: `1px solid ${c.border}` }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: c.text }}>L{form.level}</span>
                        <span style={{ fontSize: 11, color: c.text }}>{LEVEL_LABEL[form.level]}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}
                >Batal</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: saving ? "#d1d5db" : "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}
                >{saving ? "Menyimpan…" : modalMode === "tambah" ? "Tambah" : "Simpan"}</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 22, color: "#111827", margin: "0 0 4px" }}>Master Role</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Kelola daftar role dan hierarki jabatan yang digunakan dalam sistem.</p>
          </div>
          <button
            onClick={openTambah}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 4px rgba(22,163,74,0.25)", whiteSpace: "nowrap" }}
          >
            + Tambah Role
          </button>
        </div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            style={{ ...fInput, width: 240, flex: "0 0 240px" }}
            placeholder="Cari nama atau unit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={{ ...fInput, width: 220, flex: "0 0 220px", cursor: "pointer" }}
            value={filterLevel === "all" ? "all" : String(filterLevel)}
            onChange={e => setFilterLevel(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">Semua Level</option>
            {levelOptions.map(lv => (
              <option key={lv} value={lv}>Level {lv} — {LEVEL_LABEL[lv]}</option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>
            {filtered.length} role ditemukan
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {loading ? (
            <div style={{ padding: "60px 32px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px 32px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              {roles.length === 0 ? "Belum ada role. Klik \"Tambah Role\" untuk memulai." : "Tidak ada role yang sesuai filter."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                  {["No", "Nama Role", "Unit / Jabatan", "Level", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i === 4 ? "right" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((role, idx) => {
                  const c = LEVEL_COLOR[role.level] ?? LEVEL_COLOR[4];
                  return (
                    <tr
                      key={role.id}
                      style={{ borderBottom: "1px solid #f3f4f6", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#9ca3af", width: 40 }}>{idx + 1}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }}>{role.name}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, color: role.unitNama ? "#374151" : "#d1d5db" }}>
                          {role.unitNama || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                          <span style={{ fontSize: 10, opacity: 0.7 }}>L{role.level}</span>
                          {LEVEL_LABEL[role.level] ?? `Level ${role.level}`}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => openEdit(role)}
                            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                          >Edit</button>
                          <button
                            onClick={() => setDeleteTarget(role)}
                            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #fecaca", background: "#fff5f5", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#dc2626" }}
                          >Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Info card ── */}
        <div style={{ marginTop: 20, padding: "14px 18px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>ℹ️ Catatan</p>
          <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "#374151", lineHeight: 1.8 }}>
            <li>Role yang sudah digunakan oleh pengguna tidak dapat dihapus.</li>
            <li>Level menentukan hierarki disposisi: Level 0 (Admin) → Level 1 (Pimpinan) → Level 2 (Kajur) → Level 3 (Kaprodi) → Level 4 (Dosen/Tendik).</li>
            <li>Setelah menambah role baru, assign ke pengguna melalui halaman <strong>Master User</strong>.</li>
          </ul>
        </div>
      </div>
    </PageTransition>
  );
}
