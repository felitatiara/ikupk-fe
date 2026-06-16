"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import PageTransition from "@/components/layout/PageTransition";
import {
  getValidasiBiroPKU,
  upsertValidasiBiroPKU,
  bulkUpsertValidasiBiroPKU,
  getAvailableYears,
  getIndikatorGrouped,
  getAllRealisasiFiles,
  type ValidasiBiroPKUItem,
  type IndikatorGrouped,
} from "@/lib/api";
import { getAggregatedProgress, type ProgressChartItem } from "@/services/monitoringService";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_TAHUN = String(new Date().getFullYear());

export default function RealisasiBiroPKUContent() {
  const { user, token } = useAuth();
  const [selectedJenis, setSelectedJenis] = useState("IKU");
  const [selectedTahun, setSelectedTahun] = useState(DEFAULT_TAHUN);
  const [yearOptions, setYearOptions] = useState<string[]>([DEFAULT_TAHUN]);

  const [indikators, setIndikators] = useState<ProgressChartItem[]>([]);
  const [validasiData, setValidasiData] = useState<ValidasiBiroPKUItem[]>([]);
  const [grouped, setGrouped] = useState<IndikatorGrouped[]>([]);
  const [folderLinks, setFolderLinks] = useState<Map<number, string | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [inputJumlah, setInputJumlah] = useState("");
  const [inputKeterangan, setInputKeterangan] = useState("");
  const [saving, setSaving] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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
    setFolderLinks(new Map());
    try {
      const [items, validasi, grp] = await Promise.all([
        getAggregatedProgress(selectedTahun, selectedJenis),
        getValidasiBiroPKU(selectedTahun),
        getIndikatorGrouped(selectedJenis, selectedTahun),
      ]);
      setIndikators(items);
      setValidasiData(validasi.filter((v) => items.find((i) => i.id === v.indikatorId) != null));
      setGrouped(grp);

      // Ambil folder link untuk semua leaf indicator secara paralel
      const leafIds: number[] = [];
      for (const g of grp) {
        for (const sub of g.subIndikators) {
          for (const child of sub.children) {
            if (selectedJenis === "IKU") {
              leafIds.push(child.id);
            } else {
              for (const l3 of child.children) leafIds.push(l3.id);
            }
          }
        }
      }

      if (leafIds.length > 0 && token) {
        const results = await Promise.allSettled(
          leafIds.map((id) =>
            getAllRealisasiFiles(id, token).then((r) => ({ id, folderLink: r.folderLink })),
          ),
        );
        const map = new Map<number, string | null>();
        results.forEach((r) => {
          if (r.status === "fulfilled") map.set(r.value.id, r.value.folderLink);
        });
        setFolderLinks(map);
      }
    } catch {
      setIndikators([]);
      setValidasiData([]);
      setGrouped([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTahun, selectedJenis, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function startEdit(indikatorId: number) {
    const existing = validasiData.find((v) => v.indikatorId === indikatorId);
    setEditingId(indikatorId);
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
        inputBy: user?.id,
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

  // ── Export Hierarki ──────────────────────────────────────────────────────────
  async function handleExport() {
    if (indikators.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }
    setExporting(true);
    try {
      // Gunakan folderLinks yang sudah di-fetch saat load
      type Row = (string | number | null)[];
      const COLS: Row = ["No.", "Kode", "Nama Indikator", "Realisasi Diajukan", "Hasil Biro PKU", "Keterangan", "Link Folder"];
      const rows: Row[] = [COLS];
      let no = 0;

      for (const l0 of grouped) {
        const progressItem = indikators.find((i) => i.id === l0.id);
        const val = validasiData.find((v) => v.indikatorId === l0.id);

        rows.push(["", l0.kode, l0.nama, progressItem?.realisasi ?? "", val?.jumlahValid ?? "", val?.keterangan ?? "", ""]);

        for (const sub of l0.subIndikators) {
          rows.push(["", sub.kode, `  ${sub.nama}`, "", "", "", ""]);

          for (const child of sub.children) {
            if (selectedJenis === "IKU") {
              no++;
              rows.push([no, child.kode, `    ${child.nama}`, "", "", "", folderLinks.get(child.id) ?? ""]);
            } else {
              rows.push(["", child.kode, `    ${child.nama}`, "", "", "", ""]);
              for (const l3 of child.children) {
                no++;
                rows.push([no, l3.kode, `      ${l3.nama}`, "", "", "", folderLinks.get(l3.id) ?? ""]);
              }
            }
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 55 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 55 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Verifikasi Biro PKU");
      XLSX.writeFile(wb, `Verifikasi_BiroPKU_${selectedJenis}_${selectedTahun}.xlsx`);
      toast.success("Export berhasil.");
    } catch {
      toast.error("Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (raw.length === 0) {
        toast.error("File Excel kosong atau format tidak sesuai.");
        return;
      }

      const normalize = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, " ");
      const headerMap: Record<string, string> = {};
      Object.keys(raw[0]).forEach((k) => { headerMap[normalize(k)] = k; });

      const kodeKey = headerMap["kode"];
      const hasilKey = headerMap["hasil biro pku"];
      const keteranganKey = headerMap["keterangan"];

      if (!kodeKey || !hasilKey) {
        toast.error('Kolom "Kode" dan "Hasil Biro PKU" wajib ada di file Excel.');
        return;
      }

      const kodeMap = new Map<string, number>(indikators.map((i) => [i.kode.trim(), i.id]));
      const items: Parameters<typeof bulkUpsertValidasiBiroPKU>[0] = [];

      for (const row of raw) {
        const kode = String(row[kodeKey] ?? "").trim();
        const hasilRaw = row[hasilKey];
        const keterangan = keteranganKey ? String(row[keteranganKey] ?? "").trim() : "";
        const indikatorId = kodeMap.get(kode);
        if (!indikatorId) continue;
        const jumlahValid = hasilRaw === "" || hasilRaw == null ? null : isNaN(Number(hasilRaw)) ? null : Number(hasilRaw);
        items.push({ indikatorId, tahun: selectedTahun, jumlahValid, keterangan: keterangan || undefined, inputBy: user?.id });
      }

      if (items.length === 0) {
        toast.error(`Tidak ada baris yang cocok. Pastikan kolom "Kode" sesuai indikator ${selectedJenis} ${selectedTahun}.`);
        return;
      }

      const result = await bulkUpsertValidasiBiroPKU(items);
      toast.success(`Import berhasil: ${result.saved} indikator disimpan${result.skipped > 0 ? `, ${result.skipped} gagal` : ""}.`);
      await fetchData();
    } catch {
      toast.error("Gagal mengimpor file Excel.");
    } finally {
      setImporting(false);
    }
  }

  const submitted = validasiData.filter((v) => v.jumlahValid != null).length;

  // ── Render baris hierarki ───────────────────────────────────────────────────
  function renderRows() {
    if (grouped.length === 0) return null;

    const rows: React.ReactNode[] = [];

    for (const l0 of grouped) {
      const progressItem = indikators.find((i) => i.id === l0.id);
      const val = validasiData.find((v) => v.indikatorId === l0.id);
      const isEditing = editingId === l0.id;
      const hasResult = val?.jumlahValid != null;

      // L0 row — sasaran utama, tempat data verifikasi
      rows.push(
        <tr key={`l0-${l0.id}`} style={{ background: isEditing ? "#f0f9ff" : "#eef2f7", borderBottom: "2px solid #d1dce9" }}>
          <td style={{ padding: "11px 16px", textAlign: "center", fontFamily: "monospace", fontWeight: 800, color: "#1e3a5f", fontSize: 13 }}>
            {l0.kode}
          </td>
          <td style={{ padding: "11px 16px", color: "#1e3a5f", fontWeight: 700, fontSize: 13 }}>
            {l0.nama}
          </td>
          <td style={{ padding: "11px 16px", textAlign: "center", color: "#374151" }}>
            {progressItem != null ? (
              <>
                <span style={{ fontWeight: 700 }}>{progressItem.realisasi}</span>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>submisi</div>
              </>
            ) : <span style={{ color: "#d1d5db" }}>—</span>}
          </td>
          <td style={{ padding: "11px 16px", textAlign: "center" }}>
            {isEditing ? (
              <input
                type="number" min={0} value={inputJumlah}
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
          <td style={{ padding: "11px 16px" }}>
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
          {/* Link Folder — kosong di L0 */}
          <td style={{ padding: "11px 16px", textAlign: "center" }} />
          <td style={{ padding: "11px 16px", textAlign: "center" }}>
            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => handleSave(l0.id)} disabled={saving}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#0369a1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "..." : "Simpan"}
                </button>
                <button onClick={cancelEdit} disabled={saving}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                  Batal
                </button>
              </div>
            ) : (
              <button onClick={() => startEdit(l0.id)}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fafafa", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                {hasResult ? "Edit" : "Input"}
              </button>
            )}
          </td>
        </tr>,
      );

      // L1 rows
      for (const sub of l0.subIndikators) {
        rows.push(
          <tr key={`l1-${sub.id}`} style={{ background: "#f8fafc", borderBottom: "1px solid #edf2f7" }}>
            <td style={{ padding: "9px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>
              {sub.kode}
            </td>
            <td style={{ padding: "9px 16px 9px 32px", color: "#475569", fontSize: 12, fontWeight: 600 }}>
              {sub.nama}
            </td>
            <td colSpan={5} />
          </tr>,
        );

        // L2 rows
        for (const child of sub.children) {
          if (selectedJenis === "IKU") {
            // L2 = leaf IKU
            const link = folderLinks.get(child.id);
            rows.push(
              <tr key={`l2-${child.id}`} style={{ background: "#fff", borderBottom: "1px solid #f3f6fa" }}>
                <td style={{ padding: "8px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                  {child.kode}
                </td>
                <td style={{ padding: "8px 16px 8px 48px", color: "#64748b", fontSize: 12 }}>
                  {child.nama}
                </td>
                <td colSpan={3} />
                <td style={{ padding: "8px 16px", textAlign: "center" }}>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0369a1", fontWeight: 600, textDecoration: "none" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      Folder
                    </a>
                  ) : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                </td>
                <td />
              </tr>,
            );
          } else {
            // L2 = intermediate PK
            rows.push(
              <tr key={`l2-${child.id}`} style={{ background: "#f8fafc", borderBottom: "1px solid #edf2f7" }}>
                <td style={{ padding: "8px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                  {child.kode}
                </td>
                <td style={{ padding: "8px 16px 8px 48px", color: "#475569", fontSize: 12, fontWeight: 500 }}>
                  {child.nama}
                </td>
                <td colSpan={5} />
              </tr>,
            );

            // L3 rows = leaf PK
            for (const l3 of child.children) {
              const link = folderLinks.get(l3.id);
              rows.push(
                <tr key={`l3-${l3.id}`} style={{ background: "#fff", borderBottom: "1px solid #f3f6fa" }}>
                  <td style={{ padding: "7px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
                    {l3.kode}
                  </td>
                  <td style={{ padding: "7px 16px 7px 64px", color: "#64748b", fontSize: 12 }}>
                    {l3.nama}
                  </td>
                  <td colSpan={3} />
                  <td style={{ padding: "7px 16px", textAlign: "center" }}>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0369a1", fontWeight: 600, textDecoration: "none" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        Folder
                      </a>
                    ) : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                  </td>
                  <td />
                </tr>,
              );
            }
          }
        }
      }
    }

    return rows;
  }

  return (
    <div>
      <PageTransition>
        <h3 className="ikupk-card-title">
          Input Hasil Verifikasi Biro PKU
        </h3>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Jenis</label>
            <select value={selectedJenis} onChange={(e) => setSelectedJenis(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
              <option value="IKU">Indikator Kinerja Utama (IKU)</option>
              <option value="PK">Perjanjian Kinerja (PK)</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Tahun</label>
            <select value={selectedTahun} onChange={(e) => setSelectedTahun(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleExport} disabled={loading || exporting || grouped.length === 0}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: loading || exporting || grouped.length === 0 ? "not-allowed" : "pointer", opacity: loading || exporting || grouped.length === 0 ? 0.5 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exporting ? "Mengekspor..." : "Export Excel"}
            </button>
            <button onClick={() => importRef.current?.click()} disabled={importing || loading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "none", background: "#0369a1", fontSize: 13, fontWeight: 600, color: "#fff", cursor: importing || loading ? "not-allowed" : "pointer", opacity: importing || loading ? 0.7 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {importing ? "Mengimpor..." : "Import Excel"}
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
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
          ) : grouped.length === 0 ? (
            <p style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada indikator untuk {selectedJenis} {selectedTahun}.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    { label: "Kode", w: "7%" },
                    { label: "Indikator", w: "auto" },
                    { label: "Realisasi Diajukan", w: "12%" },
                    { label: "Hasil Biro PKU", w: "12%" },
                    { label: "Keterangan", w: "18%" },
                    { label: "Link Folder", w: "9%" },
                    { label: "Aksi", w: "9%" },
                  ].map((h) => (
                    <th key={h.label} style={{ width: h.w, padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#374151", borderBottom: "2px solid #e2e8f0", textAlign: h.label === "Indikator" || h.label === "Keterangan" ? "left" : "center" }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderRows()}
              </tbody>
            </table>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
