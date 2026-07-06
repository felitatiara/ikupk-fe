"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  getIndikatorGrouped,
  getAllRoles,
  getUsersByRole,
  upsertDisposisi,
  type IndikatorGrouped,
  type UnitUser,
} from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedAmount {
  excelName: string;
  amount: number;
}

interface ParsedEntry {
  ikuCode: string;
  subLabel: string;
  satuan: string;
  targetTotal: number;
  amounts: ParsedAmount[];
  sheetName: string;
}

interface MatchedAmount extends ParsedAmount {
  userId: number | null;
  dbNama: string;
}

interface MatchedEntry {
  ikuCode: string;
  subLabel: string;
  satuan: string;
  targetTotal: number;
  sheetName: string;
  indicatorId: number | null;
  indicatorKode: string;
  amounts: MatchedAmount[];
}

// Cascade level: one call to upsertDisposisi
interface CascadeLevel {
  depth: number; // 0 = dosen, 1 = kaprodi, 2 = kajur, 3 = wadek, 4+ = dekan
  roleLabel: string;
  fromUserId: number | null;
  fromNama: string;
  items: { toUserId: number; toNama: string; jumlahTarget: number }[];
}

interface PreviewCascade {
  indicatorId: number;
  indicatorKode: string;
  subLabel: string;
  levels: CascadeLevel[];
}

interface DoneStats {
  indicators: number;
  cascadeCalls: number;
  skippedInd: number;
  skippedUser: number;
  maxDepth: number;
}

interface ImportTurunanModalProps {
  open: boolean;
  onClose: () => void;
  defaultTahun?: string;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s
    .replace(/\r?\n[\s\S]*/, "")      // cut at newline
    .replace(/\([^)]*\)\s*\d*/g, "")  // remove (L), (AA), (LK 500)
    .split(",")[0]                     // drop everything after comma
    .replace(/\b(Dr\.?|Prof\.?|Ir\.?|Drs\.?|Hj\.?|H\.?)\s*/gi, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripSubPrefix(label: string): string {
  return label.replace(/^[a-z]\.\s*/i, "").replace(/\*+$/, "").trim();
}

function parseSheet(
  aoa: (string | number | boolean | null)[][],
  sheetName: string,
): ParsedEntry[] {
  if (!aoa.length) return [];
  const h0 = (aoa[0] as (string | null)[]).map((c) => String(c ?? "").trim());

  const jumlahIdx = h0.findIndex((v) => v === "Jumlah");
  const sisaIdx = h0.findIndex((v) => v.toLowerCase() === "sisa");
  const isDetailed = jumlahIdx >= 6;

  let dosenNames: string[];
  let amtOffset: number;
  let dataStart: number;

  if (isDetailed) {
    dosenNames = h0.slice(6, jumlahIdx).filter(Boolean);
    amtOffset = jumlahIdx + 3;
    dataStart = 2;
  } else {
    const endCol = sisaIdx > 6 ? sisaIdx : h0.length;
    dosenNames = h0.slice(6, endCol).filter(Boolean);
    amtOffset = 6;
    dataStart = 1;
  }

  if (!dosenNames.length) return [];

  const entries: ParsedEntry[] = [];
  let currentIKU = "";

  for (let r = dataStart; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every((c) => c === null || c === "" || c === 0)) continue;

    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const satuan = String(row[3] ?? "");
    const targetTotal = Number(row[4] ?? 0);

    if (/^IKU\s*\d+/i.test(c0)) currentIKU = c0.replace(/\s+/g, " ");
    if (!c1) continue;

    const amounts: ParsedAmount[] = [];
    for (let d = 0; d < dosenNames.length; d++) {
      const raw = row[amtOffset + d];
      if (raw === null || raw === "" || raw === false || raw === true) continue;
      const amt = Number(raw);
      if (!isNaN(amt) && amt > 0) amounts.push({ excelName: dosenNames[d], amount: amt });
    }
    if (!amounts.length) continue;

    const ikuCode = /^IKU\s*\d+/i.test(c0) ? c0.replace(/\s+/g, " ") : currentIKU || c0;
    entries.push({ ikuCode, subLabel: c1, satuan, targetTotal, amounts, sheetName });
  }
  return entries;
}

