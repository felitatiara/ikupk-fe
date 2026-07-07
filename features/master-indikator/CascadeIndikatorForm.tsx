"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getIndikatorById,
  getAllRoles,
  getIndikatorCascadeChain,
  saveIndikatorCascadeChain,
  getAvailableYears,
  type Indikator,
  type RoleOption,
} from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";
import { toast } from "sonner";

type Chain = number[][];

function normalizeIncoming(raw: (number | number[])[]): Chain {
  return raw.map(step => Array.isArray(step) ? step.map(Number) : [Number(step)]);
}

export default function CascadeIndikatorForm({ l0Id: indikatorId, jenis, tahun }: { l0Id: number; jenis: string; tahun: string }) {
  const router = useRouter();

  const [l0, setL0] = useState<Indikator | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedTahun, setSelectedTahun] = useState<string>(tahun);
  const [chain, setChain] = useState<Chain>([[0]]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Remove app-main bottom padding so sticky footer sits flush at the bottom
  useEffect(() => {
    const main = document.querySelector('.app-main') as HTMLElement | null;
    if (!main) return;
    const prev = main.style.paddingBottom;
    main.style.paddingBottom = '0';
    return () => { main.style.paddingBottom = prev; };
  }, []);

  useEffect(() => {
    Promise.all([getIndikatorById(indikatorId), getAllRoles(), getIndikatorCascadeChain(indikatorId), getAvailableYears()])
      .then(([indikator, roles, existingChain, years]) => {
        setL0(indikator);
        setAllRoles(roles.filter(r => r.level > 0).sort((a, b) => a.level - b.level));
        if (existingChain.length > 0) setChain(normalizeIncoming(existingChain));
        setAvailableYears(years);
        if (years.length > 0 && !years.includes(tahun)) setSelectedTahun(years[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [indikatorId, tahun]);

  const addStep = () => setChain(p => [...p, [0]]);
  const removeStep = (si: number) => setChain(p => p.filter((_, i) => i !== si));
  const addRoleToStep = (si: number) => setChain(p => p.map((s, i) => i === si ? [...s, 0] : s));
  const removeRoleFromStep = (si: number, ri: number) => setChain(p => p.map((s, i) => i === si ? s.filter((_, j) => j !== ri) : s));
  const updateRole = (si: number, ri: number, val: number) => setChain(p => p.map((s, i) => i === si ? s.map((v, j) => j === ri ? val : v) : s));

  async function handleSubmit() {
    const validChain = chain.map(s => s.filter(id => id > 0)).filter(s => s.length > 0);
    if (validChain.length === 0) { toast.error("Pilih minimal satu role penerima."); return; }
    const all = validChain.flat();
    if (new Set(all).size !== all.length) { toast.error("Role yang sama tidak boleh muncul lebih dari sekali."); return; }
    if (!selectedTahun) { toast.error("Pilih tahun terlebih dahulu."); return; }
    setSubmitLoading(true);
    try {
      await saveIndikatorCascadeChain(indikatorId, validChain, selectedTahun);
      toast.success(`Alur disposisi berhasil disimpan untuk tahun ${selectedTahun}!`);
      router.push("/admin/master-indikator");
    } catch {
      toast.error("Gagal menyimpan alur disposisi.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const levelLabel = (level: number) => ({ 1: "Pimpinan", 2: "Kajur", 3: "Kaprodi", 4: "Dosen/Tendik" }[level] ?? `Level ${level}`);
  const getRoleLabel = (r: RoleOption) => `${r.name}${r.unitNama ? ` — ${r.unitNama}` : ""} (${levelLabel(r.level)})`;

  const hasAnyValid = chain.some(s => s.some(id => id > 0));

  return (
    <>
    <PageTransition>
      <div style={{ padding: "4px 0 24px", fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 22, fontSize: 13 }}>
          <button onClick={() => router.push("/admin/master-indikator")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#FF7900", fontWeight: 600, padding: 0 }}>
            Master Indikator
          </button>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ color: "#6b7280" }}>Atur Alur Disposisi</span>
        </nav>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontWeight: 800, fontSize: 24, color: "#111827", margin: "0 0 6px" }}>Alur Disposisi</h2>
          <p style={{ fontSize: 13.5, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
            Tentukan urutan penerima disposisi. Tiap langkah bisa memiliki lebih dari satu role.
          </p>
        </div>

        {/* L0 card */}
        {loadingInfo ? (
          <div style={{ height: 60, background: "#f3f4f6", borderRadius: 12, marginBottom: 28, animation: "pulse 1.5s infinite" }} />
        ) : l0 ? (
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0", borderRadius: 14,
            padding: "14px 20px", marginBottom: 32,
            display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, color: "#fff", background: "#FF7900",
              padding: "3px 10px", borderRadius: 20, textTransform: "uppercase",
              letterSpacing: "0.06em", flexShrink: 0, whiteSpace: "nowrap",
            }}>
              {jenis} · {tahun}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1c1917", lineHeight: 1.4 }}>
              {l0.kode} — {l0.nama}
            </span>
          </div>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "14px 20px", marginBottom: 28 }}>
            <span style={{ fontSize: 13, color: "#dc2626" }}>Indikator tidak ditemukan.</span>
          </div>
        )}

        {/* Year picker */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
            Terapkan ke Tahun
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {loadingInfo
              ? [1, 2, 3].map(i => (
                  <div key={i} style={{ width: 72, height: 36, borderRadius: 8, background: "#f3f4f6", animation: "pulse 1.5s infinite" }} />
                ))
              : availableYears.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedTahun(y)}
                    style={{
                      padding: "7px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", transition: "all 0.15s",
                      border: selectedTahun === y ? "2px solid #4f46e5" : "1.5px solid #e5e7eb",
                      background: selectedTahun === y ? "#eef2ff" : "#fff",
                      color: selectedTahun === y ? "#4f46e5" : "#374151",
                      boxShadow: selectedTahun === y ? "0 0 0 3px rgba(79,70,229,0.12)" : "none",
                    }}
                  >
                    {y}
                  </button>
                ))
            }
          </div>
          {selectedTahun && (
            <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "8px 0 0" }}>
              Disposisi tahun <strong style={{ color: "#4f46e5" }}>{selectedTahun}</strong> akan di-overwrite sesuai alur ini. Tahun lain tidak terpengaruh.
            </p>
          )}
        </div>

        {/* Timeline chain builder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {chain.map((step, si) => {
            const isLast = si === chain.length - 1;
            const filled = step.some(id => id > 0);
            return (
              <div key={si} style={{ display: "flex", gap: 0, alignItems: "stretch" }}>

                {/* ── Timeline rail (dot + line) ── */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 52, flexShrink: 0 }}>
                  {/* Dot */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: filled ? "#4f46e5" : "#e5e7eb",
                    color: filled ? "#fff" : "#9ca3af",
                    fontSize: 13, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: filled ? "0 0 0 4px rgba(79,70,229,0.15)" : "none",
                    transition: "all 0.2s",
                    zIndex: 1,
                  }}>
                    {si + 1}
                  </div>
                  {/* Connector */}
                  {!isLast && (
                    <div style={{ width: 3, flex: 1, minHeight: 24, background: filled ? "#c7d2fe" : "#e5e7eb", borderRadius: 2, margin: "4px 0" }} />
                  )}
                </div>

                {/* ── Step card ── */}
                <div style={{ flex: 1, marginBottom: isLast ? 0 : 16, paddingBottom: 4 }}>
                  <div style={{
                    background: "#fff",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "18px 20px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)",
                    transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                  }}>
                    {/* Card header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Langkah {si + 1}</span>
                        {step.filter(id => id > 0).length > 1 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#4f46e5",
                            background: "#eef2ff", border: "1px solid #c7d2fe",
                            padding: "2px 8px", borderRadius: 20,
                          }}>
                            {step.filter(id => id > 0).length} role
                          </span>
                        )}
                      </div>
                      {chain.length > 1 && (
                        <button type="button" onClick={() => removeStep(si)}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 7,
                            border: "1px solid #fecaca", background: "#fef2f2",
                            color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}>
                          × Hapus
                        </button>
                      )}
                    </div>

                    {/* Role rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {step.map((roleId, ri) => (
                        <div key={ri} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, position: "relative" }}>
                            <select
                              value={roleId}
                              onChange={e => updateRole(si, ri, Number(e.target.value))}
                              style={{
                                width: "100%",
                                border: `1.5px solid ${roleId > 0 ? "#a5b4fc" : "#e5e7eb"}`,
                                borderRadius: 10,
                                padding: "10px 36px 10px 14px",
                                fontSize: 13,
                                fontWeight: roleId > 0 ? 600 : 400,
                                color: roleId === 0 ? "#9ca3af" : "#1e1b4b",
                                outline: "none",
                                background: "#fff",
                                cursor: "pointer",
                                appearance: "none",
                                WebkitAppearance: "none",
                                transition: "border-color 0.15s, background 0.15s",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                              }}
                            >
                              <option value={0} disabled>Pilih role penerima…</option>
                              {allRoles.map(r => (
                                <option key={r.id} value={r.id}>{getRoleLabel(r)}</option>
                              ))}
                            </select>
                            {/* Custom chevron */}
                            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af", fontSize: 11 }}>▼</div>
                          </div>
                          {step.length > 1 && (
                            <button type="button" onClick={() => removeRoleFromStep(si, ri)}
                              style={{
                                width: 34, height: 34, borderRadius: 8,
                                border: "1.5px solid #fecaca", background: "#fef2f2",
                                color: "#dc2626", fontSize: 18, lineHeight: 1,
                                cursor: "pointer", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontWeight: 700,
                              }}>
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add role button */}
                    <button type="button" onClick={() => addRoleToStep(si)}
                      style={{
                        marginTop: 12,
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 8,
                        border: "1.5px solid #bbf7d0", background: "#f0fdf4",
                        color: "#16a34a", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 1px 4px rgba(22,163,74,0.08)",
                        transition: "background 0.15s, box-shadow 0.15s",
                      }}>
                      + Tambah role lain di langkah ini
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add step button */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 8 }}>
          <div style={{ width: 52, flexShrink: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 3, height: 24, background: "#e5e7eb", borderRadius: 2 }} />
          </div>
          <button type="button" onClick={addStep}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 10,
              border: "1.5px solid #e5e7eb",
              background: "linear-gradient(145deg, #ffffff 0%, #f9fafb 100%)",
              color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "#818cf8"; b.style.color = "#4f46e5"; b.style.background = "#eef2ff"; b.style.boxShadow = "0 4px 12px rgba(79,70,229,0.12)"; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "#e5e7eb"; b.style.color = "#6b7280"; b.style.background = "linear-gradient(145deg, #ffffff 0%, #f9fafb 100%)"; b.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 800 }}>+</span> Tambah Langkah
          </button>
        </div>

        {/* Preview */}
        {hasAnyValid && (
          <div style={{
            marginTop: 28, padding: "16px 20px",
            background: "linear-gradient(135deg, #f9fafb 0%, #fff 100%)",
            borderRadius: 12, border: "1px solid #f3f4f6",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 14px" }}>
              Preview Alur
            </p>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Admin" color="orange" />
              {chain.map((step, i) => {
                const valid = step.filter(id => id > 0);
                if (valid.length === 0) return null;
                const names = valid.map(rid => allRoles.find(r => r.id === rid)?.name ?? `Role ${rid}`);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
                      <path d="M0 5h14M10 1l4 4-4 4" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {names.length === 1
                      ? <Chip label={names[0]} color="gray" />
                      : <Chip label={names.join(" / ")} color="green" />
                    }
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </PageTransition>

    {/* Sticky footer — sibling of PageTransition so transform doesn't trap it */}
    <div style={{
      position: "sticky", bottom: 0, zIndex: 50,
      background: "rgba(255,255,255,0.98)", backdropFilter: "blur(16px)",
      borderTop: "1.5px solid #e2e8f0",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.10)",
      padding: "12px 32px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginLeft: -32, marginRight: -32,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#4f46e5",
          background: "#eef2ff", border: "1.5px solid #c7d2fe",
          padding: "4px 12px", borderRadius: 20,
        }}>
          {chain.filter(s => s.some(id => id > 0)).length} langkah dikonfigurasi
        </span>
        {selectedTahun && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: "#6b7280",
            background: "#f3f4f6", border: "1.5px solid #e5e7eb",
            padding: "4px 12px", borderRadius: 20,
          }}>
            Tahun {selectedTahun}
          </span>
        )}
        {l0 && (
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
            {l0.kode} — {l0.nama}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading}
          style={{
            padding: "9px 20px", borderRadius: 9,
            border: "1.5px solid #e5e7eb", background: "#fff",
            color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          Batal
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitLoading || !l0 || loadingInfo}
          style={{
            padding: "9px 24px", borderRadius: 9, border: "none",
            background: submitLoading || !l0 || loadingInfo ? "#fdba74" : "#FF7900",
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: submitLoading || !l0 || loadingInfo ? "not-allowed" : "pointer",
            boxShadow: submitLoading || !l0 || loadingInfo ? "none" : "0 3px 10px rgba(255,121,0,0.4)",
            transition: "background 0.2s, box-shadow 0.2s",
            display: "flex", alignItems: "center", gap: 7,
          }}>
          {submitLoading
            ? <><span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Menyimpan…</>
            : <>💾 Simpan Alur</>
          }
        </button>
      </div>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function Chip({ label, color }: { label: string; color: "orange" | "gray" | "green" }) {
  const styles: Record<string, React.CSSProperties> = {
    orange: { background: "#1e293b", color: "#f8fafc", border: "1.5px solid #1e293b" },
    gray:   { background: "#f3f4f6", color: "#374151", border: "1.5px solid #e5e7eb" },
    green:  { background: "#eef2ff", color: "#4f46e5", border: "1.5px solid #c7d2fe" },
  };
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 13px", borderRadius: 20, whiteSpace: "nowrap", ...styles[color] }}>
      {label}
    </span>
  );
}
