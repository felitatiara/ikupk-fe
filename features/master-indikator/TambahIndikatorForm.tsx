"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createIndikator,
  getBaselineByJenisData,
  upsertTargetUniversitas,
} from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";

const TRIWULAN_OPTIONS = ["Triwulan I", "Triwulan II", "Triwulan III", "Triwulan IV"];
const TAHUN_OPTIONS = ["2024", "2025", "2026", "2027", "2028"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  color: "#374151",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  marginBottom: 5,
  color: "#374151",
  fontWeight: 600,
};

let _nextId = 1;
const nextId = () => _nextId++;

type SubItem = {
  id: number;
  kodeSubIndikator: string;
  subIndikatorKinerja: string;
  jenisData: string;
  baseline: number | null | string;
  baselineLoading: boolean;
};

const blankSub = (): SubItem => ({
  id: nextId(),
  kodeSubIndikator: "",
  subIndikatorKinerja: "",
  jenisData: "",
  baseline: null,
  baselineLoading: false,
});

const blankGroup = () => ({
  id: nextId(),
  existingLevel1Id: null as number | null,
  kodeIndikator: "",
  indikatorKinerja: "",
  subItems: [blankSub()],
});

export default function TambahIndikatorForm() {
  const router = useRouter();

  const [jenis, setJenis] = useState("IKU");
  const [nomor, setNomor] = useState("");
  const [sasaranStrategis, setSasaranStrategis] = useState("");
  const [targetUniversitas, setTargetUniversitas] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [targetTahun, setTargetTahun] = useState(String(new Date().getFullYear()));
  const [groups, setGroups] = useState([blankGroup()]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const addGroup = () => setGroups((prev) => [...prev, blankGroup()]);
  const removeGroup = (gid: number) =>
    setGroups((prev) => prev.filter((g) => g.id !== gid));
  const updateGroup = (gid: number, field: string, value: string) =>
    setGroups((prev) =>
      prev.map((g) => (g.id === gid ? { ...g, [field]: value } : g))
    );
  const addSubItem = (gid: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid ? { ...g, subItems: [...g.subItems, blankSub()] } : g
      )
    );
  const removeSubItem = (gid: number, sid: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? { ...g, subItems: g.subItems.filter((s) => s.id !== sid) }
          : g
      )
    );
  const updateSubItem = (gid: number, sid: number, field: string, value: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
            ...g,
            subItems: g.subItems.map((s) =>
              s.id === sid ? { ...s, [field]: value } : s
            ),
          }
          : g
      )
    );

  const handleJenisDataChange = (gid: number, sid: number, value: string) => {
    updateSubItem(gid, sid, "jenisData", value);
    clearTimeout(debounceRefs.current[sid]);
    debounceRefs.current[sid] = setTimeout(async () => {
      if (!value.trim()) return;
      // Mark loading
      setGroups((prev) =>
        prev.map((g) =>
          g.id === gid
            ? {
              ...g,
              subItems: g.subItems.map((s) =>
                s.id === sid ? { ...s, baselineLoading: true } : s
              ),
            }
            : g
        )
      );
      try {
        const result = await getBaselineByJenisData(value.trim(), targetTahun);
        setGroups((prev) =>
          prev.map((g) =>
            g.id === gid
              ? {
                ...g,
                subItems: g.subItems.map((s) =>
                  s.id === sid
                    ? {
                      ...s,
                      baseline: result ? (result.jumlah ?? null) : null,
                      baselineLoading: false,
                    }
                    : s
                ),
              }
              : g
          )
        );
      } catch {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === gid
              ? {
                ...g,
                subItems: g.subItems.map((s) =>
                  s.id === sid ? { ...s, baseline: null, baselineLoading: false } : s
                ),
              }
              : g
          )
        );
      }
    }, 600);
  };

  const handleSubmit = async () => {
    if (!nomor.trim() || !sasaranStrategis.trim()) {
      alert("Nomor dan Sasaran Strategis wajib diisi.");
      return;
    }
    if (!targetUniversitas || isNaN(Number(targetUniversitas))) {
      alert("Target Universitas wajib diisi dengan angka.");
      return;
    }
    if (!tenggat) {
      alert("Pilih Tenggat (Triwulan) terlebih dahulu.");
      return;
    }
    for (const g of groups) {
      if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) {
        alert("Kode dan nama Indikator Kinerja Kegiatan wajib diisi.");
        return;
      }
      for (const s of g.subItems) {
        if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) {
          alert("Kode dan nama Sub Indikator wajib diisi.");
          return;
        }
      }
    }

    setSubmitLoading(true);
    try {
      // 1. Buat indikator level 0 (Sasaran Strategis)
      const level0 = await createIndikator({
        jenis,
        kode: nomor.trim(),
        nama: sasaranStrategis.trim(),
        level: 0,
        parentId: null,
      });

      // 2. Simpan target universitas + tenggat untuk level 0
      await upsertTargetUniversitas(
        level0.id,
        1,
        targetTahun,
        Number(targetUniversitas),
        tenggat
      );

      // 3. Buat indikator level 1 dan level 2
      for (const g of groups) {
        const level1 = await createIndikator({
          jenis,
          kode: g.kodeIndikator.trim(),
          nama: g.indikatorKinerja.trim(),
          level: 1,
          parentId: level0.id,
        });
        for (const s of g.subItems) {
          await createIndikator({
            jenis,
            kode: s.kodeSubIndikator.trim(),
            nama: s.subIndikatorKinerja.trim(),
            level: 2,
            parentId: level1.id,
            jenisData: s.jenisData.trim() || null,
          });
        }
      }

      alert("Berhasil menambah indikator!");
      router.push("/admin/master-indikator");
    } catch (err) {
      alert("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <PageTransition>
      <div>
    
        <nav className="breadcrumb page" aria-label="Breadcrumb">
          <button
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, fontSize: 13, color: "#FF7900" }}
            onClick={() => router.push("/admin/master-indikator")}
          >
            Master Indikator
          </button>
          <span style={{ color: "#9ca3af", margin: "0 6px" }}>/</span>
          <span style={{ color: "#16a34a", fontWeight: 600 }}>Form Tambah</span>
        </nav>

            <div style={{ marginBottom: 24 }}>
            <h3>Tambah Indikator Baru</h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Isi data berikut untuk membuat indikator kinerja baru.</p>
          </div>

          {/* === LEVEL 0: Sasaran Strategis === */}
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "20px 20px 20px 20px", marginBottom: 24, borderLeft: "4px solid #f59e0b" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#92400e", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Level 0 — Sasaran Strategis
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Jenis Indikator</label>
                <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={inputStyle}>
                  <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                  <option value="PK">Perjanjian Kerja (PK)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tahun Target</label>
                <select value={targetTahun} onChange={(e) => setTargetTahun(e.target.value)} style={inputStyle}>
                  {TAHUN_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tenggat Waktu</label>
                <select value={tenggat} onChange={(e) => setTenggat(e.target.value)} style={inputStyle}>
                  <option value="">-- Pilih Tenggat --</option>
                  {TRIWULAN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 160px", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nomor / Kode</label>
                <input type="text" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="contoh: 1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sasaran Strategis</label>
                <input type="text" value={sasaranStrategis} onChange={(e) => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Target Universitas</label>
                <input type="number" min={0} value={targetUniversitas} onChange={(e) => setTargetUniversitas(e.target.value)} placeholder="contoh: 80" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* === LEVEL 1 & 2 === */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#374151", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Level 1 &amp; Level 2 — Indikator Kinerja
            </p>
            <button
              type="button"
              onClick={addGroup}
              style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 6, padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              + Tambah Level 1
            </button>
          </div>

          {groups.map((group, gIdx) => (
            <div key={group.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, marginBottom: 18, background: "#fff" }}>
              {/* Level 1 Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ display: "inline-block", background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Level 1 #{gIdx + 1} — Indikator Kinerja Kegiatan
                </span>
                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Hapus
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Kode</label>
                  <input type="text" value={group.kodeIndikator} onChange={(e) => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder={`${nomor || "1"}.${gIdx + 1}`} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nama Indikator Kinerja Kegiatan</label>
                  <input type="text" value={group.indikatorKinerja} onChange={(e) => updateGroup(group.id, "indikatorKinerja", e.target.value)} placeholder="contoh: Hasil Lulusan yang Bekerja Sesuai Bidang" style={inputStyle} />
                </div>
              </div>

              {/* Level 2 label */}
              <div style={{ marginBottom: 10 }}>
                <span style={{ display: "inline-block", background: "#f0fdf4", color: "#15803d", fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Level 2 — Sub Indikator
                </span>
              </div>

              {group.subItems.map((sub, sIdx) => (
                <div key={sub.id} style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", marginBottom: 10, border: "1px solid #f3f4f6" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Kode Sub</label>
                      <input type="text" value={sub.kodeSubIndikator} onChange={(e) => updateSubItem(group.id, sub.id, "kodeSubIndikator", e.target.value)} placeholder={`${group.kodeIndikator || `${nomor || "1"}.${gIdx + 1}`}.${sIdx + 1}`} style={inputStyle} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Nama Sub Indikator</label>
                        <input type="text" value={sub.subIndikatorKinerja} onChange={(e) => updateSubItem(group.id, sub.id, "subIndikatorKinerja", e.target.value)} placeholder="contoh: Lulusan bekerja dalam 6 bulan" style={inputStyle} />
                      </div>
                      {group.subItems.length > 1 && (
                        <button type="button" onClick={() => removeSubItem(group.id, sub.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6, lineHeight: 1 }}>−</button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Jenis Data (untuk baseline)</label>
                      <input type="text" value={sub.jenisData} onChange={(e) => handleJenisDataChange(group.id, sub.id, e.target.value)} placeholder="contoh: mahasiswa_lulus" style={inputStyle} />
                    </div>
                    <div style={{ minWidth: 140 }}>
                      <label style={labelStyle}>Baseline ({targetTahun})</label>
                      <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, background: "#f3f4f6", color: sub.baseline !== null ? "#1f2937" : "#9ca3af", minHeight: 36 }}>
                        {sub.baselineLoading ? "Memuat..." : sub.baseline !== null ? (typeof sub.baseline === "number" ? sub.baseline.toLocaleString("id-ID") : sub.baseline) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => addSubItem(group.id)} style={{ background: "none", border: "1px dashed #d1d5db", color: "#6b7280", borderRadius: 6, padding: "4px 14px", fontSize: 12, cursor: "pointer" }}>
                  + Sub Indikator
                </button>
              </div>
            </div>
          ))}

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 20, borderTop: "1px solid #f3f4f6", marginTop: 8 }}>
            <button type="button" onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading} className="btn-outline">
              Kembali
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitLoading} className="btn-main" style={{ backgroundColor: submitLoading ? "#9ca3af" : undefined, cursor: submitLoading ? "not-allowed" : "pointer" }}>
              {submitLoading ? "Menyimpan..." : "Simpan Indikator"}
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }
