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
  saveIndikatorCascadeChain,
  type IndikatorGrouped,
  type UnitUser,
} from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedAmount {
  excelName: string;
  amount: number;
}

interface VMarkEntry {
  roleLabel: string; // "Wakil Dekan 1", "Kepala Jurusan", "Koordinator Prodi"
  colNama: string;   // user name from header row
}

interface ParsedEntry {
  ikuCode: string;
  subLabel: string;
  satuan: string;
  targetTotal: number;
  targetProdiMin: number;
  amounts: ParsedAmount[];
  sheetName: string;
  vMarks: VMarkEntry[]; // V marks collected per-row (per indicator), not per sheet
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
  targetProdiMin: number;
  sheetName: string;
  indicatorId: number | null;
  indicatorKode: string;
  amounts: MatchedAmount[];
  vMarks: VMarkEntry[]; // per-row V marks for this specific indicator row
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
  skippedVMark: number;
  maxDepth: number;
  chainsSaved: number;
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
  return label.trim().replace(/^[a-z]\.\s*/i, "").replace(/\*+$/, "").trim();
}

interface ColDef { name: string; role: string; dataColIdx: number; }

function parseSheet(
  aoa: (string | number | boolean | null)[][],
  sheetName: string,
): { entries: ParsedEntry[]; sheetChain: VMarkEntry[] } {
  if (!aoa.length) return { entries: [], sheetChain: [] };
  const h0 = (aoa[0] as (string | null)[]).map((c) => String(c ?? "").trim());

  // Check for role row (row 1) — present in new template format
  const h1 = aoa.length > 1 ? (aoa[1] as (string | null)[]).map((c) => String(c ?? "").trim()) : [];
  const hasRoleRow = h1.slice(6).some((v) =>
    /wakil dekan|kepala jurusan|koordinator prodi|dosen/i.test(v),
  );

  const jumlahIdx = h0.findIndex((v) => v === "Jumlah");
  const sisaIdx = h0.findIndex((v) => v.toLowerCase() === "sisa");
  const isDetailed = jumlahIdx >= 6;

  // Build column definitions preserving original indices so role labels and data
  // values are always looked up from the correct column, even when header has empty cells.
  const colDefs: ColDef[] = [];
  let dataStart: number;

  if (isDetailed) {
    const rawNames = h0.slice(6, jumlahIdx);
    const rawRoles = hasRoleRow ? h1.slice(6, jumlahIdx) : rawNames.map(() => "");
    rawNames.forEach((n, i) => {
      const name = String(n ?? "").trim();
      if (!name) return;
      colDefs.push({ name, role: String(rawRoles[i] ?? "").trim(), dataColIdx: jumlahIdx + 3 + i });
    });
    dataStart = 2;
  } else {
    const endCol = sisaIdx > 6 ? sisaIdx : h0.length;
    const rawNames = h0.slice(6, endCol);
    const rawRoles = hasRoleRow ? h1.slice(6, endCol) : rawNames.map(() => "");
    rawNames.forEach((n, i) => {
      const name = String(n ?? "").trim();
      if (!name) return;
      colDefs.push({ name, role: String(rawRoles[i] ?? "").trim(), dataColIdx: 6 + i });
    });
    dataStart = hasRoleRow ? 2 : 1;
  }

  // Backwards-compat aliases used by existing code below
  const colNames = colDefs.map((c) => c.name);
  const colRoles = colDefs.map((c) => c.role);

  if (!colDefs.length) return { entries: [], sheetChain: [] };

  const entries: ParsedEntry[] = [];
  let currentIKU = "";
  // Sheet-level chain (union of all row V marks) — kept for display only
  const sheetChainMap = new Map<string, VMarkEntry>();

  for (let r = dataStart; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every((c) => c === null || c === "" || c === 0)) continue;

    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const satuan = String(row[3] ?? "");
    const targetTotal = Number(row[4] ?? 0);
    const targetProdiMin = Number(row[5] ?? 0);

    if (/^(IKU|PK)\s*\d+/i.test(c0)) currentIKU = c0.replace(/\s+/g, " ");
    if (!c1) continue;

    const amounts: ParsedAmount[] = [];
    const rowVMarks: VMarkEntry[] = []; // per-row V marks for this specific indicator
    for (let d = 0; d < colDefs.length; d++) {
      const raw = row[colDefs[d].dataColIdx];
      const roleLabel = colDefs[d].role;
      const isPimpinan = hasRoleRow && /wakil dekan|kepala jurusan|koordinator prodi/i.test(roleLabel);

      if (isPimpinan) {
        // Collect V mark for cascade chain configuration — per-row AND sheet-level
        const val = String(raw ?? "").trim().toUpperCase();
        if (val === "V") {
          const colNama = colNames[d];
          rowVMarks.push({ roleLabel, colNama }); // per-row
          if (!sheetChainMap.has(colNama)) sheetChainMap.set(colNama, { roleLabel, colNama }); // sheet-level for display
        }
      } else {
        // Dosen column: numeric target amount
        if (raw === null || raw === "" || raw === false || raw === true) continue;
        const amt = Number(raw);
        if (!isNaN(amt) && amt > 0) amounts.push({ excelName: colNames[d], amount: amt });
      }
    }
    // Include rows that have V marks even when dosen amounts are empty —
    // those rows still need to create the upper cascade chain (Kajur→Kaprodi→WD)
    if (!amounts.length && !rowVMarks.length) continue;

    const ikuCode = /^(IKU|PK)\s*\d+/i.test(c0) ? c0.replace(/\s+/g, " ") : currentIKU || c0;
    entries.push({ ikuCode, subLabel: c1, satuan, targetTotal, targetProdiMin, amounts, sheetName, vMarks: rowVMarks });
  }
  return { entries, sheetChain: Array.from(sheetChainMap.values()) };
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
 * Build cascade levels from V-mark users directly (top→bottom by role hierarchy).
 * This replaces the atasanId-based buildCascadeLevels for pimpinan chain creation,
 * because atasanId is often null/unconfigured in the DB.
 *
 * Result: Admin→WD(amt), WD→KJ(amt) [if KJ resolved], KJ→KP(amt), KP→dosens.
 */
