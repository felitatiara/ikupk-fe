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

function hasPkBerbasisIku(group: IndikatorGrouped): boolean {
  return group.subIndikators.some(sub =>
    sub.children.some(child =>
      (child.children ?? []).some(l3 => l3.linkedIkuId != null)
    )
  );
}

function computeStats(data: IndikatorGrouped[], jenis: "IKU" | "PK" | "PK_IKU"): Stats {
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ h = 80 }: { h?: number }) {
  return (
    <div style={{
      flex: 1, height: h, borderRadius: 12,
      background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)",
      backgroundSize: "200% 100%",
      animation: "db-shimmer 1.4s infinite",
    }} />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MonitoringBoxesProps {
  jenis?: "IKU" | "PK" | "PK_IKU";
  setJenis?: (v: "IKU" | "PK" | "PK_IKU") => void;
  tahun?: string;
  setTahun?: (v: string) => void;
}

export default function MonitoringBoxes({ jenis: exJenis, setJenis: exSetJenis, tahun: exTahun, setTahun: exSetTahun }: MonitoringBoxesProps = {}) {
  const { user: authUser } = useAuth();
  const [internalJenis, setInternalJenis] = useState<"IKU" | "PK" | "PK_IKU">("IKU");
  const [internalTahun, setInternalTahun] = useState(String(new Date().getFullYear()));
  const jenis = exJenis ?? internalJenis;
  const setJenis = exSetJenis ?? setInternalJenis;
  const tahun = exTahun ?? internalTahun;
  const setTahun = exSetTahun ?? setInternalTahun;
  const [years, setYears] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const roleLevel = authUser?.roleLevel ?? 4;
  const roleName = (authUser?.role ?? "").toLowerCase();
  const isAdmin = roleLevel === 0;
  const isActualDekan = roleLevel <= 1 && !roleName.includes("wakil");
  const isTopLevel = isAdmin || isActualDekan;
  const unitId = authUser?.roleId ?? 0;

  const jenisLabel = jenis === "PK_IKU" ? "PK Berbasis IKU" : jenis;
  const pct = stats ? Math.round(stats.total > 0 ? (stats.tercapai / stats.total) * 100 : 0) : 0;
  const avgPct = stats ? stats.rataCapaian : 0;

  const eyebrow = isAdmin
    ? "Admin · Dashboard"
    : isActualDekan
    ? "Pimpinan · Dashboard"
    : (authUser?.role ?? "Dosen") + " · Dashboard";

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

    const effectiveJenis = jenis === "PK_IKU" ? "PK" : jenis;
    const fetch =
      isTopLevel
        ? getIndikatorGrouped(effectiveJenis, tahun, unitId)
        : getIndikatorGroupedForUser(effectiveJenis, tahun, authUser.id, unitId);

    fetch
      .then((data) => {
        const filtered = jenis === "PK_IKU" ? data.filter(hasPkBerbasisIku) : data;
        setStats(computeStats(filtered, jenis));
      })
      .catch(() => setStats({ total: 0, tercapai: 0, rataCapaian: 0 }))
      .finally(() => setLoading(false));
  }, [authUser, jenis, tahun, unitId, isTopLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes db-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .db-hero {
          display: flex; justify-content: space-between; gap: 28px; align-items: stretch;
          margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #f0fdf4 100%);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
        }
        .db-eyebrow { margin: 0 0 6px; color: #0f9f6e; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
        .db-title { margin: 0 0 8px; color: #0f172a; font-size: 22px; font-weight: 900; }
        .db-subtitle { max-width: 480px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
        .db-stats-panel {
          min-width: 300px; max-width: 340px; padding: 16px 18px; border: 1px solid #e2e8f0; border-radius: 14px;
          background: #ffffff; display: flex; flex-direction: column; justify-content: center; gap: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .db-jenis-tabs { display: flex; background: #f3f4f6; border-radius: 10px; padding: 3px; gap: 2px; flex-wrap: wrap; }
        .db-jenis-tab {
          padding: 6px 14px; border-radius: 8px; border: 1.5px solid transparent;
          font-size: 12px; font-weight: 700; cursor: pointer; background: transparent;
          color: #6b7280; transition: all 0.15s;
        }
        .db-jenis-tab--active { color: #fff; }
        .db-year-select {
          border: 1px solid #d7dde8; border-radius: 10px; padding: 7px 14px;
          font-size: 13px; font-weight: 700; color: #334155; background: #f8fafc;
          cursor: pointer; outline: none;
        }
        .db-year-select:focus { border-color: #0f9f6e; box-shadow: 0 0 0 3px rgba(15,159,110,0.12); }
        @media (max-width: 900px) {
          .db-hero { flex-direction: column; align-items: stretch; }
          .db-stats-panel { min-width: 0; max-width: 100%; }
        }
      `}</style>

      {/* ── Hero Card ── */}
      <div className="db-hero">
        <div style={{ flex: 1 }}>
          <p className="db-eyebrow">{eyebrow}</p>
          <h3 className="db-title">Monitoring Kinerja</h3>
          <p className="db-subtitle">
            Pantau progres capaian indikator kinerja{isTopLevel ? " seluruh unit" : " Anda"} secara real-time.
          </p>

          {/* ── Tab Jenis ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            <div className="db-jenis-tabs">
              {([
                { key: "IKU", label: "Indikator Kinerja Utama", color: "#FF7900" },
                { key: "PK", label: "Perjanjian Kinerja", color: "#7c3aed" },
                { key: "PK_IKU", label: "PK Berbasis IKU", color: "#0891b2" },
              ] as const).map(({ key: j, label, color }) => (
                <button
                  key={j}
                  onClick={() => setJenis(j)}
                  className={`db-jenis-tab${jenis === j ? " db-jenis-tab--active" : ""}`}
                  style={jenis === j ? { background: color, borderColor: color } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="db-year-select"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* ── Stats Panel ── */}
        <div className="db-stats-panel">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SkeletonBox h={24} />
              <SkeletonBox h={40} />
              <SkeletonBox h={16} />
            </div>
          ) : stats ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Rata-rata Capaian</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: avgPct >= 100 ? "#16a34a" : avgPct >= 50 ? "#d97706" : "#ea580c", lineHeight: 1 }}>
                  {avgPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                <div style={{
                  width: `${Math.min(avgPct, 100)}%`, height: "100%", borderRadius: 99, transition: "width 0.6s ease",
                  background: avgPct >= 100
                    ? "linear-gradient(90deg,#16a34a,#0f9f6e)"
                    : avgPct >= 50
                    ? "linear-gradient(90deg,#f59e0b,#0f9f6e)"
                    : "linear-gradient(90deg,#ea580c,#f59e0b)",
                }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 2 }}>Total</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1f2937", lineHeight: 1 }}>{stats.total}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>indikator</div>
                </div>
                <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 2 }}>Tercapai</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1f2937", lineHeight: 1 }}>{stats.tercapai}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>dari {stats.total}</div>
                </div>
                <div style={{
                  flex: 1,
                  background: pct >= 100 ? "#f0fdf4" : pct >= 50 ? "#fefce8" : "#fff7ed",
                  border: `1px solid ${pct >= 100 ? "#bbf7d0" : pct >= 50 ? "#fde047" : "#fed7aa"}`,
                  borderRadius: 10, padding: "8px 12px", textAlign: "center"
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#ea580c", marginBottom: 2 }}>Progress</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1f2937", lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{jenisLabel}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
