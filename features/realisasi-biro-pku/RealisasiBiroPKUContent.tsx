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
  getRealisasiCounts,
  type ValidasiBiroPKUItem,
  type IndikatorGrouped,
  type IndikatorGroupedSub,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_TAHUN = String(new Date().getFullYear());

export default function RealisasiBiroPKUContent() {
  const { user, token } = useAuth();
  const [selectedJenis, setSelectedJenis] = useState("IKU");
  const [selectedTahun, setSelectedTahun] = useState(DEFAULT_TAHUN);
  const [yearOptions, setYearOptions] = useState<string[]>([DEFAULT_TAHUN]);

  const [validasiData, setValidasiData] = useState<ValidasiBiroPKUItem[]>([]);
  const [grouped, setGrouped] = useState<IndikatorGrouped[]>([]);
  const [realisasiCounts, setRealisasiCounts] = useState<Record<number, number>>({});
  const [folderLinks, setFolderLinks] = useState<Map<number, string | null>>(new Map());
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [inputJumlah, setInputJumlah] = useState("");
  const [inputKeterangan, setInputKeterangan] = useState("");
  const [saving, setSaving] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // -- Helpers -----------------------------------------------------------------

  /** Kumpulkan semua leaf (L2 IKU / L3 PK) dari satu L0 */
  function leafIdsOf(l0: IndikatorGrouped, jenis: string): number[] {
    const ids: number[] = [];
    for (const sub of l0.subIndikators)
      for (const child of sub.children)
        if (jenis === "IKU") ids.push(child.id);
        else for (const l3 of child.children) ids.push(l3.id);
    return ids;
  }

  /** Leaf dari satu L1 */
  function leafIdsOfSub(sub: IndikatorGroupedSub, jenis: string): number[] {
    const ids: number[] = [];
    for (const child of sub.children)
      if (jenis === "IKU") ids.push(child.id);
      else for (const l3 of child.children) ids.push(l3.id);
    return ids;
  }

  /** Semua leaf di seluruh grouped */
  function allLeafIds(jenis: string): number[] {
    return grouped.flatMap((l0) => leafIdsOf(l0, jenis));
  }

  /** Sum hasil biro PKU untuk sekumpulan leaf ID */
  function sumHasil(ids: number[]): number | null {
    const items = validasiData.filter((v) => ids.includes(v.indikatorId) && v.jumlahValid != null);
    if (items.length === 0) return null;
    return items.reduce((s, v) => s + (v.jumlahValid ?? 0), 0);
  }

  /** Sum realisasi dari realisasiCounts untuk sekumpulan leaf ID */
  function sumRealisasiIds(ids: number[]): number {
    return ids.reduce((s, id) => s + (realisasiCounts[id] ?? 0), 0);
  }

  // -- Data fetch ---------------------------------------------------------------

  useEffect(() => {
    getAvailableYears()
      .then((years) => {
        const cy = new Date().getFullYear();
        const merged = [...new Set([...years, String(cy - 1), String(cy), String(cy + 1)])].sort();
        setYearOptions(merged);
        if (!merged.includes(DEFAULT_TAHUN)) setSelectedTahun(merged[merged.length - 1]);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFolderLinks(new Map());
    try {
      const [validasi, grp, counts] = await Promise.all([
        getValidasiBiroPKU(selectedTahun),
        getIndikatorGrouped(selectedJenis, selectedTahun),
        getRealisasiCounts(selectedJenis, selectedTahun),
      ]);
      setValidasiData(validasi);
      setGrouped(grp);
      setRealisasiCounts(counts);

      // Fetch folder links untuk semua leaf secara paralel
      const leafs: number[] = [];
      for (const g of grp)
        for (const sub of g.subIndikators)
          for (const child of sub.children)
            if (selectedJenis === "IKU") leafs.push(child.id);
            else for (const l3 of child.children) leafs.push(l3.id);

      if (leafs.length > 0 && token) {
        const results = await Promise.allSettled(
          leafs.map((id) => getAllRealisasiFiles(id, token).then((r) => ({ id, folderLink: r.folderLink }))),
        );
        const map = new Map<number, string | null>();
        results.forEach((r) => { if (r.status === "fulfilled") map.set(r.value.id, r.value.folderLink); });
        setFolderLinks(map);
      }
    } catch {
      setValidasiData([]);
      setGrouped([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTahun, selectedJenis, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // -- Edit / Save --------------------------------------------------------------

  function startEdit(leafId: number) {
    const existing = validasiData.find((v) => v.indikatorId === leafId);
    setEditingId(leafId);
    setInputJumlah(existing?.jumlahValid != null ? String(existing.jumlahValid) : "");
    setInputKeterangan(existing?.keterangan ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setInputJumlah("");
    setInputKeterangan("");
  }

  async function handleSave(leafId: number) {
    if (!user) return;
    setSaving(true);
    try {
      const saved = await upsertValidasiBiroPKU({
        indikatorId: leafId,
        tahun: selectedTahun,
        jumlahValid: inputJumlah === "" ? null : Number(inputJumlah),
        keterangan: inputKeterangan || undefined,
        inputBy: user?.id,
      });
      setValidasiData((prev) => {
        const idx = prev.findIndex((v) => v.indikatorId === leafId);
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
        return [...prev, saved];
      });
      setEditingId(null);
    } catch {
      alert("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  // -- Export -------------------------------------------------------------------

  async function handleExport() {
    setExporting(true);
    try {
      const [freshValidasiData, freshGrouped, freshRealisasiCounts] = await Promise.all([
        getValidasiBiroPKU(selectedTahun),
        getIndikatorGrouped(selectedJenis, selectedTahun),
        getRealisasiCounts(selectedJenis, selectedTahun),
      ]);

      if (freshGrouped.length === 0) { toast.error("Tidak ada data untuk diekspor."); return; }

      const freshLeafs: number[] = [];
      for (const g of freshGrouped)
        for (const sub of g.subIndikators)
          for (const child of sub.children)
            if (selectedJenis === "IKU") freshLeafs.push(child.id);
            else for (const l3 of child.children) freshLeafs.push(l3.id);

      const freshFolderLinks = new Map<number, string | null>();
      if (freshLeafs.length > 0 && token) {
        const results = await Promise.allSettled(
          freshLeafs.map((id) => getAllRealisasiFiles(id, token).then((r) => ({ id, folderLink: r.folderLink }))),
        );
        results.forEach((r) => { if (r.status === "fulfilled") freshFolderLinks.set(r.value.id, r.value.folderLink); });
      }

      function freshSumHasil(ids: number[]): number | null {
        const items = freshValidasiData.filter((v) => ids.includes(v.indikatorId) && v.jumlahValid != null);
        if (items.length === 0) return null;
        return items.reduce((s, v) => s + (v.jumlahValid ?? 0), 0);
      }
      function freshSumRealisasi(ids: number[]): number {
        return ids.reduce((s, id) => s + (freshRealisasiCounts[id] ?? 0), 0);
      }

      type Row = (string | number | null)[];
      const COLS: Row = ["No.", "Kode", "Nama Indikator", "Realisasi Diajukan", "Hasil Biro PKU", "Keterangan", "Link Folder"];
      const rows: Row[] = [COLS];
      let no = 0;

      for (const l0 of freshGrouped) {
        const l0Ids = leafIdsOf(l0, selectedJenis);
        const l0Hasil = freshSumHasil(l0Ids);
        const l0Realisasi = freshSumRealisasi(l0Ids);

        rows.push(["", l0.kode, l0.nama, l0Realisasi || "", l0Hasil ?? "", "", ""]);

        for (const sub of l0.subIndikators) {
          const subIds = leafIdsOfSub(sub, selectedJenis);
          const subHasil = freshSumHasil(subIds);
          const subRealisasi = freshSumRealisasi(subIds);
          rows.push(["", sub.kode, `  ${sub.nama}`, subRealisasi || "", subHasil ?? "", "", ""]);

          for (const child of sub.children) {
            if (selectedJenis === "IKU") {
              no++;
              const val = freshValidasiData.find((v) => v.indikatorId === child.id);
              rows.push([no, child.kode, `    ${child.nama}`, freshRealisasiCounts[child.id] ?? 0, val?.jumlahValid ?? "", val?.keterangan ?? "", freshFolderLinks.get(child.id) ?? ""]);
            } else {
              const childIds = child.children.map((l3) => l3.id);
              const childHasil = freshSumHasil(childIds);
              const childRealisasi = freshSumRealisasi(childIds);
              rows.push(["", child.kode, `    ${child.nama}`, childRealisasi || "", childHasil ?? "", "", ""]);
              for (const l3 of child.children) {
                no++;
                const val = freshValidasiData.find((v) => v.indikatorId === l3.id);
                rows.push([no, l3.kode, `      ${l3.nama}`, freshRealisasiCounts[l3.id] ?? 0, val?.jumlahValid ?? "", val?.keterangan ?? "", freshFolderLinks.get(l3.id) ?? ""]);
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

  // -- Import -------------------------------------------------------------------

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

      if (raw.length === 0) { toast.error("File Excel kosong."); return; }

      const normalize = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, " ");
      const headerMap: Record<string, string> = {};
      Object.keys(raw[0]).forEach((k) => { headerMap[normalize(k)] = k; });

      const kodeKey = headerMap["kode"];
      const hasilKey = headerMap["hasil biro pku"];
      const keteranganKey = headerMap["keterangan"];

      if (!kodeKey || !hasilKey) { toast.error('Kolom "Kode" dan "Hasil Biro PKU" wajib ada.'); return; }

      // Build map dari kode leaf (L2/L3) ke indikatorId
      const kodeMap = new Map<string, number>();
      for (const l0 of grouped)
        for (const sub of l0.subIndikators)
          for (const child of sub.children)
            if (selectedJenis === "IKU") kodeMap.set(child.kode.trim(), child.id);
            else for (const l3 of child.children) kodeMap.set(l3.kode.trim(), l3.id);

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

      if (items.length === 0) { toast.error(`Tidak ada baris yang cocok dengan kode indikator ${selectedJenis}.`); return; }

      const result = await bulkUpsertValidasiBiroPKU(items);
      toast.success(`Import berhasil: ${result.saved} baris disimpan${result.skipped > 0 ? `, ${result.skipped} gagal` : ""}.`);
      await fetchData();
    } catch {
      toast.error("Gagal mengimpor file Excel.");
    } finally {
      setImporting(false);
    }
  }

  // -- Render tabel hierarki ----------------------------------------------------

  function renderLeafInputCell(leafId: number) {
    const isEditing = editingId === leafId;
    const val = validasiData.find((v) => v.indikatorId === leafId);
    const hasResult = val?.jumlahValid != null;
    if (isEditing) {
      return (
        <input
          type="number" min={0} value={inputJumlah}
          onChange={(e) => setInputJumlah(e.target.value)}
          placeholder="0"
          style={{ width: 80, padding: "5px 8px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 13, textAlign: "center", outline: "none" }}
          autoFocus
        />
      );
    }
    if (hasResult) return <span style={{ fontWeight: 700, color: "#0369a1", fontSize: 14 }}>{val!.jumlahValid}</span>;
    return <span style={{ color: "#d1d5db" }}>—</span>;
  }

  function renderLeafKeteranganCell(leafId: number) {
    const isEditing = editingId === leafId;
    const val = validasiData.find((v) => v.indikatorId === leafId);
    if (isEditing) {
      return (
        <textarea
          value={inputKeterangan} onChange={(e) => setInputKeterangan(e.target.value)}
          placeholder="Catatan (opsional)" rows={2}
          style={{ width: "100%", padding: "5px 8px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 12, resize: "vertical", boxSizing: "border-box" }}
        />
      );
    }
    if (val?.keterangan) return <span style={{ fontSize: 12, color: "#4b5563" }}>{val.keterangan}</span>;
    return <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>;
  }

  function renderLeafAksiCell(leafId: number) {
    const isEditing = editingId === leafId;
    const val = validasiData.find((v) => v.indikatorId === leafId);
    const hasResult = val?.jumlahValid != null;
    if (isEditing) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={() => handleSave(leafId)} disabled={saving}
            style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#0369a1", color: "#fff", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "..." : "Simpan"}
          </button>
          <button onClick={cancelEdit} disabled={saving}
            style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, color: "#6b7280", cursor: "pointer" }}>
            Batal
          </button>
        </div>
      );
    }
    return (
      <button onClick={() => startEdit(leafId)}
        style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fafafa", fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
        {hasResult ? "Edit" : "Input"}
      </button>
    );
  }

  function renderFolderLink(id: number) {
    const link = folderLinks.get(id);
    if (!link) return <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>;
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0369a1", fontWeight: 600, textDecoration: "none" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        Folder
      </a>
    );
  }

  /** Cell "Hasil Biro PKU" untuk baris agregat (non-leaf) */
  function hasilCell(val: number | null) {
    if (val == null) return <span style={{ color: "#d1d5db" }}>—</span>;
    return <span style={{ fontWeight: 700, color: "#0369a1" }}>{val}</span>;
  }

  function renderRows() {
    if (grouped.length === 0) return null;
    const rows: React.ReactNode[] = [];

    for (const l0 of grouped) {
      const l0Ids = leafIdsOf(l0, selectedJenis);
      const l0Hasil = sumHasil(l0Ids);
      const l0Realisasi = sumRealisasiIds(l0Ids);

      // -- L0 row --
      rows.push(
        <tr key={`l0-${l0.id}`} style={{ background: "#f5f7fa", borderBottom: "1px solid #f0f0f0", borderTop: "1px solid #f0f0f0" }}>
          <td style={{ padding: "11px 16px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: "#374151", fontSize: 13 }}>{l0.kode}</td>
          <td style={{ padding: "11px 16px", fontWeight: 700, color: "#374151", fontSize: 13 }}>{l0.nama}</td>
          <td style={{ padding: "11px 16px", textAlign: "center", color: "#374151" }}>
            {l0Realisasi > 0 ? <><span style={{ fontWeight: 700 }}>{l0Realisasi}</span><div style={{ fontSize: 10, color: "#9ca3af" }}>total submisi</div></> : <span style={{ color: "#d1d5db" }}>—</span>}
          </td>
          <td style={{ padding: "11px 16px", textAlign: "center" }}>{hasilCell(l0Hasil)}</td>
          <td style={{ padding: "11px 16px" }}><span style={{ color: "#d1d5db", fontSize: 12 }}>—</span></td>
          <td style={{ padding: "11px 16px" }} />
          <td style={{ padding: "11px 16px" }} />
        </tr>,
      );

      for (const sub of l0.subIndikators) {
        const subIds = leafIdsOfSub(sub, selectedJenis);
        const subHasil = sumHasil(subIds);
        const subRealisasi = sumRealisasiIds(subIds);

        // -- L1 row --
        rows.push(
          <tr key={`l1-${sub.id}`} style={{ background: "#fff", borderBottom: "1px solid #f8f8f8" }}>
            <td style={{ padding: "11px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{sub.kode}</td>
            <td style={{ padding: "11px 16px 11px 32px", color: "#374151", fontSize: 13, fontWeight: 600 }}>{sub.nama}</td>
            <td style={{ padding: "11px 16px", textAlign: "center", color: "#374151", fontSize: 13 }}>
              {subRealisasi > 0 ? subRealisasi : <span style={{ color: "#d1d5db" }}>—</span>}
            </td>
            <td style={{ padding: "11px 16px", textAlign: "center" }}>{hasilCell(subHasil)}</td>
            <td style={{ padding: "11px 16px" }}><span style={{ color: "#d1d5db", fontSize: 12 }}>—</span></td>
            <td /><td />
          </tr>,
        );

        for (const child of sub.children) {
          if (selectedJenis === "IKU") {
            // -- L2 = leaf IKU --
            const isEditing = editingId === child.id;
            rows.push(
              <tr key={`l2-${child.id}`} style={{ background: isEditing ? "#f0f9ff" : "#fff", borderBottom: "1px solid #f8f8f8" }}>
                <td style={{ padding: "13px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{child.kode}</td>
                <td style={{ padding: "13px 16px 13px 48px", color: "#374151", fontSize: 13 }}>{child.nama}</td>
                <td style={{ padding: "13px 16px", textAlign: "center", color: "#374151" }}>
                  {(realisasiCounts[child.id] ?? 0) > 0
                    ? <><span style={{ fontWeight: 600 }}>{realisasiCounts[child.id]}</span><div style={{ fontSize: 10, color: "#9ca3af" }}>submisi</div></>
                    : <span style={{ color: "#d1d5db" }}>—</span>}
                </td>
                <td style={{ padding: "13px 16px", textAlign: "center" }}>{renderLeafInputCell(child.id)}</td>
                <td style={{ padding: "13px 16px" }}>{renderLeafKeteranganCell(child.id)}</td>
                <td style={{ padding: "13px 16px", textAlign: "center" }}>{renderFolderLink(child.id)}</td>
                <td style={{ padding: "13px 16px", textAlign: "center" }}>{renderLeafAksiCell(child.id)}</td>
              </tr>,
            );
          } else {
            // -- L2 = intermediate PK --
            const childIds = child.children.map((l3) => l3.id);
            const childHasil = sumHasil(childIds);
            const childRealisasi = sumRealisasiIds(child.children.map((l3) => l3.id));
            rows.push(
              <tr key={`l2pk-${child.id}`} style={{ background: "#fff", borderBottom: "1px solid #f8f8f8" }}>
                <td style={{ padding: "11px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{child.kode}</td>
                <td style={{ padding: "11px 16px 11px 48px", color: "#374151", fontSize: 13, fontWeight: 500 }}>{child.nama}</td>
                <td style={{ padding: "11px 16px", textAlign: "center", color: "#374151", fontSize: 13 }}>
                  {childRealisasi > 0 ? childRealisasi : <span style={{ color: "#d1d5db" }}>—</span>}
                </td>
                <td style={{ padding: "11px 16px", textAlign: "center" }}>{hasilCell(childHasil)}</td>
                <td><span style={{ color: "#d1d5db", fontSize: 12 }}>—</span></td>
                <td /><td />
              </tr>,
            );

            for (const l3 of child.children) {
              // -- L3 = leaf PK --
              const l3Realisasi = realisasiCounts[l3.id] ?? 0;
              const isEditing = editingId === l3.id;
              rows.push(
                <tr key={`l3-${l3.id}`} style={{ background: isEditing ? "#f0f9ff" : "#fff", borderBottom: "1px solid #f8f8f8" }}>
                  <td style={{ padding: "13px 16px", textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{l3.kode}</td>
                  <td style={{ padding: "13px 16px 13px 64px", color: "#374151", fontSize: 13 }}>{l3.nama}</td>
                  <td style={{ padding: "13px 16px", textAlign: "center", color: "#374151" }}>
                    {l3Realisasi > 0
                      ? <><span style={{ fontWeight: 600 }}>{l3Realisasi}</span><div style={{ fontSize: 10, color: "#9ca3af" }}>submisi</div></>
                      : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "center" }}>{renderLeafInputCell(l3.id)}</td>
                  <td style={{ padding: "13px 16px" }}>{renderLeafKeteranganCell(l3.id)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "center" }}>{renderFolderLink(l3.id)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "center" }}>{renderLeafAksiCell(l3.id)}</td>
                </tr>,
              );
            }
          }
        }
      }
    }
    return rows;
  }

  // -- Submitted count ----------------------------------------------------------

  const leafIds = allLeafIds(selectedJenis);
  const submitted = validasiData.filter((v) => leafIds.includes(v.indikatorId) && v.jumlahValid != null).length;
  const total = leafIds.length;
  const progressPct = total > 0 ? Math.round((submitted / total) * 100) : 0;

  // -- Render -------------------------------------------------------------------

  return (
    <div className="biro-pku-page">
      <PageTransition>
        <div className="biro-pku-hero">
          <div>
            <h3 className="ikupk-card-title">Verifikasi Capaian</h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Rekap realisasi, hasil validasi, keterangan, dan folder bukti untuk setiap indikator.
            </p>
          </div>
          <div className="biro-pku-progress-card">
            <div className="biro-pku-progress-card__top">
              <span>Progress Verifikasi</span>
              <strong>{progressPct}%</strong>
            </div>
            <div className="biro-pku-progress-track">
              <div className="biro-pku-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="biro-pku-progress-meta">
              <span>{submitted} dari {total} indikator</span>
              <span>{selectedJenis} {selectedTahun}</span>
            </div>
          </div>
        </div>

        <div className="biro-pku-toolbar">
          <div className="biro-pku-filter-grid">
            <label className="biro-pku-field">
              <span>Jenis</span>
              <select value={selectedJenis} onChange={(e) => setSelectedJenis(e.target.value)}>
                <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                <option value="PK">Perjanjian Kinerja (PK)</option>
              </select>
            </label>
            <label className="biro-pku-field biro-pku-field--year">
              <span>Tahun</span>
              <select value={selectedTahun} onChange={(e) => setSelectedTahun(e.target.value)}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div className="biro-pku-actions">
            <button onClick={handleExport} disabled={loading || exporting || grouped.length === 0} className="biro-pku-btn biro-pku-btn--secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {exporting ? "Mengekspor..." : "Export Excel"}
            </button>
            <button onClick={() => importRef.current?.click()} disabled={importing || loading} className="biro-pku-btn biro-pku-btn--primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              {importing ? "Mengimpor..." : "Import Excel"}
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          </div>
        </div>

        <div className="biro-pku-table-card">
          {loading ? (
            <div className="biro-pku-state">Memuat data...</div>
          ) : grouped.length === 0 ? (
            <div className="biro-pku-state biro-pku-state--empty">Tidak ada indikator untuk {selectedJenis} {selectedTahun}.</div>
          ) : (
            <div className="biro-pku-table-scroll">
              <table className="biro-pku-table">
                <thead>
                  <tr>
                    {[
                      { label: "Kode", w: "8%" },
                      { label: "Indikator", w: "auto" },
                      { label: "Realisasi Diajukan", w: "12%" },
                      { label: "Hasil Biro PKU", w: "12%" },
                      { label: "Keterangan", w: "18%" },
                      { label: "Link Folder", w: "10%" },
                      { label: "Aksi", w: "9%" },
                    ].map((h) => (
                      <th key={h.label} style={{ width: h.w }} className={h.label === "Indikator" || h.label === "Keterangan" ? "is-left" : ""}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{renderRows()}</tbody>
              </table>
            </div>
          )}
        </div>

        <style>{`
          .biro-pku-page { color: #111827; }
          .biro-pku-hero {
            display: flex; justify-content: space-between; gap: 24px; align-items: stretch;
            margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eef6ff 100%);
            box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
          }
          .biro-pku-eyebrow { margin: 0 0 6px; color: #2563eb; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
          .biro-pku-title { margin: 0; color: #0f172a; font-size: 26px; font-weight: 900; }
          .biro-pku-subtitle { max-width: 680px; margin: 8px 0 0; color: #64748b; font-size: 14px; line-height: 1.5; }
          .biro-pku-progress-card { min-width: 300px; padding: 16px; border: 1px solid #dbeafe; border-radius: 14px; background: #ffffff; }
          .biro-pku-progress-card__top, .biro-pku-progress-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
          .biro-pku-progress-card__top span { color: #475569; font-size: 13px; font-weight: 800; }
          .biro-pku-progress-card__top strong { color: #1d4ed8; font-size: 24px; font-weight: 900; }
          .biro-pku-progress-track { height: 9px; margin: 12px 0 10px; overflow: hidden; border-radius: 999px; background: #e5e7eb; }
          .biro-pku-progress-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2563eb, #0f9f6e); }
          .biro-pku-progress-meta { color: #64748b; font-size: 12px; font-weight: 700; }
          .biro-pku-toolbar {
            display: flex; justify-content: space-between; gap: 14px; align-items: center; margin-bottom: 18px; padding: 14px;
            border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
          }
          .biro-pku-filter-grid, .biro-pku-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
          .biro-pku-field { display: grid; gap: 6px; }
          .biro-pku-field span { color: #64748b; font-size: 12px; font-weight: 800; }
          .biro-pku-field select {
            min-width: 290px; height: 42px; padding: 0 38px 0 12px; border: 1px solid #d7dde8; border-radius: 11px;
            background: #f8fafc; color: #334155; font-size: 14px; font-weight: 700; outline: none;
          }
          .biro-pku-field--year select { min-width: 116px; }
          .biro-pku-field select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14); }
          .biro-pku-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 0 16px;
            border-radius: 11px; font-size: 14px; font-weight: 900; cursor: pointer; transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
          }
          .biro-pku-btn:disabled { cursor: not-allowed; opacity: 0.55; }
          .biro-pku-btn:not(:disabled):hover { transform: translateY(-1px); }
          .biro-pku-btn--secondary { border: 1px solid #d7dde8; background: #ffffff; color: #334155; }
          .biro-pku-btn--primary { border: 0; background: linear-gradient(135deg, #2563eb, #0f766e); color: #ffffff; box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22); }
          .biro-pku-table-card { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 18px; background: #ffffff; box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08); }
          .biro-pku-table-scroll { overflow-x: auto; }
          .biro-pku-table { width: 100%; min-width: 1080px; border-collapse: separate; border-spacing: 0; font-size: 14px; }
          .biro-pku-table thead tr { background: #0f2f4f; }
          .biro-pku-table th { padding: 15px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.18); color: #e8eef7; font-size: 12px; font-weight: 900; letter-spacing: 0.06em; text-align: center; text-transform: uppercase; }
          .biro-pku-table th.is-left { text-align: left; }
          .biro-pku-table tbody tr { transition: background 140ms ease; }
          .biro-pku-table tbody tr:hover { background: #f0f9ff !important; }
          .biro-pku-table tbody td { border-bottom: 1px solid #eef2f7; }
          .biro-pku-state { padding: 48px 24px; color: #64748b; font-size: 14px; font-weight: 800; text-align: center; }
          .biro-pku-state--empty { color: #94a3b8; }
          @media (max-width: 900px) {
            .biro-pku-hero, .biro-pku-toolbar { align-items: stretch; flex-direction: column; }
            .biro-pku-progress-card, .biro-pku-field select { min-width: 0; width: 100%; }
          }
        `}</style>
      </PageTransition>
    </div>
  );
}
