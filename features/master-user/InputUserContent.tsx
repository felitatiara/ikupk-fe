"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PageTransition from "@/components/layout/PageTransition";
import { createUserAccount, getUnits, getUsers, Unit, UnitUser, updateUserAccount, deleteUserAccount } from "@/lib/api";

const ROLE_OPTIONS = ["Superadmin", "Admin", "Pimpinan"];
const JENIS_OPTIONS = ["Dosen", "Tendik", "Administrasi"];

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  Superadmin: { bg: "#f3e8ff", color: "#7c3aed" },
  Admin:      { bg: "#dbeafe", color: "#1d4ed8" },
  Pimpinan:   { bg: "#d1fae5", color: "#15803d" },
  Dosen:      { bg: "#fef9c3", color: "#92400e" },
  Tendik:     { bg: "#fce7f3", color: "#be185d" },
  Kaprodi:    { bg: "#e0f2fe", color: "#0369a1" },
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  fontSize: 13,
  color: "#374151",
  backgroundColor: "white",
  boxSizing: "border-box",
};

interface FormData {
  id?: number;
  nip: string;
  nama: string;
  email: string;
  password: string;
  role: string;
  jenis: string;
  unitId: number | "";
  atasanId: number | "";
}

const blankForm = (): FormData => ({
  nip: "", nama: "", email: "", password: "",
  role: "", jenis: "Dosen", unitId: "", atasanId: "",
});