function matchIndicator(
  ikuCode: string,
  subLabel: string,
  grouped: IndikatorGrouped[],
): { id: number; kode: string } | null {
  const ikuNum = ikuCode.match(/\d+/)?.[0];
  if (!ikuNum) return null;

  const l0 = grouped.find((g) => g.kode === ikuNum || g.kode === `IKU ${ikuNum}`);
  if (!l0) return null;

  const stripped = stripSubPrefix(subLabel);
  const strNorm = stripped.toLowerCase().replace(/[^a-z\s]/g, "").trim();

  for (const l1 of l0.subIndikators) {
    for (const l2 of l1.children) {
      const l2Norm = l2.nama.toLowerCase().replace(/[^a-z\s]/g, "").trim();
      if (l2Norm === strNorm) return { id: l2.id, kode: l2.kode };
      if (strNorm && l2Norm && (strNorm.includes(l2Norm) || l2Norm.includes(strNorm)))
        return { id: l2.id, kode: l2.kode };
      const firstKw = strNorm.split(/\s+/)[0];
      if (firstKw.length >= 2 && l2Norm.startsWith(firstKw)) return { id: l2.id, kode: l2.kode };
      for (const l3 of (l2 as any).children ?? []) {
        const l3Norm = l3.nama.toLowerCase().replace(/[^a-z\s]/g, "").trim();
        if (l3Norm === strNorm || strNorm.includes(l3Norm) || l3Norm.includes(strNorm))
          return { id: l3.id, kode: l3.kode };
      }
    }
  }
  return null;
}

// ─── Cascade rollup helpers ───────────────────────────────────────────────────

const DEPTH_LABELS = ["Dosen", "Kaprodi", "Kajur", "Wadek / WD", "Dekan", "Pimpinan"];

/**
 * Build cascade levels for one indicator WITHOUT calling the API.
 * Returns levels ordered from DEEPEST (dosen) to SHALLOWEST (wadek/dekan),
 * which is also the order we CREATE them (bottom-up dispatch is fine for upsert).
 */
function buildCascadeLevels(
  leafAmounts: { userId: number; amount: number }[],
  allUsers: Map<number, UnitUser>,
): CascadeLevel[] {
  const result: CascadeLevel[] = [];
  let current = leafAmounts.filter((a) => a.amount > 0);
  let depth = 0;

  while (current.length > 0 && depth < 6) {
    const byParent = new Map<number | null, { toUserId: number; toNama: string; jumlahTarget: number }[]>();
    const parentSums = new Map<number, number>();
    let hasParent = false;

    for (const { userId, amount } of current) {
      const user = allUsers.get(userId);
      const parentId = user?.atasanId ?? null;
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId)!.push({
        toUserId: userId,
        toNama: user?.nama ?? String(userId),
        jumlahTarget: amount,
      });
      if (parentId !== null) {
        parentSums.set(parentId, (parentSums.get(parentId) ?? 0) + amount);
        hasParent = true;
      }
    }

    for (const [fromId, items] of byParent.entries()) {
      const fromUser = fromId !== null ? allUsers.get(fromId) : null;
      result.push({
        depth,
        roleLabel: DEPTH_LABELS[depth] ?? `Level ${depth}`,
        fromUserId: fromId,
        fromNama: fromUser?.nama ?? (fromId !== null ? String(fromId) : "Admin"),
        items,
      });
    }

    if (!hasParent) break;
    current = Array.from(parentSums.entries()).map(([userId, amount]) => ({
      userId,
      amount,
    }));
    depth++;
  }

  return result;
}

