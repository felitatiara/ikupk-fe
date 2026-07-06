"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  getIndikatorGrouped,
  getIndikatorCascadeChain,
  getUsersByRole,
  upsertDisposisi,
  type IndikatorGrouped,
} from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeafIndicator {
  id: number; kode: string; nama: string;
  satuan: string | null; nilaiTarget: number | null; l0Kode: string;
}

interface UserCol {
  userId: number;
  userName: string;
  stepLabel: string; // "Langkah 1 | Wakil Dekan 1"
}

interface ResultRow {
  kode: string;
  nama: string;
  satuan: string;
  targetTotal: number;
  alloc: Record<number, number>; // userId → jumlahTarget
}

interface ImportResult {
  jenis: string;
  tahun: string;
  skipped: number;
  userCols: UserCol[];
  rows: ResultRow[];
}

interface DistribusiTargetModalProps {
  open: boolean;
  onClose: () => void;
  defaultJenis?: "IKU" | "PK";
  defaultTahun?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelStyle = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 } as const;
const inputStyle = {
  border: "1px solid #e5e7eb", borderRadius: 6,
  padding: "8px 12px", fontSize: 13, color: "#374151",
  width: "100%", outline: "none",
} as const;

function collectLeaves(grouped: IndikatorGrouped[]): LeafIndicator[] {
  const out: LeafIndicator[] = [];
  for (const l0 of grouped)
    for (const sub of l0.subIndikators)
      for (const child of sub.children) {
        if ((child.nilaiTarget ?? 0) > 0)
          out.push({ id: child.id, kode: child.kode, nama: child.nama, satuan: child.satuan ?? null, nilaiTarget: child.nilaiTarget, l0Kode: l0.kode });
        for (const l3 of child.children ?? [])
          if ((l3.nilaiTarget ?? 0) > 0)
            out.push({ id: l3.id, kode: l3.kode, nama: l3.nama, satuan: l3.satuan ?? null, nilaiTarget: l3.nilaiTarget, l0Kode: l0.kode });
      }
  return out;
}

