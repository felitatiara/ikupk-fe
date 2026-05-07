"use client";

import { useEffect, useState } from "react";
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
} from "@/services/monitoringService";
import { getIndikatorGroupedForUser, getAllRealisasiFiles, type RealisasiFileItem } from "@/lib/api";
import type { User } from "@/types";

const jenisOptions = [
  { label: "Indikator Kinerja Kegiatan", value: "IKU" },
  { label: "Perjanjian Kerja", value: "PK" },
];

const yearOptions = ["2024", "2025", "2026"];

interface PersonalRow {
  kode: string;
  nama: string;
  sasaran: string;
  target: number | null;
  realisasi: number | null;
  capaian: number | null;
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
    realisasi?: number | string | null;
    progress?: number | string | null;
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
        setDetail({ indikator: null, entries: [] });
        setFilesByOwner([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [item.id, tahun, token]);

  // Merge realisasi entries with file data, grouped by uploader+indikator
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
          maxWidth: 860,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <p style={{ color: "#FF7900", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              Detail Realisasi
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
                Realisasi Total: <strong style={{ color: "#1f2937" }}>{item.realisasi}</strong>
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Tahun: <strong style={{ color: "#1f2937" }}>{tahun}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: 4, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data...</div>
          ) : entryGroups.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
              Belum ada realisasi yang diinput untuk tahun {tahun}.
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                {entryGroups.length} penginput · {totalFiles > 0 ? `${totalFiles} file terlampir` : "belum ada file"}
              </p>

              {/* Table header */}
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
                            <div
                              key={f.id}
                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", backgroundColor: "#f8fafc", borderRadius: 6, border: "1px solid #e5e7eb" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <span style={{ fontSize: 14 }}>📄</span>
                                <span style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                                {f.preview_url && (
                                  <a href={f.preview_url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textDecoration: "none" }}>
                                    Preview ↗
                                  </a>
                                )}
                                {f.download_url && (
                                  <a href={f.download_url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, color: "#0284c7", fontWeight: 600, textDecoration: "none" }}>
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
      <div
        className="position-absolute top-0 start-0 end-0"
      />
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

// ── Custom Bar Tooltip ────────────────────────────────────────────────────────

function BarTooltip({ active, payload }: { active?: boolean; payload?: ChartTooltipItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isIku = d.jenis === "IKU";
  const unit = !isIku && d.satuan ? ` ${d.satuan}` : "";
  const progressColor = d.status === "Done" ? "#16a34a" : "#ea580c";
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: 12, maxWidth: 280 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#1f2937" }}>[{d.kode}] {d.nama ?? d.kode}</p>
      {d.target != null && (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Target: <strong style={{ color: "#374151" }}>{isIku ? `${d.target}%` : `${d.target}${unit}`}</strong>
        </p>
      )}
      {d.realisasi != null && (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Realisasi: <strong style={{ color: progressColor }}>{d.realisasi}{unit}</strong>
        </p>
      )}
      {d.progress != null && (
        <p style={{ margin: "2px 0", color: "#6b7280" }}>
          Progress: <strong style={{ color: progressColor }}>{d.progress}%</strong>
        </p>
      )}
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
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear().toString());

  const [chartData, setChartData] = useState<ProgressChartItem[]>([]);
  const [personalRows, setPersonalRows] = useState<PersonalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailItem, setDetailItem] = useState<ProgressChartItem | null>(null);

  const isPimpinan = role === "pimpinan" || role === "admin";
  const roleStr = (user?.role ?? "").toLowerCase();
  const canViewDetail = roleStr === "dekan" || roleStr.includes("wakil dekan");

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
    if (!user) return;
    if (isPimpinan) {
      fetchGlobal();
    } else {
      fetchPersonal();
    }
  }, [selectedJenis, selectedTahun, user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function fetchPersonal() {
    setLoading(true);
    try {
      const userId: number = user?.id ?? user?.userId;
      const roleId: number = user?.roleId ?? 0;
      const data = await getIndikatorGroupedForUser(selectedJenis, selectedTahun, userId, roleId);
      const rows: PersonalRow[] = [];
      for (const group of data) {
        for (const sub of group.subIndikators) {
          const target = sub.disposisiJumlah ?? null;
          const realisasi = sub.realisasiJumlah ?? null;
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
          });
        }
      }
      setPersonalRows(rows);
    } catch {
      setPersonalRows([]);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const personalChartData = personalRows.map((r) => ({
    kode: r.kode,
    nama: r.nama,
    target: r.target ?? 0,
    realisasi: r.realisasi ?? 0,
    capaian: r.capaian !== null ? Number(r.capaian.toFixed(1)) : 0,
    progress: r.capaian !== null ? Math.min(100, Number(r.capaian.toFixed(1))) : 0,
    status: r.capaian !== null && r.capaian >= 100 ? "Done" : "Proses",
  }));

  // Pimpinan KPIs
  const doneCount = chartData.filter((d) => d.status === "Done").length;
  const prosesCount = chartData.filter((d) => d.status === "Proses").length;
  const avgProgress = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.chartProgress, 0) / chartData.length)
    : 0;

