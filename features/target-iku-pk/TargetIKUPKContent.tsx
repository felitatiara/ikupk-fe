"use client";

import { useState, useEffect, Fragment } from "react";
import { getIndikatorGrouped, upsertTargetFakultas, upsertTargetUniversitas } from "../../lib/api";
import type { IndikatorGrouped, IndikatorGroupedSub } from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";
import SuccessModal from "@/components/ui/SuccessModal";
import { useAuth } from "@/hooks/useAuth";

const JENIS_OPTIONS = [
  { value: "IKU", label: "Indikator Kinerja Utama" },
  { value: "PK", label: "Perjanjian Kerja" },
];

export default function TargetIKUPKContent({ role = 'admin' }: { role?: 'admin' | 'pimpinan' }) {
  const { user } = useAuth();
  const [jenis, setJenis] = useState("IKU");
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [data, setData] = useState<IndikatorGrouped[]>([]);
  // kualitasFakultas state: { [indikatorId]: percentageValue } — for level 2 input
  const [kualitasFakultas, setKualitasFakultas] = useState<Record<number, string>>({});
  // univTargetValue: { [sasaranId]: quantityValue } — for Super Admin input per level 0
  const [univTargetValue, setUnivTargetValue] = useState<Record<number, string>>({});
  const [univTargetWaktu, setUnivTargetWaktu] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const unitId = user?.unitId;
  const userRole = user?.role?.toLowerCase() || '';
  const isFakultas = user?.unitJenis?.toLowerCase() === 'fakultas';
  // Super Admin & Admin di Fakultas Ilmu Komputer (unit_id = 1) mendapat fitur Target Universitas
  const isSuperAdminFIK = (userRole === 'superadmin' || userRole === 'admin') && Number(unitId) === 1;

  useEffect(() => {
    if (!jenis) return;
    let cancelled = false;
    getIndikatorGrouped(jenis, tahun, unitId)
      .then((d) => {
        if (cancelled) return;
        setData(d);

        const initFak: Record<number, string> = {};
        const initUniv: Record<number, string> = {};
        const initWaktu: Record<number, string> = {};

        for (const g of d) {
          initUniv[g.id] = g.targetUniversitas !== null ? String(g.targetUniversitas) : "";
          initWaktu[g.id] = g.tenggat || "Triwulan I";

          for (const sub of g.subIndikators) {
            // Effective baseline: use l1 if available, else use group (Level 0)
            const effectiveBaseline = sub.baselineJumlah ?? g.baselineJumlah;

            // Initialization for Target Fakultas
            if (sub.targetFakultas !== null && effectiveBaseline && Number(effectiveBaseline) > 0) {
              const pct = (Number(sub.targetFakultas) / Number(effectiveBaseline)) * 100;
              initFak[sub.id] = String(Math.round(pct * 100) / 100);
            } else {
              initFak[sub.id] = "";
            }
          }
        }
        setKualitasFakultas(initFak);
        setUnivTargetValue(initUniv);
        setUnivTargetWaktu(initWaktu);
      })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [jenis, tahun, unitId]);

  const getRowKuantitas = (id: number, baselineJumlah: number | null | undefined): number | null => {
    const pct = parseFloat(kualitasFakultas[id] || "");
    if (isNaN(pct) || baselineJumlah === null || baselineJumlah === undefined) return null;
    return Math.round((pct / 100) * Number(baselineJumlah));
  };

  const handleSave = async () => {
    if (!unitId) return;
    setSaving(true);
    try {
      // No longer saving Target Universitas here. It is managed in Master Indikator.
      if (isFakultas || isSuperAdminFIK) {
        // Both Admin and SuperAdmin FIK save Target Fakultas per level 1 indikator
        for (const group of data) {
          for (const sub of group.subIndikators) {
            const effectiveBaseline = sub.baselineJumlah ?? group.baselineJumlah;
            const kuantitas = getRowKuantitas(sub.id, effectiveBaseline);
            if (kuantitas !== null) {
              await upsertTargetFakultas(sub.id, unitId, tahun, kuantitas);
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


  return (
    <div>
      <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
      <PageTransition>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="/admin/target-iku-pk">Target Indikator Kinerja Utama &amp; Perjanjian Kerja</a>
        </nav>

        <div className="page-card">
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Target Indikator Kinerja Utama &amp; Perjanjian Kerja
          </h3>

          <div className="filter" style={{ marginBottom: 20 }}>
            <div className="filter-content">
              <label className="filter-content-label">Target</label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="filter-isi"
              >
                {JENIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="filter-content">
              <label className="filter-content-label">Tahun</label>
              <select
                value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                className="filter-isi"
              >
                {["2024", "2025", "2026", "2027"].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {(isFakultas || isSuperAdminFIK) && (
              <div className="filter-content" style={{ justifyContent: 'flex-end', marginLeft: 'auto' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-main"
                  style={{ height: 38 }}
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            )}
          </div>

          <div className="table-wrapper">
            {data.length > 0 ? (
              <table className="table-universal">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: "5%" }}>Nomor</th>
                    <th rowSpan={2} style={{ width: "20%" }}>Sasaran Strategis</th>
                    <th rowSpan={2} style={{ width: "35%", minWidth: 250 }}>Indikator Kinerja Utama</th>
                    <th colSpan={2}>Target Universitas {tahun}</th>
                    <th colSpan={2}>Target Fakultas</th>
                  </tr>
                  <tr>
                    <th style={{ width: 100 }}>Kuantitas</th>
                    <th style={{ width: 100 }}>Waktu</th>
                    <th style={{ width: 100 }}>Kualitas (%)</th>
                    <th style={{ width: 120 }}>Kuantitas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((group, groupIdx) => {
                    const l1Items = group.subIndikators;
                    const groupRows = l1Items.reduce((acc, curr) => acc + 1 + curr.children.length, 0);

                    return l1Items.flatMap((l1, l1Idx) => {
                      const children = l1.children || [];
                      const totalSubRows = 1 + children.length;

                      const baseVal = l1.baselineJumlah ?? group.baselineJumlah;
                      const effectiveBaseline = baseVal !== null && baseVal !== undefined ? Number(baseVal) : null;
                      const rowKuantitas = getRowKuantitas(l1.id, effectiveBaseline);

                      const l1Row = (
                        <tr key={l1.id}>
                          {l1Idx === 0 && (
                            <>
                              <td
                                rowSpan={groupRows}
                                className="text-center vertical-top"
                                style={{ fontWeight: 700 }}
                              >
                                {groupIdx + 1}
                              </td>
                              <td
                                rowSpan={groupRows}
                                className="vertical-top"
                                style={{ fontWeight: 600, color: "#374151" }}
                              >
                                {group.nama}
                              </td>
                            </>
                          )}

                          <td style={{ fontWeight: 600 }}>
                            {l1.kode} {l1.nama}
                            {l1.isPkBerbasisIku && jenis === "PK" && (
                              <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, backgroundColor: "#eff6ff", color: "#2563eb", fontSize: 10, fontWeight: 700, border: "1px solid #93c5fd", verticalAlign: "middle" }}>
                                Berbasis IKU
                              </span>
                            )}
                          </td>

                          {/* Merged Target Univ Columns: Only on first Level 1 row of the group */}
                          {l1Idx === 0 && (
                            <>
                              <td
                                rowSpan={groupRows}
                                className="text-center"
                                style={{ fontWeight: 600, color: "#1f2937" }}
                              >
                                {group.targetUniversitas !== null ? group.targetUniversitas : "-"}
                              </td>
                              <td
                                rowSpan={groupRows}
                                className="text-center"
                                style={{ color: "#4b5563" }}
                              >
                                {group.tenggat || "Triwulan I"}
                              </td>
                            </>
                          )}

                          <td rowSpan={totalSubRows} className="text-center">
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={kualitasFakultas[l1.id] ?? ""}
                                  onChange={(e) => setKualitasFakultas((prev) => ({ ...prev, [l1.id]: e.target.value }))}
                                  style={{
                                    width: 60,
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                    fontSize: 13,
                                    textAlign: "center",
                                  }}
                                />
                                <span style={{ fontWeight: 600 }}>%</span>
                              </div>
                              {effectiveBaseline !== null && effectiveBaseline > 0 && (
                                <span style={{ fontSize: 10, color: "#6b7280" }}>
                                  Acuan: {effectiveBaseline}
                                </span>
                              )}
                            </div>
                          </td>

                          <td rowSpan={totalSubRows} className="text-center" style={{ fontWeight: 600 }}>
                            {rowKuantitas !== null ? `${rowKuantitas} Lulusan` : "-"}
                          </td>
                        </tr>
                      );

                      const l2Rows = children.map((l2) => (
                        <tr key={l2.id}>
                          <td style={{ color: "#6b7280", paddingLeft: 24, fontSize: 12 }}>
                            {l2.kode} {l2.nama}
                          </td>
                        </tr>
                      ));

                      return [l1Row, ...l2Rows];
                    });
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "#9ca3af", padding: 24, textAlign: "center" }}>
                Tidak ada data indikator untuk ditampilkan.
              </p>
            )}
          </div>
        </div>
      </PageTransition>
      <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} />
    </div>
  );
}
