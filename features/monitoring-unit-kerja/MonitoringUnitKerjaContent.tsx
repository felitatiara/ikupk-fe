"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface KinerjaRow {
  waktu: string;
  target: string;
  sasaran: string;
  capaian: string;
}

const unitOptions = [
  "Fakultas Ilmu Komputer",
  "Fakultas Teknik",
  "Fakultas Ekonomi",
  "Rektorat",
  "Lembaga Penelitian",
];

const pieData = [
  { name: "IKU", value: 75 },
  { name: "PK", value: 25 },
];
const PIE_COLORS = ["#7c6fcd", "#f4a89a"];

const barData = [
  { name: "IKU 1", Proses: 60 },
  { name: "IKU 2", Proses: 50 },
  { name: "IKU 3", Proses: 30 },
  { name: "IKU 4", Proses: 80 },
  { name: "IKU 5", Proses: 0 },
  { name: "IKU 6", Proses: 0 },
  { name: "IKU 7", Proses: 0 },
  { name: "IKU 8", Proses: 0 },
  { name: "IKU 9", Proses: 0 },
];

const kinerjaRows: KinerjaRow[] = [
  {
    waktu: "02 Januari 2024",
    target: "Perjanjian Kerja",
    sasaran: "Pemberitahuan kegiatan melalui web Fakultas",
    capaian: "100%",
  },
  {
    waktu: "02 Januari 2024",
    target: "Perjanjian Kerja",
    sasaran: "Laporan Rapat Tinjauan Manajemen (RTM)",
    capaian: "100%",
  },
  {
    waktu: "02 Januari 2024",
    target: "Perjanjian Kerja",
    sasaran: "Penyelesaian LPI",
    capaian: "80%",
  },
  {
    waktu: "31 Maret 2024",
    target: "Indikator Kinerja Utama",
    sasaran: "Hasil lulusan mendapatkan pekerjaan",
    capaian: "55.5%",
  },
];

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }: any) => {
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
  const [selectedUnit, setSelectedUnit] = useState("Fakultas Ilmu Komputer");

  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(userStr));
  }, []);

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
          Monitoring Unit Kerja
        </h1>

        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
            Unit Kerja
          </label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            style={{
              width: 280,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
              backgroundColor: "white",
              cursor: "pointer",
              color: "#374151",
            }}
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 32,
            marginBottom: 40,
            alignItems: "center",
          }}
        >
          <PieChart width={260} height={260}>
            <Pie
              data={pieData}
              cx={125}
              cy={125}
              innerRadius={65}
              outerRadius={110}
              dataKey="value"
              labelLine={false}
              label={CustomPieLabel}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value}`, ""]} />
            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13 }} />
          </PieChart>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Proses" fill="#b8b4e8" radius={[3, 3, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1f2937" }}>
          Kinerja
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Waktu</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Target</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Sasaran Strategis</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Capaian</th>
                  <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kinerjaRows.map((row, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "16px", color: "#0284c7", fontWeight: 600 }}>{row.waktu}</td>
                    <td style={{ padding: "16px", color: "#374151" }}>{row.target}</td>
                    <td style={{ padding: "16px", color: "#374151" }}>{row.sasaran}</td>
                    <td style={{ padding: "16px", textAlign: "center", color: "#374151", fontWeight: 600 }}>{row.capaian}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        style={{
                          backgroundColor: "#ecfdf5",
                          color: "#059669",
                          padding: "6px 16px",
                          borderRadius: 6,
                          border: "1px solid #d1fae5",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