export default function InputUserContent() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allUsers, setAllUsers] = useState<UnitUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"tambah" | "edit">("tambah");
  const [formData, setFormData] = useState<FormData>(blankForm());
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UnitUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { refreshData(); }, []);

  const refreshData = () => {
    getUnits().then(setUnits).catch(() => setUnits([]));
    getUsers().then(setAllUsers).catch(() => setAllUsers([]));
  };

  const openTambah = () => {
    setFormData(blankForm());
    setModalMode("tambah");
    setModalOpen(true);
  };

  const openEdit = (user: UnitUser) => {
    setFormData({
      id: user.id,
      nip: (user as any).nip || "",
      nama: user.nama,
      email: user.email,
      password: "",
      role: user.role,
      jenis: (user as any).jenis || "Dosen",
      unitId: (user as any).unitId || "",
      atasanId: "",
    });
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nama.trim() || !formData.email.trim() || (!formData.id && !formData.password.trim()) || !formData.role) {
      alert("Nama, email, password (user baru), dan role wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        nip: formData.nip.trim() || undefined,
        nama: formData.nama.trim(),
        email: formData.email.trim(),
        role: formData.role,
        jenis: formData.jenis,
        unitId: formData.unitId === "" ? null : Number(formData.unitId),
        atasanId: formData.atasanId === "" ? null : Number(formData.atasanId),
      };
      if (formData.password.trim()) payload.password = formData.password;
      if (formData.id) {
        await updateUserAccount(formData.id, payload);
      } else {
        await createUserAccount(payload);
      }
      setModalOpen(false);
      refreshData();
    } catch (err) {
      alert("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteUserAccount(deleteTarget.id);
      setDeleteTarget(null);
      refreshData();
    } catch {
      alert("Gagal menghapus user.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = allUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || u.nama.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchQ && matchRole;
  });

  const getUnitNama = (unitId?: number | null) =>
    unitId ? (units.find((u) => u.id === unitId)?.nama ?? `Unit #${unitId}`) : "—";

  return (
    <PageTransition>
      <div>
        {/* Delete Confirm Modal */}
        {deleteTarget && createPortal(
          <div
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => !deleteLoading && setDeleteTarget(null)}
          >
            <div
              style={{ backgroundColor: "white", borderRadius: 12, padding: 28, width: 400, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", boxSizing: "border-box" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937", textAlign: "center" }}>Hapus User</h3>
              <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 8, lineHeight: 1.6 }}>Anda akan menghapus akun:</p>
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 24, textAlign: "center" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1f2937" }}>{deleteTarget.nama}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{deleteTarget.email} &middot; {deleteTarget.role}</p>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="btn-outline">Batal</button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  style={{ padding: "6px 24px", borderRadius: 6, border: "none", backgroundColor: deleteLoading ? "#9ca3af" : "#dc2626", color: "white", fontSize: 13, fontWeight: 600, cursor: deleteLoading ? "not-allowed" : "pointer" }}
                >
                  {deleteLoading ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Add / Edit Modal */}
        {modalOpen && createPortal(
          <div
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={() => !saving && setModalOpen(false)}
          >
            <div
              style={{ backgroundColor: "white", borderRadius: 12, padding: 28, width: 540, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", boxSizing: "border-box" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", textAlign: "center", marginBottom: 4 }}>
                {modalMode === "tambah" ? "Tambah User Baru" : "Edit User"}
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
                {modalMode === "tambah" ? "Lengkapi data untuk membuat akun pengguna baru." : "Perbarui data akun pengguna."}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>NIP</label>
                  <input value={formData.nip} onChange={(e) => setFormData(p => ({ ...p, nip: e.target.value }))} placeholder="Masukkan NIP" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nama Lengkap <span style={{ color: "#ef4444" }}>*</span></label>
                  <input value={formData.nama} onChange={(e) => setFormData(p => ({ ...p, nama: e.target.value }))} placeholder="Masukkan nama" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="Masukkan email" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>
                    Password{formData.id ? <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}> (kosongkan jika tidak ganti)</span> : <span style={{ color: "#ef4444" }}> *</span>}
                  </label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="Masukkan password" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Role <span style={{ color: "#ef4444" }}>*</span></label>
                  <select value={formData.role} onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
                    <option value="">Pilih Role</option>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Jenis Pegawai</label>
                  <select value={formData.jenis} onChange={(e) => setFormData(p => ({ ...p, jenis: e.target.value }))} style={inputStyle}>
                    {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Unit Kerja</label>
                  <select value={formData.unitId} onChange={(e) => setFormData(p => ({ ...p, unitId: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle}>
                    <option value="">Pilih Unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Atasan Langsung</label>
                  <select value={formData.atasanId} onChange={(e) => setFormData(p => ({ ...p, atasanId: e.target.value === "" ? "" : Number(e.target.value) }))} style={inputStyle}>
                    <option value="">Pilih Atasan (Opsional)</option>
                    {allUsers.map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.role})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
                <button onClick={() => setModalOpen(false)} disabled={saving} className="btn-outline">Batal</button>
                <button onClick={handleSave} disabled={saving} className="btn-main" style={{ backgroundColor: saving ? "#9ca3af" : undefined }}>
                  {saving ? "Menyimpan..." : (modalMode === "tambah" ? "Simpan" : "Perbarui")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Main Content */}
        <div>
          <nav className="breadcrumb page" aria-label="Breadcrumb">
            <a href="/admin/master-user">Master User</a>
          </nav>

          <div className="page-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div>
                <h3>Data User</h3>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Kelola akun pengguna dan hak akses sistem.</p>
              </div>
            </div>

            {/* Filters */}
            <div className="filter" style={{ marginBottom: 16 }}>
              <div className="filter-content">
                <label className="filter-content-label">Role</label>
                <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="filter-isi">
                  <option value="all">Semua Role</option>
        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="filter-content">
                <label className="filter-content-label">Cari</label>
                <input
                  type="text"
                  placeholder="Nama / email / role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="filter-isi"
                  style={{ minWidth: 200 }}
                />
              </div>
              <button className="btn-main" style={{ marginLeft: "auto", marginTop: "auto" }} onClick={openTambah}>
                + Tambah User
              </button>
            </div>

            <div className="table-wrapper">
              <table className="table-universal">
                <thead>
                  <tr>
                    <th style={{ width: "4%", textAlign: "center" }}>No</th>
                    <th style={{ width: "12%" }}>NIP</th>
                    <th style={{ width: "20%" }}>Nama</th>
                    <th style={{ width: "22%" }}>Email</th>
                    <th style={{ width: "11%", textAlign: "center" }}>Role</th>
                    <th style={{ width: "10%", textAlign: "center" }}>Jenis</th>
                    <th style={{ width: "15%" }}>Unit Kerja</th>
                    <th style={{ width: "10%", textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#9ca3af" }}>
                        {allUsers.length === 0 ? 'Belum ada user. Klik "+ Tambah User" untuk memulai.' : "Tidak ada user yang cocok dengan filter."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u, idx) => {
                      const roleColor = ROLE_COLOR[u.role] ?? { bg: "#f3f4f6", color: "#374151" };
                      return (
                        <tr key={u.id}>
                          <td style={{ textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ color: "#6b7280", fontSize: 12 }}>{(u as any).nip || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{u.nama}</td>
                          <td style={{ color: "#6b7280", fontSize: 12 }}>{u.email}</td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: roleColor.bg, color: roleColor.color }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>
                            {(u as any).jenis || "Dosen"}
                          </td>
                          <td style={{ fontSize: 12, color: "#374151" }}>{getUnitNama((u as any).unitId)}</td>
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "6px 0" }}>
                              <button onClick={() => openEdit(u)} className="btn-small" style={{ border: "1px solid #86efac", backgroundColor: "#dcfce7", color: "#16a34a" }}>Edit</button>
                              <button onClick={() => setDeleteTarget(u)} className="btn-small" style={{ border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#dc2626" }}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} style={{ fontSize: 12, color: "#9ca3af" }}>
                      Menampilkan {filtered.length} dari {allUsers.length} user.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
