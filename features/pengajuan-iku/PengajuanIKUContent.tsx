"use client";

import { useState } from "react";
import PageTransition from "@/components/layout/PageTransition";

interface PengajuanIKUContentProps {
  role?: 'admin' | 'user';
}

export default function PengajuanIKUContent({ role = 'user' }: PengajuanIKUContentProps) {
  const [formData, setFormData] = useState({
    nama: '',
    kode: '',
    jenis: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submit:', formData);
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Pengajuan Indikator Kinerja
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", maxWidth: 600 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Buat Pengajuan IKU Baru
          </h3>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Nama Indikator
              </label>
              <input
                type="text"
                name="nama"
                value={formData.nama}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Kode Indikator
              </label>
              <input
                type="text"
                name="kode"
                value={formData.kode}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                Jenis Indikator
              </label>
              <select
                name="jenis"
                value={formData.jenis}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                required
              >
                <option value="">Pilih Jenis</option>
                <option value="iku">IKU</option>
                <option value="pk">PK</option>
              </select>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: "#16a34a", color: "white", padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              Ajukan
            </button>
          </form>
        </div>
      </PageTransition>
    </div>
  );
}