/** Execute the cascade: call upsertDisposisi for each level (leaf first → top). */
async function executeCascade(
  indicatorId: number,
  tahun: string,
  levels: CascadeLevel[],
): Promise<number> {
  let calls = 0;
  for (const level of levels) {
    const items = level.items.map((i) => ({ toUserId: i.toUserId, jumlahTarget: i.jumlahTarget }));
    await upsertDisposisi(indicatorId, tahun, items, level.fromUserId);
    calls++;
  }
  return calls;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 12, height: 12, flexShrink: 0, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  );
}

// ─── CascadeFlowBadge ─────────────────────────────────────────────────────────

function CascadeFlowBadge({ maxDepth }: { maxDepth: number }) {
  const steps = DEPTH_LABELS.slice(0, maxDepth + 1).reverse(); // top to bottom
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ padding: "3px 10px", borderRadius: 20, background: i === 0 ? "#dbeafe" : i === steps.length - 1 ? "#dcfce7" : "#f3f4f6", color: i === 0 ? "#1e40af" : i === steps.length - 1 ? "#166534" : "#374151", fontSize: 11, fontWeight: 700, border: `1px solid ${i === 0 ? "#bfdbfe" : i === steps.length - 1 ? "#bbf7d0" : "#e5e7eb"}` }}>
            {s}
          </span>
          {i < steps.length - 1 && <span style={{ color: "#9ca3af", fontSize: 13 }}>→</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportTurunanModal({
  open,
  onClose,
  defaultTahun,
}: ImportTurunanModalProps) {
  const [tahun, setTahun] = useState(defaultTahun || String(new Date().getFullYear()));
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState<MatchedEntry[]>([]);
  const [cascadePreviews, setCascadePreviews] = useState<PreviewCascade[]>([]);
  const [allUsers, setAllUsers] = useState<Map<number, UnitUser>>(new Map());
  const [doneStats, setDoneStats] = useState<DoneStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload"); setMatched([]); setCascadePreviews([]); setDoneStats(null); setError(null);
  }

  // ── Parse + Match ─────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });

      // Only process Fixed sheets
      const allEntries: ParsedEntry[] = [];
      for (const sheetName of wb.SheetNames) {
        if (!/fixed/i.test(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
          header: 1, defval: null, raw: true,
        });
        allEntries.push(...parseSheet(aoa, sheetName));
      }

      if (!allEntries.length) {
        setError('Tidak ada data target ditemukan. Pastikan file berisi sheet dengan nama mengandung "Fixed" dan sudah diisi angka target per dosen.');
        return;
      }

      // Fetch DB data
      const [ikuGrouped, pkGrouped, allRoles] = await Promise.all([
        getIndikatorGrouped("IKU", tahun).catch(() => [] as IndikatorGrouped[]),
        getIndikatorGrouped("PK", tahun).catch(() => [] as IndikatorGrouped[]),
        getAllRoles().catch(() => []),
      ]);

      // Build user map (userId → full UnitUser including atasanId)
      const userMap = new Map<number, UnitUser>();
      const nameIndex = new Map<string, UnitUser>();
      const perRoleUsers = await Promise.all(
        allRoles.map((r: any) => getUsersByRole(r.id).catch(() => [])),
      );
      for (const users of perRoleUsers) {
        for (const u of users) {
          if (!userMap.has(u.id)) {
            userMap.set(u.id, u);
            const norm = normalizeName(u.nama);
            if (norm && !nameIndex.has(norm)) nameIndex.set(norm, u);
          }
        }
      }

      function findUser(excelName: string): UnitUser | null {
        const norm = normalizeName(excelName);
        if (!norm) return null;
        const exact = nameIndex.get(norm);
        if (exact) return exact;
        let best: UnitUser | null = null;
        let bestScore = 999;
        for (const [dbNorm, u] of nameIndex.entries()) {
          if (dbNorm.includes(norm) || norm.includes(dbNorm)) {
            const diff = Math.abs(dbNorm.length - norm.length);
            if (diff < bestScore) { bestScore = diff; best = u; }
          }
        }
        return bestScore <= 8 ? best : null;
      }

      // De-duplicate entries, merge amounts across sheets
      const entryMap = new Map<string, MatchedEntry>();
      for (const e of allEntries) {
        const key = `${e.ikuCode}|||${e.subLabel}`;
        if (!entryMap.has(key)) {
          let indMatch = matchIndicator(e.ikuCode, e.subLabel, ikuGrouped);
          if (!indMatch) indMatch = matchIndicator(e.ikuCode, e.subLabel, pkGrouped);
          entryMap.set(key, {
            ikuCode: e.ikuCode, subLabel: e.subLabel, satuan: e.satuan,
            targetTotal: e.targetTotal, sheetName: e.sheetName,
            indicatorId: indMatch?.id ?? null, indicatorKode: indMatch?.kode ?? "?",
            amounts: [],
          });
        }
        const me = entryMap.get(key)!;
        for (const a of e.amounts) {
          if (me.amounts.some((x) => x.excelName === a.excelName)) continue;
          const u = findUser(a.excelName);
          me.amounts.push({ excelName: a.excelName, amount: a.amount, userId: u?.id ?? null, dbNama: u?.nama ?? "" });
        }
      }

      const matchedEntries = Array.from(entryMap.values());

      // Build cascade previews (dry run — no API calls)
      const previews: PreviewCascade[] = [];
      for (const me of matchedEntries) {
        if (!me.indicatorId) continue;
        const leaf = me.amounts
          .filter((a) => a.userId !== null && a.amount > 0)
          .map((a) => ({ userId: a.userId!, amount: a.amount }));
        if (!leaf.length) continue;
        const levels = buildCascadeLevels(leaf, userMap);
        previews.push({ indicatorId: me.indicatorId, indicatorKode: me.indicatorKode, subLabel: me.subLabel, levels });
      }

      // Debug: show user map and cascade depth in console
      const usersWithAtasan = Array.from(userMap.values()).filter((u) => u.atasanId !== null && u.atasanId !== undefined);
      console.log(`[ImportTurunan] Total users loaded: ${userMap.size}, with atasanId: ${usersWithAtasan.length}`);
      if (usersWithAtasan.length === 0) {
        console.warn("[ImportTurunan] WARNING: No users have atasanId set! Cascade will be depth=1 only. Check user_relations in DB.");
      }
      console.log("[ImportTurunan] Sample users:", Array.from(userMap.values()).slice(0, 5).map((u) => ({ id: u.id, nama: u.nama, role: u.role, atasanId: u.atasanId })));
      console.log("[ImportTurunan] Cascade previews:", previews.map((p) => ({ kode: p.indicatorKode, label: p.subLabel, levels: p.levels.length, maxDepth: p.levels.reduce((m, l) => Math.max(m, l.depth), 0) })));

      setMatched(matchedEntries);
      setCascadePreviews(previews);
      setAllUsers(userMap);
      setStep("preview");
    } catch (e: any) {
      setError("Gagal memproses file: " + (e?.message ?? "unknown error"));
    } finally {
      setLoading(false);
    }
  }

  // ── Import (full cascade) ─────────────────────────────────────────────────

  async function handleImport() {
    setStep("importing");
    setLoading(true);
    let indicatorsOk = 0, cascadeCalls = 0, skippedInd = 0, skippedUser = 0, maxDepth = 0;
    try {
      for (const me of matched) {
        if (!me.indicatorId) { skippedInd++; continue; }
        const leaf = me.amounts
          .filter((a) => a.userId !== null && a.amount > 0)
          .map((a) => ({ userId: a.userId!, amount: a.amount }));
        skippedUser += me.amounts.filter((a) => a.userId === null).length;
        if (!leaf.length) continue;

        const levels = buildCascadeLevels(leaf, allUsers);
        const calls = await executeCascade(me.indicatorId, tahun, levels);
        cascadeCalls += calls;
        maxDepth = Math.max(maxDepth, levels.reduce((m, l) => Math.max(m, l.depth), 0));
        indicatorsOk++;
      }
      setDoneStats({ indicators: indicatorsOk, cascadeCalls, skippedInd, skippedUser, maxDepth });
      setStep("done");
      toast.success(`${indicatorsOk} indikator berhasil dikaskade ke ${maxDepth + 1} level jabatan.`);
    } catch (e: any) {
      toast.error("Import gagal: " + (e?.message ?? "error"));
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  // Computed preview stats
  const matchedInd = matched.filter((m) => m.indicatorId !== null).length;
  const totalInd = matched.length;
  const allExcelUsers = new Set(matched.flatMap((m) => m.amounts.map((a) => a.excelName)));
  const matchedUserNames = new Set(matched.flatMap((m) => m.amounts.filter((a) => a.userId !== null).map((a) => a.excelName)));
  const maxCascadeDepth = cascadePreviews.reduce((m, p) => Math.max(m, p.levels.reduce((mm, l) => Math.max(mm, l.depth), 0)), 0);
  const totalCascadeCalls = cascadePreviews.reduce((s, p) => s + p.levels.length, 0);

  const isWide = step === "preview" || step === "importing";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 10px 48px rgba(0,0,0,0.20)", width: "100%", maxWidth: isWide ? 960 : 520, maxHeight: "92vh", display: "flex", flexDirection: "column", transition: "max-width 0.25s" }}>

        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#FF7900,#ff9e3a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>📥</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Import Rencana Turunan Cascading</div>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, paddingLeft: 42 }}>
              Upload file → otomatis distribusi target ke seluruh jenjang: Wadek → Kajur → Kaprodi → Dosen
            </div>
          </div>
          <button onClick={onClose} disabled={loading} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: 4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {/* ── UPLOAD ── */}
          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Tahun</label>
                <input value={tahun} onChange={(e) => setTahun(e.target.value)} placeholder="2026"
                  style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none" }} />
              </div>

              {/* How it works */}
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", fontSize: 12, lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>Cara kerja</div>
                {[
                  ["1", "Baca sheet Fixed (S1 SI Fixed, SI IF FIxed, S1 SD Fixed, D3 SI Fixed)"],
                  ["2", "Cocokkan nama dosen di Excel → user di database"],
                  ["3", "Cocokkan kode IKU → indikator di database"],
                  ["4", "Hitung target tiap level via atasanId: Kaprodi = Σ dosen, Kajur = Σ Kaprodi, dst."],
                  ["5", "Buat disposisi serentak di semua level jenjang"],
                ].map(([n, t]) => (
                  <div key={n} style={{ display: "flex", gap: 10, color: "#6b7280" }}>
                    <span style={{ minWidth: 18, height: 18, borderRadius: "50%", background: "#e5e7eb", color: "#374151", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                    {t}
                  </div>
                ))}
              </div>

              {/* Cascade flow preview */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", marginRight: 4 }}>Alur:</span>
                <CascadeFlowBadge maxDepth={3} />
              </div>

              {/* Drop zone */}
              <div
                onClick={() => !loading && fileRef.current?.click()}
                style={{ border: "2px dashed #d1d5db", borderRadius: 14, padding: "44px 24px", textAlign: "center", cursor: loading ? "not-allowed" : "pointer", background: loading ? "#f9fafb" : "#fafafa", transition: "border-color 0.15s, background 0.15s" }}
                onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = "#FF7900"; (e.currentTarget as HTMLElement).style.background = "#fff8f0"; } }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db"; (e.currentTarget as HTMLElement).style.background = loading ? "#f9fafb" : "#fafafa"; }}
              >
                {loading ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Memproses & mencocokkan data...</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>Membaca sheet Fixed, mencocokkan nama dosen dan indikator ke database</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Klik untuk upload file Excel</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>FIX Rencana Turunan Cashading PK DAN SKP 2026.xlsx</div>
                    <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 4 }}>.xlsx · .xls</div>
                  </>
                )}
                {error && (
                  <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626", textAlign: "left" }}>
                    ⚠ {error}
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFile(f); e.target.value = ""; }} />
            </div>
          )}

          {/* ── PREVIEW ── */}
          {(step === "preview" || step === "importing") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Cascade flow detected */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", flexShrink: 0 }}>Alur terdeteksi:</span>
                <CascadeFlowBadge maxDepth={maxCascadeDepth} />
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { v: `${matchedInd}/${totalInd}`, label: "Indikator", ok: matchedInd === totalInd, bg: "#eff6ff", border: "#bfdbfe", col: "#1e3a8a" },
                  { v: `${matchedUserNames.size}/${allExcelUsers.size}`, label: "Dosen Matched", ok: matchedUserNames.size === allExcelUsers.size, bg: "#fff7ed", border: "#fed7aa", col: "#c2410c" },
                  { v: maxCascadeDepth + 1, label: "Level Cascade", ok: true, bg: "#f0fdf4", border: "#bbf7d0", col: "#14532d" },
                  { v: totalCascadeCalls, label: "Disposisi Calls", ok: true, bg: "#f5f3ff", border: "#ddd6fe", col: "#5b21b6" },
                ].map(({ v, label, ok, bg, border, col }) => (
                  <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: ok ? col : "#dc2626", lineHeight: 1.1 }}>{String(v)}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {matchedInd < totalInd && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626", lineHeight: 1.5 }}>
                  ⚠ <b>{totalInd - matchedInd} indikator</b> tidak ditemukan di database — baris tersebut akan dilewati. Pastikan indikator sudah ada di Master Indikator.
                </div>
              )}
              {matchedUserNames.size < allExcelUsers.size && (
                <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  ⚠ <b>{allExcelUsers.size - matchedUserNames.size} nama dosen</b> tidak cocok dengan user di database — nama tersebut dilewati. Periksa apakah user sudah terdaftar di sistem.
                </div>
              )}

              {/* Cascade preview per indicator */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                  Rincian Cascade per Indikator ({cascadePreviews.length} indikator)
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", maxHeight: 380, overflowY: "auto" }}>
                  {cascadePreviews.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                      Tidak ada indikator yang cocok dengan database
                    </div>
                  ) : cascadePreviews.map((p, pi) => {
                    const topLevel = p.levels[p.levels.length - 1]; // shallowest = highest in org
                    const leafLevel = p.levels[0]; // deepest = dosen
                    return (
                      <details key={pi} style={{ borderBottom: pi < cascadePreviews.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                        <summary style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 12, userSelect: "none", background: pi % 2 === 0 ? "#fff" : "#fafafa", listStyle: "none" }}>
                          <span style={{ minWidth: 64, fontFamily: "monospace", color: "#1d4ed8", fontWeight: 700 }}>{p.indicatorKode}</span>
                          <span style={{ flex: 1, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.subLabel}</span>
                          <span style={{ color: "#6b7280", fontSize: 11, flexShrink: 0 }}>{p.levels.length} disposisi · {p.levels.reduce((s, l) => s + l.items.length, 0)} penerima</span>
                          <span style={{ color: "#9ca3af", fontSize: 16, flexShrink: 0 }}>›</span>
                        </summary>
                        <div style={{ padding: "0 14px 12px 14px", background: "#f8fafc" }}>
                          {/* Cascade chain for this indicator (top to bottom) */}
                          {[...p.levels].reverse().map((level, li) => (
                            <div key={li} style={{ marginTop: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#1e3a8a", color: "#fff" }}>
                                  {level.roleLabel}
                                </span>
                                <span style={{ fontSize: 11, color: "#6b7280" }}>
                                  dari: <b>{level.fromNama || "Admin"}</b>
                                </span>
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>→ {level.items.length} penerima</span>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 4 }}>
                                {level.items.slice(0, 6).map((item, ii) => (
                                  <span key={ii} style={{ fontSize: 10, padding: "2px 8px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 4, color: "#374151" }}>
                                    {item.toNama.split(" ").slice(0, 2).join(" ")} ({item.jumlahTarget})
                                  </span>
                                ))}
                                {level.items.length > 6 && (
                                  <span style={{ fontSize: 10, padding: "2px 8px", background: "#f3f4f6", borderRadius: 4, color: "#9ca3af" }}>
                                    +{level.items.length - 6} lagi
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>

              {/* Unmatched users */}
              {allExcelUsers.size > matchedUserNames.size && (
                <details>
                  <summary style={{ fontSize: 11, color: "#9ca3af", cursor: "pointer", userSelect: "none" }}>
                    Lihat nama dosen yang tidak cocok ({allExcelUsers.size - matchedUserNames.size} nama)
                  </summary>
                  <div style={{ marginTop: 6, padding: "8px 12px", background: "#f9fafb", borderRadius: 6, fontSize: 11, color: "#dc2626", lineHeight: 1.8 }}>
                    {Array.from(allExcelUsers).filter((n) => !matchedUserNames.has(n)).map((n) => (
                      <div key={n}>✕ {n}</div>
                    ))}
                  </div>
                </details>
              )}

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 4 }}>
                <button onClick={reset} disabled={loading} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                  ← Upload Ulang
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || matchedInd === 0}
                  style={{ padding: "8px 26px", borderRadius: 8, border: "none", background: loading || matchedInd === 0 ? "#d1d5db" : "#FF7900", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading || matchedInd === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: loading || matchedInd === 0 ? "none" : "0 3px 10px rgba(255,121,0,0.35)" }}
                >
                  {loading ? <><Spinner /> Membuat cascade disposisi...</> : `Terapkan Cascade ${matchedInd} Indikator →`}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && doneStats && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Banner */}
              <div style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1.5px solid #86efac", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#16a34a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "0 3px 10px rgba(22,163,74,0.3)" }}>✓</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#14532d" }}>Import cascade berhasil!</div>
                  <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>Disposisi dibuat di {doneStats.maxDepth + 1} level jenjang · Tahun {tahun}</div>
                </div>
              </div>

              {/* Cascade flow result */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginRight: 4 }}>Alur dibuat:</span>
                <CascadeFlowBadge maxDepth={doneStats.maxDepth} />
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { v: doneStats.indicators, label: "Indikator", bg: "#eff6ff", border: "#bfdbfe", col: "#1e3a8a" },
                  { v: doneStats.cascadeCalls, label: "Disposisi Dibuat", bg: "#f5f3ff", border: "#ddd6fe", col: "#5b21b6" },
                  { v: doneStats.maxDepth + 1, label: "Level Jenjang", bg: "#f0fdf4", border: "#bbf7d0", col: "#14532d" },
                  ...(doneStats.skippedInd > 0 ? [{ v: doneStats.skippedInd, label: "Ind. Skip", bg: "#fef2f2", border: "#fecaca", col: "#dc2626" }] : []),
                  ...(doneStats.skippedUser > 0 ? [{ v: doneStats.skippedUser, label: "Dosen Skip", bg: "#fffbeb", border: "#fde68a", col: "#92400e" }] : []),
                ].map(({ v, label, bg, border, col }) => (
                  <div key={label} style={{ flex: 1, minWidth: 80, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: col, lineHeight: 1.1 }}>{v}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={reset} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>↺ Import Lagi</button>
                <button onClick={onClose} style={{ padding: "8px 24px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px rgba(22,163,74,0.3)" }}>Selesai</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
}
