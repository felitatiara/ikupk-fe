"use client";

import { useState, useEffect } from "react";
import { getIndikator, getKriteria, getTargets, getUnits, Indikator, Kriteria, getBaselineDataByIndikatorAndUnit, getTargetUniversitas, saveTargetUniversitas, createTarget } from "../../lib/api";
import type { TargetRow, Unit } from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";

export interface TargetDetail {
  id: number;
  tenggat: string;
  targetNama: string;
  sasaranStrategis: string;
  capaian: string;
  unitNama: string;
  tahun: string;
  targetAngka: number;
}

export interface SubIndikatorBlock {
  id: number;
  indikatorId: number | null;
  subIndikator: string;
  kriterias: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const JENIS_LABEL: Record<string, string> = {
  IKU: "Indikator Kinerja Utama",
  PK: "Perjanjian Kerja",
};

export default function TargetIKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [unitId, setUnitId] = useState<number | "">("")
  const [targetType, setTargetType] = useState("");
  const [nomor, setNomor] = useState("IKU 1");
  const [indikatorKegiatan] = useState("Hasil Lulusan");
  const [persentase, setPersentase] = useState(0);
  const [targetUniversitas, setTargetUniversitas] = useState<number | "">("")

  const [blocks, setBlocks] = useState<SubIndikatorBlock[]>([]);
  const [indikator, setIndikator] = useState<Indikator[]>([]);
  const [kriteria, setKriteria] = useState<Kriteria[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [baselineJumlah, setBaselineJumlah] = useState<number | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    getIndikator().then(setIndikator);
    getKriteria().then(setKriteria);
    getTargets().then(setTargets);
    getUnits().then(setUnits);
  }, []);

  useEffect(() => {
    const selectedIndikator = indikator.find(i => i.level === 1 && i.jenis === targetType && i.kode === nomor);
    if (selectedIndikator && unitId !== "") {
      getBaselineDataByIndikatorAndUnit(selectedIndikator.id, unitId)
        .then(data => setBaselineJumlah(data.length > 0 ? data[0].jumlah : null))
        .catch(() => setBaselineJumlah(null));
    } else {
      setBaselineJumlah(null);
    }
  }, [indikator, nomor, targetType, unitId]);

  // Fetch existing target universitas when nomor changes
  useEffect(() => {
    const selectedIndikator = indikator.find(i => i.level === 1 && i.jenis === targetType && i.kode === nomor);
    if (selectedIndikator) {
      const tahun = new Date().getFullYear().toString();
      getTargetUniversitas(selectedIndikator.id, tahun)
        .then(data => setTargetUniversitas(data ? Number(data.targetAngka) : ""))
        .catch(() => setTargetUniversitas(""));
    } else {
      setTargetUniversitas("");
    }
  }, [indikator, nomor, targetType]);

  useEffect(() => {
    if (indikator.length > 0 && kriteria.length > 0 && targets.length > 0 && blocks.length === 0) {
      setBlocks([{ id: 1, indikatorId: null, subIndikator: "", kriterias: [] }]);
    }
  }, [indikator, kriteria, targets, blocks.length]);

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
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const newKriteria = kriteria && kriteria.length > 0 ? kriteria[0].nama : "Tanpa Kriteria";
        return { ...block, kriterias: [...block.kriterias, newKriteria] };
      })
    );
  };

  const removeKriteria = (blockId: number, index: number) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        if (block.kriterias.length <= 1) return block;
        return { ...block, kriterias: block.kriterias.filter((_, i) => i !== index) };
      })
    );
  };

  const addSubIndikator = () => {
    const newId = blocks.length > 0 ? Math.max(...blocks.map(b => b.id)) + 1 : 1;
    setBlocks((prev) => [...prev, { id: newId, indikatorId: null, subIndikator: "", kriterias: [""] }]);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const selectedIndikator = indikator.find(i => i.level === 1 && i.jenis === targetType && i.kode === nomor);
    if (!selectedIndikator) {
      alert("Pilih Nomor terlebih dahulu");
      return;
    }
    if (targetUniversitas === "") {
      alert("Masukkan Target Universitas");
      return;
    }
    if (unitId === "") {
      alert("Pilih Unit terlebih dahulu");
      return;
    }
    const selectedBlocks = blocks.filter(b => b.indikatorId !== null);
    if (selectedBlocks.length === 0) {
      alert("Pilih minimal satu Sub Indikator Kinerja Kegiatan");
      return;
    }
    setSubmitting(true);
    try {
      const tahun = new Date().getFullYear().toString();
      // Save target universitas
      await saveTargetUniversitas(selectedIndikator.id, tahun, targetUniversitas);
      // Save each sub indikator to target table
      for (const block of selectedBlocks) {
        await createTarget({
          indikatorId: block.indikatorId!,
          unitId: unitId as number,
          tahun,
          targetAngka: 0,
          targetUniversitas: targetUniversitas as number,
        });
      }
      alert("Data berhasil disimpan");
    } catch (err) {
      console.error("Submit error:", err);
      alert("Gagal menyimpan data: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
          Target Indikator Kinerja Utama &amp; Perjanjian Kerja &nbsp; &gt; &nbsp; Pengajuan Target
        </p>
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Pengajuan Target
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
             <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Unit</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option value="">Pilih Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option value="">Pilih Target</option>
                {[...new Set(indikator.map(i => i.jenis))].map((jenis) => (
                  <option key={jenis} value={jenis}>
                    {JENIS_LABEL[jenis] || jenis}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Nomor</label>
              <select
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                <option value="">Pilih Nomor</option>
                {indikator
                  .filter(i => i.level === 1 && i.jenis === targetType)
                  .map((i) => (
                    <option key={i.id} value={i.kode}>{i.kode}</option>
                  ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Sasaran Strategis</label>
              <input
                value={(() => {
                  const selected = indikator.find(i => i.level === 1 && i.jenis === targetType && i.kode === nomor);
                  return selected ? selected.nama : "";
                })()}
                readOnly
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f3f4f6" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target Universitas</label>
              <input
                type="number"
                value={targetUniversitas}
                onChange={e => setTargetUniversitas(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Masukkan target universitas (%)"
                min={0}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Jumlah Target</label>
              <input
                value={baselineJumlah !== null && targetUniversitas !== "" ? targetUniversitas * baselineJumlah / 100 : ""}
                readOnly
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f3f4f6" }}
              />
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
                  onChange={(e) => {
                    const selectedSub = indikator.find(i => i.level === 3 && i.nama === e.target.value);
                    setBlocks((prev) =>
                      prev.map((item) =>
                        item.id === block.id ? { ...item, subIndikator: e.target.value, indikatorId: selectedSub ? selectedSub.id : null, kriterias: [""] } : item
                      )
                    );
                  }}
                  style={{ width: "100%", maxWidth: 560, border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#374151" }}
                >
                  <option value="">Pilih Sub Indikator</option>
                  {indikator
                    .filter(i => i.level === 3 && i.jenis === targetType)
                    .map((i) => (
                      <option key={i.id} value={i.nama}>{i.nama}</option>
                    ))}
                </select>
              </div>

              {block.indikatorId && (
                <>
                  <label style={{ display: "block", fontSize: 11, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Kriteria</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {kriteria
                      .filter(k => k.indikatorId === block.indikatorId)
                      .map((k) => (
                        <div key={k.id} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, color: "#374151", backgroundColor: "#f9fafb" }}>
                          {k.nama}
                        </div>
                      ))}
                    {kriteria.filter(k => k.indikatorId === block.indikatorId).length === 0 && (
                      <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                        Belum ada kriteria
                      </div>
                    )}
                  </div>
                </>
              )}
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

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                backgroundColor: submitting ? "#9ca3af" : "#FF7900",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 28px",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Menyimpan..." : "Submit"}
            </button>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
