"use client";

import { useState, useEffect } from "react";
import { getIndikatorGrouped, upsertTargetUniversitas } from "../../lib/api";
import type { IndikatorGrouped } from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";
import SuccessModal from "@/components/ui/SuccessModal";

const JENIS_OPTIONS = [
  { value: "IKU", label: "Indikator Kinerja Utama" },
  { value: "PK", label: "Perjanjian Kerja" },
];

const UNIT_ID_FAKULTAS = 1;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function TargetIKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [jenis, setJenis] = useState("IKU");
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [data, setData] = useState<IndikatorGrouped[]>([]);
  // kualitas state: { [indikatorId]: percentageValue }
  const [kualitas, setKualitas] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!jenis) return;
    let cancelled = false;
    getIndikatorGrouped(jenis, tahun)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Initialize kualitas from existing target_universitas
        const init: Record<number, string> = {};
        for (const g of d) {
          if (g.targetUniversitas !== null && g.baselineJumlah && g.baselineJumlah > 0) {
            const pct = (g.targetUniversitas / g.baselineJumlah) * 100;
            init[g.id] = String(Math.round(pct * 100) / 100);
          } else {
            init[g.id] = "";
          }
        }
        setKualitas(init);
      })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [jenis, tahun]);

  const getKuantitas = (group: IndikatorGrouped): number | null => {
    const pct = parseFloat(kualitas[group.id] || "");
    if (isNaN(pct) || group.baselineJumlah === null || group.baselineJumlah === undefined) return null;
    return Math.round((pct / 100) * group.baselineJumlah);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const group of data) {
        const kuantitas = getKuantitas(group);
        if (kuantitas === null) continue;
        await upsertTargetUniversitas(group.id, UNIT_ID_FAKULTAS, tahun, kuantitas);
      }
      // Refresh data
      const d = await getIndikatorGrouped(jenis, tahun);
      setData(d);
      setShowSuccess(true);
    } catch {
      alert("Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  // Build flat rows for the table
  const buildRows = (group: IndikatorGrouped) => {
    const rows: { kode: string; nama: string; level: number }[] = [];
    for (const sub of group.subIndikators) {
      rows.push({ kode: sub.kode, nama: sub.nama, level: 1 });
      for (const child of sub.children) {
        rows.push({ kode: child.kode, nama: child.nama, level: 2 });
      }
    }
    return rows;
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
          Target Indikator Kinerja Utama &amp; Perjanjian Kerja
        </p>
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Target Indikator Kinerja Utama &amp; Perjanjian Kerja
          </h3>

          <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target</label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                {JENIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Tahun</label>
              <select
                value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
              >
                {["2024", "2025", "2026", "2027"].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: saving ? "#9ca3af" : "#e97a1f",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>

          {data.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
                <thead>
                  <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                    <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Nomor</th>
                    <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sasaran Strategis</th>
                    <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sub Indikator Kinerja Utama</th>
                    <th colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>Target Universitas</th>
                  </tr>
                  <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Kualitas</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Kuantitas</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Jangka</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((group, groupIdx) => {
                    const allRows = buildRows(group);
                    const totalRowSpan = allRows.length;
                    const kuantitas = getKuantitas(group);

                    return allRows.map((row, rowIdx) => (
                      <tr key={`${group.id}-${rowIdx}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        {rowIdx === 0 && (
                          <>
                            <td
                              rowSpan={totalRowSpan}
                              style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}
                            >
                              {groupIdx + 1}
                            </td>
                            <td
                              rowSpan={totalRowSpan}
                              style={{ padding: "10px 12px", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}
                            >
                              {group.nama}
                            </td>
                          </>
                        )}
                        <td style={{ padding: "10px 12px", color: "#374151", borderRight: "1px solid #e5e7eb", paddingLeft: row.level === 2 ? 28 : 12 }}>
                          {row.kode} {row.nama}
                        </td>
                        {rowIdx === 0 ? (
                          <>
                            <td
                              rowSpan={totalRowSpan}
                              style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={kualitas[group.id] ?? ""}
                                  onChange={(e) => setKualitas((prev) => ({ ...prev, [group.id]: e.target.value }))}
                                  style={{
                                    width: 60,
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                    fontSize: 13,
                                    textAlign: "center",
                                    color: "#374151",
                                  }}
                                />
                                <span style={{ color: "#374151", fontWeight: 600 }}>%</span>
                              </div>
                            </td>
                            <td
                              rowSpan={totalRowSpan}
                              style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}
                            >
                              {kuantitas !== null ? kuantitas : "-"}
                            </td>
                            <td
                              rowSpan={totalRowSpan}
                              style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", color: "#374151" }}
                            >
                              Triwulan I
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                Menampilkan {data.length} dari {data.length}
              </p>
            </div>
          )}

          {data.length === 0 && (
            <p style={{ color: "#9ca3af", padding: 12, textAlign: "center" }}>Tidak ada data indikator</p>
          )}
        </div>
      </PageTransition>
      <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
    </div>
  );
}
