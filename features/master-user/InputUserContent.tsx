"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { createUserAccount, getUnits, Unit } from "@/lib/api";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "#1f2937",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 14,
  color: "#374151",
  backgroundColor: "white",
};

export default function InputUserContent() {
  const [nip, setNip] = useState("");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUnits()
      .then((data) => setUnits(data))
      .catch(() => setUnits([]));
  }, []);

  const resetForm = () => {
    setNip("");
    setNama("");
    setEmail("");
    setPassword("");
    setRole("");
    setUnitId("");
  };

  const handleSubmit = async () => {
    if (!nip.trim()) {
      alert("NIP wajib diisi");
      return;
    }
    if (!nama.trim() || !email.trim() || !password.trim() || !role) {
      alert("Nama, email, password, dan role wajib diisi");
      return;
    }

    setSaving(true);
    try {
      await createUserAccount({
        nip: nip.trim() || undefined,
        nama: nama.trim(),
        email: email.trim(),
        password,
        role,
        unitId: unitId === "" ? null : Number(unitId),
      });

      alert("User berhasil disimpan");
      resetForm();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Gagal menyimpan user";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageTransition>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 14 }}>
          <span style={{ color: "#FF7900", fontWeight: 500 }}>Master User</span>
          <span style={{ color: "#9ca3af" }}>{">"}</span>
          <span style={{ color: "#16a34a", fontWeight: 500 }}>Input User</span>
        </div>

        <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 20 }} />

        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#111827", marginBottom: 18, lineHeight: 1.1 }}>
          Input User
        </h1>

        <div
          style={{
            backgroundColor: "#f5f6f7",
            borderRadius: 10,
            padding: 24,
            minHeight: 520,
            border: "1px solid #eceef0",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
            <div>
              <label style={labelStyle}>NIP</label>
              <input value={nip} onChange={(e) => setNip(e.target.value)} placeholder="Masukkan NIP" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Nama</label>
              <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Masukkan nama" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Masukkan email" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                <option value="">Pilih Role</option>
                <option value="admin">Admin</option>
                <option value="dekan">Dekan</option>
                <option value="wakil_dekan_1">Wakil Dekan 1</option>
                <option value="wakil_dekan_2">Wakil Dekan 2</option>
                <option value="wakil_dekan_3">Wakil Dekan 3</option>
                <option value="kepala_jurusan">Kepala Jurusan</option>
                <option value="koordinator_prodi">Koordinator Prodi</option>
                <option value="dosen">Dosen</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Unit</label>
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
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 26, gap: 10 }}>
            <button
              type="button"
              onClick={resetForm}
              style={{
                backgroundColor: "white",
                border: "1px solid #d1d5db",
                color: "#374151",
                padding: "10px 18px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              style={{
                backgroundColor: saving ? "#9ca3af" : "#16a34a",
                border: "none",
                color: "white",
                padding: "10px 18px",
                borderRadius: 6,
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