function buildLevelsFromVMarks(
  vMarks: VMarkEntry[],
  kaprodiUser: UnitUser,
  kaprodiAmount: number,
  leaf: { userId: number; amount: number }[],
  allUsers: Map<number, UnitUser>,
  findUser: (name: string) => UnitUser | null,
): CascadeLevel[] {
  const roleLevel = (label: string): number =>
    /wakil dekan/i.test(label) ? 1 : /kepala jurusan/i.test(label) ? 2 : /koordinator prodi/i.test(label) ? 3 : 99;

  // Collect resolved pimpinan users from V marks, ordered by role hierarchy (WD first)
  const pimpinan: Array<{ user: UnitUser; roleLabel: string; lvl: number }> = [];
  for (const vm of vMarks) {
    const lvl = roleLevel(vm.roleLabel);
    if (lvl === 99) continue;
    const user = findUser(vm.colNama);
    if (!user) continue;
    if (!pimpinan.some((p) => p.user.id === user.id)) {
      pimpinan.push({ user, roleLabel: vm.roleLabel, lvl });
    }
  }
  pimpinan.sort((a, b) => a.lvl - b.lvl); // WD first, then KJ, then KP

  // Ensure kaprodi is always in chain
  if (!pimpinan.some((p) => p.user.id === kaprodiUser.id)) {
    pimpinan.push({ user: kaprodiUser, roleLabel: 'Koordinator Prodi', lvl: 3 });
  }

  const levels: CascadeLevel[] = [];

  // Build pimpinan chain: each level receives kaprodiAmount from the one above
  for (let i = 0; i < pimpinan.length; i++) {
    const curr = pimpinan[i];
    const prev = i > 0 ? pimpinan[i - 1] : null;
    levels.push({
      depth: i,
      roleLabel: curr.roleLabel,
      fromUserId: prev?.user.id ?? null,
      fromNama: prev?.user.nama ?? 'Admin',
      items: [{ toUserId: curr.user.id, toNama: curr.user.nama, jumlahTarget: kaprodiAmount }],
    });
  }

  // Dosen level: kaprodi distributes individual amounts to dosens
  if (leaf.length > 0) {
    levels.push({
      depth: pimpinan.length,
      roleLabel: 'Dosen',
      fromUserId: kaprodiUser.id,
      fromNama: kaprodiUser.nama,
      items: leaf.map((a) => ({
        toUserId: a.userId,
        toNama: allUsers.get(a.userId)?.nama ?? String(a.userId),
        jumlahTarget: a.amount,
      })),
    });
  }

  return levels;
}

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

// ─── Unit user data (for template generation) ────────────────────────────────

interface TplUser { nama: string; role: string; }

