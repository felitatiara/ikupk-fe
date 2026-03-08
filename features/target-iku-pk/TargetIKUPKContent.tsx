"use client";

import { useState } from "react";
import PageTransition from "@/components/layout/PageTransition";

interface SubIndikatorBlock {
  id: number;
  subIndikator: string;
  kriterias: string[];
}

export default function TargetIKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [targetType, setTargetType] = useState("Indikator Kinerja Utama");
  const [nomor, setNomor] = useState("IKU 1");
  const [indikatorKegiatan, setIndikatorKegiatan] = useState("Hasil Lulusan");
  const [sasaranStrategis, setSasaranStrategis] = useState("Meningkatnya kualitas lulusan pendidikan tinggi");
  const [targetUniversitas, setTargetUniversitas] = useState("75%");

  const [blocks, setBlocks] = useState<SubIndikatorBlock[]>([
    {
      id: 1,
      subIndikator: "1.1.1 Hasil Lulusan Mendapatkan Pekerjaan",
      kriterias: [
        "< 6 Bulan dan >1.2 UMP",
        "7 s.d 12 Bulan dan >1.2 UMP",
        "< 6 Bulan dan < 1.2 UMP",
        "7 s.d 12 Bulan dan >1.2 UMP",
      ],
    },
    {
      id: 2,
      subIndikator: "1.1.2 Hasil Lulusan Melanjutkan Studi",
      kriterias: ["Tanpa Kriteria"],
    },
    {
      id: 3,
      subIndikator: "1.1.3 Hasil Lulusan Menjadi Wiraswasta",
      kriterias: [
        "< 6 Bulan dan >1.2 UMP",
        "7 s.d 12 Bulan dan >1.2 UMP",
        "< 6 Bulan dan < 1.2 UMP",
        "7 s.d 12 Bulan dan >1.2 UMP",
      ],
    },
  ]);

  const updateKriteria = (blockId: number, index: number, value: string) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const next = [...block.kriterias];
        next[index] = value;
        return { ...block, kriterias: next };
      })
    );
  };

  const addKriteria = (blockId: number) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? { ...block, kriterias: [...block.kriterias, "Tanpa Kriteria"] }
          : block
      )
    );
  };

  const removeKriteria = (blockId: number, index: number) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        if (block.kriterias.length <= 1) return block;
        return {
          ...block,
          kriterias: block.kriterias.filter((_, i) => i !== index),
        };
      })
    );
  };

  const addSubIndikator = () => {
    setBlocks((prev) => [
      ...prev,
      {
        id: Date.now(),
        subIndikator: "Sub Indikator Baru",
        kriterias: ["Tanpa Kriteria"],
      },
    ]);
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
          Target Indikator Kinerja Utama & Perjanjian Kerja &nbsp; &gt; &nbsp; Pengajuan Target
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Pengajuan Target
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option>Indikator Kinerja Utama</option>
                <option>Perjanjian Kerja</option>
              </select>
            </div>
            <div />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Nomor</label>
              <select
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option>IKU 1</option>
                <option>IKU 2</option>
                <option>IKU 3</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Sasaran Strategis</label>
              <input
                value={sasaranStrategis}
                onChange={(e) => setSasaranStrategis(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Indikator Kinerja Kegiatan</label>
              <input
                value={indikatorKegiatan}
                onChange={(e) => setIndikatorKegiatan(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target Universitas</label>
              <select
                value={targetUniversitas}
                onChange={(e) => setTargetUniversitas(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option>75%</option>
                <option>80%</option>
                <option>85%</option>
              </select>
            </div>
          </div>

          {blocks.map((block) => (
            <div key={block.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 10 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6, color: "#374151", fontWeight: 700 }}>
                  Sub Indikator Kinerja Kegiatan
                </label>
                <select
                  value={block.subIndikator}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((item) =>
                        item.id === block.id ? { ...item, subIndikator: e.target.value } : item
                      )
                    )
                  }
                  style={{ width: "100%", maxWidth: 560, border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#374151" }}
                >
                  <option>{block.subIndikator}</option>
                  <option>Sub Indikator Alternatif 1</option>
                  <option>Sub Indikator Alternatif 2</option>
                </select>
              </div>

              <label style={{ display: "block", fontSize: 11, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Kriteria</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {block.kriterias.map((kriteria, index) => (
                  <div key={`${block.id}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", maxWidth: 660 }}>
                    <select
                      value={kriteria}
                      onChange={(e) => updateKriteria(block.id, index, e.target.value)}
                      style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#374151" }}
                    >
                      <option>{kriteria}</option>
                      <option>Tanpa Kriteria</option>
                      <option>{"< 6 Bulan dan >1.2 UMP"}</option>
                      <option>{"7 s.d 12 Bulan dan >1.2 UMP"}</option>
                      <option>{"< 6 Bulan dan < 1.2 UMP"}</option>
                    </select>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => addKriteria(block.id)}
                        style={{ width: 28, height: 28, border: "none", borderRadius: 4, backgroundColor: "#10b759", color: "white", fontWeight: 800, cursor: "pointer" }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeKriteria(block.id, index)}
                        style={{ width: 28, height: 28, border: "none", borderRadius: 4, backgroundColor: "#b93815", color: "white", fontWeight: 700, cursor: "pointer" }}
                      >
                        -
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={addSubIndikator}
              style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#111827", lineHeight: 1 }}
              title="Tambah Sub Indikator"
            >
              +
            </button>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
