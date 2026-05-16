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

export default function CascadeIndikatorForm({ l0Id, jenis, tahun }: { l0Id: number; jenis: string; tahun: string }) {
  const router = useRouter();

  const [l0, setL0] = useState<Indikator | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [chain, setChain] = useState<number[]>([0]); // array of roleId, 0 = belum dipilih
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      getIndikatorById(l0Id),
      getAllRoles(),
      getIndikatorCascadeChain(l0Id),
    ])
      .then(([indikator, roles, existingChain]) => {
        setL0(indikator);
        // Hanya tampilkan role non-admin (level > 0)
        setAllRoles(roles.filter(r => r.level > 0).sort((a, b) => a.level - b.level));
        if (existingChain.length > 0) setChain(existingChain);
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [l0Id]);

  const addStep = () => setChain(p => [...p, 0]);
  const removeStep = (idx: number) => setChain(p => p.filter((_, i) => i !== idx));
  const updateStep = (idx: number, roleId: number) =>
    setChain(p => p.map((v, i) => i === idx ? roleId : v));

  async function handleSubmit() {
    const validChain = chain.filter(id => id > 0);
    if (validChain.length === 0) {
      toast.error("Pilih minimal satu role penerima disposisi.");
      return;
    }
    const uniqueChain = [...new Set(validChain)];
    if (uniqueChain.length !== validChain.length) {
      toast.error("Setiap role dalam alur disposisi harus berbeda.");
      return;
    }
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

  const fieldInput: React.CSSProperties = {
    width: "100%", border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, color: "#374151", outline: "none", background: "#fff",
  };

  const levelLabel = (level: number) => {
    const map: Record<number, string> = { 1: "Pimpinan", 2: "Kajur", 3: "Kaprodi", 4: "Dosen/Tendik" };
    return map[level] ?? `Level ${level}`;
  };

  const getRoleLabel = (r: RoleOption) =>
    `${r.name}${r.unitNama ? ` — ${r.unitNama}` : ""} (${levelLabel(r.level)})`;

  return (
    <PageTransition>
      <div style={{ margin: "0", padding: "4px 0 80px", fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 }}>
          <button onClick={() => router.push("/admin/master-indikator")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#FF7900", fontWeight: 600, padding: 0 }}>
            Master Indikator
          </button>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ color: "#6b7280" }}>Atur Alur Disposisi</span>
        </nav>

        {/* Page Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontWeight: 800, fontSize: 22, color: "#111", margin: "0 0 4px" }}>Atur Alur Disposisi</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Tentukan urutan role yang menerima disposisi target indikator ini secara berurutan.
          </p>
        </div>

        {/* L0 Summary Card */}
        {loadingInfo ? (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Memuat info indikator…</p>
          </div>
        ) : l0 ? (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#FF7900", padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {jenis} · {tahun}
              </span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: "#111", margin: 0 }}>{l0.kode} — {l0.nama}</p>
          </div>
        ) : (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>Indikator tidak ditemukan.</p>
          </div>
        )}

        {/* Info box */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 12, color: "#0369a1", margin: 0, lineHeight: 1.6 }}>
            Alur disposisi berbasis <b>role</b> — bukan user individual. Sistem akan secara otomatis menentukan
            penerima berdasarkan role yang dikonfigurasi. Contoh: <b>Dekan → Kajur → Kaprodi → Dosen</b>.
          </p>
        </div>

        {/* Chain Builder */}
        <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              Urutan Role Penerima Disposisi
            </p>
            <button type="button" onClick={addStep}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px dashed #d1d5db", background: "#fafafa", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              + Tambah Role
            </button>
          </div>

          {chain.length === 0 && (
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>
              Belum ada role. Klik "+ Tambah Role" untuk menambahkan.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chain.map((roleId, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Step number */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "#FF7900", color: "#fff",
                  fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </div>

                {/* Label */}
                <span style={{ fontSize: 12, color: "#6b7280", flexShrink: 0, minWidth: 90 }}>
                  Penerima ke-{idx + 1}
                </span>

                {/* Dropdown roles */}
                <select
                  style={{ ...fieldInput, flex: 1 }}
                  value={roleId}
                  onChange={e => updateStep(idx, Number(e.target.value))}
                >
                  <option value={0} disabled>— Pilih role —</option>
                  {allRoles.map(r => (
                    <option key={r.id} value={r.id}>{getRoleLabel(r)}</option>
                  ))}
                </select>

                {/* Remove button */}
                {chain.length > 1 && (
                  <button type="button" onClick={() => removeStep(idx)}
                    style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid #fca5a5", background: "#fff7f7", color: "#dc2626", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    −
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Visual flow preview */}
          {chain.some(id => id > 0) && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Preview Alur
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#FF7900", background: "#fff7ed", padding: "4px 12px", borderRadius: 20, border: "1px solid #fed7aa" }}>
                  Admin
                </span>
                {chain.filter(id => id > 0).map((rid, i) => {
                  const r = allRoles.find(r => r.id === rid);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#d1d5db", fontSize: 16 }}>→</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", background: "#f9fafb", padding: "4px 12px", borderRadius: 20, border: "1px solid #e5e7eb" }}>
                        {r ? r.name : `Role ${rid}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Action Bar */}
        <div style={{
          position: "sticky", bottom: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
          borderTop: "1px solid #f0f0f0", padding: "14px 0", marginTop: 8,
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button type="button" onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading}
            style={{ padding: "9px 24px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Selesai tanpa menyimpan
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitLoading || !l0 || loadingInfo}
            style={{
              padding: "9px 28px", borderRadius: 9, border: "none", background: "#FF7900", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: (submitLoading || !l0 || loadingInfo) ? "not-allowed" : "pointer",
              opacity: (submitLoading || !l0 || loadingInfo) ? 0.65 : 1,
              display: "flex", alignItems: "center", gap: 8,
            }}>
            {submitLoading ? "Menyimpan…" : "Simpan Alur Disposisi"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
