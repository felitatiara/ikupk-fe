"use client";

import { useState } from "react";
import PageTransition from "@/components/layout/PageTransition";

export interface ValidasiData {
  id: number;
  status: string;
  nama: string;
  keterangan: string;
}

export default function ValidasiIKUPKContent() {
  const [data, setData] = useState<ValidasiData[]>([
    {
      id: 1,
      status: 'pending',
      nama: 'IKU - Jumlah Lulusan',
      keterangan: 'Menunggu validasi',
    },
    {
      id: 2,
      status: 'approved',
      nama: 'PK - Kepuasan Pelanggan',
      keterangan: 'Sudah divalidasi',
    },
  ]);

  const handleValidate = (id: number) => {
    console.log('Validating:', id);
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Validasi IKU & PK
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Daftar Data untuk Divalidasi
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Nama</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Keterangan</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "16px", color: "#374151" }}>{item.nama}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: item.status === 'approved' ? '#d1fae5' : '#fef3c7',
                        color: item.status === 'approved' ? '#065f46' : '#92400e'
                      }}>
                        {item.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                      </span>
                    </td>
                    <td style={{ padding: "16px", color: "#374151" }}>{item.keterangan}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        onClick={() => handleValidate(item.id)}
                        style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "6px 12px", borderRadius: 6, border: "1px solid #d1fae5", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
