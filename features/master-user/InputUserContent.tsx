"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PageTransition from "@/components/layout/PageTransition";
import { createUserAccount, getAllRoles, getUsers, RoleOption, UnitUser, updateUserAccount, deleteUserAccount } from "@/lib/api";
import { toast } from "sonner";

const STRUCTURAL_ROLES = new Set([
  "dekan", "wakil dekan 1", "wakil dekan 2", "wakil dekan 3",
  "kepala bagian", "kepala jurusan", "koordinator prodi",
]);
const JENIS_OPTIONS = ["Dosen", "Tendik", "Administrasi"];

function getInitials(nama: string) {
  return nama.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

const AVATAR_COLORS = [
  { bg: "#fff7ed", text: "#ea580c" },
  { bg: "#faf5ff", text: "#7c3aed" },
  { bg: "#eff6ff", text: "#2563eb" },
  { bg: "#f0fdf4", text: "#16a34a" },
  { bg: "#fff1f2", text: "#e11d48" },
  { bg: "#fffbeb", text: "#d97706" },
];

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  superadmin: { bg: "#fef9c3", text: "#854d0e" },
  admin: { bg: "#fff7ed", text: "#c2410c" },
  dekan: { bg: "#faf5ff", text: "#7c3aed" },
  dosen: { bg: "#eff6ff", text: "#2563eb" },
  tendik: { bg: "#f0fdf4", text: "#16a34a" },
};

function getRoleColor(role: string) {
  const key = role.toLowerCase();
  for (const k of Object.keys(ROLE_COLOR)) {
    if (key.includes(k)) return ROLE_COLOR[k];
  }
  return { bg: "#f3f4f6", text: "#6b7280" };
}

interface FormData {
  id?: number;
  nip: string; nama: string; email: string; password: string;
  roleIds: number[]; jenis: string; atasanIds: number[];
}
const blankForm = (): FormData => ({ nip: "", nama: "", email: "", password: "", roleIds: [], jenis: "Dosen", atasanIds: [] });

