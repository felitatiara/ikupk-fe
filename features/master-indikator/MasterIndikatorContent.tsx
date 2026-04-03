"use client";

import { useState, useEffect, useCallback } from "react";
import { getIndikator, createIndikator, Indikator } from "../../lib/api";
import PageTransition from "@/components/layout/PageTransition";

interface SubIndikatorItem {
  id: number;
  kodeSubIndikator: string;
  subIndikatorKinerja: string;
}

interface IndikatorGroupForm {
  id: number;
  // null = pilih existing level 1, string = buat baru
  existingLevel1Id: number | null;
  kodeIndikator: string;
  indikatorKinerja: string;
  subItems: SubIndikatorItem[];
}

interface Level0WithChildren {
  record: Indikator;
  children: {
    record: Indikator;
    children: Indikator[];
  }[];
}

type FormMode = "baru" | "tambah";

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

export default function MasterIndikatorContent() {
  const [indikatorList, setIndikatorList] = useState<Indikator[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterJenis, setFilterJenis] = useState<"IKU" | "PK">("IKU");

  // Form state — mode baru
  const [formMode, setFormMode] = useState<FormMode>("baru");
  const [jenis, setJenis] = useState<"IKU" | "PK">("IKU");
  const [nomor, setNomor] = useState("");
  const [sasaranStrategis, setSasaranStrategis] = useState("");

  // Form state — mode tambah ke existing
  const [selectedLevel0Id, setSelectedLevel0Id] = useState<number | "">("");

  const [groups, setGroups] = useState<IndikatorGroupForm[]>([
    { id: nextId(), existingLevel1Id: null, kodeIndikator: "", indikatorKinerja: "", subItems: [{ id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] },
  ]);

  const refreshList = useCallback(() => {
    setLoading(true);
    getIndikator()
      .then(setIndikatorList)
      .catch(() => setIndikatorList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Build hierarchy from flat list, filtered by jenis
  const buildHierarchy = (): Level0WithChildren[] => {
    const filtered = indikatorList.filter((i) => i.jenis === filterJenis);
    const level0 = filtered.filter((i) => i.level === 0);
    return level0.map((l0) => {
      const level1 = filtered.filter((i) => i.level === 1 && i.parentId === l0.id);
      return {
        record: l0,
        children: level1.map((l1) => ({
          record: l1,
          children: filtered.filter((i) => i.level === 2 && i.parentId === l1.id),
        })),
      };
    });
  };

  const hierarchy = buildHierarchy();

  // Untuk mode tambah: level 1 anak dari level 0 yang dipilih
  const availableLevel1 = selectedLevel0Id !== ""
    ? indikatorList.filter((i) => i.level === 1 && i.parentId === selectedLevel0Id)
    : [];

  // --- Form helpers ---
  const addGroup = () => {
    setGroups((prev) => [
      ...prev,
      { id: nextId(), existingLevel1Id: null, kodeIndikator: "", indikatorKinerja: "", subItems: [{ id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] },
    ]);
  };

  const removeGroup = (groupId: number) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const updateGroup = (groupId: number, field: keyof Pick<IndikatorGroupForm, "kodeIndikator" | "indikatorKinerja">, value: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, [field]: value } : g)));
  };

  const setGroupExistingLevel1 = (groupId: number, level1Id: number | null) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, existingLevel1Id: level1Id, kodeIndikator: "", indikatorKinerja: "" } : g)));
  };

  const addSubItem = (groupId: number) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, subItems: [...g.subItems, { id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] }
          : g
      )
    );
  };

  const removeSubItem = (groupId: number, subId: number) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, subItems: g.subItems.filter((s) => s.id !== subId) } : g
      )
    );
  };

  const updateSubItem = (groupId: number, subId: number, field: keyof Pick<SubIndikatorItem, "kodeSubIndikator" | "subIndikatorKinerja">, value: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, subItems: g.subItems.map((s) => (s.id === subId ? { ...s, [field]: value } : s)) }
          : g
      )
    );
  };

  const resetForm = () => {
    setFormMode("baru");
    setJenis("IKU");
    setNomor("");
    setSasaranStrategis("");
    setSelectedLevel0Id("");
    setGroups([{ id: nextId(), existingLevel1Id: null, kodeIndikator: "", indikatorKinerja: "", subItems: [{ id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] }]);
  };

  const handleSubmit = async () => {
    if (formMode === "baru") {
      // Validasi mode baru
      if (!nomor.trim() || !sasaranStrategis.trim()) {
        alert("Nomor dan Sasaran Strategis wajib diisi.");
        return;
      }
      for (const g of groups) {
        if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) {
          alert("Kode dan nama Indikator Kinerja Kegiatan wajib diisi pada semua baris.");
          return;
        }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) {
            alert("Kode dan nama Sub Indikator Kinerja Kegiatan wajib diisi pada semua baris.");
            return;
          }
        }
      }

      setSubmitLoading(true);
      try {
        const level0 = await createIndikator({ jenis, kode: nomor.trim(), nama: sasaranStrategis.trim(), level: 0, parentId: null });
        for (const g of groups) {
          const level1 = await createIndikator({ jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), level: 1, parentId: level0.id });
          for (const s of g.subItems) {
            await createIndikator({ jenis, kode: s.kodeSubIndikator.trim(), nama: s.subIndikatorKinerja.trim(), level: 2, parentId: level1.id });
          }
        }
        resetForm();
        setShowForm(false);
        refreshList();
      } catch (err: unknown) {
        alert("Gagal menyimpan data: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setSubmitLoading(false);
      }
    } else {
      // Mode tambah ke existing
      if (selectedLevel0Id === "") {
        alert("Pilih Sasaran Strategis (Level 0) terlebih dahulu.");
        return;
      }
      const parentLevel0 = indikatorList.find((i) => i.id === selectedLevel0Id);
      if (!parentLevel0) return;

      for (const g of groups) {
        if (g.existingLevel1Id === null) {
          if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) {
            alert("Kode dan nama Indikator Kinerja Kegiatan baru wajib diisi.");
            return;
          }
        }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) {
            alert("Kode dan nama Sub Indikator Kinerja Kegiatan wajib diisi pada semua baris.");
            return;
          }
        }
      }

      setSubmitLoading(true);
      try {
        for (const g of groups) {
          let level1Id: number;

          if (g.existingLevel1Id !== null) {
            // Pakai level 1 yang sudah ada
            level1Id = g.existingLevel1Id;
          } else {
            // Buat level 1 baru di bawah level 0 existing
            const newLevel1 = await createIndikator({
              jenis: parentLevel0.jenis,
              kode: g.kodeIndikator.trim(),
              nama: g.indikatorKinerja.trim(),
              level: 1,
              parentId: parentLevel0.id,
            });
            level1Id = newLevel1.id;
          }

          // Buat level 2 baru
          for (const s of g.subItems) {
            await createIndikator({
              jenis: parentLevel0.jenis,
              kode: s.kodeSubIndikator.trim(),
              nama: s.subIndikatorKinerja.trim(),
              level: 2,
              parentId: level1Id,
            });
          }
        }
        resetForm();
        setShowForm(false);
        refreshList();
      } catch (err: unknown) {
        alert("Gagal menyimpan data: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setSubmitLoading(false);
      }
    }
  };

  const rowsPerLevel0 = hierarchy.map((h) => {
    const entries: { key: string; text: string; isLevel1: boolean }[] = [];

    h.children.forEach((level1) => {
      entries.push({
        key: `l1-${level1.record.id}`,
        text: `${level1.record.kode} ${level1.record.nama}`,
        isLevel1: true,
      });

      level1.children.forEach((level2) => {
        entries.push({
          key: `l2-${level2.id}`,
          text: `${level2.kode} ${level2.nama}`,
          isLevel1: false,
        });
      });
    });

    if (entries.length === 0) {
      entries.push({ key: `empty-${h.record.id}`, text: "-", isLevel1: false });
    }

    return { parent: h.record, entries };
  });

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Master Indikator {filterJenis === "IKU" ? "Kinerja Utama" : "Perjanjian Kerja"}
        </p>

        {/* LIST SECTION */}
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", margin: 0 }}>
              Daftar Master Indikator {filterJenis === "IKU" ? "Kinerja Utama" : "Perjanjian Kerja"}
            </h3>
            <button
              onClick={() => { setShowForm((v) => !v); resetForm(); }}
              style={{ background: "#f0fff4", color: "#16a34a", border: "1px solid #86efac", borderRadius: 6, padding: "8px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {showForm ? "Tutup" : "Tambah"}
            </button>
          </div>

          {/* Filter Jenis */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginRight: 8 }}>Jenis Indikator:</label>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value as "IKU" | "PK")}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151" }}
            >
              <option value="IKU">Indikator Kinerja Utama (IKU)</option>
              <option value="PK">Perjanjian Kerja (PK)</option>
            </select>
          </div>

          {loading ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Memuat data...</p>
          ) : hierarchy.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Belum ada data indikator.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#ff7a00" }}>
                  <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "white", border: "1px solid #f3f4f6", width: 80 }}>Nomor</th>
                  <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "white", border: "1px solid #f3f4f6" }}>Sasaran Strategis</th>
                  <th style={{ padding: "12px 12px", textAlign: "center", fontWeight: 700, color: "white", border: "1px solid #f3f4f6" }}>{filterJenis === "IKU" ? "Sub Indikator Kinerja Utama" : "Sub Indikator Perjanjian Kerja"}</th>
                </tr>
              </thead>
              <tbody>
                {rowsPerLevel0.map((row) => (
                  row.entries.map((entry, entryIndex) => (
                    <tr key={`${row.parent.id}-${entry.key}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      {entryIndex === 0 && (
                        <td rowSpan={row.entries.length} style={{ padding: "12px", textAlign: "center", verticalAlign: "top", color: "#374151", border: "1px solid #e5e7eb", background: "#fafafa", fontWeight: 600 }}>
                          {row.parent.kode}
                        </td>
                      )}
                      {entryIndex === 0 && (
                        <td rowSpan={row.entries.length} style={{ padding: "12px", verticalAlign: "top", color: "#374151", border: "1px solid #e5e7eb", background: "#fafafa" }}>
                          {row.parent.nama}
                        </td>
                      )}
                      <td style={{ padding: "12px", color: "#374151", border: "1px solid #e5e7eb", background: entry.isLevel1 ? "#f9fafb" : "white", fontWeight: entry.isLevel1 ? 600 : 400 }}>
                        {entry.text}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", color: "#374151", fontSize: 12 }}>
                    Menampilkan {rowsPerLevel0.length} dari {rowsPerLevel0.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* FORM SECTION */}
        {showForm && (
          <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 20 }}>
              Master Indikator {filterJenis === "IKU" ? "Kinerja Utama" : "Perjanjian Kerja"}
            </h3>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setFormMode("baru"); setSelectedLevel0Id(""); setGroups([{ id: nextId(), existingLevel1Id: null, kodeIndikator: "", indikatorKinerja: "", subItems: [{ id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] }]); }}
                style={{ padding: "7px 18px", fontSize: 13, borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", fontWeight: 600, background: formMode === "baru" ? "#FF7900" : "white", color: formMode === "baru" ? "white" : "#374151" }}
              >
                Data Baru
              </button>
              <button
                type="button"
                onClick={() => { setFormMode("tambah"); setNomor(""); setSasaranStrategis(""); setGroups([{ id: nextId(), existingLevel1Id: null, kodeIndikator: "", indikatorKinerja: "", subItems: [{ id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] }]); }}
                style={{ padding: "7px 18px", fontSize: 13, borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", fontWeight: 600, background: formMode === "tambah" ? "#FF7900" : "white", color: formMode === "tambah" ? "white" : "#374151" }}
              >
                Tambah ke Data Ada
              </button>
            </div>

            {formMode === "baru" ? (
              <>
                {/* Jenis */}
                <div style={{ marginBottom: 16, maxWidth: 320 }}>
                  <label style={labelStyle}>Jenis Indikator</label>
                  <select value={jenis} onChange={(e) => setJenis(e.target.value as "IKU" | "PK")} style={inputStyle}>
                    <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                    <option value="PK">Perjanjian Kerja (PK)</option>
                  </select>
                </div>

                {/* Level 0 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 6 }}>
                  <div>
                    <label style={labelStyle}>Nomor</label>
                    <input type="text" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="contoh: 1" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Sasaran Strategis</label>
                    <input type="text" value={sasaranStrategis} onChange={(e) => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan..." style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button type="button" onClick={addGroup} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer", lineHeight: 1 }} title="Tambah Indikator Kinerja Kegiatan">+</button>
                </div>

                {groups.map((group, gIdx) => (
                  <div key={group.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, marginBottom: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>Kode Indikator Kinerja Kegiatan</label>
                        <input type="text" value={group.kodeIndikator} onChange={(e) => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder={`contoh: ${nomor || "1"}.${gIdx + 1}`} style={inputStyle} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Indikator Kinerja Kegiatan</label>
                          <input type="text" value={group.indikatorKinerja} onChange={(e) => updateGroup(group.id, "indikatorKinerja", e.target.value)} placeholder="contoh: Hasil Lulusan..." style={inputStyle} />
                        </div>
                        {groups.length > 1 && (
                          <button type="button" onClick={() => removeGroup(group.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>
                        )}
                      </div>
                    </div>

                    {group.subItems.map((sub, sIdx) => (
                      <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10, paddingLeft: 8 }}>
                        <div>
                          <label style={labelStyle}>Kode Sub Indikator Kinerja Kegiatan</label>
                          <input type="text" value={sub.kodeSubIndikator} onChange={(e) => updateSubItem(group.id, sub.id, "kodeSubIndikator", e.target.value)} placeholder={`contoh: ${group.kodeIndikator || `${nomor || "1"}.${gIdx + 1}`}.${sIdx + 1}`} style={inputStyle} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Sub Indikator Kinerja Kegiatan</label>
                            <input type="text" value={sub.subIndikatorKinerja} onChange={(e) => updateSubItem(group.id, sub.id, "subIndikatorKinerja", e.target.value)} placeholder="contoh: < 6 Bulan dan > 1,2 UMP" style={inputStyle} />
                          </div>
                          {group.subItems.length > 1 && (
                            <button type="button" onClick={() => removeSubItem(group.id, sub.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div style={{ display: "flex", justifyContent: "flex-end", paddingLeft: 8, marginBottom: 4 }}>
                      <button type="button" onClick={() => addSubItem(group.id)} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer", lineHeight: 1 }} title="Tambah Sub Indikator">+</button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Mode tambah ke existing */}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Pilih Sasaran Strategis (Level 0)</label>
                  <select
                    value={selectedLevel0Id}
                    onChange={(e) => {
                      setSelectedLevel0Id(e.target.value === "" ? "" : Number(e.target.value));
                      setGroups([{ id: nextId(), existingLevel1Id: null, kodeIndikator: "", indikatorKinerja: "", subItems: [{ id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "" }] }]);
                    }}
                    style={inputStyle}
                  >
                    <option value="">-- Pilih --</option>
                    {indikatorList.filter((i) => i.level === 0).map((i) => (
                      <option key={i.id} value={i.id}>{i.kode} — {i.nama}</option>
                    ))}
                  </select>
                </div>

                {selectedLevel0Id !== "" && (
                  <>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                      <button type="button" onClick={addGroup} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer", lineHeight: 1 }} title="Tambah grup indikator">+</button>
                    </div>

                    {groups.map((group, gIdx) => (
                      <div key={group.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, marginBottom: 8 }}>
                        {/* Pilih level 1 existing atau buat baru */}
                        <div style={{ marginBottom: 10 }}>
                          <label style={labelStyle}>Indikator Kinerja Kegiatan (Level 1)</label>
                          <select
                            value={group.existingLevel1Id === null ? "__baru__" : String(group.existingLevel1Id)}
                            onChange={(e) => {
                              if (e.target.value === "__baru__") {
                                setGroupExistingLevel1(group.id, null);
                              } else {
                                setGroupExistingLevel1(group.id, Number(e.target.value));
                              }
                            }}
                            style={inputStyle}
                          >
                            <option value="__baru__">+ Buat indikator kinerja kegiatan baru</option>
                            {availableLevel1.map((l1) => (
                              <option key={l1.id} value={l1.id}>{l1.kode} — {l1.nama}</option>
                            ))}
                          </select>
                        </div>

                        {/* Jika buat baru, tampilkan input kode + nama */}
                        {group.existingLevel1Id === null && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                            <div>
                              <label style={labelStyle}>Kode Indikator Kinerja Kegiatan</label>
                              <input type="text" value={group.kodeIndikator} onChange={(e) => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder={`contoh: kode.${gIdx + 1}`} style={inputStyle} />
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Nama Indikator Kinerja Kegiatan</label>
                                <input type="text" value={group.indikatorKinerja} onChange={(e) => updateGroup(group.id, "indikatorKinerja", e.target.value)} placeholder="contoh: Hasil Lulusan..." style={inputStyle} />
                              </div>
                              {groups.length > 1 && (
                                <button type="button" onClick={() => removeGroup(group.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Sub indikator baru (level 2) */}
                        <div style={{ background: "#f9fafb", borderRadius: 6, padding: "10px 12px", marginTop: 6 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 8px 0" }}>Sub Indikator Baru (Level 2)</p>
                          {group.subItems.map((sub, sIdx) => (
                            <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
                              <div>
                                <label style={labelStyle}>Kode Sub Indikator</label>
                                <input type="text" value={sub.kodeSubIndikator} onChange={(e) => updateSubItem(group.id, sub.id, "kodeSubIndikator", e.target.value)} placeholder={`contoh: kode.${sIdx + 1}`} style={inputStyle} />
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <label style={labelStyle}>Nama Sub Indikator</label>
                                  <input type="text" value={sub.subIndikatorKinerja} onChange={(e) => updateSubItem(group.id, sub.id, "subIndikatorKinerja", e.target.value)} placeholder="contoh: < 6 Bulan dan > 1,2 UMP" style={inputStyle} />
                                </div>
                                {group.subItems.length > 1 && (
                                  <button type="button" onClick={() => removeSubItem(group.id, sub.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>
                                )}
                              </div>
                            </div>
                          ))}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button type="button" onClick={() => addSubItem(group.id)} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Submit */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                style={{ background: submitLoading ? "#d1d5db" : "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "9px 28px", fontSize: 13, fontWeight: 600, cursor: submitLoading ? "not-allowed" : "pointer" }}
              >
                {submitLoading ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </div>
        )}
      </PageTransition>
    </div>
  );
}
