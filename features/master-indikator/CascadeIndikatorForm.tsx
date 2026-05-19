"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getIndikatorById,
  getAllRoles,
  getIndikatorCascadeChain,
  saveIndikatorCascadeChain,
  type Indikator,
  type RoleOption,
} from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";
import { toast } from "sonner";

type Chain = number[][];

function normalizeIncoming(raw: (number | number[])[]): Chain {
  return raw.map(step => Array.isArray(step) ? step.map(Number) : [Number(step)]);
}

export default function CascadeIndikatorForm({ l0Id, jenis, tahun }: { l0Id: number; jenis: string; tahun: string }) {
  const router = useRouter();

  const [l0, setL0] = useState<Indikator | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [chain, setChain] = useState<Chain>([[0]]);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    Promise.all([getIndikatorById(l0Id), getAllRoles(), getIndikatorCascadeChain(l0Id)])
      .then(([indikator, roles, existingChain]) => {
        setL0(indikator);
        setAllRoles(roles.filter(r => r.level > 0).sort((a, b) => a.level - b.level));
        if (existingChain.length > 0) setChain(normalizeIncoming(existingChain));
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [l0Id]);

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
    setSubmitLoading(true);
    try {
      await saveIndikatorCascadeChain(l0Id, validChain);
      toast.success("Alur disposisi berhasil disimpan!");
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
    <PageTransition>
      <div style={{ margin: "0", padding: "4px 0 80px", fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif", maxWidth: 680 }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 13 }}>
          <button onClick={() => router.push("/admin/master-indikator")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#FF7900", fontWeight: 600, padding: 0 }}>
            Master Indikator
          </button>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ color: "#6b7280" }}>Atur Alur Disposisi</span>
        </nav>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontWeight: 800, fontSize: 22, color: "#111827", margin: "0 0 6px" }}>Alur Disposisi</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
            Tentukan urutan penerima disposisi. Tiap langkah bisa memiliki lebih dari satu role.
          </p>
        </div>

        {/* L0 card */}
        {loadingInfo ? (
          <div style={{ height: 56, background: "#f9fafb", borderRadius: 10, marginBottom: 24 }} />
        ) : l0 ? (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#FF7900", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
              {jenis} · {tahun}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{l0.kode} — {l0.nama}</span>
          </div>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 28 }}>
            <span style={{ fontSize: 13, color: "#dc2626" }}>Indikator tidak ditemukan.</span>
          </div>
        )}

        {/* Timeline chain builder */}
        <div style={{ marginBottom: 8 }}>
          {chain.map((step, si) => (
            <div key={si} style={{ display: "flex", gap: 16 }}>
              {/* Left: number + connector */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 28 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: step.some(id => id > 0) ? "#FF7900" : "#e5e7eb",
                  color: step.some(id => id > 0) ? "#fff" : "#9ca3af",
                  fontSize: 12, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}>
                  {si + 1}
                </div>
                {si < chain.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 20, background: "#e5e7eb", margin: "6px 0" }} />
                )}
              </div>

              {/* Right: content */}
              <div style={{ flex: 1, paddingBottom: si < chain.length - 1 ? 20 : 8 }}>
                {/* Step header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, height: 28 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                    Langkah {si + 1}
                    {step.filter(id => id > 0).length > 1 && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#FF7900", fontWeight: 600 }}>
                        {step.filter(id => id > 0).length} role
                      </span>
                    )}
                  </span>
                  {chain.length > 1 && (
                    <button type="button" onClick={() => removeStep(si)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12, fontWeight: 600, padding: "2px 0" }}>
                      Hapus
                    </button>
                  )}
                </div>

                {/* Role selects */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {step.map((roleId, ri) => (
                    <div key={ri} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select
                        value={roleId}
                        onChange={e => updateRole(si, ri, Number(e.target.value))}
                        style={{
                          flex: 1, border: "1px solid #e5e7eb", borderRadius: 8,
                          padding: "8px 12px", fontSize: 13, color: roleId === 0 ? "#9ca3af" : "#111827",
                          outline: "none", background: "#fff", cursor: "pointer",
                        }}
                      >
                        <option value={0} disabled>Pilih role...</option>
                        {allRoles.map(r => (
                          <option key={r.id} value={r.id}>{getRoleLabel(r)}</option>
                        ))}
                      </select>
                      {step.length > 1 && (
                        <button type="button" onClick={() => removeRoleFromStep(si, ri)}
                          style={{
                            width: 30, height: 30, borderRadius: 7, border: "1px solid #f3f4f6",
                            background: "#f9fafb", color: "#9ca3af", fontSize: 16, lineHeight: 1,
                            cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add role to this step */}
                <button type="button" onClick={() => addRoleToStep(si)}
                  style={{
                    marginTop: 8, background: "none", border: "none", cursor: "pointer",
                    color: "#FF7900", fontSize: 12, fontWeight: 600, padding: "2px 0",
                  }}>
                  + Tambah role lain di langkah ini
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add step button */}
        <button type="button" onClick={addStep}
          style={{
            marginLeft: 44, display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 8, border: "1.5px dashed #d1d5db",
            background: "#fafafa", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Tambah Langkah
        </button>

        {/* Preview */}
        {hasAnyValid && (
          <div style={{ marginTop: 28, padding: "16px 20px", background: "#f9fafb", borderRadius: 10, border: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
              Preview Alur
            </p>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <Chip label="Admin" color="orange" />
              {chain.map((step, i) => {
                const valid = step.filter(id => id > 0);
                if (valid.length === 0) return null;
                const names = valid.map(rid => allRoles.find(r => r.id === rid)?.name ?? `Role ${rid}`);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#9ca3af", fontSize: 14 }}>→</span>
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

        {/* Sticky footer */}
        <div style={{
          position: "sticky", bottom: 0,
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
          borderTop: "1px solid #f3f4f6", padding: "14px 0", marginTop: 24,
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button type="button" onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading}
            style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitLoading || !l0 || loadingInfo}
            style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: "#FF7900", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: (submitLoading || !l0 || loadingInfo) ? "not-allowed" : "pointer",
              opacity: (submitLoading || !l0 || loadingInfo) ? 0.6 : 1,
            }}>
            {submitLoading ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}

function Chip({ label, color }: { label: string; color: "orange" | "gray" | "green" }) {
  const styles: Record<string, React.CSSProperties> = {
    orange: { background: "#fff7ed", color: "#FF7900", border: "1px solid #fed7aa" },
    gray:   { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb" },
    green:  { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" },
  };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, ...styles[color] }}>
      {label}
    </span>
  );
}
