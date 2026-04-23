"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { getAggregatedProgress, ProgressChartItem } from "@/services/monitoringService";

const jenisOptions = [
  { label: "Indikator Kinerja Kegiatan", value: "IKU" },
  { label: "Perjanjian Kerja", value: "PK" },
];

const pieData = [
  { name: "IKU", value: 75 },
  { name: "PK", value: 25 },
];
const PIE_COLORS = ["#7c6fcd", "#f4a89a"];

const yearOptions = ["2024", "2025", "2026"];

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      <tspan x={x} dy="-6">{value}</tspan>
      <tspan x={x} dy="16">{`${value}.00%`}</tspan>
    </text>
  );
};

export default function MonitoringUnitKerjaContent({ role = "user" }: { role?: string }) {
  const [user, setUser] = useState<any>(null);
  const [selectedJenis, setSelectedJenis] = useState("IKU");
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear().toString());
  const [chartData, setChartData] = useState<ProgressChartItem[]>([]);
  const [loading, setLoading] = useState(true);

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

    const fetchData = async () => {
      setLoading(true);
      try {
        console.log(`DEBUG Monitoring: Fetching aggregated data for ${selectedJenis} on year ${selectedTahun}`);
        const data = await getAggregatedProgress(selectedTahun, selectedJenis);
        setChartData(data);
      } catch (error) {
        console.error("Failed to fetch monitoring data:", error);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedJenis, selectedTahun, user]);

  if (!user) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Monitoring Unit Kerja
        </p>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#1f2937" }}>
          Monitoring Global Indikator
        </h1>

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

        <div
          style={{
            display: "grid",
            gap: 32,
            marginBottom: 40,
            alignItems: "center",
          }}
        >


          <div style={{ width: '100%', height: 260, position: 'relative' }}>
            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10 }}>
                Loading Chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="kode"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 100]}
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Status Capaian', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#9ca3af' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value, name) => [value === 100 ? 'Tercapai' : 'Proses', 'Status']}
                  />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, paddingTop: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="chartProgress"
                    name="Capaian IKU"
                    stroke="#7c6fcd"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#7c6fcd", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>
          Rangkuman Target & Realisasi {selectedJenis} {selectedTahun}
        </h2>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Kode</th>
                  <th style={{ textAlign: "left", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Indikator</th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Target Univ</th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Target Fak</th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Realisasi</th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Tenggat</th>
                  <th style={{ textAlign: "center", padding: "12px 10px", fontWeight: 600, color: "#374151" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Memuat data kinerja...</td>
                  </tr>
                ) : chartData.length > 0 ? (
                  chartData.map((item, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "14px 10px", color: "#0284c7", fontWeight: 600 }}>{item.kode}</td>
                      <td style={{ padding: "14px 10px", color: "#374151" }}>{item.nama}</td>
                      <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.targetUniversitas}</td>
                      <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.targetFakultas}</td>
                      <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.realisasi}</td>
                      <td style={{ padding: "14px 10px", textAlign: "center", color: "#374151" }}>{item.tenggat}</td>
                      <td style={{ padding: "14px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: item.status === "Done" ? "#d1fae5" : "#fff7ed",
                            color: item.status === "Done" ? "#059669" : "#ea580c",
                            border: `1px solid ${item.status === "Done" ? "#34d399" : "#fbbf24"}`
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Tidak ada data target level 0 ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}


