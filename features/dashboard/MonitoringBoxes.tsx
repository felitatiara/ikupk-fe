"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getIndikatorGrouped,
  getIndikatorGroupedForUser,
  getAvailableYears,
  type IndikatorGrouped,
  type IndikatorGroupedSub,
  type IndikatorGroupedChild,
  type IndikatorGroupedLevel3,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  tercapai: number;
  rataCapaian: number;
}

type LeafNode =
  | IndikatorGroupedSub
  | IndikatorGroupedChild
  | IndikatorGroupedLevel3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(data: IndikatorGrouped[], jenis: "IKU" | "PK"): Stats {
  let total = 0;
  let tercapai = 0;
  let sumCapaian = 0;
  let countWithTarget = 0;

  const processLeaf = (node: LeafNode) => {
    const target = (node.disposisiJumlah ?? node.nilaiTarget) ?? 0;
    const real = node.realisasiJumlah ?? 0;
    total++;
    if (target > 0) {
      const pct = (real / target) * 100;
      sumCapaian += Math.min(pct, 100);
      countWithTarget++;
      if (real >= target) tercapai++;
    }
  };

  for (const group of data) {
    for (const sub of group.subIndikators) {
      if (jenis === "IKU") {
        if (sub.children.length === 0) {
          processLeaf(sub);
        } else {
          for (const child of sub.children) processLeaf(child);
        }
      } else {
        for (const child of sub.children) {
          const l3s = child.children ?? [];
          if (l3s.length === 0) {
            processLeaf(child);
          } else {
            for (const l3 of l3s) processLeaf(l3);
          }
        }
      }
    }
  }

  return {
    total,
    tercapai,
    rataCapaian: countWithTarget > 0 ? sumCapaian / countWithTarget : 0,
  };
}

// ─── Stat box card ─────────────────────────────────────────────────────────────

function StatBox({
  label, value, sub, bg, color, border, icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  bg: string;
  color: string;
  border: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      flex: 1,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      minWidth: 0,
    }}>
      <div>
        <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 5 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: "#1f2937", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ color, opacity: 0.35, fontSize: 28, flexShrink: 0 }}>{icon}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            flex: 1, height: 80, borderRadius: 12,
            background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MonitoringBoxes() {
  const { user: authUser } = useAuth();
  const [jenis, setJenis] = useState<"IKU" | "PK">("IKU");
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [years, setYears] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const roleLevel = authUser?.roleLevel ?? 4;
  const roleName = (authUser?.role ?? "").toLowerCase();
  const isAdmin = roleLevel === 0;
  const isActualDekan = roleLevel <= 1 && !roleName.includes("wakil");
  const isTopLevel = isAdmin || isActualDekan;
  const unitId = authUser?.roleId ?? 0;

  useEffect(() => {
    const cy = new Date().getFullYear();
    getAvailableYears()
      .then((y) => {
        const merged = [...new Set([...y, String(cy - 1), String(cy), String(cy + 1)])].sort();
        setYears(merged);
        if (!merged.includes(String(cy))) setTahun(merged[merged.length - 1]);
      })
      .catch(() => setYears([String(cy - 1), String(cy), String(cy + 1)]));
  }, []);

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    setStats(null);

    const fetch =
      isTopLevel
        ? getIndikatorGrouped(jenis, tahun, unitId)
        : getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId);

    fetch
      .then((data) => setStats(computeStats(data, jenis)))
      .catch(() => setStats({ total: 0, tercapai: 0, rataCapaian: 0 }))
      .finally(() => setLoading(false));
  }, [authUser, jenis, tahun, unitId, isTopLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopeLabel = isTopLevel
    ? `Capaian seluruh target ${jenis} fakultas tahun ${tahun}`
    : `Target ${jenis} tahun ${tahun} yang diterima melalui disposisi.`;

  return (
    <>
      {/* shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ marginBottom: 24, fontFamily: "sans-serif" }}>
        {/* ── Header bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10, marginBottom: 14,
        }}>
          {/* Tab IKU / PK */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 3 }}>
            {(["IKU", "PK"] as const).map((j) => (
              <button
                key={j}
                onClick={() => setJenis(j)}
                style={{
                  padding: "5px 18px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: 12,
                  background: jenis === j ? "#fff" : "transparent",
                  color: jenis === j ? "#FF7900" : "#6b7280",
                  boxShadow: jenis === j ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {j}
              </button>
            ))}
          </div>

          {/* Year picker */}
          <select
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
            style={{
              border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px",
              fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* ── Scope label ── */}
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>{scopeLabel}</p>

        {/* ── Stat boxes ── */}
        {loading ? (
          <SkeletonRow />
        ) : stats ? (
          <div style={{ display: "flex", gap: 12 }}>
            <StatBox
              label="Total Indikator"
              value={stats.total}
              bg="#eff6ff"
              color="#2563eb"
              border="#bfdbfe"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              }
            />
            <StatBox
              label="Sudah Tercapai"
              value={stats.tercapai}
              sub={`dari ${stats.total}`}
              bg="#f0fdf4"
              color="#16a34a"
              border="#bbf7d0"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              }
            />
            <StatBox
              label="Rata-rata Capaian"
              value={`${stats.rataCapaian.toFixed(1)}%`}
              bg={stats.rataCapaian >= 100 ? "#f0fdf4" : stats.rataCapaian >= 50 ? "#fefce8" : "#fff7ed"}
              color={stats.rataCapaian >= 100 ? "#16a34a" : stats.rataCapaian >= 50 ? "#ca8a04" : "#ea580c"}
              border={stats.rataCapaian >= 100 ? "#bbf7d0" : stats.rataCapaian >= 50 ? "#fde047" : "#fed7aa"}
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
                </svg>
              }
            />
          </div>
        ) : null}

        {/* ── Progress bar (untuk visualisasi tambahan) ── */}
        {!loading && stats && stats.total > 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "#6b7280" }}>
              <span>Progress keseluruhan</span>
              <span style={{ fontWeight: 600, color: "#374151" }}>{stats.tercapai} / {stats.total} indikator tercapai</span>
            </div>
            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  width: `${stats.total > 0 ? (stats.tercapai / stats.total) * 100 : 0}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: stats.tercapai === stats.total && stats.total > 0
                    ? "#16a34a"
                    : stats.tercapai > 0 ? "#f59e0b" : "#e5e7eb",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
