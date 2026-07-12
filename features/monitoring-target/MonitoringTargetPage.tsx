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

function detectProdis(chain: (number | number[])[], allRoles: RoleOption[]): string[] {
  for (let i = chain.length - 1; i >= 0; i--) {
    const ids = (Array.isArray(chain[i]) ? chain[i] : [chain[i]]) as number[];
    const found = new Set<string>();
    for (const id of ids) {
      const r = allRoles.find((r) => r.id === id);
      if (!r?.unitNama) continue;
      const u = r.unitNama.toLowerCase();
      if (u.includes("d3") || u.includes("diploma 3")) found.add("D3");
      else if (u.includes("data science") || u.includes("sains data")) found.add("SD");
      else if (u.includes("informatika")) found.add("IF");
      else if (u.includes("sistem informasi")) found.add("SI");
    }
    if (found.size > 0) return Array.from(found);
  }
  return [];
}

interface L1Entry {
  l0Kode: string;
  l0Nama: string;
  l1: IndikatorGroupedSub;
  chain: (number | number[])[];
  prodi: string[];
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
    return <span className="mt-badge mt-badge--green">Penuh</span>;
  if (d > 0)
    return <span className="mt-badge mt-badge--amber">Sebagian</span>;
  return <span className="mt-badge mt-badge--gray">Belum</span>;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: 52, height: 5, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: pct >= 100 ? "#22c55e" : pct > 0 ? "#f59e0b" : "#e5e7eb",
      }} />
    </div>
  );
}

