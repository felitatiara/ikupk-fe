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
  kode: string;
  nama: string;
  sasaran: string;
  target: number | null;
  realisasi: number | null;
  capaian: number | null;
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

type EntryGroup = {
  uploaderNama: string;
  uploaderEmail: string;
  indikatorKode: string;
  indikatorNama: string;
  totalRealisasi: number;
  lastPeriode: string | null;
  files: RealisasiFileItem[];
};

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

// ── Disposisi tree node ───────────────────────────────────────────────────────
function ChainNode({
  node,
  allNodes,
  depth,
}: {
  node: DisposisiChainNode;
  allNodes: DisposisiChainNode[];
  depth: number;
}) {
  const children = allNodes.filter(n => n.parentDisposisiId === node.disposisiId);
  const isLeaf = children.length === 0;

  // For non-leaf nodes: aggregate from bawahan; for leaf: own submission
  const real = isLeaf ? node.realisasiJumlah : effectiveRealisasi(node.disposisiId, allNodes);
  const status = nodeStatus(real, node.jumlahTarget);
  const sc = STATUS_STYLE[status];

  return (
    <div style={{ marginLeft: depth * 22 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 8,
        border: `1px solid ${depth === 0 ? "#d1d5db" : "#e5e7eb"}`,
        backgroundColor: depth === 0 ? "#f8fafc" : "#ffffff",
        marginBottom: 4,
        position: "relative",
      }}>
        {depth > 0 && (
          <div style={{ position: "absolute", left: -18, top: "50%", width: 14, height: 1, backgroundColor: "#d1d5db" }} />
        )}
        {/* Role indicator dot */}
        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: sc.fg, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{node.toUserNama}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{node.toUserEmail}</div>
          {!isLeaf && (
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
              Total dari {children.length} bawahan
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>
            <span style={{ color: "#9ca3af" }}>Target </span>
            <strong>{node.jumlahTarget}</strong>
            <span style={{ color: "#d1d5db", margin: "0 6px" }}>·</span>
            <span style={{ color: "#9ca3af" }}>Realisasi </span>
            <strong style={{ color: real > 0 ? "#0284c7" : "#9ca3af" }}>{real}</strong>
          </div>
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: sc.bg,
            color: sc.fg,
            border: `1px solid ${sc.border}`,
          }}>
            {sc.label}
          </span>
        </div>
      </div>
      {children.map(child => (
        <ChainNode key={child.disposisiId} node={child} allNodes={allNodes} depth={depth + 1} />
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"alur" | "realisasi">("alur");

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

  // Build entry groups for realisasi tab
  const entryGroupMap = new Map<string, EntryGroup>();
  for (const entry of (detail?.entries ?? [])) {
    const key = `${entry.uploaderEmail}::${entry.indikatorKode}`;
    if (!entryGroupMap.has(key)) {
      const fileGroup = filesByOwner.find(
        g => g.ownerEmail === entry.uploaderEmail && g.indikatorKode === entry.indikatorKode
      );
      entryGroupMap.set(key, {
        uploaderNama: entry.uploaderNama,
        uploaderEmail: entry.uploaderEmail,
        indikatorKode: entry.indikatorKode,
        indikatorNama: entry.indikatorNama,
        totalRealisasi: 0,
        lastPeriode: entry.periode,
        files: fileGroup?.files ?? [],
      });
    }
    entryGroupMap.get(key)!.totalRealisasi += entry.realisasiAngka;
  }
  const entryGroups = [...entryGroupMap.values()];
  const totalFiles = filesByOwner.reduce((s, g) => s + g.files.length, 0);

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
        {/* Header */}
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

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", padding: "0 24px" }}>
          {(["alur", "realisasi"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveDetailTab(tab)}
              style={{
                padding: "12px 20px",
                fontSize: 13,
                fontWeight: activeDetailTab === tab ? 700 : 500,
                color: activeDetailTab === tab ? "#FF7900" : "#6b7280",
                background: "none",
                border: "none",
                borderBottom: activeDetailTab === tab ? "2px solid #FF7900" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tab === "alur" ? "Alur Disposisi" : "Realisasi & File"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", maxHeight: "60vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data...</div>
          ) : activeDetailTab === "alur" ? (
            // ── Alur Disposisi ─────────────────────────────────────────────
            chain.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
                Belum ada disposisi untuk indikator ini pada tahun {tahun}.
              </div>
            ) : (
              <div>
                {/* Status summary */}
                <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                  {[
                    { label: "Tercapai", count: tercapaiCount, bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
                    { label: "Proses", count: prosesCount, bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa" },
                    { label: "Belum Input", count: belumInputCount, bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
                  ].map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: s.fg }}>{s.count}</span>
                      <span style={{ fontSize: 12, color: s.fg, fontWeight: 600 }}>{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Chain grouped by indicator */}
                {indikatorIds.map(indId => {
                  const roots = rootNodes.filter(n => n.indikatorId === indId);
                  const first = roots[0];
                  return (
                    <div key={indId} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#065f46", background: "#d1fae5", padding: "2px 7px", borderRadius: 4 }}>
                          {first?.indikatorKode}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{first?.indikatorNama}</span>
                      </div>
                      <div style={{ borderLeft: "2px solid #e5e7eb", paddingLeft: 12 }}>
                        {roots.map(root => (
                          <ChainNode key={root.disposisiId} node={root} allNodes={chain} depth={0} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // ── Realisasi & File ────────────────────────────────────────────
            entryGroups.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
                Belum ada realisasi yang diinput untuk tahun {tahun}.
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                  {entryGroups.length} penginput · {totalFiles > 0 ? `${totalFiles} file terlampir` : "belum ada file"}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px 60px 70px", gap: 8, padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Nama / Email</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>Kode</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>Capaian</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>Periode</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>File</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>Aksi</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {entryGroups.map((g) => {
                    const key = `${g.uploaderEmail}::${g.indikatorKode}`;
                    const isOpen = expandedKey === key;
                    const hasFiles = g.files.length > 0;
                    return (
                      <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px 60px 70px", gap: 8, alignItems: "center", padding: "10px 12px", backgroundColor: "#fafafa" }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{g.uploaderNama}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{g.uploaderEmail}</p>
                          </div>
                          <span style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{g.indikatorKode}</span>
                          <span style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "#374151" }}>{g.totalRealisasi}</span>
                          <span style={{ textAlign: "center", fontSize: 11, color: "#6b7280" }}>{g.lastPeriode ?? "—"}</span>
                          <span style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: hasFiles ? "#059669" : "#9ca3af" }}>
                            {hasFiles ? g.files.length : "—"}
                          </span>
                          <div style={{ textAlign: "center" }}>
                            {hasFiles ? (
                              <button
                                onClick={() => setExpandedKey(isOpen ? null : key)}
                                style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#0284c7" }}
                              >
                                {isOpen ? "Tutup" : "Lihat"}
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
                            )}
                          </div>
                        </div>
                        {isOpen && hasFiles && (
                          <div style={{ padding: "10px 14px", borderTop: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: 6 }}>
                            {g.files.map((f) => (
                              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", backgroundColor: "#f8fafc", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                  <span style={{ fontSize: 14 }}>📄</span>
                                  <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                                  {f.preview_url && (
                                    <a href={f.preview_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textDecoration: "none" }}>
                                      Preview ↗
                                    </a>
                                  )}
                                  {f.download_url && (
                                    <a href={f.download_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#0284c7", fontWeight: 600, textDecoration: "none" }}>
                                      Unduh ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
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
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", borderRadius: 8, padding: "8px 12px", border: "1px solid #e5e7eb" }}>
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

  const [activeTab, setActiveTab] = useState<"keseluruhan" | "diterima" | "bawahan">(
    role === "pimpinan" || role === "admin" ? "keseluruhan" : "diterima"
  );

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
  const [scopeIds, setScopeIds] = useState<number[]>([]);

  const isPimpinan = role === "pimpinan" || role === "admin";
  const roleStr = (user?.role ?? "").toLowerCase();
  const isDekan = roleStr === "dekan";
  const isWadek = roleStr.includes("wakil dekan");
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
      const TOTAL_COLS = 13;

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

      const sorted = [...displayedChartData].sort((a, b) => sortKode(a.kode, b.kode));

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

      // Col widths: No | Sasaran | Kode | Nama | TargetUniv | SD | TgtKual | TgtKuant | RealKual | RealKuant | Capaian | HasilBiroPKU | SumberData
      [5, 30, 10, 40, 12, 12, 12, 12, 14, 12, 12, 14, 25].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

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
      h1.getCell(2).value = "Sasaran Strategis";
      h1.getCell(3).value = "Indikator Kinerja Kegiatan";
      h1.getCell(5).value = `TARGET UNIVERSITAS\n${selectedTahun}`;
      h1.getCell(7).value = "FIK";
      h1.getCell(12).value = "Verifikasi\nBiro PKU\n(isi di sini)";
      h1.getCell(13).value = "Sumber Data";

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

      // Vertical merges: No, Sasaran, Hasil Biro PKU, Sumber Data span all 3 header rows
      [1, 2, 12, 13].forEach(c => ws.mergeCells(h1.number, c, h3.number, c));
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
        const val = validasiBiroPKU.find(v => v.indikatorId === item.id);
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

        // Merge L0-level cols (No, Sasaran, TargetUniv, SD, HasilBiroPKU, SumberData) across all rows
        [1, 2, 5, 6, 12, 13].forEach(c => {
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
          level: 0,
        });
        for (const sub of group.subIndikators) {
          // Aggregate target from children when sub has no direct disposisi
          const childTarget = (sub.children ?? []).reduce((s, c) => {
            const ct = c.disposisiJumlah ?? c.nilaiTarget ?? 0;
            if (ct > 0) return s + ct;
            return s + (c.children ?? []).reduce((gs, gc) => gs + (gc.disposisiJumlah ?? gc.nilaiTarget ?? 0), 0);
          }, 0);
          const childRealisasi = (sub.children ?? []).reduce((s, c) => s + (c.realisasiJumlah ?? 0), 0);

          const target = sub.disposisiJumlah ?? (childTarget > 0 ? childTarget : null);
          // Take max of sub-level and children in case backend doesn't aggregate up
          const subReal = sub.realisasiJumlah ?? 0;
          const aggReal = Math.max(subReal, childRealisasi);
          const realisasi = sub.realisasiJumlah !== null ? aggReal : (aggReal > 0 ? aggReal : null);
          const capaian =
            target !== null && target > 0 && realisasi !== null
              ? Math.min((realisasi / target) * 100, 100)
              : null;
          rows.push({
            kode: sub.kode,
            nama: sub.nama,
            sasaran: group.nama,
            target,
            realisasi,
            capaian,
            level: 1,
          });
          for (const child of (sub.children ?? [])) {
            const cTarget = child.disposisiJumlah ?? child.nilaiTarget ?? null;
            const cRealisasi = child.realisasiJumlah ?? null;
            const cCapaian =
              cTarget !== null && cTarget > 0 && cRealisasi !== null
                ? Math.min((cRealisasi / cTarget) * 100, 100)
                : null;
            rows.push({
              kode: child.kode,
              nama: child.nama,
              sasaran: group.nama,
              target: cTarget,
              realisasi: cRealisasi,
              capaian: cCapaian,
              level: 2,
            });
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
    progress: d.chartProgress,
  }));

  const globalChartHeight = Math.max(200, displayedChartData.length * 64);
  const personalChartHeight = Math.max(200, personalChartData.length * 64);

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Monitoring Indikator
        </p>

          {/* ── Tab Switcher ── */}
          {(() => {
            const hasBawahan = (monitoringBawahan?.bawahanList?.length ?? 0) > 0;
            const tabs = [
              ...(isPimpinan ? [{ key: "keseluruhan" as const, label: "Monitoring Keseluruhan" }] : []),
              { key: "diterima" as const, label: "Target Saya" },
              ...(hasBawahan ? [{ key: "bawahan" as const, label: "Distribusi Target Dosen" }] : []),
            ];
            if (tabs.length <= 1) return null;
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: "inline-flex",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 3,
                  gap: 2,
                }}>
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                          padding: "7px 18px",
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? "#ffffff" : "#64748b",
                          background: isActive ? "#0f9f6e" : "transparent",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          boxShadow: isActive ? "0 1px 4px rgba(15,159,110,0.25)" : "none",
                          transition: "all 0.15s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Filters — hidden on bawahan tab (has its own filters) */}
          {activeTab !== "bawahan" && <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "14px 16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Jenis Indikator
              </label>
              <select
                value={selectedJenis}
                onChange={(e) => setSelectedJenis(e.target.value)}
                style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, background: "#fff", cursor: "pointer", color: "#111827", outline: "none" }}
              >
                {jenisOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Tahun
              </label>
              <select
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(e.target.value)}
                style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, background: "#fff", cursor: "pointer", color: "#111827", outline: "none" }}
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>}

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
                      <LabelList dataKey="progress" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#374151" }} />
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

            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", marginBottom: 32 }}>
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
                  {isPimpinan && (
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
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      {[
                        { label: "No", w: "4%" },
                        { label: "Sasaran", w: "13%" },
                        { label: "Indikator / Sub-Indikator", w: "auto" },
                        { label: "Target", w: "8%" },
                        { label: "Realisasi", w: "8%" },
                        { label: "Tenggat", w: "9%" },
                        { label: "Status", w: "8%" },
                        { label: "Hasil Validasi Biro PKU", w: "9%" },
                        { label: "Aksi", w: "8%" },
                      ].map((h) => (
                        <th key={h.label} style={{ width: h.w, padding: "10px 14px", fontWeight: 700, color: "#374151", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", textAlign: h.label === "Sasaran" || h.label === "Indikator / Sub-Indikator" ? "left" : "center", whiteSpace: "nowrap" }}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data kinerja...</td></tr>
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
                      const rows: React.ReactNode[] = [];
                      let globalNo = 0;

                      for (const item of sorted) {
                        const subs = [...(item.subIndikators ?? [])].sort((a, b) => sortKode(a.kode, b.kode));
                        const totalRows = subs.reduce((s, sub) => s + 1 + (sub.children?.length ?? 0), 0) || 1;
                        let firstRow = true;

                        if (subs.length === 0) {
                          globalNo++;
                          rows.push(
                            <tr key={`${item.id}-empty`} style={{ borderBottom: "1px solid #edf2f7" }}>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#0369a1", fontWeight: 700, fontFamily: "monospace" }}>{globalNo}</td>
                              <td style={{ padding: "10px 14px", color: "#334155", fontWeight: 600 }}>{item.kode} — {item.nama}</td>
                              <td colSpan={6} style={{ padding: "10px 14px", color: "#9ca3af", textAlign: "center" }}>—</td>
                            </tr>
                          );
                          continue;
                        }

                        for (const sub of subs) {
                          globalNo++;
                          rows.push(
                            <tr key={`${item.id}-${sub.id}`} style={{ borderBottom: "1px solid #edf2f7", backgroundColor: "#fff" }}>
                              {firstRow && (
                                <>
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", color: "#0369a1", fontWeight: 800, fontFamily: "monospace", fontSize: 12, borderRight: "1px solid #f0f0f0", verticalAlign: "top" }}>
                                    {item.kode}
                                  </td>
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", verticalAlign: "top", borderRight: "1px solid #f0f0f0" }}>
                                    <span style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 12 }}>{item.nama}</span>
                                  </td>
                                </>
                              )}
                              <td style={{ padding: "10px 14px", color: "#334155", lineHeight: 1.4 }}>
                                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280", marginRight: 6 }}>{sub.kode}</span>
                                <span style={{ fontWeight: 600 }}>{sub.nama}</span>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#334155", borderLeft: "1px solid #f0f0f0" }}>
                                {(() => {
                                  const l2WithTarget = (sub.children ?? []).filter((c) => c.nilaiTarget != null);
                                  if (l2WithTarget.length > 0) {
                                    const total = l2WithTarget.reduce((s, c) => s + (c.nilaiTarget ?? 0), 0);
                                    const sat = l2WithTarget[0]?.satuan ?? null;
                                    return <span style={{ fontWeight: 600 }}>{total}{sat ? ` ${sat}` : ""}</span>;
                                  }
                                  if (sub.targetFakultas > 0) return <span style={{ fontWeight: 600 }}>{sub.targetFakultas}</span>;
                                  return <span style={{ color: "#9ca3af" }}>—</span>;
                                })()}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#334155" }}>{sub.realisasi}</td>
                              {firstRow && (
                                <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", color: "#6b7280", fontSize: 12, verticalAlign: "top", borderLeft: "1px solid #f0f0f0" }}>{item.tenggat}</td>
                              )}
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: sub.status === "Done" ? "#ecfdf5" : "#fff7ed", color: sub.status === "Done" ? "#047857" : "#c2410c", border: `1px solid ${sub.status === "Done" ? "#bbf7d0" : "#fed7aa"}` }}>
                                  {sub.status}
                                </span>
                              </td>
                              {firstRow && (() => {
                                const val = validasiBiroPKU.find(v => v.indikatorId === item.id);
                                return (
                                  <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid #f0f0f0" }}>
                                    {val?.jumlahValid != null ? (
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                        <span style={{ fontWeight: 800, color: "#0369a1", fontSize: 15 }}>{val.jumlahValid}</span>
                                        {val.keterangan && (
                                          <div style={{ fontSize: 10, color: "#6b7280", maxWidth: 110, wordBreak: "break-word", lineHeight: 1.4 }}>{val.keterangan}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                                    )}
                                  </td>
                                );
                              })()}
                              {firstRow && (
                                <td rowSpan={totalRows} style={{ padding: "10px 14px", textAlign: "center", verticalAlign: "top", borderLeft: "1px solid #f0f0f0" }}>
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
                                <td style={{ padding: "8px 10px" }} />
                              </tr>
                            );
                          }
                        }
                      }

                      return rows.length > 0 ? rows : (
                        <tr key="empty"><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data indikator.</td></tr>
                      );
                    })() : (
                      <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data target ditemukan.</td></tr>
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
                    <LabelList dataKey="progress" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#374151" }} />
                    {personalChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.status === "Done" ? "#16a34a" : "#FF7900"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabel personal */}
          <div style={{ overflowX: "auto", backgroundColor: "white", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {["No", "Kode", "Nama Indikator", "Sasaran Strategis", "Target", "Realisasi", "Capaian (%)"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "No" || h === "Target" || h === "Realisasi" || h === "Capaian (%)" ? "center" : "left",
                        padding: "10px 14px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
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
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                      Memuat data indikator...
                    </td>
                  </tr>
                ) : personalRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
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
                            <td colSpan={7} style={{ padding: "8px 14px", borderTop: "2px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
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
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: isL2 ? "#fafafa" : undefined }}>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#9ca3af", fontSize: isL2 ? 10 : 13 }}>
                            {isL2 ? "↳" : l1Counter}
                          </td>
                          <td style={{ padding: "10px 14px", color: isL2 ? "#6b7280" : "#0284c7", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                            {row.kode}
                          </td>
                          <td style={{ padding: "10px 14px", paddingLeft: isL2 ? 28 : 14, color: isL2 ? "#6b7280" : "#1f2937", fontWeight: isL2 ? 400 : 500 }}>{row.nama}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{isL2 ? "" : row.sasaran}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>
                            {row.target !== null ? row.target : <span style={{ color: "#9ca3af" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", color: "#374151" }}>
                            {row.realisasi !== null ? row.realisasi : <span style={{ color: "#9ca3af" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: capColor }}>
                            {row.capaian !== null ? `${row.capaian.toFixed(1)}%` : "—"}
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
                    const rows = monitoringBawahan.rows;
                    const users = filteredBawahan;
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
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Jenis</label>
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
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Tahun</label>
                  <select
                    value={bawahanTahun}
                    onChange={(e) => setBawahanTahun(e.target.value)}
                    style={{ width: "100%", height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, color: "#111827", background: "#fff", cursor: "pointer", outline: "none" }}
                  >
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Dosen</label>
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
                  <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 40, whiteSpace: "nowrap" }}>No</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 88, whiteSpace: "nowrap" }}>Kode</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>Indikator / Dosen</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 100, whiteSpace: "nowrap" }}>Target</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 100, whiteSpace: "nowrap" }}>Realisasi</th>
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
                                    style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", cursor: "pointer", userSelect: "none" }}
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
                                      <tr key={`leaf-${leaf.leafId}-empty`} style={{ background: "#fafafa", borderBottom: "1px solid #f8fafc" }}>
                                        <td colSpan={5} style={{ padding: "6px 28px", color: "#cbd5e1", fontSize: 11, fontStyle: "italic" }}>Belum ada disposisi</td>
                                      </tr>
                                    );
                                  } else {
                                    for (const u of usersWithData) {
                                      const target = leaf.disposisiByUser[u.id] ?? 0;
                                      const real = leaf.realisasiByUser?.[u.id] ?? 0;
                                      tableRows.push(
                                        <tr key={`leaf-${leaf.leafId}-user-${u.id}`} style={{ background: "#fafafa", borderBottom: "1px solid #f8fafc" }}>
                                          <td style={{ padding: "6px 12px" }} />
                                          <td style={{ padding: "6px 12px" }} />
                                          <td style={{ padding: "6px 16px 6px 36px" }}>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setBawahanCellModal({ user: u, row: leaf, target, realisasi: real }); }}
                                              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 8px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}
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
