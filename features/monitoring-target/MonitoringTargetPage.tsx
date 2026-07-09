"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getIndikatorGrouped,
  getAllRoles,
  getIndikatorCascadeChain,
  getAvailableYears,
  getDisposisi,
  type IndikatorGrouped,
  type IndikatorGroupedSub,
  type IndikatorGroupedChild,
  type RoleOption,
  type DisposisiItem,
} from "../../lib/api";

const PRODI_DEFS = [
  { key: "SI", label: "S1 SI Fixed", keywords: ["sistem informasi"] },
  { key: "IF", label: "S1 IF Fixed", keywords: ["informatika"] },
  { key: "D3", label: "D3 SI Fixed", keywords: ["d3", "diploma 3"] },
  { key: "SD", label: "S1 SD Fixed", keywords: ["data science", "sains data"] },
];

function detectProdi(chain: (number | number[])[], allRoles: RoleOption[]): string {
  for (let i = chain.length - 1; i >= 0; i--) {
    const ids = (Array.isArray(chain[i]) ? chain[i] : [chain[i]]) as number[];
    for (const id of ids) {
      const r = allRoles.find((r) => r.id === id);
      if (!r?.unitNama) continue;
      const u = r.unitNama.toLowerCase();
      if (u.includes("d3") || u.includes("diploma 3")) return "D3";
      if (u.includes("data science") || u.includes("sains data")) return "SD";
      if (u.includes("informatika")) return "IF";
      if (u.includes("sistem informasi")) return "SI";
    }
  }
  return "";
}

interface L1Entry {
  l0Kode: string;
  l0Nama: string;
  l1: IndikatorGroupedSub;
  chain: (number | number[])[];
  prodi: string;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("id-ID");
}

function DistStatus({ disposisi, target }: { disposisi: number | null; target: number | null }) {
  const d = disposisi ?? 0;
  const t = target ?? 0;
  if (t === 0) return <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>;
  if (d >= t)
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "1px 7px", borderRadius: 20 }}>
        Penuh
      </span>
    );
  if (d > 0)
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "1px 7px", borderRadius: 20 }}>
        Sebagian
      </span>
    );
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", padding: "1px 7px", borderRadius: 20 }}>
      Belum
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: 52, height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: pct >= 100 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#e5e7eb",
          borderRadius: 99,
        }}
      />
    </div>
  );
}