  // Personal KPIs
  const pDone = personalRows.filter((r) => r.capaian !== null && r.capaian >= 100).length;
  const pAvg = personalRows.length > 0
    ? (personalRows.reduce((s, r) => s + (r.capaian ?? 0), 0) / personalRows.length).toFixed(1)
    : "0";

  const globalChartItems = chartData.map((d) => ({
    kode: d.kode,
    nama: d.nama,
    jenis: d.jenis,
    status: d.status,
    satuan: d.satuan,
    target: d.targetUniversitas,
    realisasi: d.realisasi,
    persentaseRealisasi: d.persentaseRealisasi,
    progress: d.chartProgress,
  }));

  const globalChartHeight = Math.max(200, chartData.length * 64);
  const personalChartHeight = Math.max(200, personalChartData.length * 64);

  return (
    <div style={{ backgroundColor: "#ffffff", margin: "-24px -32px", minHeight: "calc(100vh - 64px)", padding: "24px 32px 40px" }}>
      <PageTransition>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "#ea580c", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Monitoring Unit Kerja
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#111827", letterSpacing: 0 }}>
                  {isPimpinan ? "Monitoring Global Indikator" : "Monitoring Indikator Saya"}
                </h1>
                <div style={{ marginTop: 6, color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                  Pantau target, realisasi, dan progres capaian indikator berdasarkan jenis dan tahun.
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            padding: 14,
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}>
            <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }}>
                Jenis Indikator
              </label>
              <select
                value={selectedJenis}
                onChange={(e) => setSelectedJenis(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid #dbe3ea",
                  fontSize: 13,
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  color: "#111827",
                  outline: "none",
                }}
              >
                {jenisOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div style={{ width: 140 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }}>
                Tahun
              </label>
              <select
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid #dbe3ea",
                  fontSize: 13,
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  color: "#111827",
                  outline: "none",
                }}
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

        {/* ── PIMPINAN / ADMIN: global view ── */}
        {isPimpinan && (
          <>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="Total Indikator" value={chartData.length} accent="#0284c7" bg="#E8F1F9" icon={ListChecks} />
              <KpiCard label="Sudah Tercapai" value={doneCount} sub={`dari ${chartData.length}`} accent="#047857" bg="#E6F6EA" icon={CheckCircle2} />
              <KpiCard label="Sedang Proses" value={prosesCount} sub={`dari ${chartData.length}`} accent="#b45309" bg="#FFF4C2" icon={Clock3} />
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
                      <LabelList dataKey="progress" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#374151" }} />
                      {globalChartItems.map((entry, i) => (
                        <Cell key={i} fill={entry.status === "Done" ? "#16a34a" : "#ea580c"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "flex-end" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                  <span style={{ width: 12, height: 8, borderRadius: 2, background: "#16a34a", display: "inline-block" }} />
                  Tercapai
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280" }}>
                  <span style={{ width: 12, height: 8, borderRadius: 2, background: "#ea580c", display: "inline-block" }} />
                  Proses
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  Rangkuman Target & Realisasi
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedJenis} - {selectedTahun}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f8fafc" }}>
                      {[
                        { label: "Kode", align: "left" },
                        { label: "Indikator", align: "left" },
                        { label: selectedJenis === "PK" ? "Target Fak" : "Target Univ (%)", align: "center" },
                        { label: "Realisasi", align: "center" },
                        { label: "Tenggat", align: "center" },
                        { label: "Status", align: "center" },
                        { label: "Aksi", align: "center" },
                      ].map((h) => (
                        <th
                          key={h.label}
                          style={{
                            textAlign: h.align as "left" | "center",
                            padding: "11px 10px",
                            fontWeight: 600,
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                          Memuat data kinerja...
                        </td>
                      </tr>
                    ) : chartData.length > 0 ? (
                      chartData.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #edf2f7" }}>
                          <td style={{ padding: "13px 10px", color: "#0369a1", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                            {item.kode}
                          </td>
                          <td style={{ padding: "13px 10px", color: "#334155", maxWidth: 300, lineHeight: 1.45 }}>
                            {item.nama}
                          </td>
                          <td style={{ padding: "13px 10px", textAlign: "center", color: "#334155" }}>
                            {item.targetUniversitas != null ? (
                              <span>
                                {item.jenis === "PK"
                                  ? `${item.targetUniversitas}${item.satuan ? ` ${item.satuan}` : ""}`
                                  : `${item.targetUniversitas}%`}
                                {item.jenis === "IKU" && item.targetAbsolut != null && (
                                  <span style={{ display: "block", fontSize: 10, color: "#9ca3af" }}>
                                    ≈ {item.targetAbsolut} abs
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "13px 10px", textAlign: "center", color: "#334155" }}>
                            {item.realisasi}
                          </td>
                          <td style={{ padding: "13px 10px", textAlign: "center", color: "#334155" }}>
                            {item.tenggat}
                          </td>
                          <td style={{ padding: "13px 10px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: item.status === "Done" ? "#ecfdf5" : "#fff7ed",
                                color: item.status === "Done" ? "#047857" : "#c2410c",
                                border: `1px solid ${item.status === "Done" ? "#bbf7d0" : "#fed7aa"}`,
                              }}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: "13px 10px", textAlign: "center" }}>
                            {canViewDetail ? (
                              <button
                                onClick={() => setDetailItem(item)}
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  background: "white",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#374151",
                                  cursor: "pointer",
                                }}
                              >
                                Detail
                              </button>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                          Tidak ada data target ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── ATASAN / USER: personal view ── */}
        {!isPimpinan && (
          <>
            {/* KPI Cards */}
            {personalRows.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
                <KpiCard label="Total Indikator" value={personalRows.length} accent="#0284c7" bg="#E8F1F9" icon={ListChecks} />
                <KpiCard label="Sudah Tercapai" value={pDone} sub={`dari ${personalRows.length}`} accent="#047857" bg="#E6F6EA" icon={CheckCircle2} />
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
                      <LabelList dataKey="progress" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#374151" }} />
                      {personalChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.status === "Done" ? "#16a34a" : "#ea580c"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}


            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>
              Rincian Indikator {selectedJenis} — {selectedTahun}
            </h2>

            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f8fafc" }}>
                      {["No", "Kode", "Nama Indikator", "Sasaran Strategis", "Target", "Realisasi", "Capaian (%)"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "No" || h === "Target" || h === "Realisasi" || h === "Capaian (%)" ? "center" : "left",
                            padding: "11px 10px",
                            fontWeight: 600,
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                          Memuat data indikator...
                        </td>
                      </tr>
                    ) : personalRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                          Belum ada indikator yang didisposisikan untuk tahun {selectedTahun}.
                        </td>
                      </tr>
                    ) : (
                      personalRows.map((row, i) => {
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
                          <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <td style={{ padding: "12px 10px", textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                            <td style={{ padding: "12px 10px", color: "#0284c7", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                              {row.kode}
                            </td>
                            <td style={{ padding: "12px 10px", color: "#1f2937", fontWeight: 500 }}>{row.nama}</td>
                            <td style={{ padding: "12px 10px", color: "#6b7280", fontSize: 12 }}>{row.sasaran}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center", color: "#374151" }}>
                              {row.target !== null ? row.target : <span style={{ color: "#9ca3af" }}>—</span>}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "center", color: "#374151" }}>
                              {row.realisasi !== null ? row.realisasi : <span style={{ color: "#9ca3af" }}>—</span>}
                            </td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700, color: capColor }}>
                              {row.capaian !== null ? `${row.capaian.toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </div>
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
    </div>
  );
}
