"use client";

import React, { useEffect, useState, useCallback } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { getValidasiBiroPKU, upsertValidasiBiroPKU, getAvailableYears, type ValidasiBiroPKUItem } from "@/lib/api";
import { getAggregatedProgress, type ProgressChartItem } from "@/services/monitoringService";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_TAHUN = String(new Date().getFullYear());

export default function RealisasiBiroPKUContent() {
  const { user } = useAuth();
  const [selectedJenis, setSelectedJenis] = useState("IKU");
  const [selectedTahun, setSelectedTahun] = useState(DEFAULT_TAHUN);
  const [yearOptions, setYearOptions] = useState<string[]>([DEFAULT_TAHUN]);

  const [indikators, setIndikators] = useState<ProgressChartItem[]>([]);
  const [validasiData, setValidasiData] = useState<ValidasiBiroPKUItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [inputJumlah, setInputJumlah] = useState("");
  const [inputKeterangan, setInputKeterangan] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAvailableYears()
      .then((years) => {
        const cy = new Date().getFullYear();
        const merged = [...new Set([...years, String(cy - 1), String(cy), String(cy + 1)])].sort();
        setYearOptions(merged);
        if (merged.includes(DEFAULT_TAHUN)) setSelectedTahun(DEFAULT_TAHUN);
        else setSelectedTahun(merged[merged.length - 1]);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [items, validasi] = await Promise.all([
        getAggregatedProgress(selectedTahun, selectedJenis),
        getValidasiBiroPKU(selectedTahun),
      ]);
      setIndikators(items);
      setValidasiData(validasi.filter((v) => {
        // Only show validasi for the current jenis
        const ind = items.find((i) => i.id === v.indikatorId);
        return ind != null;
      }));
    } catch {
      setIndikators([]);
      setValidasiData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTahun, selectedJenis]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function startEdit(indikator: ProgressChartItem) {
    const existing = validasiData.find((v) => v.indikatorId === indikator.id);
    setEditingId(indikator.id);
    setInputJumlah(existing?.jumlahValid != null ? String(existing.jumlahValid) : "");
    setInputKeterangan(existing?.keterangan ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setInputJumlah("");
    setInputKeterangan("");
  }

  async function handleSave(indikatorId: number) {
    if (!user) return;
    setSaving(true);
    try {
      const saved = await upsertValidasiBiroPKU({
        indikatorId,
        tahun: selectedTahun,
        jumlahValid: inputJumlah === "" ? null : Number(inputJumlah),
        keterangan: inputKeterangan || undefined,
        inputBy: (user as any).id ?? (user as any).userId,
      });
      setValidasiData((prev) => {
        const idx = prev.findIndex((v) => v.indikatorId === indikatorId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setEditingId(null);
    } catch {
      alert("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const submitted = validasiData.filter((v) => v.jumlahValid != null).length;

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Realisasi Biro PKU
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f", marginBottom: 4 }}>
          Input Hasil Realisasi Biro PKU
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
          Submit jumlah data valid yang telah dinilai oleh Biro PKU per indikator.
        </p>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Jenis</label>
            <select
              value={selectedJenis}
              onChange={(e) => setSelectedJenis(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
            >
              <option value="IKU">Indikator Kinerja Utama (IKU)</option>
              <option value="PK">Perjanjian Kinerja (PK)</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Tahun</label>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
            <span style={{ fontWeight: 700, color: "#0369a1" }}>{submitted}</span>
            {" "}dari{" "}
            <span style={{ fontWeight: 700 }}>{indikators.length}</span>
            {" "}indikator sudah disubmit
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {loading ? (
            <p style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data...</p>
          ) : indikators.length === 0 ? (
            <p style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada indikator untuk {selectedJenis} {selectedTahun}.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    { label: "Kode", w: "7%" },
                    { label: "Indikator", w: "auto" },
                    { label: "Realisasi Diajukan", w: "13%" },
                    { label: "Hasil Biro PKU", w: "13%" },
                    { label: "Keterangan", w: "20%" },
                    { label: "Aksi", w: "10%" },
                  ].map((h) => (
                    <th key={h.label} style={{ width: h.w, padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#374151", borderBottom: "2px solid #e2e8f0", textAlign: h.label === "Indikator" || h.label === "Keterangan" ? "left" : "center" }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indikators.map((ind) => {
                  const val = validasiData.find((v) => v.indikatorId === ind.id);
                  const isEditing = editingId === ind.id;
                  const hasResult = val?.jumlahValid != null;

                  return (
                    <tr key={ind.id} style={{ borderBottom: "1px solid #f0f4f8", background: isEditing ? "#f0f9ff" : "#fff" }}>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: "#0369a1", fontSize: 12 }}>
                        {ind.kode}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1e3a5f", fontWeight: 600 }}>
                        {ind.nama}
                        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginTop: 2 }}>
                          {ind.jenis} · {ind.satuan ?? "—"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: "#374151" }}>
                        <span style={{ fontWeight: 700 }}>{ind.realisasi}</span>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>submisi</div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={inputJumlah}
                            onChange={(e) => setInputJumlah(e.target.value)}
                            placeholder="0"
                            style={{ width: 80, padding: "6px 10px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 13, textAlign: "center", outline: "none" }}
                            autoFocus
                          />
                        ) : hasResult ? (
                          <span style={{ fontWeight: 700, color: "#0369a1", fontSize: 14 }}>{val!.jumlahValid}</span>
                        ) : (
                          <span style={{ color: "#d1d5db" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {isEditing ? (
                          <textarea
                            value={inputKeterangan}
                            onChange={(e) => setInputKeterangan(e.target.value)}
                            placeholder="Catatan dari Biro PKU (opsional)"
                            rows={2}
                            style={{ width: "100%", padding: "6px 10px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 12, resize: "vertical", boxSizing: "border-box" }}
                          />
                        ) : val?.keterangan ? (
                          <span style={{ fontSize: 12, color: "#4b5563" }}>{val.keterangan}</span>
                        ) : (
                          <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <button
                              onClick={() => handleSave(ind.id)}
                              disabled={saving}
                              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#0369a1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
                            >
                              {saving ? "..." : "Simpan"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(ind)}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fafafa", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                          >
                            {hasResult ? "Edit" : "Input"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
