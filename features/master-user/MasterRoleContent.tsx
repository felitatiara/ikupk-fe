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
        <style>{`
          .mr-hero {
            display: flex; justify-content: space-between; gap: 24px; align-items: stretch;
            margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #fdf4ff 100%);
            box-shadow: 0 18px 42px rgba(15,23,42,0.08);
          }
          .mr-eyebrow { margin: 0 0 6px; color: #7c3aed; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
          .mr-title { margin: 0 0 8px; color: #0f172a; font-size: 22px; font-weight: 900; }
          .mr-subtitle { max-width: 560px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
          .mr-stats-card { min-width: 300px; padding: 16px 20px; border: 1px solid #ddd6fe; border-radius: 14px; background: #fff; display: flex; align-items: center; }
          .mr-stats-grid { display: flex; align-items: center; gap: 0; width: 100%; }
          .mr-stat { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
          .mr-stat-val { font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1; }
          .mr-stat-lbl { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }
          .mr-stat-divider { width: 1px; height: 40px; background: #e2e8f0; margin: 0 6px; flex-shrink: 0; }
          .mr-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
            margin-bottom: 18px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 14px;
            background: #fff; box-shadow: 0 4px 16px rgba(15,23,42,0.06);
          }
          .mr-toolbar-left, .mr-toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          .mr-search {
            border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 14px;
            font-size: 13px; color: #374151; background: #f8fafc; outline: none; min-width: 220px;
          }
          .mr-search:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.10); background: #fff; }
          .mr-select {
            border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 14px;
            font-size: 13px; color: #374151; background: #f8fafc; outline: none; cursor: pointer; min-width: 180px;
          }
          .mr-select:focus { border-color: #7c3aed; }
          .mr-count { font-size: 12px; color: #9ca3af; }
          .mr-btn-primary {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 9px 18px; border-radius: 12px; border: none;
            background: #16a34a; color: #fff; font-size: 13px; font-weight: 700;
            cursor: pointer; white-space: nowrap; box-shadow: 0 3px 10px rgba(22,163,74,0.28);
            transition: all 0.15s;
          }
          .mr-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
          .mr-table-card { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; box-shadow: 0 8px 28px rgba(15,23,42,0.07); }
          .mr-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
          .mr-table thead tr { background: #0f2f4f; }
          .mr-table thead th { padding: 12px 16px; color: #e8eef7; font-size: 11px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
          .mr-table thead th.center { text-align: center; }
          .mr-table tbody tr { border-bottom: 1px solid #f3f4f6; transition: background 0.1s; }
          .mr-table tbody tr:hover { background: #f9fafb; }
          .mr-table tbody td { padding: 12px 16px; }
          .mr-btn-edit { padding: 5px 12px; border-radius: 7px; border: 1px solid #e5e7eb; background: #fff; font-size: 12px; font-weight: 600; cursor: pointer; color: #374151; transition: border-color 0.1s; }
          .mr-btn-edit:hover { border-color: #7c3aed; color: #7c3aed; }
          .mr-btn-del { padding: 5px 12px; border-radius: 7px; border: none; background: #dc2626; font-size: 12px; font-weight: 600; cursor: pointer; color: #fff; transition: opacity 0.1s; }
          .mr-btn-del:hover { opacity: 0.85; }
          @media (max-width: 900px) {
            .mr-hero { flex-direction: column; align-items: stretch; }
            .mr-stats-card { min-width: 0; }
            .mr-toolbar { flex-direction: column; align-items: stretch; }
          }
        `}</style>

        {/* ── Delete Confirm ── */}
        {deleteTarget && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => !deleteLoading && setDeleteTarget(null)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", width: 400, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}>
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
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>Batal</button>
                <button onClick={handleDelete} disabled={deleteLoading}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: deleteLoading ? "#d1d5db" : "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: deleteLoading ? "not-allowed" : "pointer" }}>
                  {deleteLoading ? "Menghapus…" : "Hapus"}</button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* ── Modal Tambah / Edit ── */}
        {modalOpen && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}
            onClick={() => !saving && setModalOpen(false)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", width: 460, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}>
              <h5 style={{ fontWeight: 800, fontSize: 18, margin: "0 0 20px", color: "#111" }}>
                {modalMode === "tambah" ? "Tambah Role" : "Edit Role"}
              </h5>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={fLabel}>Nama Role <span style={{ color: "#dc2626" }}>*</span></label>
                  <input style={fInput} placeholder="contoh: Dosen, Koordinator Prodi" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={fLabel}>Unit / Jabatan</label>
                  <input style={fInput} placeholder="contoh: S1 Sistem Informasi, FIK" value={form.unitNama} onChange={e => setForm(p => ({ ...p, unitNama: e.target.value }))} />
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>Kosongkan jika tidak ada unit spesifik (misal: Dekan)</p>
                </div>
                <div>
                  <label style={fLabel}>Level Hierarki <span style={{ color: "#dc2626" }}>*</span></label>
                  <select style={{ ...fInput, cursor: "pointer" }} value={form.level} onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) }))}>
                    {levelOptions.map(lv => <option key={lv} value={lv}>Level {lv} — {LEVEL_LABEL[lv]}</option>)}
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
                <button onClick={() => setModalOpen(false)} disabled={saving}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>Batal</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: saving ? "#d1d5db" : "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Menyimpan…" : modalMode === "tambah" ? "Tambah" : "Simpan"}</button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* ── Hero Card ── */}
        <div className="mr-hero">
          <div>
            <h3 className="ikupk-card-title">Master Role</h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Kelola daftar role dan hierarki jabatan yang digunakan dalam sistem.</p>
          </div>
          <div className="mr-stats-card">
            <div className="mr-stats-grid">
              <div className="mr-stat">
                <span className="mr-stat-val">{roles.length}</span>
                <span className="mr-stat-lbl">Total Role</span>
              </div>
              <div className="mr-stat-divider" />
              <div className="mr-stat">
                <span className="mr-stat-val">{roles.filter(r => r.level <= 1).length}</span>
                <span className="mr-stat-lbl">Pimpinan</span>
              </div>
              <div className="mr-stat-divider" />
              <div className="mr-stat">
                <span className="mr-stat-val">{roles.filter(r => r.level >= 4).length}</span>
                <span className="mr-stat-lbl">Dosen/Tendik</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="mr-toolbar">
          <div className="mr-toolbar-left">
            <input
              className="mr-search"
              placeholder="Cari nama atau unit..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="mr-select"
              value={filterLevel === "all" ? "all" : String(filterLevel)}
              onChange={e => setFilterLevel(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">Semua Level</option>
              {levelOptions.map(lv => <option key={lv} value={lv}>Level {lv} — {LEVEL_LABEL[lv]}</option>)}
            </select>
            <span className="mr-count">{filtered.length} role ditemukan</span>
          </div>
          <div className="mr-toolbar-right">
            <button onClick={openTambah} className="mr-btn-primary">+ Tambah Role</button>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="mr-table-card">
          {loading ? (
            <div style={{ padding: "60px 32px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px 32px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              {roles.length === 0 ? "Belum ada role. Klik \"+ Tambah Role\" untuk memulai." : "Tidak ada role yang sesuai filter."}
            </div>
          ) : (
            <table className="mr-table">
              <thead>
                <tr>
                  {[
                    { label: "No", cls: "center", w: "4%" },
                    { label: "Nama Role", cls: "", w: "30%" },
                    { label: "Unit / Jabatan", cls: "", w: "35%" },
                    { label: "Level", cls: "center", w: "20%" },
                    { label: "Aksi", cls: "center", w: "11%" },
                  ].map((h, i) => (
                    <th key={i} className={h.cls} style={{ width: h.w }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((role, idx) => {
                  const c = LEVEL_COLOR[role.level] ?? LEVEL_COLOR[4];
                  return (
                    <tr key={role.id}>
                      <td style={{ textAlign: "center", fontSize: 12, color: "#9ca3af" }}>{idx + 1}</td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }}>{role.name}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, color: role.unitNama ? "#374151" : "#d1d5db" }}>{role.unitNama || "—"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                          <span style={{ fontSize: 10, opacity: 0.7 }}>L{role.level}</span>
                          {LEVEL_LABEL[role.level] ?? `Level ${role.level}`}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => openEdit(role)} className="mr-btn-edit">Edit</button>
                          <button onClick={() => setDeleteTarget(role)} className="mr-btn-del">Hapus</button>
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
