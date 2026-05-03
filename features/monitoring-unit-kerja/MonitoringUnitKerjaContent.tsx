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
import { getAggregatedProgress, ProgressChartItem } from "@/services/monitoringService";
import { getIndikatorGroupedForUser } from "@/lib/api";

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

export default function MonitoringUnitKerjaContent({ role = "user" }: { role?: string }) {
  const [user, setUser] = useState<any>(null);
  const [selectedJenis, setSelectedJenis] = useState("IKU");
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear().toString());

  // Pimpinan/admin: global aggregated data
  const [chartData, setChartData] = useState<ProgressChartItem[]>([]);

  // Atasan: personal indikator data
  const [personalRows, setPersonalRows] = useState<PersonalRow[]>([]);

  const [loading, setLoading] = useState(true);

  const isPimpinan = role === "pimpinan" || role === "admin";

  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(userStr));
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

  // ─── Personal chart data ───
  const personalChartData = personalRows.map(r => ({
    kode: r.kode,
    capaian: r.capaian !== null ? Number(r.capaian.toFixed(1)) : 0,
  }));

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Monitoring Indikator Kinerja
        </p>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#1f2937" }}>
          {isPimpinan ? "Monitoring Indikator" : "Monitoring Indikator Saya"}
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
            {/* Line chart */}
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
                      label={{ value: "Status Capaian", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#9ca3af" }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      formatter={(value) => [value === 100 ? "Tercapai" : "Proses", "Status"]}
                    />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                    <Line type="monotone" dataKey="chartProgress" name="Capaian IKU" stroke="#7c6fcd" strokeWidth={3} dot={{ r: 4, fill: "#7c6fcd", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
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
                      {["Kode", "Indikator", "Target Univ", "Target Fak", "Realisasi", "Tenggat", "Status"].map(h => (
                        <th key={h} style={{ textAlign: h === "Kode" || h === "Indikator" ? "left" : "center", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data kinerja...</td></tr>
                    ) : chartData.length > 0 ? (
                      chartData.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "14px 10px", color: "#0284c7", fontWeight: 600 }}>{item.kode}</td>
                          <td style={{ padding: "14px 10px", color: "#374151" }}>{item.nama}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.targetUniversitas}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.targetFakultas}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.realisasi}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.tenggat}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: item.status === "Done" ? "#d1fae5" : "#fff7ed",
                              color: item.status === "Done" ? "#059669" : "#ea580c",
                              border: `1px solid ${item.status === "Done" ? "#34d399" : "#fbbf24"}`,
                            }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Tidak ada data target ditemukan.</td></tr>
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
            {/* Personal line chart */}
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
                    <Line type="monotone" dataKey="capaian" name="Capaian" stroke="#FF7900" strokeWidth={3} dot={{ r: 4, fill: "#FF7900", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
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
                      {["No", "Kode", "Nama Indikator", "Sasaran Strategis", "Target", "Realisasi", "Capaian (%)"].map(h => (
                        <th key={h} style={{ textAlign: h === "No" || h === "Target" || h === "Realisasi" || h === "Capaian (%)" ? "center" : "left", padding: "12px 10px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data indikator...</td></tr>
                    ) : personalRows.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                        Belum ada indikator yang didisposisikan untuk tahun {selectedTahun}.
                      </td></tr>
                    ) : (
                      personalRows.map((row, i) => {
                        const capColor = row.capaian === null ? "#9ca3af" : row.capaian >= 100 ? "#16a34a" : row.capaian >= 76 ? "#2563eb" : row.capaian >= 51 ? "#d97706" : "#dc2626";
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <td style={{ padding: "12px 10px", textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                            <td style={{ padding: "12px 10px", color: "#0284c7", fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{row.kode}</td>
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
    </div>
  );
}
