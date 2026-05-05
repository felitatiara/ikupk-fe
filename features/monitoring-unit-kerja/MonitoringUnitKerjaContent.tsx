"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getAggregatedProgress,
  getIndikatorMonitoringDetail,
  ProgressChartItem,
  IndikatorDetail,
} from "@/services/monitoringService";
import { getIndikatorGroupedForUser, getAllRealisasiFiles, type RealisasiFileItem } from "@/lib/api";

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
                Target Univ: <strong style={{ color: "#1f2937" }}>{item.targetUniversitas}%</strong>
                {item.targetAbsolut != null && (
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonitoringUnitKerjaContent({ role = "user" }: { role?: string }) {
  const [user, setUser] = useState<any>(null);
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
    capaian: r.capaian !== null ? Number(r.capaian.toFixed(1)) : 0,
  }));

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Monitoring Unit Kerja
        </p>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#1f2937" }}>
          {isPimpinan ? "Monitoring Global Indikator" : "Monitoring Indikator Saya"}
        </h1>

        {/* Filters */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#4b5563" }}>
              Jenis Indikator
            </label>
            <select
              value={selectedJenis}
              onChange={(e) => setSelectedJenis(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                backgroundColor: "white",
                cursor: "pointer",
                color: "#374151",
              }}
            >
              {jenisOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 120 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#4b5563" }}>
              Tahun
            </label>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                backgroundColor: "white",
                cursor: "pointer",
                color: "#374151",
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
            <div style={{ width: "100%", height: 260, position: "relative", marginBottom: 40 }}>
              {loading ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", zIndex: 10 }}>
                  Loading Chart...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis dataKey="kode" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 100]}
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Progress (%)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#9ca3af" }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      formatter={(value) => [`${value}%`, "Progress"]}
                    />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="chartProgress"
                      name="Progress Capaian"
                      stroke="#7c6fcd"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#7c6fcd", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>
              Rangkuman Target & Realisasi {selectedJenis} {selectedTahun}
            </h2>

            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      {[
                        { label: "Kode", align: "left" },
                        { label: "Indikator", align: "left" },
                        { label: "Target Univ (%)", align: "center" },
                        { label: "Realisasi", align: "center" },
                        { label: "Tenggat", align: "center" },
                        { label: "Status", align: "center" },
                        { label: "Aksi", align: "center" },
                      ].map((h) => (
                        <th
                          key={h.label}
                          style={{
                            textAlign: h.align as any,
                            padding: "12px 10px",
                            fontWeight: 600,
                            color: "#374151",
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
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "14px 10px", color: "#0284c7", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>
                            {item.kode}
                          </td>
                          <td style={{ padding: "14px 10px", color: "#374151", maxWidth: 260 }}>
                            {item.nama}
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>
                            {item.targetUniversitas != null ? (
                              <span>
                                {item.targetUniversitas}%
                                {item.targetAbsolut != null && (
                                  <span style={{ display: "block", fontSize: 10, color: "#9ca3af" }}>
                                    ≈ {item.targetAbsolut} abs
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>
                            {item.realisasi}
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>
                            {item.tenggat}
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: item.status === "Done" ? "#d1fae5" : "#fff7ed",
                                color: item.status === "Done" ? "#059669" : "#ea580c",
                                border: `1px solid ${item.status === "Done" ? "#34d399" : "#fbbf24"}`,
                              }}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
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
            {personalRows.length > 0 && (
              <div style={{ width: "100%", height: 240, position: "relative", marginBottom: 32 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={personalChartData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                    <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis dataKey="kode" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fontSize: 12, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Capaian (%)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#9ca3af" }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      formatter={(value) => [`${value}%`, "Capaian"]}
                    />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="capaian"
                      name="Capaian"
                      stroke="#FF7900"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#FF7900", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>
              Rincian Indikator {selectedJenis} — {selectedTahun}
            </h2>

            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      {["No", "Kode", "Nama Indikator", "Sasaran Strategis", "Target", "Realisasi", "Capaian (%)"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "No" || h === "Target" || h === "Realisasi" || h === "Capaian (%)" ? "center" : "left",
                            padding: "12px 10px",
                            fontWeight: 600,
                            color: "#374151",
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