function L1Row({ entry, allRoles, router, tahun, activeProdi }: {
  entry: L1Entry;
  allRoles: RoleOption[];
  router: ReturnType<typeof useRouter>;
  tahun: string;
  activeProdi: string;
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
      {/* Summary row */}
      <div
        className={`mt-l1-row${expanded ? " mt-l1-row--expanded" : ""}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`mt-chevron${expanded ? " mt-chevron--open" : ""}`}>▶</span>

        <div style={{ minWidth: 150, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#4f46e5" }}>{l1.kode}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginLeft: 8 }}>{l1.nama}</span>
        </div>

        <div style={{ flex: 1 }}>
          {hasChain ? (
            <span className="mt-badge mt-badge--indigo">{chain.length} langkah</span>
          ) : (
            <span style={{ fontSize: 11, color: "#d1d5db", fontStyle: "italic" }}>Alur belum dikonfigurasi</span>
          )}
        </div>

        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
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
          className="mt-btn-edit-alur"
        >
          Edit Alur
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-l1-expanded">
          {hasChain && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" as const }}>
              {chain.map((step, si) => {
                const ids = (Array.isArray(step) ? step : [step]) as number[];
                const roles = ids.map((id) => allRoles.find((r) => r.id === id)).filter(Boolean) as import("../../lib/api").RoleOption[];
                const isFirst = si === 0;
                const isLast = si === chain.length - 1;
                return (
                  <span key={si} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {roles.map((role, ri) => (
                      <span key={role.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {ri > 0 && <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>+</span>}
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 0,
                          padding: "3px 10px", borderRadius: 20,
                          background: isFirst ? "#dbeafe" : isLast ? "#dcfce7" : "#f3f4f6",
                          border: `1px solid ${isFirst ? "#bfdbfe" : isLast ? "#bbf7d0" : "#e5e7eb"}`,
                          whiteSpace: "nowrap" as const,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isFirst ? "#1e40af" : isLast ? "#166534" : "#1e293b" }}>
                            {role.name}
                          </span>
                          {role.unitNama && (
                            <>
                              <span style={{ color: isFirst ? "#bfdbfe" : isLast ? "#bbf7d0" : "#d1d5db", margin: "0 5px", fontSize: 11 }}>|</span>
                              <span style={{ fontSize: 10, color: isFirst ? "#60a5fa" : isLast ? "#4ade80" : "#9ca3af" }}>{role.unitNama}</span>
                            </>
                          )}
                        </span>
                      </span>
                    ))}
                    {si < chain.length - 1 && (
                      <span style={{ color: "#c7d2fe", fontSize: 13, marginLeft: 2 }}>→</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {hasDistribusi && (
            <div className="mt-dist-table">
              {/* Header */}
              <div className="mt-dist-header">
                {["Kode", "Nama", "Target", "Disposisi", "Progress", "Status", "Dosen"].map((h) => (
                  <span key={h} className="mt-dist-header-cell">{h}</span>
                ))}
              </div>

              {l2s.map((l2, idx) => {
                const hasSubs = (l2.children ?? []).length > 0;
                const l2DosenExpanded = expandedL2s.has(l2.id);
                const l2DosenItems = dosenCache.get(l2.id) ?? [];
                const l2DosenLoading = dosenLoading.has(l2.id);
                return (
                  <div key={l2.id}>
                    <div className="mt-dist-row" style={{
                      borderBottom: idx < l2s.length - 1 || hasSubs || l2DosenExpanded ? "1px solid #f3f4f6" : "none",
                    }}>
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
                        className={`mt-btn-dosen${l2DosenExpanded ? " mt-btn-dosen--active" : ""}`}
                      >
                        {l2DosenLoading ? "…" : l2DosenExpanded ? "▲ Tutup" : "👤 Dosen"}
                      </button>
                    </div>

                    {l2DosenExpanded && (() => {
                      function detectProdiUnit(userRoles?: Array<{ role: { name: string; unitNama: string } }>): string {
                        if (!userRoles) return "";
                        for (const { role } of userRoles) {
                          const u = role.unitNama?.toLowerCase() ?? "";
                          if (u.includes("d3") || u.includes("diploma 3")) return "D3 SI";
                          if (u.includes("data science") || u.includes("sains data")) return "S1 SD";
                          if (u.includes("informatika")) return "S1 IF";
                          if (u.includes("sistem informasi")) return "S1 SI";
                        }
                        return "";
                      }
                      const senderIds = new Set(l2DosenItems.map(i => i.fromUserId).filter((id): id is number => id != null));
                      const leafItems = l2DosenItems.filter(i => !senderIds.has(i.toUserId));
                      const PRODI_ORDER = ["S1 SI", "S1 IF", "D3 SI", "S1 SD", "Lainnya"];
                      const prodiMap = new Map<string, typeof leafItems>();
                      for (const item of leafItems) {
                        const prodi = detectProdiUnit(item.toUser?.userRoles) || "Lainnya";
                        if (!prodiMap.has(prodi)) prodiMap.set(prodi, []);
                        prodiMap.get(prodi)!.push(item);
                      }
                      const prodiGroups = PRODI_ORDER.filter(p => prodiMap.has(p)).map(p => ({ prodi: p, items: prodiMap.get(p)! }));
                      const PRODI_COLOR: Record<string, { bg: string; text: string; border: string }> = {
                        "S1 SI":  { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
                        "S1 IF":  { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
                        "D3 SI":  { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
                        "S1 SD":  { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
                        "Lainnya":{ bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
                      };
                      return (
                        <div style={{ padding: "8px 12px 10px 24px", background: "#f5f3ff", borderBottom: "1px solid #e5e7eb" }}>
                          {l2DosenLoading ? (
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Memuat data dosen…</p>
                          ) : leafItems.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>Belum ada distribusi ke dosen.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                              {prodiGroups.map(({ prodi, items }) => {
                                const c = PRODI_COLOR[prodi] ?? PRODI_COLOR["Lainnya"];
                                return (
                                  <div key={prodi}>
                                    <p style={{ margin: "0 0 5px", fontSize: 10.5, fontWeight: 800, color: c.text, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                                      {prodi} — {items.length} Dosen
                                    </p>
                                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                                      {items.map((item) => (
                                        <div key={item.id ?? item.toUserId} style={{
                                          display: "flex", alignItems: "center", gap: 8,
                                          padding: "5px 12px", borderRadius: 8,
                                          background: c.bg, border: `1px solid ${c.border}`, fontSize: 11.5,
                                        }}>
                                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{item.toUser?.nama ?? `User #${item.toUserId}`}</span>
                                          <span style={{ fontWeight: 700, color: c.text }}>{fmt(item.jumlahTarget)}{l2.satuan ? ` ${l2.satuan}` : ""}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {hasSubs && l2.children.map((l3, l3idx) => (
                      <div key={l3.id} className="mt-dist-row mt-dist-row--sub" style={{
                        borderBottom: l3idx < l2.children.length - 1 ? "1px solid #f3f4f6" : "1px solid #e9ecf0",
                      }}>
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

              {/* Total row */}
              <div className="mt-dist-total">
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
  const [jenis, setJenis] = useState<"IKU" | "PK" | "PK_IKU">("IKU");
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
        const effectiveJenis = jenis === "PK_IKU" ? "PK" : jenis;
        const raw = await getIndikatorGrouped(effectiveJenis, tahun);
        const grouped = jenis === "PK_IKU"
          ? raw.filter(g => g.subIndikators.some(sub =>
              sub.children.some(child =>
                (child.children ?? []).some(l3 => l3.linkedIkuId != null)
              )
            ))
          : raw;
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
            prodi: [] as string[],
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
    return l1Entries.map((e) => ({ ...e, prodi: detectProdis(e.chain, allRoles) }));
  }, [l1Entries, allRoles]);

  const filteredEntries = useMemo(() => {
    if (activeProdi === "all") return entriesWithProdi;
    return entriesWithProdi.filter((e) => e.prodi.includes(activeProdi) || e.prodi.length === 0);
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
      counts[key] = entriesWithProdi.filter((e) => e.prodi.includes(key)).length;
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

  const distPct = stats.totalTarget > 0 ? Math.min(100, (stats.totalDisposisi / stats.totalTarget) * 100) : 0;
  const jenisLabel = jenis === "PK_IKU" ? "PK Berbasis IKU" : jenis;

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif", maxWidth: 1140 }}>
      <style>{`
        .mt-hero {
          display: flex; justify-content: space-between; gap: 24px; align-items: stretch;
          margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eef6ff 100%);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
        }
        .mt-eyebrow { margin: 0 0 6px; color: #4f46e5; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
        .mt-title { margin: 0 0 8px; color: #0f172a; font-size: 22px; font-weight: 900; }
        .mt-subtitle { max-width: 560px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
        .mt-progress-card {
          min-width: 280px; padding: 16px 20px; border: 1px solid #c7d2fe; border-radius: 14px;
          background: #ffffff; display: flex; flex-direction: column; justify-content: center; gap: 0;
        }
        .mt-progress-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .mt-progress-top span { color: #475569; font-size: 13px; font-weight: 800; }
        .mt-progress-top strong { color: #4f46e5; font-size: 28px; font-weight: 900; }
        .mt-progress-track { height: 9px; margin: 12px 0 10px; overflow: hidden; border-radius: 999px; background: #e5e7eb; }
        .mt-progress-fill { height: 100%; border-radius: inherit; transition: width 0.6s ease; }
        .mt-progress-meta { display: flex; align-items: center; justify-content: space-between; color: #64748b; font-size: 12px; font-weight: 700; }
        .mt-toolbar {
          display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
          margin-bottom: 16px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 14px;
          background: #ffffff; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
        }
        .mt-toolbar-left, .mt-toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .mt-jenis-tabs { display: flex; background: #f3f4f6; border-radius: 10px; padding: 3px; gap: 2px; }
        .mt-jenis-tab {
          padding: 6px 16px; border-radius: 8px; border: 1.5px solid transparent;
          font-size: 12px; font-weight: 700; cursor: pointer; background: transparent;
          color: #6b7280; transition: all 0.15s;
        }
        .mt-jenis-tab--active { color: #fff; }
        .mt-year-select {
          border: 1px solid #d7dde8; border-radius: 10px; padding: 7px 14px;
          font-size: 13px; font-weight: 700; color: #334155; background: #f8fafc;
          cursor: pointer; outline: none;
        }
        .mt-year-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .mt-stats-badges { display: flex; gap: 6px; flex-shrink: 0; }
        .mt-prodi-tabs {
          display: flex; gap: 1px; margin-bottom: 18px;
          border-bottom: 2px solid #f1f5f9; flex-wrap: wrap;
        }
        .mt-prodi-tab {
          padding: 7px 15px; border-radius: 7px 7px 0 0; font-size: 12.5px; font-weight: 700;
          cursor: pointer; border: none; background: transparent; color: #9ca3af;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          display: flex; align-items: center; gap: 5px; transition: all 0.15s;
        }
        .mt-prodi-tab--active { background: #fff; color: #4f46e5; border-bottom-color: #4f46e5; }
        .mt-prodi-count {
          font-size: 10px; font-weight: 800; border-radius: 20px; padding: 1px 6px;
          background: #e5e7eb; color: #6b7280;
        }
        .mt-prodi-count--active { background: #4f46e5; color: #fff; }
        .mt-badge { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 20px; display: inline-block; }
        .mt-badge--green { color: #15803d; background: #dcfce7; }
        .mt-badge--amber { color: #b45309; background: #fef3c7; }
        .mt-badge--gray { color: #9ca3af; background: #f3f4f6; }
        .mt-badge--indigo { color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe; font-size: 10.5px; }
        .mt-badge--stat-indigo { font-size: 11px; font-weight: 700; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 20px; padding: 3px 11px; }
        .mt-badge--stat-green { font-size: 11px; font-weight: 700; color: #15803d; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 20px; padding: 3px 11px; }
        .mt-l0-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,23,42,0.06); }
        .mt-l0-header {
          display: flex; align-items: center; gap: 10px; padding: 11px 18px;
          background: #0f2f4f; border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .mt-l0-badge { font-size: 10px; font-weight: 900; background: #FF7900; color: #fff; padding: 2px 9px; border-radius: 20px; flex-shrink: 0; }
        .mt-l0-nama { font-weight: 700; font-size: 13px; color: #e8eef7; flex: 1; }
        .mt-l0-meta { font-size: 10.5px; color: #7aa3c8; font-weight: 600; white-space: nowrap; }
        .mt-l1-row {
          display: flex; align-items: center; gap: 12px; padding: 11px 18px;
          cursor: pointer; background: transparent; transition: background 0.15s;
        }
        .mt-l1-row--expanded { background: #fafbff; }
        .mt-l1-row:hover { background: #fafbff; }
        .mt-chevron { flex-shrink: 0; font-size: 9px; color: #94a3b8; transition: transform 0.18s; display: inline-block; }
        .mt-chevron--open { transform: rotate(90deg); }
        .mt-btn-edit-alur {
          flex-shrink: 0; padding: 5px 12px; border-radius: 8px; border: 1px solid #e5e7eb;
          background: #f8fafc; color: #6b7280; font-size: 11px; font-weight: 700; cursor: pointer;
          transition: all 0.15s;
        }
        .mt-btn-edit-alur:hover { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
        .mt-l1-expanded {
          padding: 10px 18px 14px 34px; background: #fafbff; border-top: 1px solid #eef2ff;
        }
        .mt-dist-table { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; }
        .mt-dist-header {
          display: grid; grid-template-columns: 72px 1fr 100px 100px 56px 80px 80px;
          padding: 7px 12px; background: #0f2f4f; border-bottom: 1px solid rgba(255,255,255,0.1); gap: 8px;
        }
        .mt-dist-header-cell { font-size: 9.5px; font-weight: 900; color: #b8cfe8; letter-spacing: 0.05em; text-transform: uppercase; }
        .mt-dist-row {
          display: grid; grid-template-columns: 72px 1fr 100px 100px 56px 80px 80px;
          padding: 6px 12px; gap: 8px; align-items: center;
        }
        .mt-dist-row--sub { padding: 4px 12px 4px 24px; background: #fafafa; }
        .mt-dist-total {
          display: grid; grid-template-columns: 72px 1fr 100px 100px 56px 80px 80px;
          padding: 7px 12px; background: #f8fafc; border-top: 1px solid #e5e7eb; gap: 8px; align-items: center;
        }
        .mt-btn-dosen {
          padding: 3px 8px; border-radius: 6px; border: 1px solid #e5e7eb;
          background: #fff; color: #6b7280; font-size: 10.5px; font-weight: 700;
          cursor: pointer; white-space: nowrap;
        }
        .mt-btn-dosen--active { border-color: #a5b4fc; background: #eef2ff; color: #4f46e5; }
        .mt-skeleton { height: 68px; background: linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%); background-size: 200% 100%; animation: mt-shimmer 1.4s infinite; border-radius: 14px; }
        @keyframes mt-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (max-width: 900px) {
          .mt-hero { flex-direction: column; align-items: stretch; }
          .mt-progress-card { min-width: 0; }
          .mt-toolbar { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      {/* ── Hero Card ── */}
      <div className="mt-hero">
        <div>
          <h3 className="ikupk-card-title ">Monitoring Target</h3>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0}}>Monitor distribusi target dan alur disposisi per indikator dan prodi.</p>
          <br></br>
          <div className="mt-jenis-tabs">
            {([
              { key: "IKU", label: "Indikator Kinerja Utama", color: "#FF7900" },
              { key: "PK", label: "Perjanjian Kinerja", color: "#7c3aed" },
              { key: "PK_IKU", label: "PK Berbasis IKU", color: "#0891b2" },
            ] as const).map(({ key: j, label, color }) => (
              <button
                key={j}
                onClick={() => setJenis(j)}
                className={`mt-jenis-tab${jenis === j ? " mt-jenis-tab--active" : ""}`}
                style={jenis === j ? { background: color, borderColor: color } : {}}
              >
                {label}
              </button>
            ))}
            <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="mt-year-select">
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
          </div>
          
        </div>
        <div className="mt-progress-card">
          <div className="mt-progress-top">
            <span>Target Terdistribusi</span>
            {loading
              ? <span style={{ color: "#9ca3af", fontSize: 18, fontWeight: 800 }}>—</span>
              : <strong>{distPct.toFixed(1)}%</strong>
            }
          </div>
          <div className="mt-progress-track">
            <div className="mt-progress-fill" style={{
              width: loading ? "0%" : `${distPct}%`,
              background: distPct >= 100
                ? "linear-gradient(90deg,#16a34a,#0f9f6e)"
                : distPct >= 50
                ? "linear-gradient(90deg,#4f46e5,#7c3aed)"
                : "linear-gradient(90deg,#ea580c,#4f46e5)",
            }} />
          </div>
          <div className="mt-progress-meta">
            {loading
              ? <span>Memuat…</span>
              : <span>{fmt(stats.totalDisposisi)} / {fmt(stats.totalTarget)}</span>
            }
            <span>{jenisLabel} {tahun}</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="mt-toolbar">
        <div className="mt-toolbar-left">
          {[{ key: "all", label: "Semua" }, ...PRODI_DEFS].map(({ key, label }) => {
          const count = prodiCounts[key] ?? 0;
          const isActive = activeProdi === key;
          return (
            <button
              key={key}
              onClick={() => setActiveProdi(key)}
              className={`mt-prodi-tab${isActive ? " mt-prodi-tab--active" : ""}`}
            >
              {label}
              {count > 0 && (
                <span className={`mt-prodi-count${isActive ? " mt-prodi-count--active" : ""}`}>{count}</span>
              )}
            </button>
          );
        })}
        </div>
      </div>
      

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="mt-skeleton" />)}
        </div>
      ) : byL0.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 24px", background: "#fafafa", borderRadius: 14, border: "1.5px dashed #e5e7eb" }}>
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
              <div key={kode} className="mt-l0-card">
                <div className="mt-l0-header">
                  <span className="mt-l0-badge">{jenis} {kode}</span>
                  <span className="mt-l0-nama">{nama}</span>
                </div>
                {l1s.map((entry) => (
                  <L1Row key={entry.l1.id} entry={entry} allRoles={allRoles} router={router} tahun={tahun} activeProdi={activeProdi} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
