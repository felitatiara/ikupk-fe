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
import { getIndikatorGroupedForUser, getAllRealisasiFiles, getMonitoringBawahan, getAvailableYears, type RealisasiFileItem, type MonitoringBawahanResult, type MonitoringBawahanUser, type MonitoringBawahanRow } from "@/lib/api";
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

  const isPimpinan = role === "pimpinan" || role === "admin";
  const roleStr = (user?.role ?? "").toLowerCase();
  const canViewDetail = roleStr === "dekan" || roleStr.includes("wakil dekan");

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
    }
    fetchPersonal();
  }, [selectedJenis, selectedTahun, user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Pimpinan KPIs
  const doneCount = chartData.filter((d) => d.status === "Done").length;
  const prosesCount = chartData.filter((d) => d.status === "Proses").length;
  const avgProgress = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.chartProgress, 0) / chartData.length)
    : 0;

  // Personal KPIs (L1 only)
  const l1Rows = personalRows.filter((r) => r.level === 1);
  const pDone = l1Rows.filter((r) => r.capaian !== null && r.capaian >= 100).length;
  const pAvg = l1Rows.length > 0
    ? (l1Rows.reduce((s, r) => s + (r.capaian ?? 0), 0) / l1Rows.length).toFixed(1)
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
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedJenis} - {selectedTahun}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      {[
                        { label: "No", w: "4%" },
                        { label: "Sasaran", w: "14%" },
                        { label: "Indikator / Sub-Indikator", w: "auto" },
                        { label: "Target", w: "10%" },
                        { label: "Realisasi", w: "9%" },
                        { label: "Tenggat", w: "10%" },
                        { label: "Status", w: "9%" },
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
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data kinerja...</td></tr>
                    ) : chartData.length > 0 ? (() => {
                      const sortKode = (a: string, b: string) => {
                        const pa = a.split('.').map(Number);
                        const pb = b.split('.').map(Number);
                        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                          const d = (pa[i] ?? 0) - (pb[i] ?? 0);
                          if (d !== 0) return d;
                        }
                        return 0;
                      };

                      const sorted = [...chartData].sort((a, b) => sortKode(a.kode, b.kode));
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
                        <tr key="empty"><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data indikator.</td></tr>
                      );
                    })() : (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data target ditemukan.</td></tr>
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

                return (
                  <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 + users.length * 140 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 40, whiteSpace: "nowrap" }}>No</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 88, whiteSpace: "nowrap" }}>Kode</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>Indikator</th>
                          <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", width: 80, whiteSpace: "nowrap" }}>Target</th>
                          {users.map((u) => (
                            <th key={u.id} style={{ padding: "10px 12px", textAlign: "center", width: 140, minWidth: 120, borderLeft: "1px solid #e2e8f0" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{u.nama}</div>
                              <div style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af", marginTop: 1 }}>{u.roleName}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const tableRows: React.ReactNode[] = [];
                          let currentGroupId: number | null = null;
                          let groupNo = 0;
                          for (const row of allRows) {
                            if (row.groupId !== currentGroupId) {
                              currentGroupId = row.groupId;
                              groupNo++;
                              tableRows.push(
                                <tr key={`g-${row.groupId}`} style={{ background: "#f1f5f9", borderTop: "2px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 13, width: 40 }}>{groupNo}</td>
                                  <td colSpan={3 + users.length} style={{ padding: "8px 14px" }}>
                                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 13 }}>{row.groupNama}</span>
                                  </td>
                                </tr>
                              );
                            }
                            tableRows.push(
                              <tr key={row.leafId} style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                                <td style={{ padding: "10px 12px", textAlign: "center", color: "#d1d5db", fontSize: 12 }}>—</td>
                                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{row.leafKode}</td>
                                <td style={{ padding: "10px 12px", color: "#1f2937", fontWeight: 500, lineHeight: 1.4 }}>{row.leafNama}</td>
                                <td style={{ padding: "10px 12px", textAlign: "center", color: "#374151", fontWeight: 600 }}>
                                  {row.nilaiTarget != null
                                    ? <>{row.nilaiTarget}{row.satuan ? <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 3 }}>{row.satuan}</span> : null}</>
                                    : <span style={{ color: "#d1d5db" }}>—</span>}
                                </td>
                                {users.map((u) => {
                                  const target = row.disposisiByUser[u.id] ?? 0;
                                  const real = row.realisasiByUser?.[u.id] ?? 0;
                                  return (
                                    <td key={u.id} style={{ padding: "10px 12px", textAlign: "center", borderLeft: "1px solid #f1f5f9" }}>
                                      {target > 0 ? (
                                        <button
                                          onClick={() => setBawahanCellModal({ user: u, row, target, realisasi: real })}
                                          style={{
                                            display: "inline-flex", flexDirection: "column", alignItems: "center",
                                            gap: 1, padding: "4px 10px", borderRadius: 7,
                                            border: "1px solid #e5e7eb", background: "#fafafa",
                                            cursor: "pointer", minWidth: 48,
                                          }}
                                        >
                                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{target}</span>
                                          {real > 0 && (
                                            <span style={{ fontSize: 10, color: "#0f9f6e", fontWeight: 600 }}>↑{real}</span>
                                          )}
                                        </button>
                                      ) : (
                                        <span style={{ color: "#e5e7eb" }}>—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          }
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
    </div>
  );
}