const UNIT_DOSEN_TEMPLATE: { sheetName: string; users: TplUser[] }[] = [
  {
    sheetName: "S1 SI Fixed",
    users: [
      { nama: "Erly Krisnanik",           role: "Wakil Dekan 1"      },
      { nama: "Bambang Saras Yuliastiawan",role: "Wakil Dekan 2"      },
      { nama: "Ati Zaidiah",              role: "Wakil Dekan 3"      },
      { nama: "Dr. Widya Cholil",         role: "Kepala Jurusan"     },
      { nama: "Anita Muliati",            role: "Koordinator Prodi"  },
      { nama: "Dosen SI 1",               role: "Dosen"              },
      { nama: "Dosen SI 2",               role: "Dosen"              },
      { nama: "Susanto",                  role: "Dosen"              },
      { nama: "Rio Wirawan",              role: "Dosen"              },
      { nama: "Tjajanto",                 role: "Dosen"              },
      { nama: "Bambang Tri Wahyono",      role: "Dosen"              },
      { nama: "I Wayan Widi Pradnyana",   role: "Dosen"              },
      { nama: "Kraugusteeliana",          role: "Dosen"              },
      { nama: "Catur Nugrahaeni Puspita Dewi", role: "Dosen"         },
      { nama: "Ria Astriratma",           role: "Dosen"              },
      { nama: "Ruth Mariana Bunga Wadu",  role: "Dosen"              },
      { nama: "Sarika",                   role: "Dosen"              },
      { nama: "Artika Arista",            role: "Dosen"              },
      { nama: "Ika Nurlaili",             role: "Dosen"              },
      { nama: "Zatin Niqotaini",          role: "Dosen"              },
      { nama: "Rifka Dwi Amalia",         role: "Dosen"              },
      { nama: "Ade Hikma Tiana",          role: "Dosen"              },
      { nama: "Mardiah",                  role: "Dosen"              },
    ],
  },
  {
    sheetName: "S1 IF Fixed",
    users: [
      { nama: "Erly Krisnanik",           role: "Wakil Dekan 1"      },
      { nama: "Bambang Saras Yuliastiawan",role: "Wakil Dekan 2"      },
      { nama: "Ati Zaidiah",              role: "Wakil Dekan 3"      },
      { nama: "Dr. Widya Cholil",         role: "Kepala Jurusan"     },
      { nama: "Ridwan Raafiudin",         role: "Koordinator Prodi"  },
      { nama: "Dosen IF 1",               role: "Dosen"              },
      { nama: "Radinal Setyadinsa",       role: "Dosen"              },
      { nama: "Didit Widiyanto",          role: "Dosen"              },
      { nama: "Jayanta",                  role: "Dosen"              },
      { nama: "Henki Bayu Seta",          role: "Dosen"              },
      { nama: "Indra Permana Solihin",    role: "Dosen"              },
      { nama: "Noor Falih",               role: "Dosen"              },
      { nama: "Ichsan Mardani",           role: "Dosen"              },
      { nama: "Desta Sandya Prasvita",    role: "Dosen"              },
      { nama: "Mayanda Mega Santoni",     role: "Dosen"              },
      { nama: "Nurul Chamidah",           role: "Dosen"              },
      { nama: "Bayu Hananto",             role: "Dosen"              },
      { nama: "Hamonangan Kinantan Prabu",role: "Dosen"              },
      { nama: "Neny Rosmawarni",          role: "Dosen"              },
      { nama: "I Wayan Rangga Pinastawa", role: "Dosen"              },
      { nama: "Kharisma Wiati Gusti",     role: "Dosen"              },
      { nama: "Nurhuda Maulana",          role: "Dosen"              },
      { nama: "Nurul Afifah Arifuddin",   role: "Dosen"              },
      { nama: "Sanggi Bayu Ardika",       role: "Dosen"              },
      { nama: "Anis Fitri Nur Masruiyah", role: "Dosen"              },
      { nama: "Wildan Alrasyid",          role: "Dosen"              },
    ],
  },
  {
    sheetName: "D3 SI Fixed",
    users: [
      { nama: "Erly Krisnanik",           role: "Wakil Dekan 1"      },
      { nama: "Bambang Saras Yuliastiawan",role: "Wakil Dekan 2"      },
      { nama: "Ati Zaidiah",              role: "Wakil Dekan 3"      },
      { nama: "Dr. Widya Cholil",         role: "Kepala Jurusan"     },
      { nama: "Andhika Octa Indarso",     role: "Koordinator Prodi"  },
      { nama: "Rizky Tito Prasetyo",      role: "Dosen"              },
      { nama: "Bobby Suryo Prakoso",      role: "Dosen"              },
      { nama: "Budi Arif Dermawan",       role: "Dosen"              },
      { nama: "Galih Prakoso Rizky",      role: "Dosen"              },
      { nama: "Rasenda",                  role: "Dosen"              },
      { nama: "Octanty Mulianingtyas",    role: "Dosen"              },
      { nama: "Intan Hesti Indriana",     role: "Dosen"              },
      { nama: "Iin Ernawati",             role: "Dosen"              },
      { nama: "Theresia Wati",            role: "Dosen"              },
      { nama: "Tri Rahayu",               role: "Dosen"              },
      { nama: "Nur Hafifah Matondang",    role: "Dosen"              },
      { nama: "Bayu Wibisono",            role: "Dosen"              },
      { nama: "Helena Nurramdhani Irmanda", role: "Dosen"            },
    ],
  },
  {
    sheetName: "S1 SD Fixed",
    users: [
      { nama: "Erly Krisnanik",           role: "Wakil Dekan 1"      },
      { nama: "Bambang Saras Yuliastiawan",role: "Wakil Dekan 2"      },
      { nama: "Ati Zaidiah",              role: "Wakil Dekan 3"      },
      { nama: "Dr. Widya Cholil",         role: "Kepala Jurusan"     },
      { nama: "Novi Trisman Hadi",        role: "Koordinator Prodi"  },
      { nama: "Hengki Tamando Sihotang",  role: "Dosen"              },
      { nama: "Musthofa Galih Pradana",   role: "Dosen"              },
      { nama: "Muhammad Adrezo",          role: "Dosen"              },
      { nama: "Nindy Irzavika",           role: "Dosen"              },
      { nama: "Muhammad Panji Muslim",    role: "Dosen"              },
      { nama: "Oktaviano",                role: "Dosen"              },
    ],
  },
];

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
  // Role labels detected from V marks (e.g. ["Wadek / WD", "Kajur", "Kaprodi", "Dosen"])
  const [vChainLabels, setVChainLabels] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Data refs for cascade chain building (populated in handleFile, consumed in handleImport)
  const allRolesRef = useRef<any[]>([]);
  const nameIndexRef = useRef<Map<string, UnitUser>>(new Map());
  const userIdToRoleIdsRef = useRef<Map<number, number[]>>(new Map());
  const sheetChainsRef = useRef<Map<string, VMarkEntry[]>>(new Map());
  // Maps matched indicator ID (L2/L3) → parent L1 indicator ID (for cascade chain saving)
  const childToL1Ref = useRef<Map<number, number>>(new Map());

  function reset() {
    setStep("upload"); setMatched([]); setCascadePreviews([]); setDoneStats(null); setError(null); setVChainLabels([]);
  }

  // ── Download Template ─────────────────────────────────────────────────────

  async function handleDownloadTemplate() {
    setLoading(true);
    try {
      const [ikuGrouped, pkGrouped] = await Promise.all([
        getIndikatorGrouped("IKU", tahun).catch(() => [] as IndikatorGrouped[]),
        getIndikatorGrouped("PK", tahun).catch(() => [] as IndikatorGrouped[]),
      ]);

      const LETTERS = "abcdefghijklmnopqrstuvwxyz";
      const FIXED_COLS = 6; // Kode | Nama | Dokumen | Satuan | Target | Target Min

      // ── Style definitions ──────────────────────────────────────────────────
      const border = {
        top:    { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left:   { style: "thin", color: { rgb: "000000" } },
        right:  { style: "thin", color: { rgb: "000000" } },
      };
      const hdrStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "1D4ED8" }, patternType: "solid" },
        alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
        border,
      };
      const roleStyle = {
        font: { bold: true, color: { rgb: "1F2937" }, sz: 10 },
        fill: { fgColor: { rgb: "BFDBFE" }, patternType: "solid" },
        alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
        border,
      };
      const ikuL0Style = {
        font: { bold: true, color: { rgb: "1E3A8A" }, sz: 10 },
        fill: { fgColor: { rgb: "DBEAFE" }, patternType: "solid" },
        border,
      };
      const ikuL1Style = {
        font: { bold: true, color: { rgb: "1F2937" }, sz: 10 },
        fill: { fgColor: { rgb: "F0F9FF" }, patternType: "solid" },
        border,
      };
      const pkL1Style = {
        font: { bold: true, color: { rgb: "4C1D95" }, sz: 10 },
        fill: { fgColor: { rgb: "EDE9FE" }, patternType: "solid" },
        border,
      };
      const pkL2Style = {
        font: { italic: true, color: { rgb: "374151" }, sz: 10 },
        fill: { fgColor: { rgb: "F5F3FF" }, patternType: "solid" },
        border,
      };
      const leafStyle = { font: { sz: 10 }, border };
      const emptyStyle = { border };

      function applyRowStyle(ws: XLSX.WorkSheet, rowIdx: number, totalCols: number, style: object) {
        for (let c = 0; c < totalCols; c++) {
          const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };
          (ws[addr] as any).s = style;
        }
      }

      function applyRangeStyle(ws: XLSX.WorkSheet, rowIdx: number, totalCols: number, fixedStyle: object, userStyle: object) {
        for (let c = 0; c < totalCols; c++) {
          const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
          if (!ws[addr]) ws[addr] = { v: "", t: "s" };
          (ws[addr] as any).s = c < FIXED_COLS ? fixedStyle : userStyle;
        }
      }

      const wb = XLSX.utils.book_new();

      for (const { sheetName, users } of UNIT_DOSEN_TEMPLATE) {
        const totalCols = FIXED_COLS + users.length;
        const E = () => users.map(() => "");

        // ── Build rows ────────────────────────────────────────────────────────
        // Row 0: header (name labels)
        // Row 1: role sub-header
        // Row 2+: data

        const rows: (string | number)[][] = [];

        // Row 0 — column headers
        rows.push([
          "Kode", "Indikator Kinerja Kegiatan", "Dokumen", "Satuan",
          "Target", "Target Prodi Min",
          ...users.map((u) => u.nama),
        ]);

        // Row 1 — role labels
        rows.push(["", "", "", "", "", "", ...users.map((u) => u.role)]);

        // Track which row index each data row lands on
        const rowMeta: { type: "ikuL0"|"ikuL1"|"pkL1"|"pkL2"|"leaf"|"blank" }[] = [];
        rowMeta.push({ type: "blank" }); // row 0 placeholder (header)
        rowMeta.push({ type: "blank" }); // row 1 placeholder (role)

        // ── IKU data ─────────────────────────────────────────────────────────
        for (const l0 of ikuGrouped) {
          rows.push([`IKU ${l0.kode}`, l0.nama, "", "", "", "", ...E()]);
          rowMeta.push({ type: "ikuL0" });

          for (const l1 of l0.subIndikators) {
            rows.push(["", l1.nama, "", "", l1.nilaiTarget ?? "", "", ...E()]);
            rowMeta.push({ type: "ikuL1" });

            let li = 0;
            for (const l2 of l1.children) {
              if (l2.children.length > 0) {
                for (const l3 of l2.children) {
                  rows.push(["", `${LETTERS[li++] ?? "?"}. ${l3.nama}`, "", l3.satuan ?? "", l3.nilaiTarget ?? "", "", ...E()]);
                  rowMeta.push({ type: "leaf" });
                }
              } else {
                rows.push(["", `${LETTERS[li++] ?? "?"}. ${l2.nama}`, "", l2.satuan ?? "", l2.nilaiTarget ?? "", "", ...E()]);
                rowMeta.push({ type: "leaf" });
              }
            }
          }
          // blank spacer between IKU groups
          rows.push(Array(totalCols).fill(""));
          rowMeta.push({ type: "blank" });
        }

        // blank separator before PK
        rows.push(Array(totalCols).fill(""));
        rowMeta.push({ type: "blank" });

        // ── PK data ───────────────────────────────────────────────────────────
        for (const l0 of pkGrouped) {
          let isFirstL1 = true;
          for (const l1 of l0.subIndikators) {
            rows.push([isFirstL1 ? `PK ${l0.kode}` : "", l1.nama, "", "", "", "", ...E()]);
            rowMeta.push({ type: "pkL1" });
            isFirstL1 = false;

            for (const l2 of l1.children) {
              rows.push(["", `  ${l2.nama}`, "", "", "", "", ...E()]);
              rowMeta.push({ type: "pkL2" });

              let li = 0;
              if (l2.children.length > 0) {
                for (const l3 of l2.children) {
                  rows.push(["", `    ${LETTERS[li++] ?? "?"}. ${l3.nama}`, "", l3.satuan ?? "", l3.nilaiTarget ?? "", "", ...E()]);
                  rowMeta.push({ type: "leaf" });
                }
              } else {
                rows.push(["", `    ${LETTERS[li++] ?? "?"}. ${l2.nama}`, "", l2.satuan ?? "", l2.nilaiTarget ?? "", "", ...E()]);
                rowMeta.push({ type: "leaf" });
              }
            }
          }
          rows.push(Array(totalCols).fill(""));
          rowMeta.push({ type: "blank" });
        }

        // ── Create worksheet ──────────────────────────────────────────────────
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // ── Apply styles row by row ───────────────────────────────────────────
        for (let ri = 0; ri < rowMeta.length; ri++) {
          const { type } = rowMeta[ri];
          if (type === "blank") continue;

          if (ri === 0) {
            applyRowStyle(ws, ri, totalCols, hdrStyle);
          } else if (ri === 1) {
            // role row: fixed cols get hdrStyle, user cols get roleStyle
            applyRangeStyle(ws, ri, totalCols, hdrStyle, roleStyle);
          } else if (type === "ikuL0") {
            applyRowStyle(ws, ri, totalCols, ikuL0Style);
          } else if (type === "ikuL1") {
            applyRowStyle(ws, ri, totalCols, ikuL1Style);
          } else if (type === "pkL1") {
            applyRowStyle(ws, ri, totalCols, pkL1Style);
          } else if (type === "pkL2") {
            applyRowStyle(ws, ri, totalCols, pkL2Style);
          } else if (type === "leaf") {
            // fixed cols: leaf style; user cols: empty with border
            for (let c = 0; c < totalCols; c++) {
              const addr = XLSX.utils.encode_cell({ r: ri, c });
              if (!ws[addr]) ws[addr] = { v: "", t: "s" };
              (ws[addr] as any).s = c < FIXED_COLS ? leafStyle : emptyStyle;
            }
          }
        }

        // ── Row heights & col widths ──────────────────────────────────────────
        ws["!rows"] = [{ hpt: 36 }, { hpt: 28 }]; // header rows taller
        ws["!cols"] = [
          { wch: 10 }, { wch: 60 }, { wch: 10 }, { wch: 14 },
          { wch: 10 }, { wch: 16 },
          ...users.map(() => ({ wch: 22 })),
        ];

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      XLSX.writeFile(wb, `template-cascade-${tahun}.xlsx`);
    } catch (e: any) {
      toast.error("Gagal generate template: " + (e?.message ?? "error"));
    } finally {
      setLoading(false);
    }
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
      const sheetChains = new Map<string, VMarkEntry[]>();
      for (const sheetName of wb.SheetNames) {
        if (!/fixed/i.test(sheetName)) continue;
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
          header: 1, defval: null, raw: true,
        });
        const { entries, sheetChain } = parseSheet(aoa, sheetName);
        allEntries.push(...entries);
        if (sheetChain.length > 0) sheetChains.set(sheetName, sheetChain);
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
      // Track which role IDs each user was fetched under (for cascade chain role lookup)
      const userIdToRoleIds = new Map<number, number[]>();
      const perRoleUsers = await Promise.all(
        allRoles.map((r: any) => getUsersByRole(r.id).catch(() => [])),
      );
      for (let ri = 0; ri < allRoles.length; ri++) {
        for (const u of perRoleUsers[ri]) {
          if (!userMap.has(u.id)) {
            userMap.set(u.id, u);
            const norm = normalizeName(u.nama);
            if (norm && !nameIndex.has(norm)) nameIndex.set(norm, u);
          }
          // Record all role IDs for this user
          if (!userIdToRoleIds.has(u.id)) userIdToRoleIds.set(u.id, []);
          const rids = userIdToRoleIds.get(u.id)!;
          if (!rids.includes(allRoles[ri].id)) rids.push(allRoles[ri].id);
        }
      }

      // Build childId (L2/L3) → L1 indicator ID map for cascade chain saving
      const childToL1 = new Map<number, number>();
      for (const l0 of [...ikuGrouped, ...pkGrouped]) {
        for (const l1 of l0.subIndikators) {
          childToL1.set(l1.id, l1.id);
          for (const l2 of l1.children) {
            childToL1.set(l2.id, l1.id);
            for (const l3 of (l2 as any).children ?? []) {
              childToL1.set(l3.id, l1.id);
            }
          }
        }
      }

      // Store in refs for use in handleImport
      allRolesRef.current = allRoles;
      nameIndexRef.current = nameIndex;
      userIdToRoleIdsRef.current = userIdToRoleIds;
      sheetChainsRef.current = sheetChains;
      childToL1Ref.current = childToL1;

      // Build display labels from V marks (for "Alur terdeteksi" badge in preview)
      const chainLabels: string[] = [];
      for (const vMarks of sheetChains.values()) {
        if (!vMarks.length) continue;
        if (vMarks.some((v) => /wakil dekan/i.test(v.roleLabel))) chainLabels.push("Wadek / WD");
        if (vMarks.some((v) => /kepala jurusan/i.test(v.roleLabel))) chainLabels.push("Kajur");
        if (vMarks.some((v) => /koordinator prodi/i.test(v.roleLabel))) chainLabels.push("Kaprodi");
        chainLabels.push("Dosen");
        break; // use first sheet with V marks as representative
      }
      setVChainLabels(chainLabels);

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

      // Keep entries per-sheet: each sheet×indicator gets its own entry.
      // This ensures each prodi's kaprodi gets the correct targetProdiMin and V-mark chain.
      const entryMap = new Map<string, MatchedEntry>();
      for (const e of allEntries) {
        const key = `${e.sheetName}|||${e.ikuCode}|||${e.subLabel}`;
        if (!entryMap.has(key)) {
          let indMatch = matchIndicator(e.ikuCode, e.subLabel, ikuGrouped);
          if (!indMatch) indMatch = matchIndicator(e.ikuCode, e.subLabel, pkGrouped);
          entryMap.set(key, {
            ikuCode: e.ikuCode, subLabel: e.subLabel, satuan: e.satuan,
            targetTotal: e.targetTotal, targetProdiMin: e.targetProdiMin,
            sheetName: e.sheetName,
            indicatorId: indMatch?.id ?? null, indicatorKode: indMatch?.kode ?? "?",
            amounts: [],
            vMarks: e.vMarks,
          });
        }
        const me = entryMap.get(key)!;
        // Merge vMarks: if first entry had none but a later row does, pick them up
        if (me.vMarks.length === 0 && e.vMarks.length > 0) {
          me.vMarks = e.vMarks;
        }
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
        // Use per-row V marks (falls back to sheet-level chain for older entries without per-row marks)
        const vMarksPreview = me.vMarks.length > 0 ? me.vMarks : (sheetChains.get(me.sheetName) ?? []);
        // Find deepest marked pimpinan in hierarchy: KaProdi > KaJur > WD
        // This allows partial chains (e.g. WD only, or WD+KaJur) to still build correctly
        const kaprodiMarkPreview =
          vMarksPreview.find((v) => /koordinator prodi/i.test(v.roleLabel)) ??
          vMarksPreview.find((v) => /kepala jurusan/i.test(v.roleLabel)) ??
          vMarksPreview.find((v) => /wakil dekan/i.test(v.roleLabel));
        const kaprodiUserPreview = kaprodiMarkPreview
          ? (nameIndex.get(normalizeName(kaprodiMarkPreview.colNama)) ?? null)
          : null;
        const kaprodiAmountPreview = kaprodiUserPreview
          ? (me.targetProdiMin > 0 ? me.targetProdiMin : leaf.reduce((s, a) => s + a.amount, 0))
          : 0;
        // Skip if no leaf AND no kaprodi amount
        if (!leaf.length && kaprodiAmountPreview <= 0) continue;
        let levels: CascadeLevel[];
        if (kaprodiUserPreview && kaprodiAmountPreview > 0) {
          levels = buildLevelsFromVMarks(vMarksPreview, kaprodiUserPreview, kaprodiAmountPreview, leaf, userMap,
            (name) => nameIndex.get(normalizeName(name)) ?? null);
        } else {
          if (!leaf.length) continue;
          levels = buildCascadeLevels(leaf, userMap);
        }
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
      console.log("[ImportTurunan] V-mark chains detected:", Object.fromEntries(Array.from(sheetChains.entries()).map(([s, v]) => [s, v.map((x) => `${x.colNama} (${x.roleLabel})`)])));

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
    let indicatorsOk = 0, cascadeCalls = 0, skippedInd = 0, skippedUser = 0, skippedVMark = 0, maxDepth = 0, chainsSaved = 0;
    try {
      // Helpers for cascade chain building (use refs populated in handleFile)
      const localRoles = allRolesRef.current;
      const localNameIndex = nameIndexRef.current;
      const localUserRoleIds = userIdToRoleIdsRef.current;
      const localSheetChains = sheetChainsRef.current;
      const localChildToL1 = childToL1Ref.current;

      function findUserLocal(excelName: string): UnitUser | null {
        const norm = normalizeName(excelName);
        if (!norm) return null;
        const exact = localNameIndex.get(norm);
        if (exact) return exact;
        let best: UnitUser | null = null;
        let bestScore = 999;
        for (const [dbNorm, u] of localNameIndex.entries()) {
          if (dbNorm.includes(norm) || norm.includes(dbNorm)) {
            const diff = Math.abs(dbNorm.length - norm.length);
            if (diff < bestScore) { bestScore = diff; best = u; }
          }
        }
        return bestScore <= 8 ? best : null;
      }

      function findRoleIdForUser(userId: number, roleLabel: string): number | null {
        const roleIds = localUserRoleIds.get(userId) ?? [];
        // Prefer exact role name match for this user
        for (const rId of roleIds) {
          const role = localRoles.find((r: any) => r.id === rId);
          if (role && role.name.toLowerCase() === roleLabel.toLowerCase()) return rId;
        }
        // Fallback: any non-dosen role for this user
        for (const rId of roleIds) {
          const role = localRoles.find((r: any) => r.id === rId);
          if (role && !/dosen/i.test(role.name)) return rId;
        }
        // Last fallback: find by role name alone (might be wrong unit)
        const byName = localRoles.find((r: any) => r.name.toLowerCase() === roleLabel.toLowerCase());
        return byName?.id ?? null;
      }

      function buildChainFromVMarks(vMarks: VMarkEntry[]): (number | number[])[] {
        const wdRoleIds: number[] = [];
        let kajurRoleId: number | null = null;
        let kaprodiRoleId: number | null = null;

        for (const { roleLabel, colNama } of vMarks) {
          const user = findUserLocal(colNama);
          const roleId = user ? findRoleIdForUser(user.id, roleLabel) : null;
          if (!roleId) continue;

          if (/wakil dekan/i.test(roleLabel)) {
            if (!wdRoleIds.includes(roleId)) wdRoleIds.push(roleId);
          } else if (/kepala jurusan/i.test(roleLabel)) {
            kajurRoleId = roleId;
          } else if (/koordinator prodi/i.test(roleLabel)) {
            kaprodiRoleId = roleId;
          }
        }

        const chain: (number | number[])[] = [];
        if (wdRoleIds.length === 1) chain.push(wdRoleIds[0]);
        else if (wdRoleIds.length > 1) chain.push(wdRoleIds);
        if (kajurRoleId !== null) chain.push(kajurRoleId);
        if (kaprodiRoleId !== null) chain.push(kaprodiRoleId);
        return chain;
      }

      // Track which L1 indicators have already had their cascade chain saved
      const l1ChainSaved = new Set<number>();

      // Accumulate cascade levels before executing upserts.
      // Multiple prodi sheets can share the same indicator and upper-level user (Kajur, WD).
      // Without accumulation, each sheet's upsert would DELETE the previous sheet's records
      // for that fromUser and only keep the last sheet's data.
      // Key: `${indicatorId}|${fromUserId ?? 'null'}`
      type AccumLevel = {
        indicatorId: number;
        depth: number;
        roleLabel: string;
        fromUserId: number | null;
        fromNama: string;
        items: { toUserId: number; toNama: string; jumlahTarget: number }[];
      };
      const levelAccum = new Map<string, AccumLevel>();

      for (const me of matched) {
        if (!me.indicatorId) { skippedInd++; continue; }

        // Use per-row V marks (falls back to sheet-level chain for safety)
        const vMarks = (me.vMarks?.length ?? 0) > 0
          ? me.vMarks
          : (localSheetChains.get(me.sheetName) ?? []);

        // Save cascade chain to the parent L1 indicator (once per L1, first entry with vMarks wins)
        const l1Id = localChildToL1.get(me.indicatorId) ?? null;
        if (l1Id && !l1ChainSaved.has(l1Id)) {
          if (vMarks.length > 0) {
            const chain = buildChainFromVMarks(vMarks);
            if (chain.length > 0) {
              await saveIndikatorCascadeChain(l1Id, chain, tahun, true);
              l1ChainSaved.add(l1Id);
              chainsSaved++;
            }
          }
        }

        // Create cascade disposisi from dosen amounts
        const leaf = me.amounts
          .filter((a) => a.userId !== null && a.amount > 0)
          .map((a) => ({ userId: a.userId!, amount: a.amount }));
        skippedUser += me.amounts.filter((a) => a.userId === null).length;

        // Find deepest marked pimpinan in hierarchy: KaProdi > KaJur > WD
        const kaprodiMark =
          vMarks.find((v) => /koordinator prodi/i.test(v.roleLabel)) ??
          vMarks.find((v) => /kepala jurusan/i.test(v.roleLabel)) ??
          vMarks.find((v) => /wakil dekan/i.test(v.roleLabel));
        const kaprodiUser = kaprodiMark ? findUserLocal(kaprodiMark.colNama) : null;

        // kaprodiAmount: prefer explicit targetProdiMin, otherwise sum of dosen amounts
        const kaprodiAmount = kaprodiUser
          ? (me.targetProdiMin > 0 ? me.targetProdiMin : leaf.reduce((s, a) => s + a.amount, 0))
          : 0;

        // Skip only when there is truly nothing to process.
        // If V marks exist but kaprodiAmount = 0 (targetProdiMin not filled and no dosen amounts),
        // count as a warning so the user knows to fill column 5 (Target Prodi Min).
        if (!leaf.length && kaprodiAmount <= 0) {
          if (kaprodiUser) skippedVMark++;
          continue;
        }

        let levels: CascadeLevel[];
        if (kaprodiUser && kaprodiAmount > 0) {
          // Build chain from V-mark users (WD→KJ→KP→Dosen) instead of atasanId traversal,
          // because atasanId is often unconfigured in the DB.
          levels = buildLevelsFromVMarks(vMarks, kaprodiUser, kaprodiAmount, leaf, allUsers, findUserLocal);
        } else {
          if (!leaf.length) continue;
          levels = buildCascadeLevels(leaf, allUsers);
        }

        maxDepth = Math.max(maxDepth, levels.reduce((m, l) => Math.max(m, l.depth), 0));
        indicatorsOk++;

        // Accumulate: merge items for same (indicatorId, fromUserId) across sheets
        for (const level of levels) {
          const key = `${me.indicatorId}|${level.fromUserId ?? 'null'}`;
          const existing = levelAccum.get(key);
          if (!existing) {
            levelAccum.set(key, {
              indicatorId: me.indicatorId,
              depth: level.depth,
              roleLabel: level.roleLabel,
              fromUserId: level.fromUserId,
              fromNama: level.fromNama,
              items: level.items.map((i) => ({ ...i })),
            });
          } else {
            for (const item of level.items) {
              const found = existing.items.find((i) => i.toUserId === item.toUserId);
              if (found) {
                found.jumlahTarget += item.jumlahTarget;
              } else {
                existing.items.push({ ...item });
              }
            }
          }
        }
      }

      // Execute one upsert per (indicatorId, fromUserId) with merged totals
      for (const [, level] of levelAccum) {
        const items = level.items.map((i) => ({ toUserId: i.toUserId, jumlahTarget: i.jumlahTarget }));
        console.log(`[ImportTurunan] upsert indId=${level.indicatorId} from=${level.fromNama} (${level.fromUserId ?? 'null'}) role=${level.roleLabel} items=${items.length} totalAmt=${items.reduce((s,i)=>s+i.jumlahTarget,0)}`);
        try {
          await upsertDisposisi(level.indicatorId, tahun, items, level.fromUserId);
        } catch (e: any) {
          throw new Error(`[indId=${level.indicatorId} from=${level.fromNama} role=${level.roleLabel}] ${e.message}`);
        }
        cascadeCalls++;
      }

      setDoneStats({ indicators: indicatorsOk, cascadeCalls, skippedInd, skippedUser, skippedVMark, maxDepth, chainsSaved });
      setStep("done");
      const chainMsg = chainsSaved > 0 ? ` · ${chainsSaved} alur indikator disimpan` : "";
      toast.success(`${indicatorsOk} indikator berhasil dikaskade ke ${maxDepth + 1} level jabatan${chainMsg}.`);
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
                  ["1", "Baca sheet Fixed (S1 SI Fixed, S1 IF Fixed, S1 SD Fixed, D3 SI Fixed)"],
                  ["2", "Baca tanda V di kolom Wadek/Kajur/Kaprodi → tentukan alur cascade indikator"],
                  ["3", "Cocokkan nama dosen di Excel → user di database"],
                  ["4", "Cocokkan kode IKU/PK → indikator di database"],
                  ["5", "Simpan konfigurasi alur ke halaman Alur Indikator"],
                  ["6", "Hitung target tiap level via atasanId: Kaprodi = Σ dosen, Kajur = Σ Kaprodi, dst."],
                  ["7", "Buat disposisi serentak di semua level jenjang"],
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

              {/* Download template */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#14532d" }}>Belum punya template?</div>
                  <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>Download template Excel dengan format yang benar (IKU + PK, 4 sheet prodi)</div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={loading}
                  style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: loading ? "#d1d5db" : "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                >
                  {loading ? <Spinner /> : null}
                  Download Template
                </button>
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

              {/* Cascade flow detected — from V marks if present, else from atasanId depth */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", flexShrink: 0 }}>
                  Alur terdeteksi{vChainLabels.length > 0 ? " (dari tanda V)" : ""}:
                </span>
                {vChainLabels.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {vChainLabels.map((label, i) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "1px solid", background: i === 0 ? "#dbeafe" : i === vChainLabels.length - 1 ? "#dcfce7" : "#f3f4f6", color: i === 0 ? "#1e40af" : i === vChainLabels.length - 1 ? "#166534" : "#374151", borderColor: i === 0 ? "#bfdbfe" : i === vChainLabels.length - 1 ? "#bbf7d0" : "#e5e7eb" }}>
                          {label}
                        </span>
                        {i < vChainLabels.length - 1 && <span style={{ color: "#9ca3af", fontSize: 13 }}>→</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <CascadeFlowBadge maxDepth={maxCascadeDepth} />
                )}
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
                  <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                    Disposisi dibuat di {doneStats.maxDepth + 1} level jenjang · Tahun {tahun}
                    {doneStats.chainsSaved > 0 ? ` · ${doneStats.chainsSaved} alur indikator tersimpan` : ""}
                  </div>
                </div>
              </div>

              {/* Cascade flow result */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginRight: 4 }}>Alur dibuat:</span>
                {vChainLabels.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {vChainLabels.map((label, i) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "1px solid", background: i === 0 ? "#dbeafe" : i === vChainLabels.length - 1 ? "#dcfce7" : "#f3f4f6", color: i === 0 ? "#1e40af" : i === vChainLabels.length - 1 ? "#166534" : "#374151", borderColor: i === 0 ? "#bfdbfe" : i === vChainLabels.length - 1 ? "#bbf7d0" : "#e5e7eb" }}>
                          {label}
                        </span>
                        {i < vChainLabels.length - 1 && <span style={{ color: "#9ca3af", fontSize: 13 }}>→</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <CascadeFlowBadge maxDepth={doneStats.maxDepth} />
                )}
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { v: doneStats.indicators, label: "Indikator", bg: "#eff6ff", border: "#bfdbfe", col: "#1e3a8a" },
                  { v: doneStats.cascadeCalls, label: "Disposisi Dibuat", bg: "#f5f3ff", border: "#ddd6fe", col: "#5b21b6" },
                  { v: doneStats.maxDepth + 1, label: "Level Jenjang", bg: "#f0fdf4", border: "#bbf7d0", col: "#14532d" },
                  ...(doneStats.chainsSaved > 0 ? [{ v: doneStats.chainsSaved, label: "Alur Disimpan", bg: "#ecfdf5", border: "#6ee7b7", col: "#065f46" }] : []),
                  ...(doneStats.skippedInd > 0 ? [{ v: doneStats.skippedInd, label: "Ind. Skip", bg: "#fef2f2", border: "#fecaca", col: "#dc2626" }] : []),
                  ...(doneStats.skippedUser > 0 ? [{ v: doneStats.skippedUser, label: "Dosen Skip", bg: "#fffbeb", border: "#fde68a", col: "#92400e" }] : []),
                  ...(doneStats.skippedVMark > 0 ? [{ v: doneStats.skippedVMark, label: "V-Mark Skip", bg: "#fef2f2", border: "#fecaca", col: "#dc2626" }] : []),
                ].map(({ v, label, bg, border, col }) => (
                  <div key={label} style={{ flex: 1, minWidth: 80, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: col, lineHeight: 1.1 }}>{v}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {doneStats.skippedVMark > 0 && (
                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#92400e" }}>
                  <strong>{doneStats.skippedVMark} baris</strong> memiliki tanda V (alur cascade) tapi tidak ada jumlah target yang bisa digunakan.
                  Pastikan kolom <strong>Target Prodi Min (kolom F)</strong> diisi dengan target masing-masing prodi di file Excel, lalu import ulang.
                </div>
              )}

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
