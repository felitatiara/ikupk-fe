"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";

interface KinerjaRow {
  waktu: string;
  target: string;
  sasaran: string;
  capaian: string;
}

export default function MonitoringUnitKerjaContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [user, setUser] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState("Fakultas Ilmu Komputer");
  const [kinerjaData, setKinerjaData] = useState<KinerjaRow[]>([
    {
      waktu: "02 Januari 2024",
      target: "Perjanjian Kerja",
      sasaran: "Pemberlakuan kegiatan melalui web Fakultas",
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
      sasaran: "Penyelesaian LP3",
      capaian: "80%",
    },
    {
      waktu: "31 Maret 2024",
      target: "Indikator Kinerja Utama",
      sasaran: "Jumlah lulusan melepaskan pelataran",
      capaian: "55.0%",
    },
  ]);

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

  // Pie Chart Component
  const PieChart = () => {
    const data = [
      { label: "KI", value: 60, color: "#7c3aed" },
      { label: "KE", value: 40, color: "#ec4899" },
    ];

    const radius = 80;
    const centerX = 120;
    const centerY = 120;
    let currentAngle = -90;

    return (
      <svg width="240" height="240" viewBox="0 0 240 240">
        {data.map((item, idx) => {
          const sliceAngle = (item.value / 100) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceAngle;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;

          const x1 = centerX + radius * Math.cos(startRad);
          const y1 = centerY + radius * Math.sin(startRad);
          const x2 = centerX + radius * Math.cos(endRad);
          const y2 = centerY + radius * Math.sin(endRad);

          const largeArc = sliceAngle > 180 ? 1 : 0;

          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            "Z",
          ].join(" ");

          currentAngle = endAngle;

          return (
            <path key={idx} d={pathData} fill={item.color} stroke="white" strokeWidth="2" />
          );
        })}

        {/* Center circle for donut effect */}
        <circle cx={centerX} cy={centerY} r="50" fill="white" />
        <text
          x={centerX}
          y={centerY - 10}
          textAnchor="middle"
          fontSize="32"
          fontWeight="bold"
          fill="#1f2937"
        >
          100
        </text>
        <text
          x={centerX}
          y={centerY + 20}
          textAnchor="middle"
          fontSize="12"
          fill="#6b7280"
        >
          Total
        </text>
      </svg>
    );
  };

  // Bar Chart Component
  const BarChart = () => {
    const months = ["JUL", "JUL", "AUG", "AUG", "SEP", "SEP", "OCT", "OCT", "NOV", "NOV"];
    const values = [10, 15, 20, 8, 25, 30, 15, 12, 18, 22];
    const maxValue = 35;
    const chartHeight = 200;
    const chartWidth = 500;
    const barWidth = (chartWidth / (months.length + 1)) * 0.8;
    const spacing = chartWidth / (months.length + 1);

    return (
      <svg width="520" height="280" viewBox="0 0 520 280">
        {/* Y-axis */}
        <line x1="40" y1="20" x2="40" y2="220" stroke="#d1d5db" strokeWidth="2" />
        {/* X-axis */}
        <line x1="40" y1="220" x2="520" y2="220" stroke="#d1d5db" strokeWidth="2" />

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((val, idx) => (
          <text key={idx} x="25" y={220 - (val / 100) * 200 + 5} fontSize="12" fill="#9ca3af" textAnchor="end">
            {val}
          </text>
        ))}

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val, idx) => (
          <line
            key={`grid-${idx}`}
            x1="40"
            y1={220 - (val / 100) * 200}
            x2="520"
            y2={220 - (val / 100) * 200}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}

        {/* Bars */}
        {values.map((value, idx) => {
          const x = 40 + (idx + 0.5) * spacing - barWidth / 2;
          const height = (value / maxValue) * 200;
          const y = 220 - height;
          const color = value > 20 ? "#6366f1" : "#e5e7eb";

          return (
            <g key={idx}>
              <rect x={x} y={y} width={barWidth} height={height} fill={color} rx="2" />
            </g>
          );
        })}

        {/* X-axis labels */}
        {months.map((month, idx) => (
          <text
            key={idx}
            x={40 + (idx + 0.5) * spacing}
            y="245"
            fontSize="12"
            fill="#9ca3af"
            textAnchor="middle"
          >
            {month}
          </text>
        ))}

        {/* X-axis title */}
        <text x="280" y="270" fontSize="12" fill="#6b7280" textAnchor="middle">
          Bulan
        </text>
      </svg>
    );
  };

  return (
    <div>
      <PageTransition>
        {/* Breadcrumb */}
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Monitoring Unit Kerja
        </p>

        {/* Title */}
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#1f2937" }}>
          Monitoring Unit Kerja
        </h1>

        {/* Unit Selector */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
            Unit Kerja
          </label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            <option>Fakultas Ilmu Komputer</option>
            <option>Fakultas Teknik</option>
            <option>Fakultas Ekonomi</option>
            <option>Rektorat</option>
          </select>
        </div>

        {/* Charts Section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          {/* Pie Chart */}
          <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
              Distribusi Indikator
            </h3>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ position: "relative" }}>
                <PieChart />
                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    justifyContent: "center",
                    marginTop: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: "#7c3aed",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#6b7280" }}>KI</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: "#ec4899",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#6b7280" }}>KE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
              Trend Capaian Bulanan
            </h3>
            <div style={{ display: "flex", justifyContent: "center", overflowX: "auto" }}>
              <BarChart />
            </div>
          </div>
        </div>

        {/* Kinerja Table */}
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Kinerja
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f9fafb",
                    borderBottom: "2px solid #e5e7eb",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Waktu
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Target
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Sasaran Strategis
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Capaian
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {kinerjaData.map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={{ padding: "16px", color: "#0284c7", fontWeight: 600 }}>
                      {row.waktu}
                    </td>
                    <td style={{ padding: "16px", color: "#374151" }}>
                      {row.target}
                    </td>
                    <td style={{ padding: "16px", color: "#374151" }}>
                      {row.sasaran}
                    </td>
                    <td
                      style={{
                        padding: "16px",
                        textAlign: "center",
                        color: "#374151",
                        fontWeight: 600,
                      }}
                    >
                      {row.capaian}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button
                        style={{
                          backgroundColor: "#ecfdf5",
                          color: "#059669",
                          padding: "6px 12px",
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