async function buildCascadeUsers(grouped: IndikatorGrouped[]): Promise<{ id: number; nama: string; role: string; stepLabel: string }[]> {
  const map = new Map<number, { id: number; nama: string; role: string; stepLabel: string }>();
  for (const l0 of grouped) {
    let chain: (number | number[])[] = [];
    try { chain = await getIndikatorCascadeChain(l0.id); } catch { continue; }
    if (!chain?.length) continue;
    for (let si = 0; si < chain.length; si++) {
      const step = chain[si];
      const rids: number[] = Array.isArray(step) ? step.map(Number) : [Number(step)];
      for (const rid of rids) {
        try {
          const users = await getUsersByRole(rid);
          for (const u of users)
            if (!map.has(u.id))
              map.set(u.id, { id: u.id, nama: u.nama, role: u.role, stepLabel: `Langkah ${si + 1}` });
        } catch { /* skip */ }
      }
    }
  }
  return Array.from(map.values());
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 12, height: 12, flexShrink: 0, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

// ─── Pivot Result Table ───────────────────────────────────────────────────────

function ResultScreen({ result, onReset, onClose }: {
  result: ImportResult; onReset: () => void; onClose: () => void;
}) {
  const totalIndicators = result.rows.length;
  const totalUsers      = result.userCols.length;
  const totalTarget     = result.rows.reduce((s, r) => s + r.targetTotal, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Banner */}
      <div style={{
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
        border: "1.5px solid #86efac", borderRadius: 12,
        padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "#16a34a", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 19, flexShrink: 0, boxShadow: "0 3px 10px rgba(22,163,74,0.3)",
        }}>✓</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#14532d" }}>Distribusi target berhasil diterapkan!</div>
          <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>{result.jenis} · Tahun {result.tahun}</div>
        </div>
      </div>

      {/* Stat chips */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { v: totalIndicators, label: "Indikator", bg: "#eff6ff", border: "#bfdbfe", val: "#1e3a8a", text: "#1d4ed8" },
          { v: totalUsers,      label: "User",       bg: "#fff7ed", border: "#fed7aa", val: "#c2410c", text: "#FF7900" },
          { v: totalTarget,     label: "Total Target",bg: "#f0fdf4", border: "#bbf7d0", val: "#14532d", text: "#16a34a" },
          ...(result.skipped > 0 ? [{ v: result.skipped, label: "Dilewati", bg: "#f9fafb", border: "#e5e7eb", val: "#374151", text: "#6b7280" }] : []),
        ].map(({ v, label, bg, border, val, text }) => (
          <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: val, lineHeight: 1.1 }}>{v.toLocaleString("id-ID")}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: text, marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pivot table */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
          Rincian Distribusi per Indikator
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", maxHeight: 340, overflowY: "auto", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, whiteSpace: "nowrap", minWidth: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              {/* Row 1: Kode | Nama | Satuan | Target | user names */}
              <tr style={{ background: "#1e3a8a" }}>
                {[
                  { label: "Kode",   w: 80 },
                  { label: "Nama Indikator", w: 180 },
                  { label: "Satuan", w: 80 },
                  { label: "Target Total", w: 96 },
                ].map(({ label, w }) => (
                  <th key={label} rowSpan={2} style={{
                    padding: "8px 12px", color: "#fff", fontWeight: 700,
                    textAlign: "left", minWidth: w,
                    borderRight: "1px solid rgba(255,255,255,0.15)",
                    borderBottom: "1px solid rgba(255,255,255,0.2)",
                    verticalAlign: "middle",
                  }}>{label}</th>
                ))}
                {result.userCols.map((u, i) => (
                  <th key={u.userId} style={{
                    padding: "6px 10px", color: "#fff", fontWeight: 700, textAlign: "center",
                    borderLeft: i === 0 ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.15)",
                    borderBottom: "1px solid rgba(255,255,255,0.2)",
                    maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {u.userName}
                  </th>
                ))}
              </tr>
              {/* Row 2: step labels */}
              <tr style={{ background: "#1e40af" }}>
                {result.userCols.map((u, i) => (
                  <th key={u.userId} style={{
                    padding: "4px 10px", fontSize: 10, color: "#bfdbfe", fontWeight: 600, textAlign: "center",
                    borderLeft: i === 0 ? "2px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
                    whiteSpace: "nowrap",
                  }}>
                    {u.stepLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, ri) => {
                const rowTotal = Object.values(row.alloc).reduce((s, v) => s + v, 0);
                return (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "7px 12px", fontWeight: 700, color: "#FF7900", borderRight: "1px solid #f0f0f0" }}>{row.kode}</td>
                    <td style={{ padding: "7px 12px", color: "#111827", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", borderRight: "1px solid #f0f0f0" }}>{row.nama}</td>
                    <td style={{ padding: "7px 12px", color: "#6b7280", borderRight: "1px solid #f0f0f0" }}>{row.satuan || "—"}</td>
                    <td style={{ padding: "7px 12px", fontWeight: 700, color: "#374151", textAlign: "right", borderRight: "2px solid #e5e7eb" }}>
                      {row.targetTotal.toLocaleString("id-ID")}
                    </td>
                    {result.userCols.map((u, ci) => {
                      const v = row.alloc[u.userId] ?? 0;
                      return (
                        <td key={u.userId} style={{
                          padding: "7px 10px", textAlign: "right",
                          borderLeft: ci === 0 ? "2px solid #e5e7eb" : "1px solid #f0f0f0",
                          color: v > 0 ? "#111827" : "#d1d5db",
                          fontWeight: v > 0 ? 700 : 400,
                          background: v > 0 ? (ri % 2 === 0 ? "#f0fdf4" : "#e8faf0") : undefined,
                        }}>
                          {v > 0 ? v.toLocaleString("id-ID") : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Total row */}
              <tr style={{ background: "#f9fafb", borderTop: "2px solid #e5e7eb", fontWeight: 700 }}>
                <td colSpan={3} style={{ padding: "8px 12px", color: "#374151", fontSize: 12 }}>TOTAL</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "#111827", borderRight: "2px solid #e5e7eb" }}>
                  {result.rows.reduce((s, r) => s + r.targetTotal, 0).toLocaleString("id-ID")}
                </td>
                {result.userCols.map((u, ci) => {
                  const col_total = result.rows.reduce((s, r) => s + (r.alloc[u.userId] ?? 0), 0);
                  return (
                    <td key={u.userId} style={{
                      padding: "8px 10px", textAlign: "right",
                      borderLeft: ci === 0 ? "2px solid #e5e7eb" : "1px solid #f0f0f0",
                      color: col_total > 0 ? "#1d4ed8" : "#d1d5db",
                    }}>
                      {col_total > 0 ? col_total.toLocaleString("id-ID") : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {result.skipped > 0 && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
            * {result.skipped} baris dilewati karena kode tidak cocok dengan database.
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <button onClick={onReset} style={{ padding: "8px 20px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151" }}>
          ↺ Import Lagi
        </button>
        <button onClick={onClose} style={{ padding: "8px 24px", borderRadius: 8, border: "none", background: "#16a34a", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", boxShadow: "0 3px 10px rgba(22,163,74,0.3)" }}>
          Selesai
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DistribusiTargetModal({
  open, onClose, defaultJenis = "IKU", defaultTahun,
}: DistribusiTargetModalProps) {
  const [jenis, setJenis] = useState<"IKU" | "PK">(defaultJenis);
  const [tahun, setTahun] = useState(defaultTahun || String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetResult() { setImportResult(null); setImportError(null); }

  // ── Download template ──────────────────────────────────────────────────────
  async function handleDownload() {
    if (!tahun) { toast.error("Pilih tahun terlebih dahulu."); return; }
    setGenerating(true);
    try {
      const grouped = await getIndikatorGrouped(jenis, tahun);
      if (!grouped?.length) { toast.error(`Tidak ada indikator ${jenis} untuk tahun ${tahun}.`); return; }

      const [leaves, users] = await Promise.all([
        Promise.resolve(collectLeaves(grouped)),
        buildCascadeUsers(grouped),
      ]);
      if (!leaves.length) { toast.error("Belum ada sub-indikator dengan target."); return; }
      if (!users.length)  { toast.error("Belum ada alur cascade yang dikonfigurasi. Atur cascade chain dulu di Master Indikator."); return; }

      const h1 = ["L0 Kode", "Kode", "Nama Indikator", "Satuan", "Target Total (Info)", ...users.map(u => `${u.nama} (ID:${u.id})`)];
      const h2 = ["", "", "", "", "← Isi angka target per user →", ...users.map(u => `${u.stepLabel} | ${u.role}`)];
      const rows = leaves.map(l => [l.l0Kode, l.kode, l.nama, l.satuan ?? "", l.nilaiTarget ?? 0, ...users.map(() => 0)]);

      const ws = XLSX.utils.aoa_to_sheet([h1, h2, ...rows]);
      ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 42 }, { wch: 12 }, { wch: 22 }, ...users.map(() => ({ wch: 26 }))];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Distribusi Target");
      XLSX.writeFile(wb, `template-distribusi-${jenis}-${tahun}.xlsx`);
      toast.success(`Template berhasil didownload (${leaves.length} indikator, ${users.length} user).`);
    } catch (e: any) {
      toast.error("Gagal generate template: " + (e?.message ?? "error"));
    } finally {
      setGenerating(false);
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport(file: File) {
    setImportError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb   = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const aoa: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

      if (aoa.length < 3) { setImportError("File tidak valid. Gunakan template yang didownload dari sistem."); return; }

      const h1 = aoa[0] as (string | null)[];
      const h2 = aoa[1] as (string | null)[];

      // Parse user columns
      const userCols: { colIdx: number; userId: number; userName: string; stepLabel: string }[] = [];
      for (let c = 5; c < h1.length; c++) {
        const m = String(h1[c] ?? "").match(/^(.+)\s+\(ID:(\d+)\)$/);
        if (m) userCols.push({ colIdx: c, userId: Number(m[2]), userName: m[1].trim(), stepLabel: String(h2[c] ?? "") });
      }
      if (!userCols.length) { setImportError("Tidak ada kolom user. Gunakan template dari sistem ini."); return; }

      // Mapping kode → indikatorId
      const grouped   = await getIndikatorGrouped(jenis, tahun);
      const kodeToId  = new Map<string, number>();
      for (const l0 of grouped)
        for (const sub of l0.subIndikators)
          for (const child of sub.children) {
            kodeToId.set(child.kode.trim(), child.id);
            for (const l3 of child.children ?? []) kodeToId.set(l3.kode.trim(), l3.id);
          }

      type Entry = { indikatorId: number; kode: string; nama: string; satuan: string; targetTotal: number; alloc: Record<number, number> };
      const entryMap = new Map<number, Entry>();
      let skipped = 0;

      for (let r = 2; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || row.every(c => c === null)) continue;
        const kode   = String(row[1] ?? "").trim();
        const nama   = String(row[2] ?? "").trim();
        const satuan = String(row[3] ?? "").trim();
        const total  = Number(row[4] ?? 0);
        if (!kode) continue;

        const indikatorId = kodeToId.get(kode);
        if (!indikatorId) { skipped++; continue; }

        const items: { toUserId: number; jumlahTarget: number }[] = [];
        for (const { colIdx, userId } of userCols) {
          const amount = Number(row[colIdx]);
          if (!isNaN(amount) && amount > 0) items.push({ toUserId: userId, jumlahTarget: amount });
        }
        if (!items.length) continue;

        if (!entryMap.has(indikatorId)) entryMap.set(indikatorId, { indikatorId, kode, nama, satuan, targetTotal: total, alloc: {} });
        const entry = entryMap.get(indikatorId)!;
        for (const { toUserId, jumlahTarget } of items) {
          entry.alloc[toUserId] = (entry.alloc[toUserId] ?? 0) + jumlahTarget;
        }
      }

      if (!entryMap.size) { setImportError("Tidak ada data target (> 0) yang ditemukan. Isi angka di kolom user terlebih dahulu."); return; }

      const entries = Array.from(entryMap.values());
      await Promise.all(entries.map(e => {
        const items = Object.entries(e.alloc).map(([uid, amt]) => ({ toUserId: Number(uid), jumlahTarget: amt }));
        return upsertDisposisi(e.indikatorId, tahun, items, null);
      }));

      const totalUsers = new Set(entries.flatMap(e => Object.keys(e.alloc).map(Number))).size;
      setImportResult({
        jenis, tahun, skipped,
        userCols: userCols.map(u => ({ userId: u.userId, userName: u.userName, stepLabel: u.stepLabel })),
        rows: entries.map(e => ({ kode: e.kode, nama: e.nama, satuan: e.satuan, targetTotal: e.targetTotal, alloc: e.alloc })),
      });
      toast.success(`Disposisi berhasil untuk ${entries.length} indikator ke ${totalUsers} user.`);
      if (skipped > 0) toast(`${skipped} baris dilewati karena kode tidak cocok.`);
    } catch (e: any) {
      setImportError("Gagal import: " + (e?.message ?? "error"));
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const isResultMode = !!importResult;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 10px 48px rgba(0,0,0,0.20)",
        width: "100%",
        maxWidth: isResultMode ? Math.min(320 + (importResult?.userCols.length ?? 0) * 120, 1100) : 580,
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        transition: "max-width 0.25s",
      }}>

        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Distribusi Target via Cascade</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
              {isResultMode
                ? `Import selesai — ${importResult!.jenis} · ${importResult!.tahun}`
                : "Generate template → isi target per user → import untuk buat disposisi massal."}
            </div>
          </div>
          <button onClick={onClose} disabled={importing || generating}
            style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {isResultMode ? (
            <ResultScreen result={importResult!} onReset={resetResult} onClose={onClose} />
          ) : (
            <>
              {/* Jenis + Tahun */}
              <div style={{ display: "flex", gap: 16, marginBottom: 22 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>Jenis</div>
                  <select value={jenis} onChange={e => { setJenis(e.target.value as "IKU" | "PK"); resetResult(); }} style={{ ...inputStyle }}>
                    <option value="IKU">IKU</option>
                    <option value="PK">PK</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>Tahun</div>
                  <input value={tahun} onChange={e => { setTahun(e.target.value); resetResult(); }} placeholder="2026" style={{ ...inputStyle }} />
                </div>
              </div>

              {/* Step 1 */}
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1d4ed8", color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>Download Template</div>
                    <div style={{ fontSize: 12, color: "#1e3a8a", marginBottom: 12, lineHeight: 1.6 }}>
                      Sistem membaca cascade chain tiap indikator dan mengambil semua user di setiap langkah.
                      Hasilnya: Excel dengan baris = sub-indikator, kolom = tiap user.
                    </div>
                    <button onClick={handleDownload} disabled={generating || !tahun}
                      style={{
                        padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                        background: generating || !tahun ? "#d1d5db" : "#1d4ed8", color: "#fff",
                        cursor: generating || !tahun ? "not-allowed" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: 7,
                      }}>
                      {generating ? <><Spinner /> Generating...</> : "↓ Download Template Excel"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div style={{ display: "flex", justifyContent: "center", height: 26, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 2, height: 8, background: "#e5e7eb", borderRadius: 1 }} />
                  <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, padding: "2px 0" }}>isi angka di Excel</span>
                  <div style={{ width: 2, height: 8, background: "#e5e7eb", borderRadius: 1 }} />
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "16px 18px", marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FF7900", color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c2410c", marginBottom: 4 }}>Import & Terapkan Disposisi</div>
                    <div style={{ fontSize: 12, color: "#9a3412", marginBottom: 12, lineHeight: 1.6 }}>
                      Upload template yang sudah diisi. Sistem membuat disposisi untuk semua user di semua level sekaligus.
                    </div>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await handleImport(file);
                        e.target.value = "";
                      }}
                    />
                    <button onClick={() => { resetResult(); fileRef.current?.click(); }} disabled={importing || !tahun}
                      style={{
                        padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                        background: importing || !tahun ? "#d1d5db" : "#FF7900", color: "#fff",
                        cursor: importing || !tahun ? "not-allowed" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: 7,
                        boxShadow: importing || !tahun ? "none" : "0 3px 10px rgba(255,121,0,0.35)",
                      }}>
                      {importing ? <><Spinner /> Mengimpor...</> : "↑ Upload & Terapkan Sekarang"}
                    </button>
                    {importError && (
                      <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626", lineHeight: 1.5 }}>
                        {importError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button onClick={onClose} disabled={importing || generating}
                  style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                  Tutup
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
}
