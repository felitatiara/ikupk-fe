"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageTransition from "@/components/layout/PageTransition";
import { getPendingFakultas, submitTargetFakultas, getTargetItems, getKriteria } from "@/lib/api";
import type { PendingFakultasRow, Kriteria, TargetItem } from "@/lib/api";

interface TargetRow {
  id: number;
  indikatorId: number;
  waktuCapaian: string;
  target: string;
  sasaranStrategis: string;
  targetAngka: number;
  targetUniversitas: number;
  status: string;
}

interface TargetItemEditable extends TargetItem {
  inputValue: string;
}

export default function UserTargetContent() {
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");

  // Form view state
  const [formMode, setFormMode] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TargetRow | null>(null);
  const [targetItems, setTargetItems] = useState<TargetItemEditable[]>([]);
  const [allKriterias, setAllKriterias] = useState<Kriteria[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [unitId, setUnitId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userStr = sessionStorage.getItem("user");
      if (!userStr) return;
      const user = JSON.parse(userStr);
      setUnitId(user.unitId);
      const data: PendingFakultasRow[] = await getPendingFakultas(user.unitId);
      setRows(data.map((item) => ({
        id: item.id,
        indikatorId: item.indikatorId,
        waktuCapaian: item.tahun,
        target: item.target,
        sasaranStrategis: item.sasaranStrategis,
        targetAngka: item.targetAngka,
        targetUniversitas: item.targetUniversitas,
        status: "Menunggu Target Fakultas",
      })));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form mode handlers
  const handleInputTarget = async (row: TargetRow) => {
    setSelectedRow(row);
    setTargetItems([]);
    try {
      const [items, krData] = await Promise.all([
        getTargetItems(unitId!, row.indikatorId, row.waktuCapaian),
        getKriteria(),
      ]);
      setAllKriterias(krData);
      setTargetItems(items.map(item => ({ ...item, inputValue: String(item.targetAngka || "") })));
    } catch { /* ignore */ }
    setFormMode(true);
  };

  const handleBack = () => {
    setFormMode(false);
    setSelectedRow(null);
    setTargetItems([]);
  };

  const handleSubmit = async () => {
    if (!selectedRow) return;
    const itemsToSubmit = targetItems.filter(it => it.inputValue !== "");
    if (itemsToSubmit.length === 0) {
      toast.warning("Masukkan minimal satu Target Fakultas");
      return;
    }
    setSubmitting(true);
    try {
      const items = itemsToSubmit.map(it => ({
        targetId: it.targetId,
        targetAngka: Number(it.inputValue),
      }));
      await submitTargetFakultas(items);
      toast.success("Target berhasil diajukan");
      handleBack();
      await fetchData();
    } catch {
      toast.error("Gagal mengajukan target");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter options
  const targetOptions = [
    "semua",
    ...Array.from(new Set(rows.map((r) => r.target))).filter(Boolean),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(new Set(rows.map((r) => {
      const match = r.waktuCapaian.match(/\d{4}/);
      return match ? match[0] : "-";
    }))).filter((y) => y !== "-"),
  ];

  const filteredRows = rows.filter((row) => {
    const matchTarget = filterTarget === "semua" || row.target === filterTarget;
    const matchPeriode = filterPeriode === "semua" || row.waktuCapaian.includes(filterPeriode);
    return matchTarget && matchPeriode;
  });

  if (formMode && selectedRow) {
    return (
      <div>
        <PageTransition>
          <p style={{ color: "#FF7900", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            Target Indikator Kinerja Utama &amp; Perjanjian Kinerja &nbsp; &gt; &nbsp;
            <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={handleBack}>Pengajuan Target</span>
          </p>

          <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
              Pengajuan Target
            </h3>

            {/* Target Type (read-only) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target</label>
              <input
                value={selectedRow.target}
                readOnly
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f3f4f6", boxSizing: "border-box" }}
              />
            </div>

            {/* Sasaran Strategis */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Sasaran Strategis</label>
              <input
                value={selectedRow.sasaranStrategis}
                readOnly
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f3f4f6", boxSizing: "border-box" }}
              />
            </div>

            {/* Target Universitas */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target Universitas</label>
              <input
                value={selectedRow.targetUniversitas ? `${selectedRow.targetUniversitas}` : "-"}
                readOnly
                style={{ width: "100%", maxWidth: 200, border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f3f4f6", boxSizing: "border-box" }}
              />
            </div>

            {/* Target Items from DB */}
            {targetItems.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", padding: "12px 0" }}>Tidak ada sub indikator target</p>
            )}

            {targetItems.map((item) => {
              const itemKriterias = allKriterias.filter(k => k.indikatorId === item.indikatorId);

              return (
                <div key={item.targetId} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 12 }}>
                  {/* Sub Indikator (read-only) */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>
                      Sub Indikator Kinerja Kegiatan
                    </label>
                    <input
                      value={`${item.indikatorKode} ${item.indikatorNama}`}
                      readOnly
                      style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", backgroundColor: "#f3f4f6", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Target Fakultas */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target Fakultas</label>
                    <input
                      type="number"
                      min={0}
                      value={item.inputValue}
                      onChange={(e) => setTargetItems(prev => prev.map(it => it.targetId === item.targetId ? { ...it, inputValue: e.target.value } : it))}
                      placeholder="Masukkan target fakultas"
                      style={{ width: "100%", maxWidth: 300, border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Kriteria (read-only) */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Kriteria</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {itemKriterias.length > 0 ? (
                        itemKriterias.map(k => (
                          <div key={k.id} style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, color: "#374151", backgroundColor: "#f9fafb" }}>
                            {k.nama}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                          Belum ada kriteria
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Submit button */}
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
                {submitting ? "Mengajukan..." : "Ajukan"}
              </button>
            </div>
          </div>
        </PageTransition>
      </div>
    );
  }

  // =================== TABLE VIEW ===================
  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Target Indikator Kinerja Utama &amp; Perjanjian Kinerja
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Target IKU dan PK
          </h3>

          {/* Filter bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Target</label>
              <select
                value={filterTarget}
                onChange={(e) => setFilterTarget(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
              >
                {targetOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua" : opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 600 }}>Periode</label>
              <select
                value={filterPeriode}
                onChange={(e) => setFilterPeriode(e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px", fontSize: 13, color: "#374151" }}
              >
                {periodeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "semua" ? "Semua" : opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 20 }}>
            <button
              onClick={() => { setFilterTarget("semua"); setFilterPeriode("semua"); }}
              style={{ background: "white", color: "#10b759", border: "1px solid #10b759", borderRadius: 4, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Reset Filter
            </button>
            <button
              style={{ background: "#10b759", color: "white", border: "none", borderRadius: 4, padding: "8px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Cari
            </button>
          </div>

          {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

          {!loading && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Waktu Capaian</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Target</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Sasaran Strategis</th>
                    <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Status</th>
                    <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 600 }}>{row.waktuCapaian}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{row.target}</td>
                        <td style={{ padding: "10px 12px", color: "#4b5563" }}>{row.sasaranStrategis}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 12px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: "#fff7ed",
                            color: "#c2410c",
                            border: "1px solid #fed7aa",
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <button
                            onClick={() => handleInputTarget(row)}
                            style={{
                              padding: "4px 12px",
                              borderRadius: 4,
                              border: "none",
                              backgroundColor: "#FF7900",
                              color: "white",
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Input Target
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: "#9ca3af" }}>
                        Tidak ada data target
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
