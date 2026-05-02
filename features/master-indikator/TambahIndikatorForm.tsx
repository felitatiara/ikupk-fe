"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createIndikator,
  getAllBaselineData,
  getBaselineByJenisData,
  upsertTargetUniversitas,
  getIndikator,
  type BaselineData,
  type Indikator,
} from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";
import { toast } from "sonner";

const TRIWULAN_OPTIONS = ["Triwulan I", "Triwulan II", "Triwulan III", "Triwulan IV"];
const TAHUN_OPTIONS = ["2024", "2025", "2026", "2027", "2028"];


let _nextId = 1;
const nextId = () => _nextId++;

type Level3Item = {
  id: number;
  kode: string;
  nama: string;
};

type SubItem = {
  id: number;
  kodeSubIndikator: string;
  subIndikatorKinerja: string;
  jenisData: string;
  baseline: number | null | string;
  baselineLoading: boolean;
  level3Items: Level3Item[];
};

const blankLevel3 = (): Level3Item => ({ id: nextId(), kode: "", nama: "" });

const blankSub = (): SubItem => ({
  id: nextId(),
  kodeSubIndikator: "",
  subIndikatorKinerja: "",
  jenisData: "",
  baseline: null,
  baselineLoading: false,
  level3Items: [blankLevel3()],
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
  const [baselineOptions, setBaselineOptions] = useState<BaselineData[]>([]);
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // append-to-existing mode
  const [mode, setMode] = useState<"new" | "append">("new");
  const [existingLevel0s, setExistingLevel0s] = useState<Indikator[]>([]);
  const [selectedLevel0Id, setSelectedLevel0Id] = useState<number | null>(null);

  useEffect(() => {
    getAllBaselineData(targetTahun)
      .then(setBaselineOptions)
      .catch(() => setBaselineOptions([]));
  }, [targetTahun]);

  useEffect(() => {
    if (mode !== "append") return;
    getIndikator(targetTahun)
      .then((all) => setExistingLevel0s(all.filter((i) => i.level === 0 && i.jenis === jenis)))
      .catch(() => setExistingLevel0s([]));
    setSelectedLevel0Id(null);
  }, [mode, targetTahun, jenis]);

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

  const addLevel3 = (gid: number, sid: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
              ...g,
              subItems: g.subItems.map((s) =>
                s.id === sid ? { ...s, level3Items: [...(s.level3Items ?? []), blankLevel3()] } : s
              ),
            }
          : g
      )
    );

  const removeLevel3 = (gid: number, sid: number, l3id: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
              ...g,
              subItems: g.subItems.map((s) =>
                s.id === sid
                  ? { ...s, level3Items: (s.level3Items ?? []).filter((l) => l.id !== l3id) }
                  : s
              ),
            }
          : g
      )
    );

  const updateLevel3 = (gid: number, sid: number, l3id: number, field: "kode" | "nama", value: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
              ...g,
              subItems: g.subItems.map((s) =>
                s.id === sid
                  ? {
                      ...s,
                      level3Items: (s.level3Items ?? []).map((l) =>
                        l.id === l3id ? { ...l, [field]: value } : l
                      ),
                    }
                  : s
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
    if (mode === "append") {
      if (!selectedLevel0Id) {
        toast.error("Pilih indikator yang ingin ditambahi level.");
        return;
      }
    } else {
      if (!nomor.trim() || !sasaranStrategis.trim()) {
        toast.error("Nomor dan Sasaran Strategis wajib diisi.");
        return;
      }
      const persen = Number(targetUniversitas);
      if (!targetUniversitas || isNaN(persen) || persen < 0) {
        toast.error("Target Universitas wajib diisi dengan angka positif.");
        return;
      }
      if (!tenggat) {
        toast.error("Pilih Tenggat (Triwulan) terlebih dahulu.");
        return;
      }
    }

    for (const g of groups) {
      if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) {
        toast.error("Kode dan nama Indikator Kinerja Kegiatan wajib diisi.");
        return;
      }
      for (const s of g.subItems) {
        if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) {
          toast.error("Kode dan nama Sub Indikator wajib diisi.");
          return;
        }
      }
    }

    setSubmitLoading(true);
    try {
      let parentId: number;

      if (mode === "append") {
        parentId = selectedLevel0Id!;
      } else {
        // Buat indikator level 0 (Sasaran Strategis)
        const level0 = await createIndikator({
          jenis,
          kode: nomor.trim(),
          nama: sasaranStrategis.trim(),
          tahun: targetTahun,
          level: 0,
          parentId: null,
        });
        const persen = Number(targetUniversitas);
        await upsertTargetUniversitas(level0.id, targetTahun, persen, tenggat);
        parentId = level0.id;
      }

      // Buat indikator level 1, level 2, dan (jika PK) level 3
      for (const g of groups) {
        const level1 = await createIndikator({
          jenis,
          kode: g.kodeIndikator.trim(),
          nama: g.indikatorKinerja.trim(),
          tahun: targetTahun,
          level: 1,
          parentId,
        });
        for (const s of g.subItems) {
          const level2 = await createIndikator({
            jenis,
            kode: s.kodeSubIndikator.trim(),
            nama: s.subIndikatorKinerja.trim(),
            tahun: targetTahun,
            level: 2,
            parentId: level1.id,
            jenisData: s.jenisData.trim() || null,
          });
          if (jenis === "PK") {
            for (const l3 of (s.level3Items ?? [])) {
              if (l3.kode.trim() && l3.nama.trim()) {
                await createIndikator({
                  jenis,
                  kode: l3.kode.trim(),
                  nama: l3.nama.trim(),
                  tahun: targetTahun,
                  level: 3,
                  parentId: level2.id,
                });
              }
            }
          }
        }
      }

      toast.success("Indikator berhasil ditambahkan!");
      router.push("/admin/master-indikator");
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="form-page">

        {/* Breadcrumb */}
        <nav className="form-breadcrumb" aria-label="Breadcrumb">
          <button className="form-breadcrumb__link" onClick={() => router.push("/admin/master-indikator")}>
            Master Indikator
          </button>
          <span className="form-breadcrumb__sep">/</span>
          <span className="form-breadcrumb__current">Form Tambah</span>
        </nav>

        <h3 className="form-title">Tambah Indikator Baru</h3>
        <p className="form-subtitle">Isi data berikut untuk membuat indikator kinerja baru.</p>

        {/* Mode toggle */}
        <div className="form-mode-toggle">
          <button
            type="button"
            className={mode === "new" ? "form-mode-btn form-mode-btn--active" : "form-mode-btn"}
            onClick={() => setMode("new")}
          >
            Buat Baru
          </button>
          <button
            type="button"
            className={mode === "append" ? "form-mode-btn form-mode-btn--active" : "form-mode-btn"}
            onClick={() => setMode("append")}
          >
            Tambah ke Yang Ada
          </button>
        </div>

        {/* Jenis + Tahun always visible */}
        <div className="form-section form-section--amber">
          <p className="form-section__label form-section__label--amber">
            {mode === "append" ? "Pilih Indikator" : "Level 0 — Sasaran Strategis"}
          </p>

          {/* Jenis + Tahun row — shown in both modes */}
          <div className="form-row form-row--3" style={{ marginBottom: mode === "append" ? 14 : undefined }}>
            <div className="form-field">
              <label>Jenis Indikator</label>
              <select className="form-input" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                <option value="PK">Perjanjian Kerja (PK)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Tahun Target</label>
              <select className="form-input" value={targetTahun} onChange={(e) => setTargetTahun(e.target.value)}>
                {TAHUN_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {mode === "new" && (
              <div className="form-field">
                <label>Tenggat Waktu</label>
                <select className="form-input" value={tenggat} onChange={(e) => setTenggat(e.target.value)}>
                  <option value="">-- Pilih Tenggat --</option>
                  {TRIWULAN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Append mode: pick existing level-0 */}
          {mode === "append" && (
            <div className="form-field">
              <label>Indikator / Sasaran Strategis yang Ada</label>
              <select
                className="form-input"
                value={selectedLevel0Id ?? ""}
                onChange={(e) => setSelectedLevel0Id(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Pilih Indikator --</option>
                {existingLevel0s.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.kode} — {i.nama}
                  </option>
                ))}
              </select>
              {existingLevel0s.length === 0 && (
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                  Tidak ada indikator {jenis} untuk tahun {targetTahun}.
                </p>
              )}
            </div>
          )}

          {/* New mode: full level-0 fields */}
          {mode === "new" && (
            <div className="form-row form-row--kode-target form-row--last">
              <div className="form-field">
                <label>Nomor / Kode</label>
                <input className="form-input" type="text" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="contoh: 1" />
              </div>
              <div className="form-field">
                <label>Sasaran Strategis</label>
                <input className="form-input" type="text" value={sasaranStrategis} onChange={(e) => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan" />
              </div>
              <div className="form-field">
                <label>Target Universitas</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={targetUniversitas}
                  onChange={(e) => setTargetUniversitas(String(Math.max(0, Number(e.target.value))))}
                  placeholder="contoh: 100"
                />
              </div>
            </div>
          )}
        </div>

        {/* === LEVEL 1 & 2 === */}
        <div className="form-section-header">
          <p className="form-section__label" style={{ margin: 0 }}>Level 1 &amp; Level 2 — Indikator Kinerja</p>
          <button type="button" className="form-add-btn" onClick={addGroup}>+ Tambah Level 1</button>
        </div>

        {groups.map((group, gIdx) => (
          <div key={group.id} className="form-section form-section--white">
            {/* Level 1 Header */}
            <div className="form-section-header">
              <span className="form-badge form-badge--blue">Level 1 #{gIdx + 1} — Indikator Kinerja Kegiatan</span>
              {groups.length > 1 && (
                <button type="button" className="form-remove-btn" onClick={() => removeGroup(group.id)}>Hapus</button>
              )}
            </div>

            <div className="form-row form-row--kode">
              <div className="form-field">
                <label>Kode</label>
                <input className="form-input" type="text" value={group.kodeIndikator} onChange={(e) => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder={`${nomor || "1"}.${gIdx + 1}`} />
              </div>
              <div className="form-field">
                <label>Nama Indikator Kinerja Kegiatan</label>
                <input className="form-input" type="text" value={group.indikatorKinerja} onChange={(e) => updateGroup(group.id, "indikatorKinerja", e.target.value)} placeholder="contoh: Hasil Lulusan yang Bekerja Sesuai Bidang" />
              </div>
            </div>

            {/* Level 2 label */}
            <div style={{ marginBottom: 10 }}>
              <span className="form-badge form-badge--green">Level 2 — Sub Indikator</span>
            </div>

            {group.subItems.map((sub, sIdx) => (
              <div key={sub.id} className="form-sub-item">
                <div className="form-row form-row--kode" style={{ marginBottom: 10 }}>
                  <div className="form-field">
                    <label>Kode Sub</label>
                    <input className="form-input" type="text" value={sub.kodeSubIndikator} onChange={(e) => updateSubItem(group.id, sub.id, "kodeSubIndikator", e.target.value)} placeholder={`${group.kodeIndikator || `${nomor || "1"}.${gIdx + 1}`}.${sIdx + 1}`} />
                  </div>
                  <div className="form-sub-name-row">
                    <div className="form-field">
                      <label>Nama Sub Indikator</label>
                      <input className="form-input" type="text" value={sub.subIndikatorKinerja} onChange={(e) => updateSubItem(group.id, sub.id, "subIndikatorKinerja", e.target.value)} placeholder="contoh: Lulusan bekerja dalam 6 bulan" />
                    </div>
                    {group.subItems.length > 1 && (
                      <button type="button" className="form-remove-icon" onClick={() => removeSubItem(group.id, sub.id)}>−</button>
                    )}
                  </div>
                </div>

                <div className="form-row--baseline">
                  <div className="form-field">
                    <label>Jenis Data (untuk baseline)</label>
                    <select className="form-input" value={sub.jenisData} onChange={(e) => handleJenisDataChange(group.id, sub.id, e.target.value)}>
                      <option value="">-- Pilih Jenis Data --</option>
                      {baselineOptions.map((b) => (
                        <option key={b.id} value={b.jenisData}>
                          {b.jenisData} {b.keterangan ? `(${b.keterangan})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-baseline-wrapper">
                    <label>Baseline ({targetTahun})</label>
                    <div className="form-baseline" style={{ color: sub.baseline !== null ? "#1f2937" : "#9ca3af" }}>
                      {sub.baselineLoading ? "Memuat..." : sub.baseline !== null ? (typeof sub.baseline === "number" ? sub.baseline.toLocaleString("id-ID") : sub.baseline) : "—"}
                    </div>
                  </div>
                </div>

                {/* Level 3 — hanya tampil jika PK */}
                {jenis === "PK" && (
                  <div className="form-level3-section">
                    <div className="form-level3-header">
                      <span className="form-badge form-badge--purple">Level 3 — Rincian</span>
                      <button type="button" className="form-add-btn--l3" onClick={() => addLevel3(group.id, sub.id)}>
                        + Tambah Level 3
                      </button>
                    </div>
                    {(sub.level3Items ?? []).map((l3, l3Idx) => (
                      <div key={l3.id} className="form-level3-row">
                        <div className="form-field">
                          <label className="form-label--purple">Kode L3</label>
                          <input className="form-input form-input--sm" type="text" value={l3.kode} onChange={(e) => updateLevel3(group.id, sub.id, l3.id, "kode", e.target.value)} placeholder={`${sub.kodeSubIndikator || "x.x.x"}.${l3Idx + 1}`} />
                        </div>
                        <div className="form-field">
                          <label className="form-label--purple">Nama Rincian</label>
                          <input className="form-input form-input--sm" type="text" value={l3.nama} onChange={(e) => updateLevel3(group.id, sub.id, l3.id, "nama", e.target.value)} placeholder="contoh: Rincian detail kegiatan" />
                        </div>
                        <button type="button" className="form-remove-icon" onClick={() => removeLevel3(group.id, sub.id, l3.id)} disabled={(sub.level3Items ?? []).length <= 1}>−</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="form-sub-footer">
              <button type="button" className="form-add-btn--sub" onClick={() => addSubItem(group.id)}>+ Sub Indikator</button>
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="form-actions">
          <button type="button" className="btn-outline" onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading}>
            Kembali
          </button>
          <button
            type="button"
            className="btn-main"
            onClick={handleSubmit}
            disabled={submitLoading}
            style={{ backgroundColor: submitLoading ? "#9ca3af" : undefined, cursor: submitLoading ? "not-allowed" : "pointer" }}
          >
            {submitLoading ? "Menyimpan..." : "Simpan Indikator"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