function ChainBadge({ step, idx, total, allRoles }: {
  step: number | number[];
  idx: number;
  total: number;
  allRoles: RoleOption[];
}) {
  const ids = (Array.isArray(step) ? step : [step]) as number[];
  const names = ids.map((id) => allRoles.find((r) => r.id === id)?.name ?? `Role ${id}`);
  const isFirst = idx === 0;
  const isLast = idx === total - 1;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: isFirst ? "#dbeafe" : isLast ? "#dcfce7" : "#f3f4f6",
        color: isFirst ? "#1e40af" : isLast ? "#166534" : "#374151",
        border: `1px solid ${isFirst ? "#bfdbfe" : isLast ? "#bbf7d0" : "#e5e7eb"}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {names.join(" / ")}
    </span>
  );
}

function L1Row({ entry, allRoles, router, tahun }: {
  entry: L1Entry;
  allRoles: RoleOption[];
  router: ReturnType<typeof useRouter>;
  tahun: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedL2s, setExpandedL2s] = useState<Set<number>>(new Set());
  const [dosenCache, setDosenCache] = useState<Map<number, DisposisiItem[]>>(new Map());
  const [dosenLoading, setDosenLoading] = useState<Set<number>>(new Set());
  const { l1, chain } = entry;

  async function toggleDosenDrilldown(l2id: number) {
    if (expandedL2s.has(l2id)) {
      setExpandedL2s(prev => { const next = new Set(prev); next.delete(l2id); return next; });
      return;
    }
    setExpandedL2s(prev => new Set(prev).add(l2id));
    if (!dosenCache.has(l2id)) {
      setDosenLoading(prev => new Set(prev).add(l2id));
      try {
        const items = await getDisposisi(l2id, tahun);
        setDosenCache(prev => new Map(prev).set(l2id, items));
      } catch {
        setDosenCache(prev => new Map(prev).set(l2id, []));
      } finally {
        setDosenLoading(prev => { const next = new Set(prev); next.delete(l2id); return next; });
      }
    }
  }

  const l2s: IndikatorGroupedChild[] = l1.children ?? [];
  const totalTarget = l2s.reduce((s, c) => s + (c.nilaiTarget ?? 0), 0);
  const totalDisposisi = l2s.reduce((s, c) => s + (c.disposisiJumlah ?? 0), 0);
  const distributedCount = l2s.filter((c) => (c.disposisiJumlah ?? 0) > 0).length;
  const satuan = l2s.find((c) => c.satuan)?.satuan ?? "";
  const hasChain = chain.length > 0;
  const hasDistribusi = l2s.length > 0 && totalTarget > 0;

  return (
    <div style={{ borderBottom: "1px solid #f1f5f9" }}>
      {/* ── Summary row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 18px",
          cursor: "pointer",
          background: expanded ? "#fafbff" : "transparent",
          transition: "background 0.15s",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          style={{
            flexShrink: 0,
            fontSize: 9,
            color: "#94a3b8",
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.18s",
            display: "inline-block",
          }}
        >
          ▶
        </span>

        {/* L1 label */}
        <div style={{ minWidth: 150, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#4f46e5" }}>{l1.kode}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginLeft: 8 }}>
            {l1.nama}
          </span>
        </div>

        {/* Alur status badge (collapsed — detail shown when expanded) */}
        <div style={{ flex: 1 }}>
          {hasChain ? (
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: "#4f46e5", background: "#eef2ff",
              border: "1px solid #c7d2fe", borderRadius: 20,
              padding: "2px 10px",
            }}>
              {chain.length} langkah
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "#d1d5db", fontStyle: "italic" }}>
              Alur belum dikonfigurasi
            </span>
          )}
        </div>

        {/* Distribusi summary */}
        <div
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {hasDistribusi ? (
            <>
              <ProgressBar value={totalDisposisi} max={totalTarget} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", whiteSpace: "nowrap" as const }}>
                {fmt(totalDisposisi)} / {fmt(totalTarget)}{satuan ? ` ${satuan}` : ""}
              </span>
              <span style={{ fontSize: 10.5, color: "#9ca3af", whiteSpace: "nowrap" as const }}>
                {distributedCount}/{l2s.length} unit
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/admin/master-indikator/${l1.id}/cascade`); }}
          style={{
            flexShrink: 0,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#6b7280",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Edit Alur
        </button>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div
          style={{
            padding: "10px 18px 14px 34px",
            background: "#fafbff",
            borderTop: "1px solid #eef2ff",
          }}
        >
          {/* Alur detail — single-line "Name | Unit" chips */}
          {hasChain && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" as const }}>
              {chain.map((step, si) => {
                const ids = (Array.isArray(step) ? step : [step]) as number[];
                const names = ids.map((id) => allRoles.find((r) => r.id === id)?.name ?? `Role ${id}`);
                const unit = allRoles.find((r) => ids.includes(r.id))?.unitNama ?? "";
                const isFirst = si === 0;
                const isLast = si === chain.length - 1;
                return (
                  <span key={si} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0,
                        padding: "3px 11px",
                        borderRadius: 20,
                        background: isFirst ? "#dbeafe" : isLast ? "#dcfce7" : "#f3f4f6",
                        border: `1px solid ${isFirst ? "#bfdbfe" : isLast ? "#bbf7d0" : "#e5e7eb"}`,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: isFirst ? "#1e40af" : isLast ? "#166534" : "#1e293b",
                      }}>
                        {names.join(" / ")}
                      </span>
                      {unit && (
                        <>
                          <span style={{ color: isFirst ? "#bfdbfe" : isLast ? "#bbf7d0" : "#d1d5db", margin: "0 6px", fontSize: 12 }}>|</span>
                          <span style={{ fontSize: 10.5, color: isFirst ? "#60a5fa" : isLast ? "#4ade80" : "#9ca3af" }}>
                            {unit}
                          </span>
                        </>
                      )}
                    </span>
                    {si < chain.length - 1 && (
                      <span style={{ color: "#c7d2fe", fontSize: 13 }}>→</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Distribution table */}
          {hasDistribusi && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr 100px 100px 56px 80px 80px",
                  padding: "5px 12px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e5e7eb",
                  gap: 8,
                }}
              >
                {["Kode", "Nama", "Target", "Disposisi", "Progress", "Status", "Dosen"].map((h) => (
                  <span key={h} style={{ fontSize: 9.5, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* L2 rows */}
              {l2s.map((l2, idx) => {
                const hasSubs = (l2.children ?? []).length > 0;
                const l2DosenExpanded = expandedL2s.has(l2.id);
                const l2DosenItems = dosenCache.get(l2.id) ?? [];
                const l2DosenLoading = dosenLoading.has(l2.id);
                return (
                  <div key={l2.id}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px 1fr 100px 100px 56px 80px 80px",
                        padding: "6px 12px",
                        borderBottom: idx < l2s.length - 1 || hasSubs || l2DosenExpanded ? "1px solid #f3f4f6" : "none",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 600 }}>{l2.kode}</span>
                      <span style={{ fontSize: 11.5, color: "#1e293b", fontWeight: 500 }}>
                        {l2.nama}
                        {hasSubs && <span style={{ fontSize: 9.5, color: "#9ca3af", marginLeft: 5 }}>({l2.children.length} sub)</span>}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#374151" }}>
                        {fmt(l2.nilaiTarget)}
                        {l2.satuan && <span style={{ fontSize: 9.5, fontWeight: 400, color: "#9ca3af", marginLeft: 3 }}>{l2.satuan}</span>}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: (l2.disposisiJumlah ?? 0) >= (l2.nilaiTarget ?? 1) && (l2.nilaiTarget ?? 0) > 0 ? "#15803d" : "#374151" }}>
                        {fmt(l2.disposisiJumlah)}
                      </span>
                      <ProgressBar value={l2.disposisiJumlah ?? 0} max={l2.nilaiTarget ?? 0} />
                      <DistStatus disposisi={l2.disposisiJumlah ?? null} target={l2.nilaiTarget ?? null} />
                      <button
                        onClick={() => toggleDosenDrilldown(l2.id)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: `1px solid ${l2DosenExpanded ? "#a5b4fc" : "#e5e7eb"}`,
                          background: l2DosenExpanded ? "#eef2ff" : "#fff",
                          color: l2DosenExpanded ? "#4f46e5" : "#6b7280",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {l2DosenLoading ? "…" : l2DosenExpanded ? "▲ Tutup" : "👤 Dosen"}
                      </button>
                    </div>

                    {/* Dosen drill-down */}
                    {l2DosenExpanded && (() => {
                      // Only show leaf recipients: users who received but did NOT further distribute.
                      const senderIds = new Set(l2DosenItems.map(i => i.fromUserId).filter((id): id is number => id != null));
                      const leafItems = l2DosenItems.filter(i => !senderIds.has(i.toUserId));
                      return (
                        <div style={{ padding: "8px 12px 10px 24px", background: "#f5f3ff", borderBottom: "1px solid #e5e7eb" }}>
                          {l2DosenLoading ? (
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Memuat data dosen…</p>
                          ) : leafItems.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Belum ada distribusi ke dosen.</p>
                          ) : (
                            <>
                              <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 800, color: "#4f46e5", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                                {leafItems.length} Penerima Target
                              </p>
                              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                                {leafItems.map((item) => (
                                  <div
                                    key={item.toUserId}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "5px 12px",
                                      borderRadius: 8,
                                      background: "#fff",
                                      border: "1px solid #ddd6fe",
                                      fontSize: 11.5,
                                    }}
                                  >
                                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{item.toUser?.nama ?? `User #${item.toUserId}`}</span>
                                    {item.toUser?.role && (
                                      <span style={{ fontSize: 10, color: "#7c3aed", background: "#ede9fe", padding: "1px 6px", borderRadius: 12, fontWeight: 600 }}>
                                        {item.toUser.role}
                                      </span>
                                    )}
                                    <span style={{ fontWeight: 700, color: "#4f46e5" }}>{fmt(item.jumlahTarget)}{l2.satuan ? ` ${l2.satuan}` : ""}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* L3 sub-rows */}
                    {hasSubs && l2.children.map((l3, l3idx) => (
                      <div
                        key={l3.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "72px 1fr 100px 100px 56px 80px 80px",
                          padding: "4px 12px 4px 24px",
                          background: "#fafafa",
                          borderBottom: l3idx < l2.children.length - 1 ? "1px solid #f3f4f6" : "1px solid #e9ecf0",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{l3.kode}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>└ {l3.nama}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{fmt(l3.nilaiTarget)}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{fmt(l3.disposisiJumlah ?? null)}</span>
                        <ProgressBar value={l3.disposisiJumlah ?? 0} max={l3.nilaiTarget ?? 0} />
                        <DistStatus disposisi={l3.disposisiJumlah ?? null} target={l3.nilaiTarget ?? null} />
                        <span />
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Total */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr 100px 100px 56px 80px 80px",
                  padding: "6px 12px",
                  background: "#f8fafc",
                  borderTop: "1px solid #e5e7eb",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#374151" }}>Total ({l2s.length} unit)</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#1e293b" }}>
                  {fmt(totalTarget)}{satuan && <span style={{ fontSize: 9.5, fontWeight: 400, color: "#9ca3af", marginLeft: 3 }}>{satuan}</span>}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: totalDisposisi >= totalTarget && totalTarget > 0 ? "#15803d" : "#1e293b" }}>
                  {fmt(totalDisposisi)}
                </span>
                <ProgressBar value={totalDisposisi} max={totalTarget} />
                <DistStatus disposisi={totalDisposisi} target={totalTarget} />
                <span />
              </div>
            </div>
          )}

          {!hasChain && !hasDistribusi && (
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
              Belum ada alur maupun distribusi target yang dikonfigurasi.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MonitoringTargetPage() {
  const router = useRouter();
  const [jenis, setJenis] = useState<"IKU" | "PK">("IKU");
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [l1Entries, setL1Entries] = useState<L1Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProdi, setActiveProdi] = useState("all");

  useEffect(() => {
    getAvailableYears()
      .then((yrs) => {
        setAvailableYears(yrs);
        if (yrs.length > 0) setTahun(yrs[yrs.length - 1]);
      })
      .catch(() => {});
    getAllRoles().then(setAllRoles).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setL1Entries([]);
      try {
        const grouped = await getIndikatorGrouped(jenis, tahun);
        const l1List: { l0: IndikatorGrouped; l1: IndikatorGroupedSub }[] = [];
        for (const l0 of grouped) {
          for (const l1 of l0.subIndikators) l1List.push({ l0, l1 });
        }
        const chains = await Promise.all(
          l1List.map(({ l1 }) => getIndikatorCascadeChain(l1.id).catch(() => [] as (number | number[])[]))
        );
        setL1Entries(
          l1List.map(({ l0, l1 }, i) => ({
            l0Kode: l0.kode,
            l0Nama: l0.nama,
            l1,
            chain: chains[i],
            prodi: "",
          }))
        );
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jenis, tahun]);

  const entriesWithProdi = useMemo(() => {
    if (allRoles.length === 0) return l1Entries;
    return l1Entries.map((e) => ({ ...e, prodi: detectProdi(e.chain, allRoles) }));
  }, [l1Entries, allRoles]);

  const filteredEntries = useMemo(() => {
    if (activeProdi === "all") return entriesWithProdi;
    return entriesWithProdi.filter((e) => e.prodi === activeProdi || e.prodi === "");
  }, [entriesWithProdi, activeProdi]);

  const byL0 = useMemo(() => {
    const map = new Map<string, { kode: string; nama: string; l1s: L1Entry[] }>();
    for (const e of filteredEntries) {
      if (!map.has(e.l0Kode)) map.set(e.l0Kode, { kode: e.l0Kode, nama: e.l0Nama, l1s: [] });
      map.get(e.l0Kode)!.l1s.push(e);
    }
    return Array.from(map.values());
  }, [filteredEntries]);

  const prodiCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entriesWithProdi.length };
    for (const { key } of PRODI_DEFS)
      counts[key] = entriesWithProdi.filter((e) => e.prodi === key).length;
    return counts;
  }, [entriesWithProdi]);

  const stats = useMemo(() => {
    let withChain = 0;
    let totalTarget = 0;
    let totalDisposisi = 0;
    for (const e of filteredEntries) {
      if (e.chain.length > 0) withChain++;
      const l2s = e.l1.children ?? [];
      totalTarget += l2s.reduce((s, c) => s + (c.nilaiTarget ?? 0), 0);
      totalDisposisi += l2s.reduce((s, c) => s + (c.disposisiJumlah ?? 0), 0);
    }
    return { withChain, totalTarget, totalDisposisi };
  }, [filteredEntries]);

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif", maxWidth: 1140 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: "#111827", margin: "0 0 3px" }}>Monitoring Target</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Monitor distribusi target dan alur disposisi per indikator dan prodi.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", gap: 4 }}>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setTahun(y)}
              style={{
                padding: "5px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                border: tahun === y ? "2px solid #FF7900" : "1.5px solid #e5e7eb",
                background: tahun === y ? "#fff7ed" : "#f9fafb",
                color: tahun === y ? "#FF7900" : "#6b7280",
              }}
            >
              {y}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 22, background: "#e5e7eb" }} />
        <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 8, padding: 3 }}>
          {(["IKU", "PK"] as const).map((j) => (
            <button
              key={j}
              onClick={() => setJenis(j)}
              style={{
                padding: "4px 16px",
                borderRadius: 5,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: jenis === j ? "#fff" : "transparent",
                color: jenis === j ? "#111827" : "#9ca3af",
                boxShadow: jenis === j ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {j}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {!loading && (
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "3px 11px" }}>
              {stats.withChain} alur
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 20, padding: "3px 11px" }}>
              {fmt(stats.totalDisposisi)} / {fmt(stats.totalTarget)} terdistribusi
            </span>
          </div>
        )}
      </div>

      {/* Prodi tabs */}
      <div style={{ display: "flex", gap: 1, marginBottom: 20, borderBottom: "2px solid #f1f5f9", flexWrap: "wrap" as const }}>
        {[{ key: "all", label: "Semua" }, ...PRODI_DEFS].map(({ key, label }) => {
          const count = prodiCounts[key] ?? 0;
          const isActive = activeProdi === key;
          return (
            <button
              key={key}
              onClick={() => setActiveProdi(key)}
              style={{
                padding: "7px 15px",
                borderRadius: "7px 7px 0 0",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: isActive ? "#fff" : "transparent",
                color: isActive ? "#4f46e5" : "#9ca3af",
                borderBottom: isActive ? "2px solid #4f46e5" : "2px solid transparent",
                marginBottom: -2,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  background: isActive ? "#4f46e5" : "#e5e7eb",
                  color: isActive ? "#fff" : "#6b7280",
                  borderRadius: 20,
                  padding: "1px 6px",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 60, background: "#f3f4f6", borderRadius: 12, opacity: 0.5 }} />
          ))}
        </div>
      ) : byL0.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 24px", background: "#fafafa", borderRadius: 12, border: "1.5px dashed #e5e7eb" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 5 }}>Belum ada data</div>
          <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Import file Excel atau konfigurasi indikator terlebih dahulu.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          {byL0.map(({ kode, nama, l1s }) => {
            const l0TotalTarget = l1s.reduce((s, e) => s + (e.l1.children ?? []).reduce((ss, c) => ss + (c.nilaiTarget ?? 0), 0), 0);
            const l0TotalDisp = l1s.reduce((s, e) => s + (e.l1.children ?? []).reduce((ss, c) => ss + (c.disposisiJumlah ?? 0), 0), 0);
            const l0WithChain = l1s.filter((e) => e.chain.length > 0).length;

            return (
              <div key={kode} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                {/* L0 header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, background: "#FF7900", color: "#fff", padding: "2px 9px", borderRadius: 20 }}>
                    {jenis} {kode}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", flex: 1 }}>{nama}</span>
                  <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 600 }}>{l0WithChain}/{l1s.length} alur</span>
                  {l0TotalTarget > 0 && (
                    <>
                      <div style={{ width: 1, height: 14, background: "#e5e7eb" }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: l0TotalDisp >= l0TotalTarget ? "#15803d" : "#6b7280" }}>
                        {fmt(l0TotalDisp)} / {fmt(l0TotalTarget)}
                      </span>
                    </>
                  )}
                </div>

                {l1s.map((entry) => (
                  <L1Row key={entry.l1.id} entry={entry} allRoles={allRoles} router={router} tahun={tahun} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
