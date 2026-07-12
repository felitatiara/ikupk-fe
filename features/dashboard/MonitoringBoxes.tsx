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

export default function MonitoringBoxes() {
  const { user: authUser } = useAuth();
  const [jenis, setJenis] = useState<"IKU" | "PK" | "PK_IKU">("IKU");
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
          display: flex; justify-content: space-between; gap: 24px; align-items: stretch;
          margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #f0fdf4 100%);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
        }
        .db-eyebrow { margin: 0 0 6px; color: #0f9f6e; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
        .db-title { margin: 0 0 8px; color: #0f172a; font-size: 22px; font-weight: 900; }
        .db-subtitle { max-width: 560px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
        .db-progress-card {
          min-width: 280px; padding: 16px 20px; border: 1px solid #bbf7d0; border-radius: 14px;
          background: #ffffff; display: flex; flex-direction: column; justify-content: center; gap: 0;
        }
        .db-progress-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .db-progress-top span { color: #475569; font-size: 13px; font-weight: 800; }
        .db-progress-top strong { color: #0f9f6e; font-size: 28px; font-weight: 900; }
        .db-progress-track { height: 9px; margin: 12px 0 10px; overflow: hidden; border-radius: 999px; background: #e5e7eb; }
        .db-progress-fill { height: 100%; border-radius: inherit; transition: width 0.6s ease; }
        .db-progress-meta { display: flex; align-items: center; justify-content: space-between; color: #64748b; font-size: 12px; font-weight: 700; }
        .db-toolbar {
          display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
          margin-bottom: 18px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 14px;
          background: #ffffff; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
        }
        .db-jenis-tabs { display: flex; background: #f3f4f6; border-radius: 10px; padding: 3px; gap: 2px; }
        .db-jenis-tab {
          padding: 6px 16px; border-radius: 8px; border: 1.5px solid transparent;
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
        .db-stats-row { display: flex; gap: 12px; margin-bottom: 12px; }
        .db-stat-card {
          flex: 1; border-radius: 14px; padding: 18px 20px;
          display: flex; align-items: center; justify-content: space-between; min-width: 0;
          border: 1px solid; transition: transform 0.15s, box-shadow 0.15s;
        }
        .db-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .db-stat-label { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
        .db-stat-value { font-size: 32px; font-weight: 900; color: #1f2937; line-height: 1; }
        .db-stat-sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        .db-stat-icon { opacity: 0.3; flex-shrink: 0; }
        .db-scope-label { font-size: 12px; color: #6b7280; margin: 0 0 14px; }
        @media (max-width: 900px) {
          .db-hero { flex-direction: column; align-items: stretch; }
          .db-progress-card { min-width: 0; }
          .db-stats-row { flex-direction: column; }
          .db-toolbar { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      {/* ── Hero Card ── */}
      <div className="db-hero">
        <div>
          <p className="db-eyebrow">{eyebrow}</p>
          <h3 className="db-title">Monitoring Kinerja</h3>
          <p className="db-subtitle">
            Pantau progres capaian indikator kinerja{isTopLevel ? " seluruh unit" : " Anda"} secara real-time.
          </p>
        </div>
        <div className="db-progress-card">
          <div className="db-progress-top">
            <span>Rata-rata Capaian</span>
            {loading
              ? <span style={{ color: "#9ca3af", fontSize: 18, fontWeight: 800 }}>—</span>
              : <strong>{avgPct.toFixed(1)}%</strong>
            }
          </div>
          <div className="db-progress-track">
            <div
              className="db-progress-fill"
              style={{
                width: loading ? "0%" : `${Math.min(avgPct, 100)}%`,
                background: avgPct >= 100
                  ? "linear-gradient(90deg,#16a34a,#0f9f6e)"
                  : avgPct >= 50
                  ? "linear-gradient(90deg,#f59e0b,#0f9f6e)"
                  : "linear-gradient(90deg,#ea580c,#f59e0b)",
              }}
            />
          </div>
          <div className="db-progress-meta">
            {loading
              ? <span>Memuat…</span>
              : <span>{stats?.tercapai ?? 0} dari {stats?.total ?? 0} tercapai</span>
            }
            <span>{jenisLabel} {tahun}</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="db-toolbar">
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

      {/* ── Scope label ── */}
      <p className="db-scope-label">
        {isTopLevel
          ? `Capaian seluruh target ${jenisLabel} fakultas tahun ${tahun}`
          : `Target ${jenisLabel} tahun ${tahun} yang diterima melalui disposisi.`}
      </p>

      {/* ── Stat Cards ── */}
      <div className="db-stats-row">
        {loading ? (
          <>
            <SkeletonBox />
            <SkeletonBox />
            <SkeletonBox />
          </>
        ) : stats ? (
          <>
            {/* Total Indikator */}
            <div className="db-stat-card" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
              <div>
                <div className="db-stat-label" style={{ color: "#2563eb" }}>Total Indikator</div>
                <div className="db-stat-value">{stats.total}</div>
              </div>
              <div className="db-stat-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
            </div>

            {/* Sudah Tercapai */}
            <div className="db-stat-card" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <div>
                <div className="db-stat-label" style={{ color: "#16a34a" }}>Sudah Tercapai</div>
                <div className="db-stat-value">{stats.tercapai}</div>
                <div className="db-stat-sub">dari {stats.total} indikator</div>
              </div>
              <div className="db-stat-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
            </div>

            {/* Progress Keseluruhan */}
            <div className="db-stat-card" style={{
              background: pct >= 100 ? "#f0fdf4" : pct >= 50 ? "#fefce8" : "#fff7ed",
              borderColor: pct >= 100 ? "#bbf7d0" : pct >= 50 ? "#fde047" : "#fed7aa",
            }}>
              <div style={{ flex: 1 }}>
                <div className="db-stat-label" style={{ color: pct >= 100 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#ea580c" }}>
                  Progress Tercapai
                </div>
                <div className="db-stat-value">{pct}%</div>
                <div style={{ marginTop: 8, height: 5, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 99, transition: "width 0.6s ease",
                    background: pct >= 100 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#ea580c",
                  }} />
                </div>
              </div>
              <div className="db-stat-icon" style={{ marginLeft: 16 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={pct >= 100 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#ea580c"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
                </svg>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
