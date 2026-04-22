"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { createUserAccount, getUnits, getUsers, Unit, UnitUser, updateUserAccount, deleteUserAccount } from "@/lib/api";
import { Search, Plus, Edit2, Trash2, ChevronLeft } from "lucide-react";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  color: "#1f2937",
  backgroundColor: "white",
  transition: "border-color 0.2s",
};

export default function InputUserContent() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);

  const [nip, setNip] = useState("");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [jenis, setJenis] = useState("Dosen");
  const [unitId, setUnitId] = useState<number | "">("");
  const [atasanId, setAtasanId] = useState<number | "">("");
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [allUsers, setAllUsers] = useState<UnitUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    getUnits().then(setUnits).catch(() => setUnits([]));
    getUsers().then(setAllUsers).catch(() => setAllUsers([]));
  };

  const resetForm = () => {
    setNip("");
    setNama("");
    setEmail("");
    setPassword("");
    setRole("");
    setJenis("Dosen");
    setUnitId("");
    setAtasanId("");
    setEditId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setView("form");
  };

  const handleEdit = (user: any) => {
    setEditId(user.id);
    setNip(user.nip || "");
    setNama(user.nama);
    setEmail(user.email);
    setPassword(""); // Keep password empty for security, optional update
    setRole(user.role);
    setJenis(user.jenis || "Dosen");
    setUnitId(user.unitId || "");
    // Find atasan if possible, needs backend relation check or mapping
    setAtasanId(""); 
    setView("form");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) return;
    try {
      await deleteUserAccount(id);
      alert("User berhasil dihapus");
      refreshData();
    } catch (error) {
      alert("Gagal menghapus user");
    }
  };

  const handleSubmit = async () => {
    if (!nama.trim() || !email.trim() || (!editId && !password.trim()) || !role) {
      alert("Nama, email, password (untuk user baru), dan role wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nip: nip.trim() || undefined,
        nama: nama.trim(),
        email: email.trim(),
        role,
        jenis,
        unitId: unitId === "" ? null : Number(unitId),
        atasanId: atasanId === "" ? null : Number(atasanId),
      };
      
      if (password.trim()) payload.password = password;

      if (editId) {
        await updateUserAccount(editId, payload);
        alert("User berhasil diperbarui");
      } else {
        await createUserAccount(payload);
        alert("User berhasil disimpan");
      }

      resetForm();
      setView("list");
      refreshData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Gagal menyimpan user";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition>
      <div>
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500 font-medium">
          <a href="#" onClick={(e) => { e.preventDefault(); setView("list"); }} className="hover:text-blue-600 transition-colors">Master User</a>
          {view === "form" && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900">{editId ? "Edit User" : "Tambah User"}</span>
            </>
          )}
        </nav>

        {view === "list" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Data User</h3>
                <p className="text-sm text-gray-500 mt-1">Kelola akun pengguna dan hak akses sistem.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Cari user..." 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleAddNew}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Tambah User
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">No</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">NIP / Nama</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role / Jenis</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.length > 0 ? filteredUsers.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-gray-500 font-medium">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">{(u as any).nip || '-'}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{u.nama}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                          {u.role}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">{(u as any).jenis || 'Dosen'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEdit(u)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(u.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        Tidak ada data user ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setView("list")}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-500"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{editId ? "Edit User" : "Input User Baru"}</h3>
                <p className="text-sm text-gray-500 mt-1">Lengkapi data berikut untuk {editId ? "memperbarui" : "menambah"} akun.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <label style={labelStyle}>NIP</label>
                <input value={nip} onChange={(e) => setNip(e.target.value)} placeholder="Masukkan NIP" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nama Lengkap</label>
                <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Masukkan nama" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Masukkan email" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Password {editId && "(Biarkan kosong jika tidak ingin ganti)"}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                  <option value="">Pilih Role</option>
                  <option value="Superadmin">Superadmin</option>
                  <option value="Admin">Admin</option>
                  <option value="Pimpinan">Pimpinan</option>
                  <option value="Dosen">Dosen</option>
                  <option value="Tendik">Tendik</option>
                  <option value="Kaprodi">Kaprodi</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Jenis Pegawai</label>
                <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={inputStyle}>
                  <option value="Dosen">Dosen</option>
                  <option value="Tendik">Tendik</option>
                  <option value="Administrasi">Administrasi</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Unit Kerja</label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value === "" ? "" : Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value="">Pilih Unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Atasan Langsung</label>
                <select
                  value={atasanId}
                  onChange={(e) => setAtasanId(e.target.value === "" ? "" : Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value="">Pilih Atasan (Opsional)</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 mt-12 pt-8 border-t border-gray-50">
              <button
                type="button"
                onClick={() => setView("list")}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className={`px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
                  saving 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                }`}
              >
                {saving ? "Menyimpan..." : (editId ? "Perbarui User" : "Simpan User")}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
