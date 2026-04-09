"use client";

import { useState, useEffect } from "react";
import { getIndikatorGrouped, upsertTargetFakultas, upsertTargetUniversitas } from "../../lib/api";
import type { IndikatorGrouped, IndikatorGroupedSub } from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";
import SuccessModal from "@/components/ui/SuccessModal";
import { useAuth } from "@/hooks/useAuth";

const JENIS_OPTIONS = [
  { value: "IKU", label: "Indikator Kinerja Utama" },
  { value: "PK", label: "Perjanjian Kerja" },
];

export default function TargetIKUPKContent({ role = 'admin' }: { role?: 'admin' | 'dekan' }) {
  const { user } = useAuth();
  const [jenis, setJenis] = useState("IKU");
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [data, setData] = useState<IndikatorGrouped[]>([]);
  // kualitasFakultas state: { [indikatorId]: percentageValue } — for level 2 input
  const [kualitasFakultas, setKualitasFakultas] = useState<Record<number, string>>({});
  // kualitasUniv state: { [subIndikatorId]: percentageValue } — for Biro PKU input per level 1
  const [kualitasUniv, setKualitasUniv] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const unitId = user?.unitId;
  const isFakultas = user?.unitJenis?.toLowerCase() === 'fakultas';
  const isBiroPKU = user?.unitJenis?.toLowerCase() === 'biro';

  useEffect(() => {
    if (!jenis) return;
    let cancelled = false;
    getIndikatorGrouped(jenis, tahun, unitId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Initialize kualitasFakultas from existing targetFakultas on level 2 children
        const init: Record<number, string> = {};
        for (const g of d) {
          for (const sub of g.subIndikators) {
            for (const child of sub.children) {
              if (child.targetFakultas !== null && child.baselineJumlah && Number(child.baselineJumlah) > 0) {
                const pct = (Number(child.targetFakultas) / Number(child.baselineJumlah)) * 100;
                init[child.id] = String(Math.round(pct * 100) / 100);
              } else {
                init[child.id] = "";
              }
            }
          }
        }
        setKualitasFakultas(init);
        // Initialize kualitasUniv from existing targetUniversitas per sub-indikator
        const initUniv: Record<number, string> = {};
        for (const g of d) {
          for (const sub of g.subIndikators) {
            if (sub.targetUniversitas !== null && sub.baselineJumlah && Number(sub.baselineJumlah) > 0) {
              const pct = (Number(sub.targetUniversitas) / Number(sub.baselineJumlah)) * 100;
              initUniv[sub.id] = String(Math.round(pct * 100) / 100);
            } else {
              initUniv[sub.id] = "";
            }
          }
        }
        setKualitasUniv(initUniv);
      })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [jenis, tahun, unitId]);

  const getRowKuantitas = (id: number, baselineJumlah: number | null | undefined): number | null => {
    const pct = parseFloat(kualitasFakultas[id] || "");
    if (isNaN(pct) || baselineJumlah === null || baselineJumlah === undefined) return null;
    return Math.round((pct / 100) * Number(baselineJumlah));
  };

  const getUnivPct = (sub: IndikatorGroupedSub): string => {
    if (sub.targetUniversitas !== null && sub.baselineJumlah && Number(sub.baselineJumlah) > 0) {
      const pct = (Number(sub.targetUniversitas) / Number(sub.baselineJumlah)) * 100;
      return `${Math.round(pct * 100) / 100}`;
    }
    return "-";
  };

  const getUnivKuantitas = (id: number, baselineJumlah: number | null | undefined): number | null => {
    const pct = parseFloat(kualitasUniv[id] || "");
    if (isNaN(pct) || baselineJumlah === null || baselineJumlah === undefined) return null;
    return Math.round((pct / 100) * Number(baselineJumlah));
  };

  const handleSave = async () => {
    if (!unitId) return;
    setSaving(true);
    try {
      if (isBiroPKU) {
        // Biro PKU saves Target Universitas per sub-indikator (level 1)
        for (const group of data) {
          for (const sub of group.subIndikators) {
            const kuantitas = getUnivKuantitas(sub.id, sub.baselineJumlah);
            if (kuantitas === null) continue;
            await upsertTargetUniversitas(sub.id, unitId, tahun, kuantitas);
          }
        }
      }
      if (isFakultas) {
        // Fakultas saves Target Fakultas per level 2 indikator only
        for (const group of data) {
          for (const sub of group.subIndikators) {
            for (const child of sub.children) {
              const childKuantitas = getRowKuantitas(child.id, child.baselineJumlah);
              if (childKuantitas !== null) {
                await upsertTargetFakultas(child.id, unitId, tahun, childKuantitas);
              }
            }
          }
        }
      }
      // Refresh data
      const d = await getIndikatorGrouped(jenis, tahun, unitId);
      setData(d);
      setShowSuccess(true);
    } catch {
      alert("Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  // Build flat rows for the table
  interface FlatRow {
    id: number;
    kode: string;
    nama: string;
    level: number;
    baselineJumlah: number | null;
    subId: number;
    isSubFirst: boolean;
    subChildCount: number;
    sub: IndikatorGroupedSub;
  }

  const buildRows = (group: IndikatorGrouped): FlatRow[] => {
    const rows: FlatRow[] = [];
    for (const sub of group.subIndikators) {
      const childCount = 1 + sub.children.length;
      rows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, baselineJumlah: sub.baselineJumlah, subId: sub.id, isSubFirst: true, subChildCount: childCount, sub });
      for (const child of sub.children) {
        rows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, baselineJumlah: child.baselineJumlah, subId: sub.id, isSubFirst: false, subChildCount: childCount, sub });
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
            {(isFakultas || isBiroPKU) && (
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
            )}
          </div>

          {data.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
                <thead>
                  <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                    <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Nomor</th>
                    <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sasaran Strategis</th>
                    <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sub Indikator Kinerja Utama</th>
                    <th colSpan={isBiroPKU ? 3 : 2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Target Universitas {tahun}</th>
                    {isFakultas && (
                      <th colSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>Target Fakultas</th>
                    )}
                  </tr>
                  <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                    {isBiroPKU ? (
                      <>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 80 }}>Kualitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Kuantitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Waktu</th>

                      </>
                    ) : (
                      <>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 80 }}>Kuantitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: isFakultas ? "1px solid #e5e7eb" : undefined, textAlign: "center", minWidth: 100 }}>Waktu</th>
                      </>
                    )}
                    {isFakultas && (
                      <>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Kualitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "center", minWidth: 120 }}>Kuantitas</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((group, groupIdx) => {
                    const allRows = buildRows(group);
                    const totalRowSpan = allRows.length;

                    return allRows.map((row, rowIdx) => {
                      const rowKuantitas = row.level === 2 ? getRowKuantitas(row.id, row.baselineJumlah) : null;

                      return (
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
                          {/* Target Universitas - per level 1 sub-indikator */}
                          {row.isSubFirst ? (
                            <>
                              <td
                                rowSpan={row.subChildCount}
                                style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}
                              >
                                {isBiroPKU ? (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={kualitasUniv[row.sub.id] ?? ""}
                                      onChange={(e) => setKualitasUniv((prev) => ({ ...prev, [row.sub.id]: e.target.value }))}
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
                                ) : (
                                  row.sub.targetUniversitas !== null ? Number(row.sub.targetUniversitas) : "-"
                                )}
                              </td>
                              {isBiroPKU && (
                                <td
                                  rowSpan={row.subChildCount}
                                  style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}
                                >
                                  {getUnivKuantitas(row.sub.id, row.sub.baselineJumlah) !== null ? getUnivKuantitas(row.sub.id, row.sub.baselineJumlah) : "-"}
                                </td>
                              )}
                              <td
                                rowSpan={row.subChildCount}
                                style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}
                              >
                                Triwulan I
                              </td>
                            </>
                          ) : null}
                          {/* Target Fakultas */}
                          {isFakultas && row.level === 2 ? (
                            <>
                              <td
                                style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb" }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={kualitasFakultas[row.id] ?? ""}
                                    onChange={(e) => setKualitasFakultas((prev) => ({ ...prev, [row.id]: e.target.value }))}
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
                                style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", color: "#374151", fontWeight: 600 }}
                              >
                                {rowKuantitas !== null ? rowKuantitas : "-"}
                              </td>
                            </>
                          ) : isFakultas && row.isSubFirst ? (
                            <>
                              <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                              <td style={{ padding: "10px 12px" }} />
                            </>
                          ) : null}
                        </tr>
                      );
                    });
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