export default function InputUserContent() {
  const [allUsers, setAllUsers] = useState<UnitUser[]>([]);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"tambah" | "edit">("tambah");
  const [formData, setFormData] = useState<FormData>(blankForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnitUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { refreshData(); }, []);

  const refreshData = () => {
    getUsers().then(setAllUsers).catch(() => setAllUsers([]));
    getAllRoles().then(setAllRoles).catch(() => setAllRoles([]));
  };

  const [rolePick, setRolePick] = useState<number | "">("");
  const [atasanPick, setAtasanPick] = useState<number | "">("");

  const addRole = (roleId: number) => {
    if (!roleId || formData.roleIds.includes(roleId)) return;
    const role = allRoles.find(r => r.id === roleId);
    const structural = role ? STRUCTURAL_ROLES.has(role.name.toLowerCase()) : false;
    setFormData(p => ({ ...p, roleIds: [...p.roleIds, roleId], jenis: structural && p.roleIds.length === 0 ? "Dosen" : p.jenis }));
    setRolePick("");
  };

  const removeRole = (roleId: number) => setFormData(p => ({ ...p, roleIds: p.roleIds.filter(id => id !== roleId) }));
  const addAtasan = (userId: number) => {
    if (!userId || formData.atasanIds.includes(userId)) return;
    setFormData(p => ({ ...p, atasanIds: [...p.atasanIds, userId] }));
    setAtasanPick("");
  };
  const removeAtasan = (userId: number) => setFormData(p => ({ ...p, atasanIds: p.atasanIds.filter(id => id !== userId) }));

  const openTambah = () => { setFormData(blankForm()); setRolePick(""); setAtasanPick(""); setModalMode("tambah"); setModalOpen(true); };
  const openEdit = (u: UnitUser) => {
    const userRoles: any[] = (u as any).userRoles ?? [];
    const primaryRoleId = userRoles.find((ur: any) => ur.isPrimary)?.roleId ?? userRoles[0]?.roleId;
    const nonPrimaryIds = userRoles.filter((ur: any) => !ur.isPrimary).map((ur: any) => ur.roleId);
    const roleIds = primaryRoleId ? [primaryRoleId, ...nonPrimaryIds] : nonPrimaryIds;
    const atasanIds: number[] = (u as any).atasanIds?.length ? (u as any).atasanIds : (u as any).atasanId ? [(u as any).atasanId] : [];
    setFormData({ id: u.id, nip: (u as any).nip || "", nama: u.nama, email: u.email, password: "", roleIds, jenis: (u as any).jenis || "Dosen", atasanIds });
    setRolePick(""); setAtasanPick("");
    setModalMode("edit"); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nama.trim() || !formData.email.trim()) { toast.error("Nama dan email wajib diisi."); return; }
    if (!formData.id && !formData.password.trim()) { toast.error("Password wajib diisi untuk user baru."); return; }
    if (formData.roleIds.length === 0) { toast.error("Minimal 1 role wajib dipilih."); return; }
    setSaving(true);
    try {
      const [primaryRoleId, ...extraRoleIds] = formData.roleIds;
      const payload: any = {
        nip: formData.nip.trim() || undefined, nama: formData.nama.trim(), email: formData.email.trim(),
        roleId: primaryRoleId, extraRoleIds, jenis: formData.jenis, atasanIds: formData.atasanIds,
      };
      if (formData.password.trim()) payload.password = formData.password;
      if (formData.id) { await updateUserAccount(formData.id, payload); toast.success("User berhasil diperbarui."); }
      else { await createUserAccount(payload); toast.success("User berhasil ditambahkan."); }
      setModalOpen(false); refreshData();
    } catch (err) { toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err))); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try { await deleteUserAccount(deleteTarget.id); toast.success("User berhasil dihapus."); setDeleteTarget(null); refreshData(); }
    catch { toast.error("Gagal menghapus user."); }
    finally { setDeleteLoading(false); }
  };

  const filtered = allUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || u.nama.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.role || "").toLowerCase().includes(q);
    const matchRole = filterRole === "all" || (u.role || "").toLowerCase() === filterRole.toLowerCase();
    const matchUnit = filterUnit === "all" || ((u as any).unitNama || "").toLowerCase() === filterUnit.toLowerCase();
    return matchQ && matchRole && matchUnit;
  });
  const uniqueRoleNames = Array.from(new Set(allUsers.map(u => u.role).filter(Boolean)));
  const uniqueUnitNames = Array.from(new Set(allUsers.map(u => (u as any).unitNama).filter(Boolean))).sort();

  const fInput: React.CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px",
    fontSize: 13, color: "#111", width: "100%", background: "#fff", outline: "none", boxSizing: "border-box"
  };
  const fLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 };

  const dosenCount = allUsers.filter(u => ((u as any).jenis || "").toLowerCase() === "dosen").length;
  const tendikCount = allUsers.filter(u => ((u as any).jenis || "").toLowerCase() === "tendik").length;

  return (
    <PageTransition>
      <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>
        <style>{`
          .mu-hero {
            display: flex; justify-content: space-between; gap: 24px; align-items: stretch;
            margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%);
            box-shadow: 0 18px 42px rgba(15,23,42,0.08);
          }
          .mu-eyebrow { margin: 0 0 6px; color: #2563eb; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
          .mu-title { margin: 0 0 8px; color: #0f172a; font-size: 22px; font-weight: 900; }
          .mu-subtitle { max-width: 560px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
          .mu-stats-card { min-width: 320px; padding: 16px 20px; border: 1px solid #bfdbfe; border-radius: 14px; background: #fff; display: flex; align-items: center; }
          .mu-stats-grid { display: flex; align-items: center; gap: 0; width: 100%; }
          .mu-stat { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
          .mu-stat-val { font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1; }
          .mu-stat-lbl { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }
          .mu-stat-divider { width: 1px; height: 40px; background: #e2e8f0; margin: 0 6px; flex-shrink: 0; }
          .mu-toolbar {
            display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
            margin-bottom: 18px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 14px;
            background: #fff; box-shadow: 0 4px 16px rgba(15,23,42,0.06);
          }
          .mu-toolbar-left, .mu-toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          .mu-search {
            border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 14px;
            font-size: 13px; color: #374151; background: #f8fafc; outline: none; min-width: 220px;
          }
          .mu-search:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.10); background: #fff; }
          .mu-select {
            border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 14px;
            font-size: 13px; color: #374151; background: #f8fafc; outline: none; cursor: pointer;
          }
          .mu-select:focus { border-color: #2563eb; }
          .mu-count { font-size: 12px; color: #9ca3af; white-space: nowrap; }
          .mu-btn-primary {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 9px 18px; border-radius: 12px; border: none;
            background: #16a34a; color: #fff; font-size: 13px; font-weight: 700;
            cursor: pointer; white-space: nowrap; box-shadow: 0 3px 10px rgba(22,163,74,0.28);
            transition: all 0.15s;
          }
          .mu-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
          .mu-table-card { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; box-shadow: 0 8px 28px rgba(15,23,42,0.07); }
          .mu-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
          .mu-table thead tr { background: #0f2f4f; }
          .mu-table thead th { padding: 12px 16px; color: #e8eef7; font-size: 11px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
          .mu-table thead th.center { text-align: center; }
          .mu-table tbody tr { border-bottom: 1px solid #f8f8f8; transition: background 0.1s; }
          .mu-table tbody tr:hover { background: #fafafa; }
          .mu-table tbody td { padding: 13px 16px; }
          .mu-table tfoot td { padding: 10px 16px; font-size: 12px; color: #9ca3af; background: #f8fafc; border-top: 1px solid #f0f0f0; }
          .mu-btn-edit { padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; transition: border-color 0.1s; }
          .mu-btn-edit:hover { border-color: #2563eb; color: #2563eb; }
          .mu-btn-del { padding: 5px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #dc2626; color: #fff; transition: opacity 0.1s; }
          .mu-btn-del:hover { opacity: 0.85; }
          @media (max-width: 900px) {
            .mu-hero { flex-direction: column; align-items: stretch; }
            .mu-stats-card { min-width: 0; }
            .mu-toolbar { flex-direction: column; align-items: stretch; }
          }
        `}</style>

        {/* ── Delete Confirm ── */}
        {deleteTarget && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => !deleteLoading && setDeleteTarget(null)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", width: 400, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>🗑️</div>
              <h5 style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 4px", color: "#111" }}>Hapus User?</h5>
              <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Akun ini akan dihapus permanen.</p>
              <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "14px 16px", textAlign: "center", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: AVATAR_COLORS[deleteTarget.id % 6].bg, color: AVATAR_COLORS[deleteTarget.id % 6].text }}>
                    {getInitials(deleteTarget.nama)}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{deleteTarget.nama}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{deleteTarget.email}</div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>Batal</button>
                <button onClick={handleDelete} disabled={deleteLoading}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff" }}>
                  {deleteLoading ? "Menghapus..." : "Ya, Hapus"}</button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* ── Add / Edit Modal ── */}
        {modalOpen && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => !saving && setModalOpen(false)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", width: 560, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ marginBottom: 24 }}>
                <h5 style={{ fontWeight: 800, fontSize: 17, margin: "0 0 4px", color: "#111" }}>
                  {modalMode === "tambah" ? "Tambah User Baru" : "Edit User"}
                </h5>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                  {modalMode === "tambah" ? "Lengkapi data untuk membuat akun baru." : "Perbarui data akun pengguna."}
                </p>
              </div>

              <div className="row g-3">
                <div className="col-6">
                  <label style={fLabel}>NIP</label>
                  <input style={fInput} value={formData.nip} onChange={e => setFormData(p => ({ ...p, nip: e.target.value }))} placeholder="Masukkan NIP" />
                </div>
                <div className="col-6">
                  <label style={fLabel}>Nama Lengkap <span style={{ color: "#ef4444" }}>*</span></label>
                  <input style={fInput} value={formData.nama} onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))} placeholder="Nama lengkap" />
                </div>
                <div className="col-6">
                  <label style={fLabel}>Email <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="email" style={fInput} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@domain.com" />
                </div>
                <div className="col-6">
                  <label style={fLabel}>
                    Password
                    {formData.id
                      ? <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}> (kosongkan jika tidak ganti)</span>
                      : <span style={{ color: "#ef4444" }}> *</span>}
                  </label>
                  <input type="password" style={fInput} value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="col-12">
                  <label style={fLabel}>Unit Kerja (Role) <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select style={{ ...fInput, flex: 1 }} value={rolePick} onChange={e => setRolePick(e.target.value === "" ? "" : Number(e.target.value))}>
                      <option value="">— Pilih Role —</option>
                      {allRoles.filter(r => !formData.roleIds.includes(r.id)).map(r => (
                        <option key={r.id} value={r.id}>{r.name}{r.unitNama ? ` — ${r.unitNama}` : ""}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => rolePick !== "" && addRole(Number(rolePick))} disabled={rolePick === ""}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 13, cursor: rolePick === "" ? "not-allowed" : "pointer", opacity: rolePick === "" ? 0.5 : 1, whiteSpace: "nowrap" }}>+ Tambah</button>
                  </div>
                  {formData.roleIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {formData.roleIds.map((rid, idx) => {
                        const r = allRoles.find(x => x.id === rid);
                        return (
                          <span key={rid} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: idx === 0 ? "#eff6ff" : "#f3f4f6", color: idx === 0 ? "#2563eb" : "#374151", borderRadius: 20, padding: "4px 8px 4px 12px", fontSize: 12, fontWeight: 600 }}>
                            {idx === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a" }}>PRIMARY</span>}
                            {r ? `${r.name}${r.unitNama ? ` — ${r.unitNama}` : ""}` : `Role #${rid}`}
                            <button type="button" onClick={() => removeRole(rid)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="col-6">
                  <label style={fLabel}>Jenis Pegawai</label>
                  <select style={fInput} value={formData.jenis} onChange={e => setFormData(p => ({ ...p, jenis: e.target.value }))}>
                    {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label style={fLabel}>Atasan Langsung</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select style={{ ...fInput, flex: 1 }} value={atasanPick} onChange={e => setAtasanPick(e.target.value === "" ? "" : Number(e.target.value))}>
                      <option value="">— Pilih Atasan —</option>
                      {allUsers.filter(u => u.id !== formData.id && !formData.atasanIds.includes(u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.nama} ({u.role})</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => atasanPick !== "" && addAtasan(Number(atasanPick))} disabled={atasanPick === ""}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#6b7280", color: "#fff", fontWeight: 700, fontSize: 13, cursor: atasanPick === "" ? "not-allowed" : "pointer", opacity: atasanPick === "" ? 0.5 : 1, whiteSpace: "nowrap" }}>+ Tambah</button>
                  </div>
                  {formData.atasanIds.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {formData.atasanIds.map(uid => {
                        const u = allUsers.find(x => x.id === uid);
                        return (
                          <span key={uid} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "4px 8px 4px 12px", fontSize: 12, fontWeight: 600 }}>
                            {u ? `${u.nama} (${u.role})` : `User #${uid}`}
                            <button type="button" onClick={() => removeAtasan(uid)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 24, paddingTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setModalOpen(false)} disabled={saving}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>Batal</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: "#16a34a", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff" }}>
                  {saving ? "Menyimpan..." : modalMode === "tambah" ? "Simpan" : "Perbarui"}</button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* ── Hero Card ── */}
        <div className="mu-hero">
          <div>
            <h3 className="ikupk-card-title">Master User</h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Kelola akun pengguna, hak akses, dan hierarki atasan dalam sistem.</p>
          </div>
          <div className="mu-stats-card">
            <div className="mu-stats-grid">
              <div className="mu-stat">
                <span className="mu-stat-val">{allUsers.length}</span>
                <span className="mu-stat-lbl">Total User</span>
              </div>
              <div className="mu-stat-divider" />
              <div className="mu-stat">
                <span className="mu-stat-val">{dosenCount}</span>
                <span className="mu-stat-lbl">Dosen</span>
              </div>
              <div className="mu-stat-divider" />
              <div className="mu-stat">
                <span className="mu-stat-val">{tendikCount}</span>
                <span className="mu-stat-lbl">Tendik</span>
              </div>
              <div className="mu-stat-divider" />
              <div className="mu-stat">
                <span className="mu-stat-val">{filtered.length}</span>
                <span className="mu-stat-lbl">Ditampilkan</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="mu-toolbar">
          <div className="mu-toolbar-left">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Nama, email, atau role..." className="mu-search" />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="mu-select">
              <option value="all">Semua Role</option>
              {uniqueRoleNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="mu-select">
              <option value="all">Semua Unit</option>
              {uniqueUnitNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="mu-toolbar-right">
            <button onClick={openTambah} className="mu-btn-primary">+ Tambah User</button>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="mu-table-card">
          <div style={{ overflowX: "auto" }}>
            <table className="mu-table">
              <thead>
                <tr>
                  {[
                    { label: "No", cls: "center", w: "4%" },
                    { label: "Pengguna", cls: "", w: "26%" },
                    { label: "Email", cls: "", w: "22%" },
                    { label: "Role", cls: "center", w: "18%" },
                    { label: "Unit", cls: "", w: "15%" },
                    { label: "Jenis", cls: "center", w: "9%" },
                    { label: "Aksi", cls: "center", w: "10%" },
                  ].map((h, i) => (
                    <th key={i} className={h.cls} style={{ width: h.w }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "56px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>👤</div>
                    <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                      {allUsers.length === 0 ? "Belum Ada User" : "Tidak Ada Hasil"}
                    </div>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                      {allUsers.length === 0 ? "Klik \"+ Tambah User\" untuk memulai." : "Coba ubah filter atau kata kunci."}
                    </div>
                  </td></tr>
                ) : filtered.map((u, idx) => {
                  const unitNama = (u as any).unitNama ?? "—";
                  const roleName = u.role || "—";
                  const atasanNama = (u as any).atasanNama;
                  const jenis = (u as any).jenis || "";
                  const rc = getRoleColor(roleName);
                  const ac = AVATAR_COLORS[u.id % 6];
                  return (
                    <tr key={u.id}>
                      <td style={{ textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: ac.bg, color: ac.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {getInitials(u.nama)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{u.nama}</div>
                            {atasanNama && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>↑ {atasanNama}</div>}
                            {(u as any).nip && <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{(u as any).nip}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "#6b7280", fontSize: 12 }}>{u.email}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{roleName}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "#374151" }}>{unitNama}</td>
                      <td style={{ textAlign: "center" }}>
                        {jenis
                          ? <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{jenis}</span>
                          : <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => openEdit(u)} className="mu-btn-edit">Edit</button>
                          <button onClick={() => setDeleteTarget(u)} className="mu-btn-del">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={7}>Menampilkan <b>{filtered.length}</b> dari <b>{allUsers.length}</b> pengguna</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
