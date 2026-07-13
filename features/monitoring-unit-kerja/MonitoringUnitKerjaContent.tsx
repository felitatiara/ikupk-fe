"use client";

import { useEffect, useRef, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { CheckCircle2, Clock3, ListChecks, Percent, type LucideIcon } from "lucide-react";

import {
  getAggregatedProgress,
  getIndikatorMonitoringDetail,
  ProgressChartItem,
  ProgressChartSubChild,
  IndikatorDetail,
  DisposisiChainNode,
} from "@/services/monitoringService";
import { getIndikatorGroupedForUser, getAllRealisasiFiles, getMonitoringBawahan, getAvailableYears, getValidasiBiroPKU, upsertValidasiBiroPKU, getMonitoringScope, type RealisasiFileItem, type MonitoringBawahanResult, type MonitoringBawahanUser, type MonitoringBawahanRow, type ValidasiBiroPKUItem } from "@/lib/api";
import type { User } from "@/types";

const jenisOptions = [
  { label: "Indikator Kinerja Kegiatan", value: "IKU" },
  { label: "Perjanjian Kinerja", value: "PK" },
];

const DEFAULT_TAHUN = "2026";

interface PersonalRow {
  id?: number;
  kode: string;
  nama: string;
  sasaran: string;
  target: number | null;
  realisasi: number | null;
  capaian: number | null;
  tenggat: string | null;
  level?: number;
}

interface MonitoringUser extends User {
  userId?: number;
}

interface ChartTooltipItem {
  payload: {
    kode?: string;
    nama?: string;
    jenis?: string;
    satuan?: string;
    target?: number | string | null;
    realisasi?: number | null;
    realisasiBiroPKU?: number | null;
    progress?: number | null;
    realProgress?: number | null;
    persentaseRealisasi?: number | null;
    capaian?: number | string | null;
    status?: string;
  };
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

interface FilesByOwner {
  ownerNama: string;
  ownerEmail: string;
  indikatorKode: string;
  files: RealisasiFileItem[];
}

// ── Disposisi tree helpers ────────────────────────────────────────────────────

/**
 * Effective realisasi for a node = sum of leaf-level realisasi beneath it.
 * Non-leaf nodes (Kajur, Kaprodi) don't submit directly — their bawahan do.
 */
function effectiveRealisasi(nodeId: number, allNodes: DisposisiChainNode[]): number {
  const children = allNodes.filter(n => n.parentDisposisiId === nodeId);
  if (children.length === 0) {
    // Leaf: use own submission
    return allNodes.find(n => n.disposisiId === nodeId)?.realisasiJumlah ?? 0;
  }
  return children.reduce((sum, child) => sum + effectiveRealisasi(child.disposisiId, allNodes), 0);
}

function nodeStatus(real: number, target: number): "tercapai" | "proses" | "belum_input" {
  if (real === 0) return "belum_input";
  return real >= target ? "tercapai" : "proses";
}

const STATUS_STYLE = {
  tercapai:    { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0", label: "Tercapai" },
  proses:      { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", label: "Proses" },
  belum_input: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", label: "Belum Input" },
};

interface MergedLevelNode {
  userId: number;
  nama: string;
  email: string;
  totalTarget: number;
  totalReal: number;
  sources: { fromNama: string; jumlahTarget: number }[];
  disposisiIds: number[];
  isLeaf: boolean;
  childCount: number;
  indRef: DisposisiChainNode;
}

const CHAIN_LEVEL_LABELS = ["Penerima Awal", "Distribusi 1", "Distribusi 2", "Penerima Akhir"];

/**
 * Recursively sum realisasiJumlah of all leaf-level descendants of a given user in the chain.
 * Uses fromUserId relationships (more reliable than parentDisposisiId which can be null).
 */
function getTotalRealRecursive(userId: number, indNodes: DisposisiChainNode[]): number {
  const children = indNodes.filter(n => n.fromUserId === userId);
  if (children.length === 0) {
    // Leaf: sum realisasiJumlah across all disposisi nodes where this user is the recipient
    return indNodes
      .filter(n => n.toUserId === userId)
      .reduce((s, n) => s + n.realisasiJumlah, 0);
  }
  // Non-leaf: recursively aggregate unique child user IDs
  const childUserIds = [...new Set(children.map(c => c.toUserId))];
  return childUserIds.reduce((sum, cid) => sum + getTotalRealRecursive(cid, indNodes), 0);
}

function buildChainLevels(
  allChain: DisposisiChainNode[],
  indId: number,
): { depth: number; nodes: MergedLevelNode[] }[] {
  const indNodes = allChain.filter(n => n.indikatorId === indId);
  if (!indNodes.length) return [];

  // Depth via fromUserId: more reliable than parentDisposisiId because
  // the import can insert leaf nodes before parent nodes exist (parentId=null).
  // fromUserId always identifies the actual distributor regardless of insert order.
  const toUserIds = new Set(indNodes.map(n => n.toUserId));
  const depthMap = new Map<number, number>();

  function calcDepth(nodeId: number): number {
    if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;
    const node = indNodes.find(n => n.disposisiId === nodeId);
    if (!node) { depthMap.set(nodeId, 0); return 0; }
    const { fromUserId } = node;
    // If fromUserId is null or not a recipient in this indicator chain → depth 0
    if (fromUserId == null || !toUserIds.has(fromUserId)) {
      depthMap.set(nodeId, 0);
      return 0;
    }
    // Parents = nodes where toUserId === this node's fromUserId
    const parentNodes = indNodes.filter(p => p.toUserId === fromUserId);
    const d = 1 + Math.max(...parentNodes.map(p => calcDepth(p.disposisiId)));
    depthMap.set(nodeId, d);
    return d;
  }
  for (const n of indNodes) calcDepth(n.disposisiId);

  // Step 2: group by depth, merging same toUserId at the same level
  const levelMap = new Map<number, Map<number, MergedLevelNode>>();
  for (const n of indNodes) {
    const depth = depthMap.get(n.disposisiId) ?? 0;
    if (!levelMap.has(depth)) levelMap.set(depth, new Map());
    const byUser = levelMap.get(depth)!;
    // "from" name = toUserNama of whoever has toUserId === n.fromUserId
    const parentNode = n.fromUserId != null ? indNodes.find(p => p.toUserId === n.fromUserId) : null;
    const fromNama = parentNode?.toUserNama ?? "—";

    if (!byUser.has(n.toUserId)) {
      byUser.set(n.toUserId, {
        userId: n.toUserId, nama: n.toUserNama, email: n.toUserEmail,
        totalTarget: n.jumlahTarget, totalReal: 0,
        sources: [{ fromNama, jumlahTarget: n.jumlahTarget }],
        disposisiIds: [n.disposisiId],
        isLeaf: true, childCount: 0, indRef: n,
      });
    } else {
      const entry = byUser.get(n.toUserId)!;
      entry.totalTarget += n.jumlahTarget;
      // Only add source if not already listed for same fromNama
      if (!entry.sources.some(s => s.fromNama === fromNama)) {
        entry.sources.push({ fromNama, jumlahTarget: n.jumlahTarget });
      } else {
        const existing = entry.sources.find(s => s.fromNama === fromNama)!;
        existing.jumlahTarget += n.jumlahTarget;
      }
      entry.disposisiIds.push(n.disposisiId);
    }
  }

  // Step 3: compute isLeaf, childCount, totalReal using fromUserId relationships
  for (const [, byUser] of levelMap) {
    for (const [userId, entry] of byUser) {
      // Children = nodes whose fromUserId === this user's userId
      const children = indNodes.filter(n => n.fromUserId === userId);
      entry.isLeaf = children.length === 0;
      entry.childCount = new Set(children.map(c => c.toUserId)).size;
      // Recursive roll-up: accumulates realisasi from the entire sub-chain beneath this user,
      // not just direct leaf children. Fixes Kajur showing 0 when Kaprodi→Dosen has submissions.
      entry.totalReal = getTotalRealRecursive(userId, indNodes);
    }
  }

  return Array.from(levelMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([depth, byUser]) => ({ depth, nodes: Array.from(byUser.values()) }));
}

// ── Disposisi tree node ───────────────────────────────────────────────────────

const DEPTH_STYLES = [
  { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb", accentLight: "#dbeafe" }, // WD
  { bg: "#f5f3ff", border: "#ddd6fe", accent: "#7c3aed", accentLight: "#ede9fe" }, // KaJur
  { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", accentLight: "#dcfce7" }, // KaProdi / dosen langsung
  { bg: "#fff7ed", border: "#fed7aa", accent: "#c2410c", accentLight: "#ffedd5" }, // dosen level 3+
];

function ChainNode({
  node,
  allNodes,
  depth,
  filesByOwner,
  onSelect,
  parentNama,
}: {
  node: DisposisiChainNode;
  allNodes: DisposisiChainNode[];
  depth: number;
  filesByOwner: FilesByOwner[];
  onSelect: (nama: string, email: string, files: RealisasiFileItem[], statusColor: string, indikatorLevel: number, indikatorKode: string, indikatorNama: string, indikatorHierarchy: { kode: string; nama: string; level: number }[]) => void;
  parentNama?: string;
}) {
  const children = allNodes.filter(n => n.parentDisposisiId === node.disposisiId);
  const isLeaf = children.length === 0;

  const real = isLeaf ? node.realisasiJumlah : effectiveRealisasi(node.disposisiId, allNodes);
  const status = nodeStatus(real, node.jumlahTarget);
  const sc = STATUS_STYLE[status];
  const dc = DEPTH_STYLES[Math.min(depth, DEPTH_STYLES.length - 1)];

  const userFiles = filesByOwner
    .filter(g => g.ownerEmail === node.toUserEmail)
    .flatMap(g => g.files);

  const hasFiles = userFiles.length > 0;

  return (
    <div style={{ marginLeft: depth * 22 }}>
      {/* "dari X → " connector row */}
      {parentNama && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, paddingLeft: 2 }}>
          <div style={{ width: 14, height: 14, border: `2px solid ${dc.border}`, borderTop: "none", borderRight: "none", borderRadius: "0 0 0 6px", flexShrink: 0, marginTop: -4 }} />
          <span style={{ fontSize: 10, color: "#9ca3af" }}>
            dari <span style={{ fontWeight: 700, color: "#6b7280" }}>{parentNama}</span>
          </span>
          <span style={{ fontSize: 11, color: dc.accent }}>→</span>
        </div>
      )}

      <div
        onClick={() => hasFiles && onSelect(node.toUserNama, node.toUserEmail, userFiles, sc.fg, node.indikatorLevel, node.indikatorKode, node.indikatorNama, node.indikatorHierarchy)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          borderRadius: 8,
          border: `1px solid ${dc.border}`,
          backgroundColor: dc.bg,
          marginBottom: 6,
          cursor: hasFiles ? "pointer" : "default",
          transition: "opacity 0.12s",
        }}
        onMouseEnter={e => { if (hasFiles) (e.currentTarget as HTMLDivElement).style.opacity = "0.82"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
      >
        {/* Depth accent bar */}
        <div style={{ width: 3, alignSelf: "stretch", background: dc.accent, borderRadius: 99, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.toUserNama}
          </div>
          <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 1 }}>{node.toUserEmail}</div>
          {!isLeaf && (
            <div style={{ fontSize: 10, fontWeight: 700, color: dc.accent, marginTop: 4 }}>
              ↓ mendistribusikan ke {children.length} orang
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            Target <strong style={{ color: "#374151" }}>{node.jumlahTarget}</strong>
            {" · "}
            Real <strong style={{ color: sc.fg }}>{real}</strong>
          </div>
          <div style={{
            display: "inline-block", marginTop: 4,
            fontSize: 10.5, fontWeight: 700,
            color: sc.fg, background: sc.bg,
            border: `1px solid ${sc.border}`,
            borderRadius: 20, padding: "1px 9px",
          }}>
            {sc.label}
          </div>
        </div>

        <div style={{
          flexShrink: 0, fontSize: 11, fontWeight: 600,
          color: hasFiles ? "#374151" : "#d1d5db",
          padding: "4px 10px", borderRadius: 6,
          border: `1px solid ${hasFiles ? "#e5e7eb" : "#f3f4f6"}`,
          background: hasFiles ? "#fff" : "transparent",
          whiteSpace: "nowrap",
        }}>
          {hasFiles ? `${userFiles.length} file` : "—"}
        </div>
      </div>

      {children.map(child => (
        <ChainNode
          key={child.disposisiId}
          node={child}
          allNodes={allNodes}
          depth={depth + 1}
          filesByOwner={filesByOwner}
          onSelect={onSelect}
          parentNama={node.toUserNama}
        />
      ))}
    </div>
  );
}

function DetailModal({
  item,
  tahun,
  token,
  onClose,
}: {
  item: ProgressChartItem;
  tahun: string;
  token: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<IndikatorDetail | null>(null);
  const [filesByOwner, setFilesByOwner] = useState<FilesByOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<{
    nama: string; email: string; files: RealisasiFileItem[]; color: string;
    indikatorLevel: number; indikatorKode: string; indikatorNama: string;
    indikatorHierarchy: { kode: string; nama: string; level: number }[];
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const det = await getIndikatorMonitoringDetail(item.id, tahun);
        setDetail(det);

        const leafIds = [...new Set(det.entries.map(e => e.indikatorId))];
        const allGroups: FilesByOwner[] = [];
        for (const leafId of leafIds) {
          const result = await getAllRealisasiFiles(leafId, token);
          const leafEntry = det.entries.find(e => e.indikatorId === leafId);
          const indikatorKode = leafEntry?.indikatorKode ?? result.indikatorKode ?? "";
          const ownerMap = new Map<string, FilesByOwner>();
          for (const f of result.files) {
            const email = f.ownerEmail || f.owner?.email || "";
            const nama = f.ownerName || f.owner?.name || email;
            if (!ownerMap.has(email)) {
              ownerMap.set(email, { ownerNama: nama, ownerEmail: email, indikatorKode, files: [] });
            }
            ownerMap.get(email)!.files.push(f);
          }
          allGroups.push(...ownerMap.values());
        }
        const merged = new Map<string, FilesByOwner>();
        for (const g of allGroups) {
          const key = `${g.ownerEmail}::${g.indikatorKode}`;
          if (!merged.has(key)) merged.set(key, { ...g, files: [] });
          merged.get(key)!.files.push(...g.files);
        }
        setFilesByOwner([...merged.values()]);
      } catch {
        setDetail({ indikator: null, entries: [], disposisiChain: [] });
        setFilesByOwner([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [item.id, tahun, token]);

  // Chain data
  const chain = detail?.disposisiChain ?? [];
  // Group roots by indicator
  const rootNodes = chain.filter(n => n.parentDisposisiId === null);
  const indikatorIds = [...new Set(rootNodes.map(n => n.indikatorId))];

  // Summary counts on LEAF nodes only (the actual submitters)
  const leafNodes = chain.filter(n => !chain.some(x => x.parentDisposisiId === n.disposisiId));
  const belumInputCount = leafNodes.filter(n => nodeStatus(n.realisasiJumlah, n.jumlahTarget) === "belum_input").length;
  const prosesCount    = leafNodes.filter(n => nodeStatus(n.realisasiJumlah, n.jumlahTarget) === "proses").length;
  const tercapaiCount  = leafNodes.filter(n => nodeStatus(n.realisasiJumlah, n.jumlahTarget) === "tercapai").length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        padding: "40px 16px",
        overflowY: "auto",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 880,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        {!selectedPerson ? (
          <>
            {/* PAGE 1 Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ color: "#FF7900", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  Detail Monitoring
                </p>
                <h3 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "#1f2937" }}>
                  [{item.kode}] {item.nama}
                </h3>
                <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {item.jenis === "PK" ? "Target Fak" : "Target Univ"}:{" "}
                    <strong style={{ color: "#1f2937" }}>
                      {item.jenis === "PK"
                        ? `${item.targetUniversitas}${item.satuan ? ` ${item.satuan}` : ""}`
                        : `${item.targetUniversitas}%`}
                    </strong>
                    {item.jenis === "IKU" && item.targetAbsolut != null && (
                      <span style={{ color: "#9ca3af" }}> ({item.targetAbsolut} absolut)</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Realisasi: <strong style={{ color: "#1f2937" }}>{item.realisasi}</strong>
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Tahun: <strong style={{ color: "#1f2937" }}>{tahun}</strong>
                  </span>
                </div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
            </div>

            {/* PAGE 1 Body */}
            <div style={{ padding: "20px 24px", maxHeight: "60vh", overflowY: "auto" }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data...</div>
              ) : chain.length === 0 ? (
                <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
                  Belum ada disposisi untuk indikator ini pada tahun {tahun}.
                </div>
              ) : (
                <div>
                  {/* Status summary row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#047857" }}>{tercapaiCount} Tercapai</span>
                      <span style={{ color: "#d1d5db" }}>|</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>{prosesCount} Proses</span>
                      <span style={{ color: "#d1d5db" }}>|</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>{belumInputCount} Belum Input</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>Klik baris untuk lihat file</span>
                  </div>

                  {/* Chain grouped by indicator — level flow view */}
                  {indikatorIds.map(indId => {
                    const indFirst = chain.find(n => n.indikatorId === indId && n.parentDisposisiId === null);
                    const levels = buildChainLevels(chain, indId);
                    return (
                      <div key={indId} style={{ marginBottom: 28 }}>
                        {/* Indicator label */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "2px 7px", borderRadius: 4 }}>
                            Level {(indFirst?.indikatorLevel ?? 0) + 1}
                          </span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{indFirst?.indikatorKode}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{indFirst?.indikatorNama}</span>
                        </div>

                        {/* Flow levels */}
                        {levels.map(({ depth, nodes }, li) => {
                          const dc = DEPTH_STYLES[Math.min(depth, DEPTH_STYLES.length - 1)];
                          const levelLabel = (CHAIN_LEVEL_LABELS[Math.min(depth, CHAIN_LEVEL_LABELS.length - 1)] ?? `Level ${depth + 1}`);
                          return (
                            <div key={depth}>
                              {/* Connector arrow between levels */}
                              {li > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 10px", paddingLeft: 14 }}>
                                  <div style={{ width: 1, height: 20, background: "#d1d5db" }} />
                                  <span style={{ fontSize: 10.5, color: "#9ca3af" }}>↓ mendistribusikan ke</span>
                                </div>
                              )}

                              {/* Level badge */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: dc.accent, textTransform: "uppercase" as const, letterSpacing: "0.06em", background: dc.accentLight, padding: "2px 9px", borderRadius: 20 }}>
                                  {levelLabel}
                                </span>
                                <span style={{ fontSize: 10, color: "#9ca3af" }}>{nodes.length} orang</span>
                              </div>

                              {/* Card row */}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                                {nodes.map(node => {
                                  const status = nodeStatus(node.totalReal, node.totalTarget);
                                  const sc = STATUS_STYLE[status];
                                  const userFiles = filesByOwner.filter(g => g.ownerEmail === node.email).flatMap(g => g.files);
                                  const hasFiles = userFiles.length > 0;
                                  const multiSource = node.sources.filter(s => s.fromNama !== "—").length > 1;

                                  return (
                                    <div
                                      key={node.userId}
                                      onClick={() => hasFiles && setSelectedPerson({ nama: node.nama, email: node.email, files: userFiles, color: sc.fg, indikatorLevel: node.indRef.indikatorLevel, indikatorKode: node.indRef.indikatorKode, indikatorNama: node.indRef.indikatorNama, indikatorHierarchy: node.indRef.indikatorHierarchy })}
                                      style={{
                                        flex: "1 1 200px", minWidth: 180,
                                        maxWidth: nodes.length === 1 ? "100%" : 300,
                                        padding: "10px 12px", borderRadius: 10,
                                        border: `1px solid ${dc.border}`,
                                        background: dc.bg,
                                        cursor: hasFiles ? "pointer" : "default",
                                        transition: "opacity 0.12s",
                                      }}
                                      onMouseEnter={e => { if (hasFiles) (e.currentTarget as HTMLDivElement).style.opacity = "0.78"; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                                    >
                                      {/* Source(s) */}
                                      {node.sources.some(s => s.fromNama !== "—") && (
                                        <div style={{ fontSize: 9.5, color: "#9ca3af", marginBottom: 6, lineHeight: 1.7 }}>
                                          {multiSource && <span style={{ marginRight: 3 }}>Dari:</span>}
                                          {node.sources.filter(s => s.fromNama !== "—").map((s, si) => (
                                            <span key={si}>
                                              {si > 0 && <span style={{ color: "#d1d5db" }}> + </span>}
                                              <span style={{ fontWeight: 700, color: "#374151" }}>
                                                {s.fromNama.split(",")[0].split(" ").slice(-2).join(" ")}
                                              </span>
                                              {multiSource && (
                                                <span style={{ color: "#9ca3af" }}> ({s.jumlahTarget})</span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Name */}
                                      <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                                        <div style={{ width: 3, minHeight: 28, background: dc.accent, borderRadius: 99, flexShrink: 0, marginTop: 2 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{node.nama}</div>
                                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{node.email}</div>
                                        </div>
                                      </div>

                                      {/* Target / Real / Status */}
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 4 }}>
                                        <span style={{ fontSize: 10.5, color: "#6b7280" }}>
                                          Target <strong>{node.totalTarget}</strong>
                                          {multiSource && <span style={{ color: "#9ca3af", fontSize: 9 }}> (gabungan)</span>}
                                          {" · "}Real <strong style={{ color: sc.fg }}>{node.totalReal}</strong>
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: sc.fg, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" as const }}>
                                          {sc.label}
                                        </span>
                                      </div>

                                      {/* Footer: distribusi count + file */}
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                                        {!node.isLeaf ? (
                                          <span style={{ fontSize: 9.5, fontWeight: 700, color: dc.accent }}>
                                            ↓ {node.childCount} penerima selanjutnya
                                          </span>
                                        ) : <span />}
                                        {hasFiles && (
                                          <span style={{ fontSize: 10, color: "#374151", fontWeight: 600 }}>📎 {userFiles.length} file</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* PAGE 2 Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setSelectedPerson(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", padding: "4px 0", flexShrink: 0 }}
              >
                ← Kembali
              </button>
              <span style={{ color: "#e5e7eb" }}>|</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedPerson.nama}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{selectedPerson.email}</div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
            </div>

            {/* PAGE 2 Body */}
            <div style={{ padding: "20px 24px", maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                DETAIL INDIKATOR
              </div>
              {selectedPerson.indikatorHierarchy.map((h, idx) => (
                <div key={h.kode} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: idx * 14, marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{h.kode}</span>
                  <span style={{ fontSize: 13, fontWeight: idx === selectedPerson.indikatorHierarchy.length - 1 ? 700 : 400, color: idx === selectedPerson.indikatorHierarchy.length - 1 ? "#111827" : "#6b7280" }}>{h.nama}</span>
                </div>
              ))}

              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 16, marginBottom: 10 }}>
                {selectedPerson.files.length} file diunggah
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedPerson.files.map((f, idx) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fafafa", borderRadius: 8, padding: "10px 14px", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0, fontWeight: 600, minWidth: 20 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {f.preview_url && (
                        <a href={f.preview_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 600, color: "#374151", textDecoration: "none", padding: "4px 10px", background: "#f3f4f6", borderRadius: 6, border: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                          Preview
                        </a>
                      )}
                      {f.download_url && (
                        <a href={f.download_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 600, color: "#c2410c", textDecoration: "none", padding: "4px 10px", background: "#fff7ed", borderRadius: 6, border: "1px solid #fed7aa", whiteSpace: "nowrap" }}>
                          Unduh
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── File View Modal ───────────────────────────────────────────────────────────

function FileViewModal({ id, kode, nama, token, isPimpinan, userEmail, onClose }: { id: number; kode: string; nama: string; token: string; isPimpinan: boolean; userEmail: string; onClose: () => void }) {
  const [files, setFiles] = useState<RealisasiFileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllRealisasiFiles(id, token)
      .then(r => {
        const allFiles = r.files;
        setFiles(isPimpinan ? allFiles : allFiles.filter(f => {
          const email = f.ownerEmail || (f as { owner?: { email?: string } }).owner?.email || "";
          return email === userEmail;
        }));
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [id, token, isPimpinan, userEmail]);

  const ownerKeys = Array.from(new Set(files.map(f => f.ownerEmail || f.ownerName || "—")));

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "24px 16px" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #4f46e5, #3730a3)", padding: "16px 22px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>File Bukti Indikator</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.8, marginRight: 6 }}>{kode}</span>{nama}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 22px 20px", maxHeight: "60vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0" }}>Memuat file...</div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: "center", color: "#d1d5db", padding: "32px 0" }}>Belum ada file yang diupload untuk indikator ini.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ownerKeys.map(ownerKey => {
                const ownerFiles = files.filter(f => (f.ownerEmail || f.ownerName || "—") === ownerKey);
                const ownerName = ownerFiles[0]?.ownerName || ownerKey;
                const initials = ownerName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                return (
                  <div key={ownerKey} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #3730a3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ownerName}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{ownerFiles.length} file diunggah</div>
                      </div>
                    </div>
                    <div>
                      {ownerFiles.map((f, idx) => (
                        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: idx < ownerFiles.length - 1 ? "1px solid #f3f4f6" : "none", background: "#fff" }}>
                          <span style={{ width: 20, fontSize: 11, color: "#9ca3af", textAlign: "center", flexShrink: 0 }}>{idx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {f.preview_url && (
                              <a href={f.preview_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#374151", textDecoration: "none", padding: "3px 9px", background: "#f3f4f6", borderRadius: 6, border: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>Preview</a>
                            )}
                            {f.download_url && (
                              <a href={f.download_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#c2410c", textDecoration: "none", padding: "3px 9px", background: "#fff7ed", borderRadius: 6, border: "1px solid #fed7aa", whiteSpace: "nowrap" }}>Unduh</a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 22px", textAlign: "right" }}>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 20px", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  bg = "#ffffff",
  icon: Icon = ListChecks,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  bg?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      className="card border-0 h-100 overflow-hidden position-relative"
      style={{
        minHeight: 98,
        borderRadius: 16,
        background: `linear-gradient(135deg, ${bg} 0%, #ffffff 140%)`,
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.075)",
      }}
    >
      <div className="position-absolute top-0 start-0 end-0" />
      <div className="card-body d-flex align-items-center justify-content-between gap-3 p-3">
        <div className="min-w-0">
          <div className="fw-semibold mb-2" style={{ fontSize: 13, color: accent }}>
            {label}
          </div>
          <div className="fw-bold lh-1" style={{ fontSize: 30, color: "#111827", letterSpacing: 0 }}>
            {value}
          </div>
          {sub && (
            <div className="mt-2" style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
              {sub}
            </div>
          )}
        </div>
        <div
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            backgroundColor: "rgba(255,255,255,0.62)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.8)",
          }}
        >
          <Icon size={24} color={accent} strokeWidth={2.1} />
        </div>
      </div>
    </div>
  );
}

// ── Bawahan Cell Modal ────────────────────────────────────────────────────────

function BawahanCellModal({
  user,
  row,
  target,
  realisasi,
  token,
  onClose,
}: {
  user: MonitoringBawahanUser;
  row: MonitoringBawahanRow;
  target: number;
  realisasi: number;
  token: string;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<RealisasiFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingFiles(true);
      try {
        const result = await getAllRealisasiFiles(row.leafId, token);
        setFiles(result.files.filter(f => {
          const email = f.ownerEmail || f.owner?.email || "";
          return email === user.email;
        }));
      } catch {
        setFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    }
    load();
  }, [row.leafId, user.email, token]);

  const progress = target > 0 ? Math.min(100, Math.round((realisasi / target) * 100)) : 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "24px 16px" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0f9f6e, #0d8c60)", padding: "18px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{user.nama}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>{user.roleName}{user.unitNama ? ` · ${user.unitNama}` : ""}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Indicator */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #f0fdf4" }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#065f46", fontWeight: 700, background: "#d1fae5", padding: "2px 6px", borderRadius: 4 }}>{row.leafKode}</span>
          <div style={{ fontSize: 13, color: "#1f2937", fontWeight: 600, marginTop: 6 }}>{row.leafNama}</div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #f0fdf4" }}>
          {([
            { label: "Target Disposisi", value: `${target}${row.satuan ? " " + row.satuan : ""}`, color: "#065f46", bg: "#f0fdf4" },
            { label: "Disubmit", value: `${realisasi}${row.satuan ? " " + row.satuan : ""}`, color: "#15803d", bg: "#f0fdf4" },
            { label: "Progress", value: `${progress}%`, color: progress >= 100 ? "#15803d" : "#d97706", bg: progress >= 100 ? "#f0fdf4" : "#fffbeb" },
          ] as const).map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #dcfce7" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Files */}
        <div style={{ padding: "14px 24px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
            File Bukti {!loadingFiles && <span style={{ color: "#6b7280", fontWeight: 400 }}>({files.length})</span>}
          </div>
          {loadingFiles ? (
            <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "20px 0" }}>Memuat file...</div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: "center", color: "#d1d5db", fontSize: 12, padding: "20px 0" }}>Belum ada file yang disubmit</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
              {files.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fafafa", borderRadius: 8, padding: "8px 12px", border: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <a href={f.preview_url || f.download_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "#0369a1", fontWeight: 600, textDecoration: "none", padding: "3px 8px", background: "#eff6ff", borderRadius: 5, border: "1px solid #bfdbfe", whiteSpace: "nowrap" }}>
                    Lihat
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #dcfce7", padding: "12px 24px", textAlign: "right" }}>
          <button onClick={onClose} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 20px", color: "#065f46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Bar Tooltip ────────────────────────────────────────────────────────

function BarTooltip({ active, payload }: { active?: boolean; payload?: ChartTooltipItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isIku = d.jenis === "IKU";
  const unit = !isIku && d.satuan ? ` ${d.satuan}` : "";
  const progressColor = d.status === "Done" ? "#16a34a" : "#FF7900";
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: 12, maxWidth: 280 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#1f2937" }}>[{d.kode}] {d.nama ?? d.kode}</p>
      {d.target != null && (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Target: <strong style={{ color: "#374151" }}>{isIku ? `${d.target}%` : `${d.target}${unit}`}</strong>
        </p>
      )}
      {d.realisasiBiroPKU != null ? (
        <>
          <p style={{ margin: "2px 0", color: "#6b7280" }}>
            Realisasi Diajukan: <strong style={{ color: "#374151" }}>{d.realisasi}{unit}</strong>
          </p>
          <p style={{ margin: "2px 0", color: "#6b7280" }}>
            Realisasi Biro PKU:{" "}
            <strong style={{ color: "#0369a1" }}>{d.realisasiBiroPKU}{unit}</strong>{" "}
            <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>validasi</span>
          </p>
        </>
      ) : d.realisasi != null ? (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Realisasi: <strong style={{ color: progressColor }}>{d.realisasi}{unit}</strong>
        </p>
      ) : null}
      {(d.realProgress ?? 0) > 0 ? (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Progress: <strong style={{ color: progressColor }}>{d.realProgress}%</strong>
        </p>
      ) : d.realisasiBiroPKU != null || (d.realisasi ?? 0) > 0 ? (
        <p style={{ margin: "2px 0", color: "#6b7280", fontStyle: "italic" }}>
          Target belum dikonfigurasi
        </p>
      ) : null}
      {d.capaian != null && d.progress == null && (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Capaian: <strong style={{ color: progressColor }}>{d.capaian}%</strong>
        </p>
      )}
      {d.status && <p style={{ margin: "4px 0 0", color: "#9ca3af", fontSize: 11 }}>Status: {d.status}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonitoringUnitKerjaContent({ role = "user" }: { role?: string }) {
  const [user, setUser] = useState<MonitoringUser | null>(null);
  const [token, setToken] = useState("");
  const [selectedJenis, setSelectedJenis] = useState("IKU");
  const [selectedTahun, setSelectedTahun] = useState(DEFAULT_TAHUN);
  const [yearOptions, setYearOptions] = useState<string[]>([DEFAULT_TAHUN]);

  const [chartData, setChartData] = useState<ProgressChartItem[]>([]);
  const [personalRows, setPersonalRows] = useState<PersonalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalLoading, setPersonalLoading] = useState(false);

  const [detailItem, setDetailItem] = useState<ProgressChartItem | null>(null);
  const [bawahanCellModal, setBawahanCellModal] = useState<{
    user: MonitoringBawahanUser;
    row: MonitoringBawahanRow;
    target: number;
    realisasi: number;
  } | null>(null);

  const [fileViewModal, setFileViewModal] = useState<{ id: number; kode: string; nama: string } | null>(null);

  const [activeTab, setActiveTab] = useState<"keseluruhan" | "diterima" | "bawahan">(() => {
    // Baca role dari sessionStorage secara sinkron agar tab awal langsung benar
    // tanpa menunggu useAuth (mencegah flicker tab yang salah)
    if (typeof window === "undefined") return "diterima";
    try {
      const u = JSON.parse(sessionStorage.getItem("user") ?? "{}");
      const rn = (u.role ?? "").toLowerCase().trim();
      const isDek = rn === "dekan" || (rn.startsWith("dekan") && !rn.includes("wakil"));
      const isWD2 = rn.includes("wakil") && rn.includes("dekan") &&
        ((rn.includes("ii") && !rn.includes("iii")) || rn.includes(" 2") || rn.endsWith("2") || rn.includes("kedua"));
      if (isDek || isWD2 || role === "admin") return "keseluruhan";
    } catch { /* ignore */ }
    return "diterima";
  });

  const [monitoringBawahan, setMonitoringBawahan] = useState<MonitoringBawahanResult | null>(null);
  const [monitoringBawahanLoading, setMonitoringBawahanLoading] = useState(false);
  const [bawahanJenis, setBawahanJenis] = useState("IKU");
  const [bawahanTahun, setBawahanTahun] = useState(DEFAULT_TAHUN);
  const [bawahanFilterUser, setBawahanFilterUser] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [expandedLeaves, setExpandedLeaves] = useState<Set<number>>(new Set());

  const [validasiBiroPKU, setValidasiBiroPKU] = useState<ValidasiBiroPKUItem[]>([]);
  const [validasiModal, setValidasiModal] = useState<{ indikatorId: number; nama: string; current: ValidasiBiroPKUItem | null } | null>(null);
  const [validasiInput, setValidasiInput] = useState<{ jumlahValid: string; keterangan: string }>({ jumlahValid: "", keterangan: "" });
  const [validasiSaving, setValidasiSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [collapsedSasaran, setCollapsedSasaran] = useState<Set<number>>(new Set());
  const [scopeIds, setScopeIds] = useState<number[]>([]);

  const isPimpinan = role === "pimpinan" || role === "admin";
  const roleStr = (user?.role ?? "").toLowerCase();
  const isDekan = roleStr === "dekan" || (roleStr.startsWith("dekan") && !roleStr.includes("wakil"));
  const isWadek = roleStr.includes("wakil dekan");
  const isWakilDekanII =
    isWadek &&
    ((roleStr.includes("ii") && !roleStr.includes("iii")) || roleStr.includes(" 2") || roleStr.endsWith("2") || roleStr.includes("kedua"));
  // Tab Monitoring Keseluruhan hanya untuk Dekan, Wakil Dekan II, dan Admin
  const canSeeKeseluruhan = role === "admin" || isDekan || isWakilDekanII;
  const canSeeAll = role === "admin" || isDekan;
  const canViewDetail = isDekan || isWadek;

  const filteredBawahan = (monitoringBawahan?.bawahanList ?? []).filter(b => {
    if (bawahanFilterUser !== "all" && String(b.id) !== bawahanFilterUser) return false;
    return true;
  });



  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(userStr));
    setToken(sessionStorage.getItem("token") ?? "");
  }, []);

  useEffect(() => {
    getAvailableYears().then(dbYears => {
      const cy = new Date().getFullYear();
      const merged = [...new Set([
        ...dbYears,
        String(cy - 1),
        String(cy),
        String(cy + 1),
      ])].sort();
      setYearOptions(merged);
      if (!merged.includes(DEFAULT_TAHUN)) {
        setSelectedTahun(merged[merged.length - 1]);
        setBawahanTahun(merged[merged.length - 1]);
      }
    }).catch(() => {
      const cy = new Date().getFullYear();
      setYearOptions([String(cy - 1), String(cy), String(cy + 1)]);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isPimpinan) {
      fetchGlobal();
      if (isWadek) fetchScope();
    }
    fetchPersonal();
  }, [selectedJenis, selectedTahun, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isPimpinan) return;
    getValidasiBiroPKU(selectedTahun).then(setValidasiBiroPKU).catch(() => setValidasiBiroPKU([]));
  }, [selectedTahun, isPimpinan]);

  useEffect(() => {
    const roleLevel: number = (user as MonitoringUser & { roleLevel?: number })?.roleLevel ?? 99;
    if (!user || roleLevel > 3) { setMonitoringBawahan(null); return; }
    let cancelled = false;
    setMonitoringBawahanLoading(true);
    getMonitoringBawahan(bawahanJenis, bawahanTahun, user.id, roleLevel)
      .then((d) => { if (!cancelled) { setMonitoringBawahan(d); setMonitoringBawahanLoading(false); } })
      .catch(() => { if (!cancelled) { setMonitoringBawahan(null); setMonitoringBawahanLoading(false); } });
    return () => { cancelled = true; };
  }, [bawahanJenis, bawahanTahun, user]);

  async function fetchGlobal() {
    setLoading(true);
    try {
      const data = await getAggregatedProgress(selectedTahun, selectedJenis);
      setChartData(data);
    } catch {
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchScope() {
    if (!user) return;
    const userId: number = user.id ?? (user as MonitoringUser).userId ?? 0;
    try {
      const ids = await getMonitoringScope(userId, selectedTahun, selectedJenis);
      setScopeIds(ids);
    } catch {
      setScopeIds([]);
    }
  }

  async function handleSaveValidasi() {
    if (!validasiModal) return;
    setValidasiSaving(true);
    try {
      const userId: number = user?.id ?? user?.userId ?? 0;
      const saved = await upsertValidasiBiroPKU({
        indikatorId: validasiModal.indikatorId,
        tahun: selectedTahun,
        jumlahValid: validasiInput.jumlahValid === "" ? null : Number(validasiInput.jumlahValid),
        keterangan: validasiInput.keterangan || undefined,
        inputBy: userId,
      });
      setValidasiBiroPKU(prev => {
        const idx = prev.findIndex(v => v.indikatorId === saved.indikatorId);
        if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
        return [...prev, saved];
      });
      setValidasiModal(null);
    } catch {
      alert("Gagal menyimpan hasil validasi.");
    } finally {
      setValidasiSaving(false);
    }
  }

  async function exportValidasiExcel() {
    try {
      const ExcelJS = (await import("exceljs")).default;

      const HEADER_BG  = "FFBDD7EE";
      const HEADER_FG  = "FF1F3864";
      const JUMLAH_BG  = "FFFFC000";
      const JUMLAH_FG  = "FF1F3864";
      const BORDER     = "FF000000";
      const TOTAL_COLS = 14;

      const mkBorder = (style: "thin" | "medium" = "thin") => ({
        top:    { style, color: { argb: BORDER } },
        bottom: { style, color: { argb: BORDER } },
        left:   { style, color: { argb: BORDER } },
        right:  { style, color: { argb: BORDER } },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const styleCell = (cell: any, fillArgb: string, fontArgb: string, bold: boolean, halign: "center" | "left", wrap = false, vAlign: "middle" | "top" = "middle", borderStyle: "thin" | "medium" = "thin") => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
        cell.font = { bold, color: { argb: fontArgb }, size: 10, name: "Calibri" };
        cell.alignment = { horizontal: halign, vertical: vAlign, wrapText: wrap };
        cell.border = mkBorder(borderStyle);
      };

      const sortKode = (a: string, b: string) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const d = (pa[i] ?? 0) - (pb[i] ?? 0);
          if (d !== 0) return d;
        }
        return 0;
      };

      const [freshChartData, freshValidasiBiroPKU] = await Promise.all([
        getAggregatedProgress(selectedTahun, selectedJenis),
        getValidasiBiroPKU(selectedTahun),
      ]);
      const freshDisplayed = canSeeAll ? freshChartData : freshChartData.filter((i) => scopeIds.includes(i.id));
      const sorted = [...freshDisplayed].sort((a, b) => sortKode(a.kode, b.kode));

      // Fetch folder links in parallel
      const folderLinkMap = new Map<number, string | null>();
      await Promise.all(sorted.map(async (item) => {
        try {
          const result = await getAllRealisasiFiles(item.id, token);
          folderLinkMap.set(item.id, result.folderLink ?? null);
        } catch {
          folderLinkMap.set(item.id, null);
        }
      }));

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Validasi ${selectedJenis} ${selectedTahun}`);

      // Col widths: No | Sasaran | Kode | Nama | TargetUniv | SD | TgtKual | TgtKuant | RealKual | RealKuant | Capaian | HasilBiroPKU | SumberData | CatatanVerifikasi
      [5, 30, 10, 40, 12, 12, 12, 12, 14, 12, 12, 14, 25, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      // ── Title rows ─────────────────────────────────────────────────────────
      [
        `DEKAN FAKULTAS ILMU KOMPUTER DENGAN REKTOR`,
        `UNIVERSITAS PEMBANGUNAN NASIONAL "VETERAN" JAKARTA`,
        `TAHUN ANGGARAN ${selectedTahun}`,
      ].forEach(text => {
        const r = ws.addRow([text, ...Array(TOTAL_COLS - 1).fill("")]);
        r.height = 18;
        ws.mergeCells(r.number, 1, r.number, TOTAL_COLS);
        r.getCell(1).font = { bold: true, size: 12, name: "Calibri", color: { argb: HEADER_FG } };
        r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      });
      ws.addRow([]); // spacer

      // ── 3-Row Header ────────────────────────────────────────────────────────
      const tenggat = sorted[0]?.tenggat && sorted[0].tenggat !== "-" ? sorted[0].tenggat : "";

      // H1: top-level group headers
      const h1 = ws.addRow(Array(TOTAL_COLS).fill(""));
      h1.height = 30;
      h1.getCell(1).value = "No.";
      h1.getCell(2).value = "Sasaran Program";
      h1.getCell(3).value = "Indikator Kinerja Kegiatan";
      h1.getCell(5).value = `TARGET UNIVERSITAS\n${selectedTahun}`;
      h1.getCell(7).value = "FIK";
      h1.getCell(12).value = "Verifikasi\nBiro PKU\n(isi di sini)";
      h1.getCell(13).value = "Sumber Data";
      h1.getCell(14).value = "Catatan\nVerifikasi";

      // H2: second-level headers
      const h2 = ws.addRow(Array(TOTAL_COLS).fill(""));
      h2.height = 30;
      h2.getCell(3).value = "Kode";
      h2.getCell(4).value = "Nama";
      h2.getCell(5).value = selectedTahun;
      h2.getCell(6).value = tenggat ? `S.D\n${tenggat}` : "S.D";
      h2.getCell(7).value = `Target\n${selectedTahun}`;
      h2.getCell(9).value = tenggat ? `Realisasi s.d\n${tenggat}` : "Realisasi";
      h2.getCell(11).value = "% Capaian";

      // H3: leaf sub-headers for FIK columns
      const h3 = ws.addRow(Array(TOTAL_COLS).fill(""));
      h3.height = 20;
      h3.getCell(7).value = "Kualitas";
      h3.getCell(8).value = "Kuantitas";
      h3.getCell(9).value = "Kualitas";
      h3.getCell(10).value = "Kuantitas";

      // Style all header cells
      for (const hRow of [h1, h2, h3]) {
        for (let c = 1; c <= TOTAL_COLS; c++) {
          styleCell(hRow.getCell(c), HEADER_BG, HEADER_FG, true, "center", true, "middle", "medium");
        }
      }

      // Vertical merges: No, Sasaran, Hasil Biro PKU, Sumber Data, Catatan span all 3 header rows
      [1, 2, 12, 13, 14].forEach(c => ws.mergeCells(h1.number, c, h3.number, c));
      // H1 horizontal group merges
      ws.mergeCells(h1.number, 3, h1.number, 4);   // IKK group
      ws.mergeCells(h1.number, 5, h1.number, 6);   // TARGET UNIVERSITAS group
      ws.mergeCells(h1.number, 7, h1.number, 11);  // FIK group
      // H2-H3 merges: Kode, Nama, Tahun, S.D, % Capaian span rows 2-3
      [3, 4, 5, 6, 11].forEach(c => ws.mergeCells(h2.number, c, h3.number, c));
      // H2 sub-group merges: Target (cols 7-8) and Realisasi (cols 9-10)
      ws.mergeCells(h2.number, 7, h2.number, 8);
      ws.mergeCells(h2.number, 9, h2.number, 10);

      ws.views = [{ state: "frozen", ySplit: h3.number, topLeftCell: `A${h3.number + 1}` }];

      // ── Data rows ──────────────────────────────────────────────────────────
      let groupNo = 0;
      let totalTgtKuant = 0;
      let totalRealKuant = 0;
      let totalValid = 0;

      for (const item of sorted) {
        const val = freshValidasiBiroPKU.find(v => v.indikatorId === item.id);
        const folderLink = folderLinkMap.get(item.id) ?? null;
        groupNo++;

        const subs = [...(item.subIndikators ?? [])].sort((a, b) => sortKode(a.kode, b.kode));
        const groupStartRow = ws.rowCount + 1;
        let anyRow = false;

        for (const sub of subs) {
          const l2s = [...(sub.children ?? [])].sort((a, b) => sortKode(a.kode, b.kode));

          // L1 row: kode/nama only — data cols blank
          const l1Row = ws.addRow(Array(TOTAL_COLS).fill(""));
          l1Row.height = 18;
          l1Row.getCell(3).value = sub.kode;
          l1Row.getCell(4).value = sub.nama;
          for (let c = 1; c <= TOTAL_COLS; c++) {
            styleCell(l1Row.getCell(c), "FFFFFFFF", "FF000000", true,
              c === 3 || c === 4 ? "left" : "center", true, "middle");
          }
          anyRow = true;

          // L2 rows: kode/nama + realisasi data
          for (const l2 of l2s) {
            const tgtKuant = l2.nilaiTarget != null ? Number(l2.nilaiTarget) : null;
            const realKuant = l2.realisasi != null ? Number(l2.realisasi) : 0;
            const pctStr = tgtKuant && tgtKuant > 0
              ? `${Math.round((realKuant / tgtKuant) * 100)}%`
              : "";

            if (tgtKuant != null) totalTgtKuant += tgtKuant;
            totalRealKuant += realKuant;

            const l2Row = ws.addRow(Array(TOTAL_COLS).fill(""));
            l2Row.height = 18;
            l2Row.getCell(3).value = l2.kode;
            l2Row.getCell(4).value = l2.nama;
            l2Row.getCell(8).value = tgtKuant ?? "";   // Target Kuantitas
            l2Row.getCell(9).value = pctStr;           // Realisasi Kualitas (%)
            l2Row.getCell(10).value = realKuant || ""; // Realisasi Kuantitas
            l2Row.getCell(11).value = pctStr;          // % Capaian
            for (let c = 1; c <= TOTAL_COLS; c++) {
              styleCell(l2Row.getCell(c), "FFF9F9F9", "FF000000", false,
                c === 3 || c === 4 ? "left" : "center", true, "middle");
            }
          }
        }

        if (!anyRow) {
          const eRow = ws.addRow(Array(TOTAL_COLS).fill(""));
          eRow.height = 18;
          for (let c = 1; c <= TOTAL_COLS; c++) {
            styleCell(eRow.getCell(c), "FFFFFFFF", "FF000000", false, "center", true, "middle");
          }
        }

        const groupEndRow = ws.rowCount;

        // Merge L0-level cols (No, Sasaran, TargetUniv, SD, HasilBiroPKU, SumberData, Catatan) across all rows
        [1, 2, 5, 6, 12, 13, 14].forEach(c => {
          if (groupEndRow > groupStartRow) {
            ws.mergeCells(groupStartRow, c, groupEndRow, c);
          }
        });

        // Set L0 values on first row of the group
        ws.getCell(groupStartRow, 1).value = groupNo;
        ws.getCell(groupStartRow, 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(groupStartRow, 2).value = item.nama;
        ws.getCell(groupStartRow, 2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        ws.getCell(groupStartRow, 5).value = item.targetUniversitas != null ? `${item.targetUniversitas}%` : "";
        ws.getCell(groupStartRow, 5).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.getCell(groupStartRow, 6).value = item.tenggat && item.tenggat !== "-" ? item.tenggat : "";
        ws.getCell(groupStartRow, 6).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        const veriCell = ws.getCell(groupStartRow, 12);
        veriCell.value = val?.jumlahValid != null ? val.jumlahValid : "";
        veriCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        // Kuning jika kosong → tandai isian; putih jika sudah ada nilai
        veriCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: val?.jumlahValid != null ? "FFFFFFFF" : "FFFFFFF0" } };
        veriCell.border = mkBorder("thin");

        // Sumber Data hyperlink
        const linkCell = ws.getCell(groupStartRow, 13);
        if (folderLink) {
          linkCell.value = { text: "Lihat Folder", hyperlink: folderLink };
          linkCell.font = { size: 10, name: "Calibri", color: { argb: "FF0563C1" }, underline: true };
        } else {
          linkCell.value = "-";
          linkCell.font = { size: 10, name: "Calibri", color: { argb: "FF9CA3AF" } };
        }
        linkCell.alignment = { horizontal: "center", vertical: "middle" };

        // Catatan Verifikasi
        const catatanCell = ws.getCell(groupStartRow, 14);
        catatanCell.value = val?.keterangan ?? "";
        catatanCell.font = { size: 10, name: "Calibri", color: { argb: "FF374151" } };
        catatanCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        catatanCell.border = mkBorder("thin");

        if (val?.jumlahValid != null) totalValid += val.jumlahValid;
      }

      // ── Jumlah row ──────────────────────────────────────────────────────────
      const jRow = ws.addRow(Array(TOTAL_COLS).fill(""));
      jRow.height = 22;
      ws.mergeCells(jRow.number, 1, jRow.number, 2);
      jRow.getCell(1).value = "Jumlah";
      jRow.getCell(8).value = totalTgtKuant || "";
      jRow.getCell(10).value = totalRealKuant || "";
      jRow.getCell(12).value = totalValid || "";
      for (let c = 1; c <= TOTAL_COLS; c++) {
        styleCell(jRow.getCell(c), JUMLAH_BG, JUMLAH_FG, true, "center", false, "middle", "medium");
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Validasi_${selectedJenis}_${selectedTahun}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal export: " + String(err));
    }
  }

  async function importVerifikasiExcel(file: File) {
    setImportLoading(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Worksheet tidak ditemukan dalam file.");

      const sortKode = (a: string, b: string) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const d = (pa[i] ?? 0) - (pb[i] ?? 0);
          if (d !== 0) return d;
        }
        return 0;
      };
      const sorted = [...displayedChartData].sort((a, b) => sortKode(a.kode, b.kode));

      const updates: { indikatorId: number; jumlahValid: number | null }[] = [];

      ws.eachRow((row) => {
        const col1 = row.getCell(1).value;
        const groupNo = typeof col1 === "number" ? col1 : null;
        if (groupNo == null || groupNo < 1 || groupNo > sorted.length) return;

        const indicator = sorted[groupNo - 1];
        if (!indicator) return;

        const raw = row.getCell(12).value;
        const num = raw !== null && raw !== "" ? Number(raw) : null;
        updates.push({ indikatorId: indicator.id, jumlahValid: num != null && !isNaN(num) ? num : null });
      });

      if (updates.length === 0) throw new Error("Tidak ada data yang bisa dibaca. Pastikan file adalah template yang benar.");

      await Promise.all(
        updates.map(u => upsertValidasiBiroPKU({ indikatorId: u.indikatorId, tahun: selectedTahun, jumlahValid: u.jumlahValid }))
      );

      const refreshed = await getValidasiBiroPKU(selectedTahun);
      setValidasiBiroPKU(refreshed);
      alert(`Berhasil mengimpor ${updates.length} data verifikasi.`);
    } catch (err) {
      alert("Gagal import: " + String(err));
    } finally {
      setImportLoading(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  async function fetchPersonal() {
    setPersonalLoading(true);
    try {
      const userId: number = user?.id ?? user?.userId ?? 0;
      const roleId: number = user?.roleId
        ?? user?.roles?.find((r: { id: number; isPrimary: boolean }) => r.isPrimary)?.id
        ?? user?.roles?.[0]?.id
        ?? 0;
      const data = await getIndikatorGroupedForUser(selectedJenis, selectedTahun, userId, roleId);
      const rows: PersonalRow[] = [];
      for (const group of data) {
        // Level 0 header row
        rows.push({
          kode: group.kode ?? '',
          nama: group.nama ?? '',
          sasaran: '',
          target: null,
          realisasi: null,
          capaian: null,
          tenggat: group.tenggat,
          level: 0,
        });
        for (const sub of group.subIndikators) {
          // Aggregate L1 target: direct disposisi → sum L2 → sum L3
          const childTarget = (sub.children ?? []).reduce((s, c) => {
            const ct = c.disposisiJumlah ?? c.nilaiTarget ?? 0;
            if (ct > 0) return s + ct;
            return s + (c.children ?? []).reduce((gs, gc) => gs + (gc.disposisiJumlah ?? gc.nilaiTarget ?? 0), 0);
          }, 0);
          // L1 realisasi: backend already aggregates own + bawahan across all levels
          const subReal = sub.realisasiJumlah ?? 0;
          // Fallback: sum L2+L3 from frontend in case backend hasn't aggregated yet
          const childRealisasi = (sub.children ?? []).reduce((s, c) => {
            const gcR = (c.children ?? []).reduce((gs, gc) => gs + (gc.realisasiJumlah ?? 0), 0);
            return s + (c.realisasiJumlah ?? 0) + gcR;
          }, 0);

          const target = sub.disposisiJumlah ?? (childTarget > 0 ? childTarget : null);
          const aggReal = Math.max(subReal, childRealisasi);
          const realisasi = sub.realisasiJumlah !== null ? aggReal : (aggReal > 0 ? aggReal : null);
          const capaian =
            target !== null && target > 0 && realisasi !== null
              ? (realisasi / target) * 100
              : null;
          rows.push({
            kode: sub.kode,
            nama: sub.nama,
            sasaran: group.nama,
            target,
            realisasi,
            capaian,
            tenggat: group.tenggat,
            level: 1,
          });
          for (const child of (sub.children ?? [])) {
            const hasL3 = (child.children ?? []).length > 0;

            if (hasL3) {
              // PK with L3 rincian: skip the L2 wrapper row, show only L3 leaves
              for (const gc of (child.children ?? [])) {
                const gcTargetSum = (child.children ?? []).reduce((gs, g) => gs + (g.disposisiJumlah ?? g.nilaiTarget ?? 0), 0);
                // Use L3's own target if set, fall back to even split of L2 target
                const gcTarget = gc.disposisiJumlah ?? gc.nilaiTarget ?? (gcTargetSum > 0 ? null : null);
                const gcReal = gc.realisasiJumlah ?? null;
                const gcCapaian =
                  gcTarget !== null && gcTarget > 0 && gcReal !== null
                    ? (gcReal / gcTarget) * 100
                    : null;
                rows.push({
                  id: gc.id,
                  kode: gc.kode,
                  nama: gc.nama,
                  sasaran: group.nama,
                  target: gcTarget,
                  realisasi: gcReal,
                  capaian: gcCapaian,
                  tenggat: group.tenggat,
                  level: 2,
                });
              }
            } else {
              // IKU or PK leaf at L2: show normally
              const cTarget = child.disposisiJumlah ?? child.nilaiTarget ?? null;
              const cRealisasi = child.realisasiJumlah ?? null;
              const cCapaian =
                cTarget !== null && cTarget > 0 && cRealisasi !== null
                  ? (cRealisasi / cTarget) * 100
                  : null;
              rows.push({
                id: child.id,
                kode: child.kode,
                nama: child.nama,
                sasaran: group.nama,
                target: cTarget,
                realisasi: cRealisasi,
                capaian: cCapaian,
                tenggat: group.tenggat,
                level: 2,
              });
            }
          }
        }
      }
      setPersonalRows(rows);
    } catch {
      setPersonalRows([]);
    } finally {
      setPersonalLoading(false);
    }
  }

  if (!user) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const personalChartData = personalRows.filter((r) => r.level === 1).map((r) => ({
    kode: r.kode,
    nama: r.nama,
    target: r.target ?? 0,
    realisasi: r.realisasi ?? 0,
    capaian: r.capaian !== null ? Number(r.capaian.toFixed(1)) : 0,
    actualProgress: r.capaian !== null ? Number(r.capaian.toFixed(1)) : 0,
    progress: r.capaian !== null ? Math.min(100, Number(r.capaian.toFixed(1))) : 0,
    status: r.capaian !== null && r.capaian >= 100 ? "Done" : "Proses",
  }));

  const displayedChartData = canSeeAll ? chartData : chartData.filter((i) => scopeIds.includes(i.id));

  // Pimpinan KPIs
  const doneCount = displayedChartData.filter((d) => d.status === "Done").length;
  const prosesCount = displayedChartData.filter((d) => d.status === "Proses").length;
  const avgProgress = displayedChartData.length > 0
    ? Math.round(displayedChartData.reduce((s, d) => s + d.chartProgress, 0) / displayedChartData.length)
    : 0;

  // Personal KPIs (L1 only)
  const l1Rows = personalRows.filter((r) => r.level === 1);
  const pDone = l1Rows.filter((r) => r.capaian !== null && r.capaian >= 100).length;
  const pAvg = l1Rows.length > 0
    ? (l1Rows.reduce((s, r) => s + (r.capaian ?? 0), 0) / l1Rows.length).toFixed(1)
    : "0";

  const globalChartItems = displayedChartData.map((d) => ({
    kode: d.kode,
    nama: d.nama,
    jenis: d.jenis,
    status: d.status,
    satuan: d.satuan,
    target: d.targetUniversitas,
    realisasi: d.realisasi,
    realisasiBiroPKU: d.realisasiBiroPKU,
    persentaseRealisasi: d.persentaseRealisasi,
    realProgress: d.progress,
    actualProgress: d.progress,
    progress: d.chartProgress,
  }));

  const globalChartHeight = Math.max(200, displayedChartData.length * 64);
  const personalChartHeight = Math.max(200, personalChartData.length * 64);

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>
      <style>{`
        .mik-hero { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px 32px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .mik-hero-eyebrow { font-size: 11px; font-weight: 700; color: #0f9f6e; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .mik-hero-title { font-size: 22px; font-weight: 800; color: #0f2f4f; margin: 0 0 6px; }
        .mik-hero-sub { font-size: 13px; color: #6b7280; margin: 0; }
        .mik-stats-card { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; display: flex; flex-direction: row; align-items: center; gap: 0; }
        .mik-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 18px; }
        .mik-stat + .mik-stat { border-left: 1px solid #e5e7eb; }
        .mik-stat-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .mik-stat-val { font-size: 18px; font-weight: 800; color: #0f9f6e; }
        .mik-toolbar { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 10px 14px; margin-bottom: 20px; display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .mik-tab { padding: 8px 16px; border-radius: 10px; border: none; background: transparent; color: #6b7280; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .mik-tab:hover { background: #f0fdf4; color: #0f9f6e; }
        .mik-tab--active { background: #f0fdf4; color: #0f9f6e; font-weight: 700; box-shadow: 0 1px 4px rgba(15,159,110,0.12); }
        .mik-toolbar-sep { width: 1px; height: 28px; background: #e5e7eb; margin: 0 4px; align-self: center; flex-shrink: 0; }
        .mik-toolbar-spacer { flex: 1; min-width: 8px; }
        .mik-filter-group { display: flex; flex-direction: column; gap: 3px; }
        .mik-filter-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
        .mik-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; color: #374151; background: #fff; cursor: pointer; outline: none; }
        .mik-select:focus { border-color: #0f9f6e; box-shadow: 0 0 0 2px rgba(15,159,110,0.12); }
      `}</style>
      <PageTransition>

        {/* ── Hero Card ── */}
        <div className="mik-hero">
          <div>
           
            <h2 className="ikupk-card-title">Monitoring Indikator</h2>
            <p className="mik-hero-sub">Pantau progress capaian indikator kinerja kegiatan dan perjanjian kinerja.</p>
          </div>
          {isPimpinan && !loading && (
            <div className="mik-stats-card">
              <div className="mik-stat">
                <span className="mik-stat-label">Total</span>
                <span className="mik-stat-val">{displayedChartData.length}</span>
              </div>
              <div className="mik-stat">
                <span className="mik-stat-label">Tercapai</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#047857" }}>{doneCount}</span>
              </div>
              <div className="mik-stat">
                <span className="mik-stat-label">Proses</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#b45309" }}>{prosesCount}</span>
              </div>
              <div className="mik-stat">
                <span className="mik-stat-label">Rata Progress</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#be123c" }}>{avgProgress}%</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Toolbar: Tabs + Filters ── */}
        {(() => {
          const hasBawahan = (monitoringBawahan?.bawahanList?.length ?? 0) > 0;
          const tabs = [
            ...(canSeeKeseluruhan ? [{ key: "keseluruhan" as const, label: "Monitoring Keseluruhan" }] : []),
            { key: "diterima" as const, label: "Target Saya" },
            ...(hasBawahan ? [{ key: "bawahan" as const, label: "Distribusi Target Dosen" }] : []),
          ];
          return (
            <div className="mik-toolbar">
              {tabs.length > 1 && tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`mik-tab${activeTab === tab.key ? " mik-tab--active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
              {tabs.length > 1 && <div className="mik-toolbar-sep" />}
              <div className="mik-toolbar-spacer" />
              {activeTab !== "bawahan" && (
                <>
                  <div className="mik-filter-group">
                    <select className="mik-select" value={selectedJenis} onChange={(e) => setSelectedJenis(e.target.value)}>
                      {jenisOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="mik-filter-group">
                    <select className="mik-select" value={selectedTahun} onChange={(e) => setSelectedTahun(e.target.value)}>
                      {yearOptions.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── PIMPINAN / ADMIN: Monitoring Keseluruhan ── */}
        {isPimpinan && activeTab === "keseluruhan" && (
          <>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="Total Indikator" value={displayedChartData.length} accent="#0284c7" bg="#E8F1F9" icon={ListChecks} />
              <KpiCard label="Sudah Tercapai" value={doneCount} sub={`dari ${displayedChartData.length}`} accent="#047857" bg="#E6F6EA" icon={CheckCircle2} />
              <KpiCard label="Sedang Proses" value={prosesCount} sub={`dari ${displayedChartData.length}`} accent="#b45309" bg="#FFF4C2" icon={Clock3} />
              <KpiCard label="Rata-rata Progress" value={`${avgProgress}%`} accent="#be123c" bg="#F9E7E8" icon={Percent} />
            </div>

            {/* Bar Chart */}
            <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", marginBottom: 22, position: "relative" }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                Progress per Indikator — {selectedJenis} {selectedTahun}
              </p>
              {loading ? (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Memuat chart...</div>
              ) : globalChartItems.length === 0 ? (
                <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Tidak ada data.</div>
              ) : (
                <ResponsiveContainer width="100%" height={globalChartHeight}>
                  <BarChart layout="vertical" data={globalChartItems} margin={{ top: 0, right: 56, left: 8, bottom: 0 }} barSize={18} barCategoryGap="40%">
                    <CartesianGrid horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="kode" width={44} tick={{ fontSize: 11, fill: "#4b5563", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BarTooltip />} cursor={false} />
                    <Bar dataKey="progress" radius={[4, 4, 4, 4]} background={{ fill: "#f1f5f9", radius: 4 }}>
                      <LabelList dataKey="actualProgress" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#374151" }} />
                      {globalChartItems.map((entry, i) => (
                        <Cell key={i} fill={entry.status === "Done" ? "#16a34a" : "#FF7900"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "flex-end" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                  <span style={{ width: 12, height: 8, borderRadius: 2, background: "#16a34a", display: "inline-block" }} />
                  Tercapai
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                  <span style={{ width: 12, height: 8, borderRadius: 2, background: "#FF7900", display: "inline-block" }} />
                  Proses
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>
                  Rangkuman Target & Realisasi
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{selectedJenis} - {selectedTahun}</span>
                  <button onClick={exportValidasiExcel}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    ⬇ Export Template
                  </button>
                  {(roleStr === "admin" || roleStr === "superadmin") && (
                    <>
                      <input
                        ref={importFileRef}
                        type="file"
                        accept=".xlsx"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) importVerifikasiExcel(file);
                        }}
                      />
                      <button
                        onClick={() => importFileRef.current?.click()}
                        disabled={importLoading}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #bae6fd", background: importLoading ? "#f0f9ff" : "#f0f9ff", fontSize: 12, fontWeight: 600, color: "#0369a1", cursor: importLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: importLoading ? 0.7 : 1 }}>
                        {importLoading ? "Mengimpor..." : "⬆ Import Verifikasi"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ overflowX: "auto", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", marginTop: 0, boxShadow: "0 4px 18px rgba(15,23,42,0.07)" }}>
                <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0f2f4f" }}>
                      {[
                        { label: "No", w: 48 },
                        { label: "Sasaran", w: 130 },
                        { label: "Indikator / Sub-Indikator", w: 260 },
                        { label: "Target", w: 90 },
                        { label: "Realisasi", w: 90 },
                        { label: "Capaian (%)", w: 90 },
                        { label: "Tenggat", w: 110 },
                        { label: "Status", w: 90 },
                        { label: "Status Verifikasi", w: 110 },
                        { label: "Catatan Verifikasi", w: 140 },
                      ].map((h) => (
                        <th key={h.label} style={{ minWidth: h.w, padding: "12px 16px", fontWeight: 900, color: "#e8eef7", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: h.label === "Sasaran" || h.label === "Indikator / Sub-Indikator" || h.label === "Catatan Verifikasi" ? "left" : "center", whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                          {h.label}
                        </th>
                      ))}
                      <th style={{ minWidth: 80, padding: "12px 16px", fontWeight: 900, color: "#e8eef7", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", whiteSpace: "nowrap", position: "sticky", right: 0, zIndex: 3, background: "#0f2f4f", boxShadow: "-2px 0 6px rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data kinerja...</td></tr>
                    ) : displayedChartData.length > 0 ? (() => {
                      const sortKode = (a: string, b: string) => {
                        const pa = a.split('.').map(Number);
                        const pb = b.split('.').map(Number);
                        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                          const d = (pa[i] ?? 0) - (pb[i] ?? 0);
                          if (d !== 0) return d;
                        }
                        return 0;
                      };

                      const sorted = [...displayedChartData].sort((a, b) => sortKode(a.kode, b.kode));

                      const IKU_KATEGORI: Record<string, string> = {
                        '1': 'Wajib', '2': 'Wajib', '3': 'Wajib', '5': 'Wajib', '7': 'Wajib',
                        '4': 'Pilihan', '6': 'Pilihan', '8': 'Pilihan', '10': 'Pilihan',
                      };
                      const KATEGORI_ORDER = ['Wajib', 'Pilihan', 'Partisipatif'];
                      const KATEGORI_LABEL: Record<string, string> = { 'Wajib': 'A. Wajib', 'Pilihan': 'B. Pilihan', 'Partisipatif': 'C. Partisipatif' };
                      const getKategori = (it: typeof displayedChartData[0]) =>
                        it.kategori ?? IKU_KATEGORI[it.kode] ?? 'Partisipatif';

                      const isIKU = selectedJenis === "IKU";
                      const grouped: Record<string, typeof sorted> = { Wajib: [], Pilihan: [], Partisipatif: [] };
                      if (isIKU) sorted.forEach(it => grouped[getKategori(it)].push(it));
                      const itemsToRender = isIKU
                        ? KATEGORI_ORDER.flatMap(kat => {
                            const items = grouped[kat];
                            if (items.length === 0) return [];
                            return [{ __kategoriHeader: kat, __label: KATEGORI_LABEL[kat] } as any, ...items];
                          })
                        : sorted;

                      const rows: React.ReactNode[] = [];
                      let globalNo = 0;

                      for (const item of itemsToRender) {
                        if (item.__kategoriHeader) {
                          rows.push(
                            <tr key={`kategori-${item.__kategoriHeader}`}>
                              <td colSpan={11} style={{ padding: "8px 14px", backgroundColor: "#fafafa", borderBottom: "1px solid #e5e7eb", borderTop: "1px solid #e5e7eb" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.__label}</span>
                              </td>
                            </tr>
                          );
                          continue;
                        }

                        const subs = [...(item.subIndikators ?? [])].sort((a, b) => sortKode(a.kode, b.kode));
                        const totalRows = subs.reduce((s: number, sub: typeof subs[0]) => s + 1 + (sub.children?.length ?? 0), 0) || 1;
                        let firstRow = true;

                        const isCollapsed = collapsedSasaran.has(item.id);
                        const toggleCollapse = () => setCollapsedSasaran(prev => {
                          const next = new Set(prev);
                          next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                          return next;
                        });

                        if (subs.length === 0) {
                          globalNo++;
                          rows.push(
                            <tr key={`${item.id}-empty`} style={{ borderBottom: "1px solid #f8f8f8" }}>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#0369a1", fontWeight: 700, fontFamily: "monospace" }}>{globalNo}</td>
                              <td style={{ padding: "10px 14px", color: "#334155", fontWeight: 600 }}>{item.kode} — {item.nama}</td>
                              <td colSpan={8} style={{ padding: "10px 14px", color: "#9ca3af", textAlign: "center" }}>—</td>
                              <td style={{ padding: "10px 14px", position: "sticky", right: 0, background: "#fff", zIndex: 2, boxShadow: "-2px 0 6px rgba(0,0,0,0.06)" }} />
                            </tr>
                          );
                          continue;
                        }

                        if (isCollapsed) {
                          globalNo++;
                          const val = validasiBiroPKU.find(v => v.indikatorId === item.id);
                          const itemCapaian = item.targetUniversitas && item.targetUniversitas > 0 && item.realisasi != null
                            ? Math.round((item.realisasi / item.targetUniversitas) * 100)
                            : null;
                          rows.push(
                            <tr key={`${item.id}-collapsed`} style={{ borderBottom: "1px solid #f8f8f8", backgroundColor: "#fafafa" }}>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#0369a1", fontWeight: 800, fontFamily: "monospace", fontSize: 12 }}>{item.kode}</td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <button onClick={toggleCollapse} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 2px", color: "#9ca3af", fontSize: 11, lineHeight: 1, flexShrink: 0 }}>▶</button>
                                  <span style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 12 }}>{item.nama}</span>
                                  {isIKU && item.kategori && (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: item.kategori === "Wajib" ? "#0369a1" : item.kategori === "Pilihan" ? "#7c3aed" : "#6b7280", background: item.kategori === "Wajib" ? "#dbeafe" : item.kategori === "Pilihan" ? "#ede9fe" : "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>
                                      {item.kategori}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td colSpan={4} style={{ padding: "10px 14px", color: "#d1d5db", textAlign: "center" }}>—</td>
                              <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: itemCapaian == null ? "#9ca3af" : itemCapaian >= 100 ? "#047857" : "#c2410c" }}>
                                {itemCapaian != null ? `${itemCapaian}%` : "—"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{item.tenggat}</td>
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: item.status === "Done" ? "#ecfdf5" : "#fff7ed", color: item.status === "Done" ? "#047857" : "#c2410c", border: `1px solid ${item.status === "Done" ? "#bbf7d0" : "#fed7aa"}` }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                {val?.jumlahValid != null
                                  ? <span style={{ fontSize: 10, fontWeight: 700, color: "#047857", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px" }}>Terverifikasi ({val.jumlahValid})</span>
                                  : <span style={{ fontSize: 10, fontWeight: 600, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "2px 8px" }}>Belum</span>}
                              </td>
                              <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 11 }}>
                                {val?.keterangan ? <span style={{ color: "#374151" }}>{val.keterangan}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", position: "sticky", right: 0, background: "#fafafa", zIndex: 2, boxShadow: "-2px 0 6px rgba(0,0,0,0.06)" }}>
                                {canViewDetail ? (
                                  <button onClick={() => setDetailItem(item)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Detail</button>
                                ) : <span style={{ color: "#d1d5db" }}>—</span>}
                              </td>
                            </tr>
                          );
                          continue;
                        }

                        for (const sub of subs) {
                          globalNo++;
                          const subEffTarget = (() => {
                            const l2 = (sub.children ?? []).filter((c: ProgressChartSubChild) => c.nilaiTarget != null);
                            if (l2.length > 0) return l2.reduce((s: number, c: ProgressChartSubChild) => s + (c.nilaiTarget ?? 0), 0);
                            return sub.targetFakultas > 0 ? sub.targetFakultas : null;
                          })();
                          const subCapaian = subEffTarget && subEffTarget > 0 && sub.realisasi != null
                            ? Math.round((sub.realisasi / subEffTarget) * 100)
                            : null;
                          rows.push(
                            <tr key={`${item.id}-${sub.id}`} style={{ borderBottom: "1px solid #f8f8f8", backgroundColor: "#fff" }}>
                              {firstRow && (
                                <>
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", color: "#0369a1", fontWeight: 800, fontFamily: "monospace", fontSize: 12, verticalAlign: "top" }}>
                                    {item.kode}
                                  </td>
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", verticalAlign: "top" }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                                      <button onClick={toggleCollapse} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 2px", color: "#9ca3af", fontSize: 11, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>▼</button>
                                      <span style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 12 }}>{item.nama}</span>
                                      {isIKU && item.kategori && (
                                        <span style={{ fontSize: 10, fontWeight: 600, color: item.kategori === "Wajib" ? "#0369a1" : item.kategori === "Pilihan" ? "#7c3aed" : "#6b7280", background: item.kategori === "Wajib" ? "#dbeafe" : item.kategori === "Pilihan" ? "#ede9fe" : "#f3f4f6", padding: "1px 6px", borderRadius: 4, marginTop: 2 }}>
                                          {item.kategori}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                              <td style={{ padding: "10px 14px", color: "#334155", lineHeight: 1.4 }}>
                                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280", marginRight: 6 }}>{sub.kode}</span>
                                <span style={{ fontWeight: 600 }}>{sub.nama}</span>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#334155", borderLeft: "1px solid #f0f0f0" }}>
                                {(() => {
                                  const l2WithTarget = (sub.children ?? []).filter((c: ProgressChartSubChild) => c.nilaiTarget != null);
                                  if (l2WithTarget.length > 0) {
                                    const total = l2WithTarget.reduce((s: number, c: ProgressChartSubChild) => s + (c.nilaiTarget ?? 0), 0);
                                    const sat = l2WithTarget[0]?.satuan ?? null;
                                    return <span style={{ fontWeight: 600 }}>{total}{sat ? ` ${sat}` : ""}</span>;
                                  }
                                  if (sub.targetFakultas > 0) return <span style={{ fontWeight: 600 }}>{sub.targetFakultas}</span>;
                                  return <span style={{ color: "#9ca3af" }}>—</span>;
                                })()}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#334155" }}>{sub.realisasi}</td>
                              <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: subCapaian == null ? "#9ca3af" : subCapaian >= 100 ? "#047857" : "#c2410c" }}>
                                {subCapaian != null ? `${subCapaian}%` : "—"}
                              </td>
                              {firstRow && (
                                <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", color: "#6b7280", fontSize: 12, verticalAlign: "top", borderLeft: "1px solid #f0f0f0", whiteSpace: "nowrap" }}>{item.tenggat}</td>
                              )}
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: sub.status === "Done" ? "#ecfdf5" : "#fff7ed", color: sub.status === "Done" ? "#047857" : "#c2410c", border: `1px solid ${sub.status === "Done" ? "#bbf7d0" : "#fed7aa"}` }}>
                                  {sub.status}
                                </span>
                              </td>
                              {firstRow && (() => {
                                const val = validasiBiroPKU.find(v => v.indikatorId === item.id);
                                return (<>
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid #f0f0f0" }}>
                                    {val?.jumlahValid != null
                                      ? <span style={{ fontSize: 10, fontWeight: 700, color: "#047857", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>Terverifikasi ({val.jumlahValid})</span>
                                      : <span style={{ fontSize: 10, fontWeight: 600, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "2px 8px" }}>Belum</span>}
                                  </td>
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", verticalAlign: "middle", borderLeft: "1px solid #f0f0f0" }}>
                                    {val?.keterangan ? <span style={{ fontSize: 11, color: "#374151", lineHeight: 1.4 }}>{val.keterangan}</span> : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                                  </td>
                                </>);
                              })()}
                              {firstRow && (
                                <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", verticalAlign: "top", position: "sticky", right: 0, background: "#fff", zIndex: 2, boxShadow: "-2px 0 6px rgba(0,0,0,0.06)" }}>
                                  {canViewDetail ? (
                                    <button onClick={() => setDetailItem(item)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                                      Detail
                                    </button>
                                  ) : <span style={{ color: "#d1d5db" }}>—</span>}
                                </td>
                              )}
                            </tr>
                          );
                          firstRow = false;

                          for (const child of (sub.children ?? [])) {
                            const childTarget = child.nilaiTarget ?? null;
                            const childSatuan = child.satuan ?? null;
                            const childCapaian = childTarget && childTarget > 0 && child.realisasi > 0
                              ? Math.round((child.realisasi / childTarget) * 100)
                              : null;
                            rows.push(
                              <tr key={`${item.id}-${sub.id}-${child.id}`} style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
                                <td style={{ padding: "8px 10px 8px 30px", color: "#64748b", lineHeight: 1.4 }}>
                                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "#9ca3af", marginRight: 6 }}>{child.kode}</span>
                                  <span style={{ fontSize: 12 }}>{child.nama}</span>
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "center", color: "#334155", fontSize: 12, borderLeft: "1px solid #f0f0f0" }}>
                                  {childTarget != null
                                    ? <span style={{ fontWeight: 600 }}>{childTarget}{childSatuan ? ` ${childSatuan}` : ""}</span>
                                    : <span style={{ color: "#d1d5db" }}>—</span>}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b", fontSize: 12 }}>{child.realisasi > 0 ? child.realisasi : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                                <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 12, color: childCapaian == null ? "#d1d5db" : childCapaian >= 100 ? "#047857" : "#c2410c" }}>
                                  {childCapaian != null ? `${childCapaian}%` : "—"}
                                </td>
                                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                  {child.status ? (
                                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: child.status === "Done" ? "#ecfdf5" : "#fff7ed", color: child.status === "Done" ? "#047857" : "#c2410c", border: `1px solid ${child.status === "Done" ? "#bbf7d0" : "#fed7aa"}` }}>
                                      {child.status}
                                    </span>
                                  ) : <span style={{ color: "#d1d5db" }}>—</span>}
                                </td>
                              </tr>
                            );
                          }
                        }
                      }

                      return rows.length > 0 ? rows : (
                        <tr key="empty"><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data indikator.</td></tr>
                      );
                    })() : (
                      <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data target ditemukan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Target yang Diterima — non-pimpinan always; pimpinan when tab active ── */}
        {(activeTab === "diterima") && (
          <>
          {/* Section Header — hanya untuk non-pimpinan */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Target {selectedJenis} tahun {selectedTahun} yang diterima melalui disposisi.
            </div>
          </div>

          {/* KPI Cards */}
          {personalRows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="Total Indikator" value={l1Rows.length} accent="#0284c7" bg="#E8F1F9" icon={ListChecks} />
              <KpiCard label="Sudah Tercapai" value={pDone} sub={`dari ${l1Rows.length}`} accent="#047857" bg="#E6F6EA" icon={CheckCircle2} />
              <KpiCard label="Rata-rata Capaian" value={`${pAvg}%`} accent="#b45309" bg="#FFF4C2" icon={Percent} />
            </div>
          )}

          {/* Bar Chart */}
          {personalRows.length > 0 && (
            <div style={{ background: "white", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", marginBottom: 22 }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                Capaian per Indikator — {selectedJenis} {selectedTahun}
              </p>
              <ResponsiveContainer width="100%" height={personalChartHeight}>
                <BarChart layout="vertical" data={personalChartData} margin={{ top: 0, right: 56, left: 8, bottom: 0 }} barSize={18} barCategoryGap="40%">
                  <CartesianGrid horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="kode" width={44} tick={{ fontSize: 11, fill: "#4b5563", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={false} />
                  <Bar dataKey="progress" radius={[4, 4, 4, 4]} background={{ fill: "#f1f5f9", radius: 4 }}>
                    <LabelList dataKey="actualProgress" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#374151" }} />
                    {personalChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.status === "Done" ? "#16a34a" : "#FF7900"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabel personal */}
          <div style={{ overflow: "hidden", backgroundColor: "white", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 4px 18px rgba(15,23,42,0.07)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f2f4f" }}>
                  {["No", "Kode", "Nama Indikator", "Target", "Realisasi", "Tenggat", "Capaian (%)", "File"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "No" || h === "Target" || h === "Realisasi" || h === "Tenggat" || h === "Capaian (%)" || h === "File" ? "center" : "left",
                        padding: "12px 14px",
                        fontSize: 11,
                        fontWeight: 900,
                        color: "#e8eef7",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                        borderBottom: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personalLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                      Memuat data indikator...
                    </td>
                  </tr>
                ) : personalRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                      Belum ada target yang diterima untuk tahun {selectedTahun}.
                    </td>
                  </tr>
                ) : (() => {
                    let l1Counter = 0;
                    return personalRows.map((row, i) => {
                      const isL0 = row.level === 0;
                      const isL2 = row.level === 2;
                      if (!isL0 && !isL2) l1Counter++;

                      if (isL0) {
                        return (
                          <tr key={i} style={{ backgroundColor: "#f1f5f9" }}>
                            <td colSpan={8} style={{ padding: "8px 14px", borderTop: "2px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#0369a1", background: "#dbeafe", padding: "1px 6px", borderRadius: 4, marginRight: 8, fontWeight: 700 }}>{row.kode}</span>
                              <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{row.nama}</span>
                            </td>
                          </tr>
                        );
                      }

                      const capColor =
                        row.capaian === null
                          ? "#9ca3af"
                          : row.capaian >= 100
                          ? "#16a34a"
                          : row.capaian >= 76
                          ? "#2563eb"
                          : row.capaian >= 51
                          ? "#d97706"
                          : "#dc2626";

                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f8f8f8", backgroundColor: isL2 ? "#fafafa" : undefined }}>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#9ca3af", fontSize: isL2 ? 10 : 13 }}>
                            {isL2 ? "↳" : l1Counter}
                          </td>
                          <td style={{ padding: "10px 14px", color: isL2 ? "#6b7280" : "#0284c7", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                            {row.kode}
                          </td>
                          <td style={{ padding: "10px 14px", paddingLeft: isL2 ? 28 : 14, color: isL2 ? "#6b7280" : "#1f2937", fontWeight: isL2 ? 400 : 500 }}>{row.nama}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>
                            {row.target !== null ? row.target : <span style={{ color: "#9ca3af" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>
                            {row.realisasi !== null ? row.realisasi : <span style={{ color: "#9ca3af" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                            {row.tenggat ?? "—"}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: capColor }}>
                            {row.capaian !== null ? `${row.capaian.toFixed(1)}%` : "—"}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {isL2 && row.id ? (
                              <button
                                onClick={() => setFileViewModal({ id: row.id!, kode: row.kode, nama: row.nama })}
                                style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4f46e5", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Lihat File
                              </button>
                            ) : <span style={{ color: "#e5e7eb" }}>—</span>}
                          </td>
                        </tr>
                      );
                    });
                  })()
                }
              </tbody>
            </table>
          </div>
          </>
        )}

          {/* ── Monitoring Bawahan ── */}
          {activeTab === "bawahan" && monitoringBawahan && (monitoringBawahan.bawahanList?.length ?? 0) > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

              {/* Section header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Distribusi Target Dosen</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    Jumlah target yang diterima masing-masing dosen berdasarkan disposisi.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const ExcelJS = (await import("exceljs")).default;
                    const rl: number = (user as MonitoringUser & { roleLevel?: number })?.roleLevel ?? 99;
                    const freshBawahan = await getMonitoringBawahan(bawahanJenis, bawahanTahun, user.id, rl);
                    const rows = freshBawahan.rows;
                    const users = (freshBawahan.bawahanList ?? []).filter(b => {
                      if (bawahanFilterUser !== "all" && String(b.id) !== bawahanFilterUser) return false;
                      return true;
                    });
                    const fixedCols = 4;
                    const totalCols = fixedCols + users.length;

                    const HEADER_BG = "FF1F3864";
                    const HEADER_FG = "FFFFFFFF";
                    const GROUP_BG  = "FFBDD7EE";
                    const GROUP_FG  = "FF1F3864";
                    const BORDER    = "FFAAAAAA";

                    const mkBorder = () => ({
                      top:    { style: "thin" as const, color: { argb: BORDER } },
                      bottom: { style: "thin" as const, color: { argb: BORDER } },
                      left:   { style: "thin" as const, color: { argb: BORDER } },
                      right:  { style: "thin" as const, color: { argb: BORDER } },
                    });

                    const styleCell = (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      cell: any,
                      fillArgb: string,
                      fontArgb: string,
                      bold: boolean,
                      halign: "center" | "left",
                      wrap = false,
                    ) => {
                      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
                      cell.font = { bold, color: { argb: fontArgb }, size: 10, name: "Calibri" };
                      cell.alignment = { horizontal: halign, vertical: "middle", wrapText: wrap };
                      cell.border = mkBorder();
                    };

                    const wb = new ExcelJS.Workbook();
                    const ws = wb.addWorksheet("Distribusi Target");

                    // Freeze kolom A-D + 2 header rows
                    ws.views = [{
                      state: "frozen",
                      xSplit: 4,
                      ySplit: 2,
                      topLeftCell: "E3",
                    }];

                    // Column widths
                    ws.getColumn(1).width = 5;
                    ws.getColumn(2).width = 12;
                    ws.getColumn(3).width = 55;
                    ws.getColumn(4).width = 10;
                    users.forEach((_, i) => { ws.getColumn(5 + i).width = 18; });

                    // Header row 1 — nama user
                    const hRow1 = ws.addRow(["No", "Kode", "Indikator", "Target", ...users.map((u) => u.nama)]);
                    hRow1.height = 32;
                    for (let c = 1; c <= totalCols; c++) {
                      styleCell(hRow1.getCell(c), HEADER_BG, HEADER_FG, true, "center");
                    }

                    // Header row 2 — role subtitle
                    const hRow2 = ws.addRow(["", "", "", "", ...users.map((u) => u.roleName)]);
                    hRow2.height = 20;
                    for (let c = 1; c <= totalCols; c++) {
                      styleCell(hRow2.getCell(c), HEADER_BG, HEADER_FG, true, "center");
                    }

                    // Merge No/Kode/Indikator/Target across 2 header rows
                    ws.mergeCells(1, 1, 2, 1);
                    ws.mergeCells(1, 2, 2, 2);
                    ws.mergeCells(1, 3, 2, 3);
                    ws.mergeCells(1, 4, 2, 4);

                    let rowNo = 0;
                    let currentGroupId: number | null = null;
                    let groupNo = 0;

                    for (const row of rows) {
                      if (row.groupId !== currentGroupId) {
                        currentGroupId = row.groupId;
                        groupNo++;
                        const gRow = ws.addRow([groupNo, row.groupNama, ...Array(totalCols - 2).fill("")]);
                        gRow.height = 20;
                        for (let c = 1; c <= totalCols; c++) {
                          styleCell(gRow.getCell(c), GROUP_BG, GROUP_FG, true, c === 1 ? "center" : "left");
                        }
                        ws.mergeCells(gRow.number, 2, gRow.number, totalCols);
                      }

                      rowNo++;
                      const dRow = ws.addRow([
                        rowNo,
                        row.leafKode,
                        row.leafNama,
                        row.nilaiTarget ?? "",
                        ...users.map((u) => {
                          const val = row.disposisiByUser[u.id];
                          return val != null && val > 0 ? val : "";
                        }),
                      ]);
                      dRow.height = 15;
                      for (let c = 1; c <= totalCols; c++) {
                        styleCell(dRow.getCell(c), "FFFFFFFF", "FF000000", false, c === 3 ? "left" : "center", c === 3);
                      }
                    }

                    const buffer = await wb.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `distribusi-target-bawahan-${bawahanJenis}-${bawahanTahun}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                >
                  ↓ Export Excel
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Jenis</label>
                  <select
                    value={bawahanJenis}
                    onChange={(e) => setBawahanJenis(e.target.value)}
                    style={{ width: "100%", height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111827", background: "#fff", cursor: "pointer", outline: "none" }}
                  >
                    <option value="IKU">Indikator Kinerja Utama</option>
                    <option value="PK">Perjanjian Kinerja</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tahun</label>
                  <select
                    value={bawahanTahun}
                    onChange={(e) => setBawahanTahun(e.target.value)}
                    style={{ width: "100%", height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111827", background: "#fff", cursor: "pointer", outline: "none" }}
                  >
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dosen</label>
                  <select
                    value={bawahanFilterUser}
                    onChange={(e) => setBawahanFilterUser(e.target.value)}
                    style={{ width: "100%", height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111827", background: "#fff", cursor: "pointer", outline: "none" }}
                  >
                    <option value="all">Semua Dosen</option>
                    {(monitoringBawahan?.bawahanList ?? []).map((b) => <option key={b.id} value={String(b.id)}>{b.nama}</option>)}
                  </select>
                </div>
              </div>

              {monitoringBawahanLoading && (
                <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data...</div>
              )}

              {!monitoringBawahanLoading && monitoringBawahan.bawahanList.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Belum ada bawahan terkonfigurasi.</div>
              )}

              {!monitoringBawahanLoading && monitoringBawahan.bawahanList.length > 0 && (() => {
                const allRows = monitoringBawahan.rows;
                const users = filteredBawahan;

                const groupMap = new Map<number, { groupId: number; groupNama: string; leaves: MonitoringBawahanRow[] }>();
                for (const row of allRows) {
                  if (!groupMap.has(row.groupId)) {
                    groupMap.set(row.groupId, { groupId: row.groupId, groupNama: row.groupNama, leaves: [] });
                  }
                  groupMap.get(row.groupId)!.leaves.push(row);
                }
                const groups = [...groupMap.values()];

                return (
                  <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 18px rgba(15,23,42,0.07)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#0f2f4f" }}>
                          <th style={{ padding: "12px 12px", textAlign: "center", fontSize: 11, fontWeight: 900, color: "#e8eef7", textTransform: "uppercase", letterSpacing: "0.06em", width: 40, whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>No</th>
                          <th style={{ padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "#e8eef7", textTransform: "uppercase", letterSpacing: "0.06em", width: 88, whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>Kode</th>
                          <th style={{ padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "#e8eef7", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>Indikator / Dosen</th>
                          <th style={{ padding: "12px 12px", textAlign: "center", fontSize: 11, fontWeight: 900, color: "#e8eef7", textTransform: "uppercase", letterSpacing: "0.06em", width: 100, whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>Target</th>
                          <th style={{ padding: "12px 12px", textAlign: "center", fontSize: 11, fontWeight: 900, color: "#e8eef7", textTransform: "uppercase", letterSpacing: "0.06em", width: 100, whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>Realisasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const tableRows: React.ReactNode[] = [];
                          groups.forEach((group, gi) => {
                            const isOpen = expandedGroups.has(group.groupId);
                            tableRows.push(
                              <tr
                                key={`g-${group.groupId}`}
                                style={{ background: "#f1f5f9", borderTop: gi > 0 ? "2px solid #e2e8f0" : undefined, borderBottom: "1px solid #e2e8f0", cursor: "pointer", userSelect: "none" }}
                                onClick={() => setExpandedGroups(prev => {
                                  const next = new Set(prev);
                                  if (next.has(group.groupId)) next.delete(group.groupId); else next.add(group.groupId);
                                  return next;
                                })}
                              >
                                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 13, width: 40 }}>{gi + 1}</td>
                                <td colSpan={4} style={{ padding: "8px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 11, color: "#64748b", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", lineHeight: 1 }}>▶</span>
                                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{group.groupNama}</span>
                                    <span style={{ fontSize: 11, color: "#94a3b8" }}>({group.leaves.length} indikator)</span>
                                  </div>
                                </td>
                              </tr>
                            );
                            if (isOpen) {
                              for (const leaf of group.leaves) {
                                const isLeafOpen = expandedLeaves.has(leaf.leafId);
                                const usersWithData = users.filter(u => (leaf.disposisiByUser[u.id] ?? 0) > 0 || (leaf.realisasiByUser?.[u.id] ?? 0) > 0);
                                tableRows.push(
                                  <tr
                                    key={`leaf-${leaf.leafId}`}
                                    style={{ background: "#fff", borderBottom: "1px solid #f8f8f8", cursor: "pointer", userSelect: "none" }}
                                    onClick={() => setExpandedLeaves(prev => {
                                      const next = new Set(prev);
                                      if (next.has(leaf.leafId)) next.delete(leaf.leafId); else next.add(leaf.leafId);
                                      return next;
                                    })}
                                  >
                                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#d1d5db", fontSize: 12 }}>—</td>
                                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{leaf.leafKode}</td>
                                    <td style={{ padding: "10px 12px", lineHeight: 1.4 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 10, color: "#94a3b8", display: "inline-block", transform: isLeafOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", lineHeight: 1 }}>▶</span>
                                        <span style={{ color: "#1f2937", fontWeight: 600 }}>{leaf.leafNama}</span>
                                        <span style={{ fontSize: 10, color: "#94a3b8" }}>({usersWithData.length} dosen)</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#374151", fontWeight: 600 }}>
                                      {leaf.nilaiTarget != null
                                        ? <>{leaf.nilaiTarget}{leaf.satuan ? <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 3 }}>{leaf.satuan}</span> : null}</>
                                        : <span style={{ color: "#d1d5db" }}>—</span>}
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#d1d5db", fontSize: 12 }}>—</td>
                                  </tr>
                                );
                                if (isLeafOpen) {
                                  if (usersWithData.length === 0) {
                                    tableRows.push(
                                      <tr key={`leaf-${leaf.leafId}-empty`} style={{ background: "#fafafa", borderBottom: "1px solid #f8f8f8" }}>
                                        <td colSpan={5} style={{ padding: "6px 28px", color: "#cbd5e1", fontSize: 11, fontStyle: "italic" }}>Belum ada disposisi</td>
                                      </tr>
                                    );
                                  } else {
                                    for (const u of usersWithData) {
                                      const target = leaf.disposisiByUser[u.id] ?? 0;
                                      const real = leaf.realisasiByUser?.[u.id] ?? 0;
                                      tableRows.push(
                                        <tr key={`leaf-${leaf.leafId}-user-${u.id}`} style={{ background: "#fafafa", borderBottom: "1px solid #f8f8f8" }}>
                                          <td style={{ padding: "6px 12px" }} />
                                          <td style={{ padding: "6px 12px" }} />
                                          <td style={{ padding: "6px 16px 6px 36px" }}>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setBawahanCellModal({ user: u, row: leaf, target, realisasi: real }); }}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 8px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#fafafa", cursor: "pointer" }}
                                            >
                                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", display: "inline-block", flexShrink: 0 }} />
                                              <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{u.nama}</span>
                                              <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 2 }}>{u.roleName}</span>
                                            </button>
                                          </td>
                                          <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{target}</span>
                                            {leaf.satuan && <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 2 }}>{leaf.satuan}</span>}
                                          </td>
                                          <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                            {real > 0
                                              ? <span style={{ fontSize: 13, fontWeight: 700, color: "#0f9f6e" }}>{real}</span>
                                              : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                                          </td>
                                        </tr>
                                      );
                                    }
                                  }
                                }
                              }
                            }
                          });
                          return tableRows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
      </PageTransition>

      {/* Detail Modal */}
      {detailItem && (
        <DetailModal
          item={detailItem}
          tahun={selectedTahun}
          token={token}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Bawahan Cell Modal */}
      {bawahanCellModal && (
        <BawahanCellModal
          user={bawahanCellModal.user}
          row={bawahanCellModal.row}
          target={bawahanCellModal.target}
          realisasi={bawahanCellModal.realisasi}
          token={token}
          onClose={() => setBawahanCellModal(null)}
        />
      )}

      {/* File View Modal (Target Saya — level 2/3) */}
      {fileViewModal && (
        <FileViewModal
          id={fileViewModal.id}
          kode={fileViewModal.kode}
          nama={fileViewModal.nama}
          token={token}
          isPimpinan={isPimpinan}
          userEmail={user?.email ?? ""}
          onClose={() => setFileViewModal(null)}
        />
      )}

      {/* Validasi Biro PKU Modal */}
      {validasiModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setValidasiModal(null)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", margin: "0 0 4px" }}>Input Hasil Validasi Biro PKU</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.4 }}>{validasiModal.nama}</p>

            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Jumlah Valid
            </label>
            <input
              type="number" min={0}
              value={validasiInput.jumlahValid}
              onChange={e => setValidasiInput(p => ({ ...p, jumlahValid: e.target.value }))}
              placeholder="contoh: 12"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: "border-box" }}
            />

            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Keterangan <span style={{ fontWeight: 400, color: "#9ca3af" }}>(opsional)</span>
            </label>
            <textarea
              value={validasiInput.keterangan}
              onChange={e => setValidasiInput(p => ({ ...p, keterangan: e.target.value }))}
              placeholder="Catatan dari Biro PKU..."
              rows={3}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, marginBottom: 20, resize: "vertical", boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setValidasiModal(null)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fafafa", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                Batal
              </button>
              <button onClick={handleSaveValidasi} disabled={validasiSaving}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0369a1", fontSize: 13, fontWeight: 600, color: "#fff", cursor: validasiSaving ? "not-allowed" : "pointer", opacity: validasiSaving ? 0.7 : 1 }}>
                {validasiSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )} 
    </div>
  );
}
