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

/* helpers */
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
  roleId: number | ""; jenis: string; atasanId: number | "";
}
const blankForm = (): FormData => ({ nip: "", nama: "", email: "", password: "", roleId: "", jenis: "Dosen", atasanId: "" });

export default function InputUserContent() {
  const [allUsers, setAllUsers] = useState<UnitUser[]>([]);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
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

  const selectedRole = allRoles.find(r => r.id === formData.roleId);
  const isStructural = selectedRole ? STRUCTURAL_ROLES.has(selectedRole.name.toLowerCase()) : false;
  const dosenRole = isStructural && selectedRole
    ? allRoles.find(r => r.name.toLowerCase() === "dosen" && r.unitNama === selectedRole.unitNama) : null;

  const handleRoleChange = (roleId: number | "") => {
    const role = allRoles.find(r => r.id === roleId);
    const structural = role ? STRUCTURAL_ROLES.has(role.name.toLowerCase()) : false;
    setFormData(p => ({ ...p, roleId, jenis: structural ? "Dosen" : p.jenis }));
  };

  const openTambah = () => { setFormData(blankForm()); setModalMode("tambah"); setModalOpen(true); };
  const openEdit = (u: UnitUser) => {
    const primaryRoleId = (u as any).roleId ?? (u as any).userRoles?.find((ur: any) => ur.isPrimary)?.roleId ?? (u as any).userRoles?.[0]?.roleId ?? "";
    setFormData({
      id: u.id, nip: (u as any).nip || "", nama: u.nama, email: u.email, password: "",
      roleId: primaryRoleId, jenis: (u as any).jenis || "Dosen", atasanId: (u as any).atasanId ?? ""
    });
    setModalMode("edit"); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nama.trim() || !formData.email.trim()) { toast.error("Nama dan email wajib diisi."); return; }
    if (!formData.id && !formData.password.trim()) { toast.error("Password wajib diisi untuk user baru."); return; }
    if (formData.roleId === "") { toast.error("Role wajib dipilih."); return; }
    setSaving(true);
    try {
      const extraRoleIds: number[] = dosenRole ? [dosenRole.id] : [];
      const payload: any = {
        nip: formData.nip.trim() || undefined, nama: formData.nama.trim(), email: formData.email.trim(),
        roleId: Number(formData.roleId), jenis: formData.jenis, atasanId: formData.atasanId === "" ? null : Number(formData.atasanId),
        ...(extraRoleIds.length ? { extraRoleIds } : {})
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
    return matchQ && matchRole;
  });
  const uniqueRoleNames = Array.from(new Set(allUsers.map(u => u.role).filter(Boolean)));

  /* form input style */
  const fInput: React.CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px",
    fontSize: 13, color: "#111", width: "100%", background: "#fff", outline: "none", boxSizing: "border-box"
  };
  const fLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 };

  return (
    <PageTransition>
      <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

        {/* ── Delete Confirm ── */}
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
              <h5 style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 4px", color: "#111" }}>Hapus User?</h5>
              <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>Akun ini akan dihapus permanen.</p>
              <div style={{
                background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10,
                padding: "14px 16px", textAlign: "center", marginBottom: 24
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
                  <div style={{
                    ...AVATAR_COLORS[deleteTarget.id % 6], width: 32, height: 32, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                    background: AVATAR_COLORS[deleteTarget.id % 6].bg, color: AVATAR_COLORS[deleteTarget.id % 6].text
                  }}>
                    {getInitials(deleteTarget.nama)}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{deleteTarget.nama}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{deleteTarget.email}</div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                  style={{
                    padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff",
                    fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151"
                  }}>Batal</button>
                <button onClick={handleDelete} disabled={deleteLoading}
                  style={{
                    padding: "8px 22px", borderRadius: 8, border: "none", background: "#dc2626",
                    fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff"
                  }}>
                  {deleteLoading ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* ── Add / Edit Modal ── */}
        {modalOpen && createPortal(
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
          }}
            onClick={() => !saving && setModalOpen(false)}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "32px 28px", width: 560, maxWidth: "94vw",
              maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
            }}
              onClick={e => e.stopPropagation()}>
              {/* Modal header */}
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
                  <label style={fLabel}>Role <span style={{ color: "#ef4444" }}>*</span></label>
                  <select style={fInput} value={formData.roleId}
                    onChange={e => handleRoleChange(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">— Pilih Role —</option>
                    {allRoles.map(r => <option key={r.id} value={r.id}>{r.name}{r.unitNama ? ` — ${r.unitNama}` : ""}</option>)}
                  </select>
                  {selectedRole?.unitNama && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "3px 10px", borderRadius: 20 }}>{selectedRole.unitNama}</span>
                      {isStructural && <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>+ Dosen{dosenRole ? "" : " (role Dosen belum ada)"}</span>}
                    </div>
                  )}
                </div>
                <div className="col-6">
                  <label style={fLabel}>Jenis Pegawai</label>
                  <select style={{ ...fInput, background: isStructural ? "#f9fafb" : "#fff", color: isStructural ? "#9ca3af" : "#111" }}
                    value={formData.jenis} onChange={e => setFormData(p => ({ ...p, jenis: e.target.value }))} disabled={isStructural}>
                    {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                  {isStructural && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>✓ Otomatis sebagai Dosen</div>}
                </div>
                <div className="col-6">
                  <label style={fLabel}>Atasan Langsung</label>
                  <select style={fInput} value={formData.atasanId}
                    onChange={e => setFormData(p => ({ ...p, atasanId: e.target.value === "" ? "" : Number(e.target.value) }))}>
                    <option value="">— Opsional —</option>
                    {allUsers.filter(u => u.id !== formData.id).map(u => <option key={u.id} value={u.id}>{u.nama} ({u.role})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 24, paddingTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setModalOpen(false)} disabled={saving}
                  style={{
                    padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff",
                    fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151"
                  }}>Batal</button>
                <button onClick={handleSave} disabled={saving}
                  style={{
                    padding: "8px 22px", borderRadius: 8, border: "none", background: "#16a34a",
                    fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff"
                  }}>
                  {saving ? "Menyimpan..." : modalMode === "tambah" ? "Simpan" : "Perbarui"}
                </button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* ── Page Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 className="ikupk-card-title">Master User</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Kelola akun pengguna dan hak akses sistem.</p>
          </div>
          <button onClick={openTambah}
            style={{
              padding: "9px 20px", borderRadius: 8, border: "none", background: "#FF7900",
              fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#fff", whiteSpace: "nowrap"
            }}>
            + Tambah User
          </button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="row g-3 mb-4">
          {[
            { label: "Total User", value: allUsers.length, color: "#2563eb" },
            { label: "Dosen", value: allUsers.filter(u => ((u as any).jenis || "").toLowerCase() === "dosen").length, color: "#7c3aed" },
            { label: "Tendik", value: allUsers.filter(u => ((u as any).jenis || "").toLowerCase() === "tendik").length, color: "#16a34a" },
            { label: "Ditampilkan", value: filtered.length, color: "#ea580c" },
          ].map((s, i) => (
            <div className="col-6 col-md-3" key={i}>
              <div style={{
                background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12,
                padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter & Search ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Role</div>
            <select style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#374151", background: "#fff", outline: "none", minWidth: 160 }}
              value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="all">Semua Role</option>
              {uniqueRoleNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Cari</div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Nama, email, atau role..."
              style={{
                border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#374151",
                background: "#fff", outline: "none", minWidth: 220
              }} />
          </div>
        </div>

        {/* ── Table Card ── */}
        <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>
                  {[
                    { label: "No", center: true, w: "4%" },
                    { label: "Pengguna", center: false, w: "26%" },
                    { label: "Email", center: false, w: "22%" },
                    { label: "Role", center: true, w: "18%" },
                    { label: "Unit", center: false, w: "15%" },
                    { label: "Jenis", center: true, w: "9%" },
                    { label: "Aksi", center: true, w: "10%" },
                  ].map((h, i) => (
                    <th key={i} style={{
                      padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af",
                      textTransform: "uppercase", letterSpacing: "0.06em", textAlign: h.center ? "center" : "left",
                      whiteSpace: "nowrap", width: h.w
                    }}>{h.label}</th>
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
                    <tr key={u.id} style={{ borderBottom: "1px solid #f8f8f8", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "13px 16px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9, background: ac.bg, color: ac.text,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0
                          }}>
                            {getInitials(u.nama)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{u.nama}</div>
                            {atasanNama && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>↑ {atasanNama}</div>}
                            {(u as any).nip && <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{(u as any).nip}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "13px 16px", color: "#6b7280", fontSize: 12 }}>{u.email}</td>
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        <span style={{
                          background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700,
                          padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap"
                        }}>{roleName}</span>
                      </td>
                      <td style={{ padding: "13px 16px", fontSize: 12, color: "#374151" }}>{unitNama}</td>
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        {jenis ? <span style={{
                          background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 600,
                          padding: "3px 10px", borderRadius: 20
                        }}>{jenis}</span> : <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => openEdit(u)}
                            style={{
                              padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: "1px solid #e5e7eb", background: "#fff", color: "#374151"
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "#d1d5db")}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                            Edit
                          </button>
                          <button onClick={() => setDeleteTarget(u)}
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
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid #f0f0f0", background: "#fafafa" }}>
                    <td colSpan={7} style={{ padding: "10px 16px", fontSize: 12, color: "#9ca3af" }}>
                      Menampilkan <b>{filtered.length}</b> dari <b>{allUsers.length}</b> pengguna
                    </td>
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
