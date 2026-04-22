"use client";


import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

import { getIndikator, createIndikator, updateIndikator, deleteAllIndikator, upsertTargetUniversitas, getIndikatorGrouped, getBaselineByJenisData, Indikator } from "../../lib/api";


// Type/interface definitions
interface SubIndikatorItem {
  id: number;
  kodeSubIndikator: string;
  subIndikatorKinerja: string;
  jenisData: string;
  baseline: number | null;
  baselineLoading: boolean;
}

interface IndikatorGroupForm {
  id: number;
  existingLevel1Id: number | null;
  kodeIndikator: string;
  indikatorKinerja: string;
  subItems: SubIndikatorItem[];
}

type FormMode = "baru" | "tambah";

// Use Indikator type from lib/api

interface Level0WithChildren {
  record: Indikator;
  children: Array<{
    record: Indikator;
    children: Indikator[];
  }>;
}

// Utility functions (blankGroup, blankSub, etc.) should be defined above the component
function blankSub(): SubIndikatorItem {
  return {
    id: Math.random(),
    kodeSubIndikator: "",
    subIndikatorKinerja: "",
    jenisData: "",
    baseline: null,
    baselineLoading: false,
  };
}

function blankGroup(): IndikatorGroupForm {
  return {
    id: Math.random(),
    existingLevel1Id: null,
    kodeIndikator: "",
    indikatorKinerja: "",
    subItems: [blankSub()],
  };
}

const TAHUN_OPTIONS = [
  new Date().getFullYear(),
  new Date().getFullYear() + 1,
  new Date().getFullYear() + 2,
];
const TRIWULAN_OPTIONS = ["Triwulan 1", "Triwulan 2", "Triwulan 3", "Triwulan 4"];

const labelStyle = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", width: "100%" };


export default function MasterIndikatorContent() {
  // State declarations
  const [indikatorList, setIndikatorList] = useState<Indikator[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterJenis, setFilterJenis] = useState<"IKU" | "PK">("IKU");
  const [formMode, setFormMode] = useState<FormMode>("baru");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<Level0WithChildren | null>(null);
  const [editTahun, setEditTahun] = useState(String(new Date().getFullYear()));
  const [editTenggat, setEditTenggat] = useState("");
  const [editTargetUniversitas, setEditTargetUniversitas] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Target map for table column: { [indikatorId]: { targetUniversitas, tenggat } }
  const [targetMap, setTargetMap] = useState<Record<number, { targetUniversitas: number | null; tenggat: string | null }>>({});

  // Form fields
  const [jenis, setJenis] = useState<"IKU" | "PK">("IKU");
  const [nomor, setNomor] = useState("");
  const [sasaranStrategis, setSasaranStrategis] = useState("");
  const [targetUniversitas, setTargetUniversitas] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [targetTahun, setTargetTahun] = useState(String(new Date().getFullYear()));
  const [selectedLevel0Id, setSelectedLevel0Id] = useState<number | "">("");
  const [groups, setGroups] = useState<IndikatorGroupForm[]>([blankGroup()]);

  // Target Universitas Acuan Calculation
  const [targetAcuan, setTargetAcuan] = useState("");
  const [targetPersentase, setTargetPersentase] = useState("");
  const [baselineAcuan, setBaselineAcuan] = useState<number | null>(null);

  const [editTargetAcuan, setEditTargetAcuan] = useState("");
  const [editTargetPersentase, setEditTargetPersentase] = useState("");
  const [editBaselineAcuan, setEditBaselineAcuan] = useState<number | null>(null);

  const calcAngka = (pct: string, baseline: number | null) => {
    if (!pct || !baseline) return "";
    return Math.round((Number(pct) / 100) * baseline).toString();
  };

  useEffect(() => {
    if (targetAcuan && targetTahun) {
      getBaselineByJenisData(targetAcuan, targetTahun).then(res => setBaselineAcuan(res ? res.jumlah : null));
    } else {
      setBaselineAcuan(null);
    }
  }, [targetAcuan, targetTahun]);

  useEffect(() => {
    if (editTargetAcuan && editTahun) {
      getBaselineByJenisData(editTargetAcuan, editTahun).then(res => setEditBaselineAcuan(res ? res.jumlah : null));
    } else {
      setEditBaselineAcuan(null);
    }
  }, [editTargetAcuan, editTahun]);

  // Debounce timers per sub item id
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const refreshList = useCallback(() => {
    setLoading(true);
    getIndikator()
      .then(setIndikatorList)
      .catch(() => setIndikatorList([]))
      .finally(() => setLoading(false));
  }, []);

  const refreshTargetMap = useCallback(async (jenis: string, tahun: string) => {
    try {
      const data = await getIndikatorGrouped(jenis, tahun, 1);
      const map: Record<number, { targetUniversitas: number | null; tenggat: string | null }> = {};
      data.forEach((g) => { map[g.id] = { targetUniversitas: g.targetUniversitas, tenggat: g.tenggat }; });
      setTargetMap(map);
    } catch {
      setTargetMap({});
    }
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  useEffect(() => {
    refreshTargetMap(filterJenis, String(new Date().getFullYear()));
  }, [filterJenis, refreshTargetMap]);

  // Fetch baseline when jenisData + targetTahun change
  const fetchBaseline = useCallback((subId: number, jenisDataVal: string, tahun: string) => {
    if (!jenisDataVal.trim() || !tahun) {
      setGroups((prev) => prev.map((g) => ({
        ...g,
        subItems: g.subItems.map((s) =>
          s.id === subId ? { ...s, baseline: null, baselineLoading: false } : s
        ),
      })));
      return;
    }
    // Mark loading
    setGroups((prev) => prev.map((g) => ({
      ...g,
      subItems: g.subItems.map((s) =>
        s.id === subId ? { ...s, baselineLoading: true } : s
      ),
    })));
    getBaselineByJenisData(jenisDataVal.trim(), tahun)
      .then((result) => {
        setGroups((prev) => prev.map((g) => ({
          ...g,
          subItems: g.subItems.map((s) =>
            s.id === subId
              ? { ...s, baseline: result ? (result.jumlah ?? null) : null, baselineLoading: false }
              : s
          ),
        })));
      })
      .catch(() => {
        setGroups((prev) => prev.map((g) => ({
          ...g,
          subItems: g.subItems.map((s) =>
            s.id === subId ? { ...s, baseline: null, baselineLoading: false } : s
          ),
        })));
      });
  }, []);

  const handleJenisDataChange = (gid: number, sid: number, value: string) => {
    setGroups((prev) => prev.map((g) =>
      g.id === gid
        ? { ...g, subItems: g.subItems.map((s) => s.id === sid ? { ...s, jenisData: value } : s) }
        : g
    ));
    // Debounce baseline fetch
    clearTimeout(debounceRefs.current[sid]);
    debounceRefs.current[sid] = setTimeout(() => {
      fetchBaseline(sid, value, targetTahun);
    }, 600);
  };

  // Re-fetch all baselines when tahun changes
  useEffect(() => {
    groups.forEach((g) => {
      g.subItems.forEach((s) => {
        if (s.jenisData) fetchBaseline(s.id, s.jenisData, targetTahun);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTahun]);

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
  const availableLevel1 = selectedLevel0Id !== ""
    ? indikatorList.filter((i) => i.level === 1 && i.parentId === selectedLevel0Id)
    : [];

  const rowsPerLevel0 = hierarchy.map((h) => {
    const entries: { key: string; text: string; isLevel1: boolean }[] = [];
    h.children.forEach((l1) => {
      entries.push({ key: `l1-${l1.record.id}`, text: `${l1.record.kode} ${l1.record.nama}`, isLevel1: true });
      l1.children.forEach((l2) => {
        entries.push({ key: `l2-${l2.id}`, text: `${l2.kode} ${l2.nama}`, isLevel1: false });
      });
    });
    if (entries.length === 0) entries.push({ key: `empty-${h.record.id}`, text: "-", isLevel1: false });
    return { parent: h.record, entries };
  });

  const addGroup = () => setGroups((prev) => [...prev, blankGroup()]);
  const removeGroup = (gid: number) => setGroups((prev) => prev.filter((g) => g.id !== gid));
  const updateGroup = (gid: number, field: "kodeIndikator" | "indikatorKinerja", value: string) =>
    setGroups((prev) => prev.map((g) => g.id === gid ? { ...g, [field]: value } : g));
  const setGroupExistingLevel1 = (gid: number, l1Id: number | null) =>
    setGroups((prev) => prev.map((g) => g.id === gid ? { ...g, existingLevel1Id: l1Id, kodeIndikator: "", indikatorKinerja: "" } : g));
  const addSubItem = (gid: number) =>
    setGroups((prev) => prev.map((g) => g.id === gid ? { ...g, subItems: [...g.subItems, blankSub()] } : g));
  const removeSubItem = (gid: number, sid: number) =>
    setGroups((prev) => prev.map((g) => g.id === gid ? { ...g, subItems: g.subItems.filter((s) => s.id !== sid) } : g));
  const updateSubItem = (gid: number, sid: number, field: "kodeSubIndikator" | "subIndikatorKinerja", value: string) =>
    setGroups((prev) => prev.map((g) => g.id === gid ? {
      ...g, subItems: g.subItems.map((s) => s.id === sid ? { ...s, [field]: value } : s),
    } : g));

  const resetForm = () => {
    setFormMode("baru"); setJenis("IKU"); setNomor(""); setSasaranStrategis("");
    setTargetUniversitas(""); setTenggat(""); setSelectedLevel0Id("");
    setTargetAcuan(""); setTargetPersentase(""); setBaselineAcuan(null);
    setGroups([blankGroup()]);
  };

  const handleDeleteAll = async () => {
    setDeleteLoading(true);
    try {
      await deleteAllIndikator();
      setConfirmDeleteOpen(false);
      refreshList();
    } catch (err) {
      alert("Gagal menghapus: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (formMode === "baru") {
      if (!nomor.trim() || !sasaranStrategis.trim()) { alert("Nomor dan Sasaran Strategis wajib diisi."); return; }
      if (!targetUniversitas || isNaN(Number(targetUniversitas))) { alert("Target Universitas wajib diisi dengan angka."); return; }
      if (!tenggat) { alert("Pilih Tenggat (Triwulan) terlebih dahulu."); return; }
      for (const g of groups) {
        if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) { alert("Kode dan nama Indikator Kinerja Kegiatan wajib diisi."); return; }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { alert("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
      setSubmitLoading(true);
      try {
        const level0 = await createIndikator({ 
          jenis, 
          kode: nomor.trim(), 
          nama: sasaranStrategis.trim(), 
          level: 0, 
          parentId: null,
          jenisData: targetAcuan || null
        });
        for (const g of groups) {
          const level1 = await createIndikator({ jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), level: 1, parentId: level0.id });
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
        // Save target universitas at level 0
        await upsertTargetUniversitas(level0.id, 1, targetTahun, Number(targetUniversitas), tenggat);
        resetForm(); setShowForm(false); refreshList();
      } catch (err) {
        alert("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
      } finally { setSubmitLoading(false); }

    } else {
      if (selectedLevel0Id === "") { alert("Pilih Sasaran Strategis terlebih dahulu."); return; }
      const parentLevel0 = indikatorList.find((i) => i.id === selectedLevel0Id);
      if (!parentLevel0) return;
      for (const g of groups) {
        if (g.existingLevel1Id === null && (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim())) { alert("Kode dan nama Indikator Kinerja Kegiatan baru wajib diisi."); return; }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { alert("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
      setSubmitLoading(true);
      try {
        for (const g of groups) {
          let level1Id: number;
          if (g.existingLevel1Id !== null) {
            level1Id = g.existingLevel1Id;
          } else {
            const newL1 = await createIndikator({ jenis: parentLevel0.jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), level: 1, parentId: parentLevel0.id });
            level1Id = newL1.id;
          }
          for (const s of g.subItems) {
            await createIndikator({
              jenis: parentLevel0.jenis,
              kode: s.kodeSubIndikator.trim(),
              nama: s.subIndikatorKinerja.trim(),
              level: 2,
              parentId: level1Id,
              jenisData: s.jenisData.trim() || null,
            });
          }
        }
        resetForm(); setShowForm(false); refreshList();
      } catch (err) {
        alert("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
      } finally { setSubmitLoading(false); }
    }
  };

  const fetchEditTarget = async (indikatorId: number, tahun: string) => {
    setEditLoading(true);
    setEditTargetUniversitas("");
    setEditTenggat("");
    try {
      const data = await getIndikatorGrouped(filterJenis, tahun, 1);
      const found = data.find((g) => g.id === indikatorId);
      if (found) {
        if (found.targetUniversitas != null) setEditTargetUniversitas(String(found.targetUniversitas));
        if (found.tenggat) setEditTenggat(found.tenggat);
      }
    } catch {
      // no existing target
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditClick = (row: Level0WithChildren) => {
    setEditRow(row);
    setEditTahun(String(new Date().getFullYear()));
    setEditTargetAcuan(row.record.jenisData || "");
    setEditTargetPersentase("");
    setEditBaselineAcuan(null);
    setEditModalOpen(true);
    fetchEditTarget(row.record.id, String(new Date().getFullYear()));
  };

  const handleEditTahunChange = (tahun: string) => {
    setEditTahun(tahun);
    if (editRow) fetchEditTarget(editRow.record.id, tahun);
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    if (!editTargetUniversitas || isNaN(Number(editTargetUniversitas))) {
      alert("Target Universitas wajib diisi dengan angka."); return;
    }
    setEditSaving(true);
    try {
      // Update Level 0 to save the baseline source (jenisData)
      await updateIndikator(editRow.record.id, {
        jenisData: editTargetAcuan || null
      });

      await upsertTargetUniversitas(
        editRow.record.id, 1, editTahun,
        Number(editTargetUniversitas),
        editTenggat || undefined
      );
      setEditModalOpen(false);
      setEditRow(null);
      refreshTargetMap(filterJenis, editTahun);
    } catch (err) {
      alert("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      {/* Konfirmasi Hapus Semua */}
      {confirmDeleteOpen && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => !deleteLoading && setConfirmDeleteOpen(false)}
        >
          <div
            style={{
              backgroundColor: "white", borderRadius: 12, padding: 28,
              width: 400, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1f2937", textAlign: "center" }}>
              Hapus Semua Data
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
              Semua data indikator beserta target terkait akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleteLoading}
                style={{ padding: "8px 24px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                Kembali
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteLoading}
                style={{
                  padding: "8px 24px", borderRadius: 6, border: "none",
                  backgroundColor: deleteLoading ? "#9ca3af" : "#dc2626",
                  color: "white", fontSize: 13, fontWeight: 600,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
              >
                {deleteLoading ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Edit Modal */}
      {editModalOpen && editRow && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => !editSaving && setEditModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "white", borderRadius: 12, padding: 28,
              width: 600, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)", boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", textAlign: "center" }}>
              Edit Target Universitas
            </h3>
            <p style={{ textAlign: "center", marginBottom: 20 }}> Indikator : {editRow.record.id} </p>
            {/* Edit Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Tahun Target</label>
                <select
                  value={editTahun}
                  onChange={(e) => handleEditTahunChange(e.target.value)}
                  style={inputStyle}
                  disabled={editLoading}
                >
                  {TAHUN_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tenggat</label>
                <select value={editTenggat} onChange={(e) => setEditTenggat(e.target.value)} style={inputStyle}>
                  <option value="">-- Tidak Diubah --</option>
                  {TRIWULAN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Target Universitas</label>
              {editLoading ? (
                <div style={{ ...inputStyle, backgroundColor: "#f3f4f6", color: "#9ca3af" }}>Memuat...</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <select
                      value={editTargetAcuan}
                      onChange={(e) => {
                        setEditTargetAcuan(e.target.value);
                        if (!e.target.value) { setEditTargetPersentase(""); }
                      }}
                      style={{ ...inputStyle, width: "auto", flex: 1 }}
                    >
                      <option value="Dosen">Acuan: Dosen</option>
                      <option value="Tendik">Acuan: Tendik</option>
                      <option value="Mahasiswa">Acuan: Mahasiswa</option>
                    </select>

                    {editTargetAcuan && (
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: 6, width: 90 }}>
                        <input
                          type="number"
                          value={editTargetPersentase}
                          onChange={(e) => {
                            setEditTargetPersentase(e.target.value);
                            setEditTargetUniversitas(calcAngka(e.target.value, editBaselineAcuan));
                          }}
                          placeholder="%"
                          style={{ width: "100%", border: "none", padding: "8px", outline: "none", borderRadius: "6px 0 0 6px", fontSize: 13, textAlign: "center" }}
                        />
                        <span style={{ padding: "0 8px", color: "#6b7280", fontWeight: 600, borderLeft: "1px solid #d1d5db", background: "#f9fafb", borderRadius: "0 6px 6px 0", height: "100%", display: "flex", alignItems: "center", fontSize: 12 }}>%</span>
                      </div>
                    )}

                    <input
                      type="number"
                      min={0}
                      value={editTargetUniversitas}
                      onChange={(e) => {
                        setEditTargetUniversitas(e.target.value);
                        setEditTargetPersentase("");
                        setEditTargetAcuan("");
                      }}
                      placeholder="Nilai Total"
                      style={{ ...inputStyle, width: 100 }}
                    />
                  </div>
                  {editTargetAcuan && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                      Total {editTargetAcuan}: <strong>{editBaselineAcuan ?? "0"}</strong>
                      {editBaselineAcuan ? ` (x ${editTargetPersentase || '0'}% = ${calcAngka(editTargetPersentase, editBaselineAcuan) || '0'})` : ""}
                    </span>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={editSaving}
                style={{ padding: "8px 24px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                Kembali
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || editLoading}
                style={{
                  padding: "8px 24px", borderRadius: 6, border: "none",
                  backgroundColor: editSaving || editLoading ? "#9ca3af" : "#16a34a",
                  color: "white", fontSize: 13, fontWeight: 600,
                  cursor: editSaving || editLoading ? "not-allowed" : "pointer",
                }}
              >
                {editSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="/admin/master-indikator">Master Indikator</a>
        </nav>
        <div className="page-card">
          <h3>Data Indikator Kegiatan</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div className="filter">
              <div className="filter-content">
                <label className="filter-content-label">Jenis Indikator</label>
                <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value as "IKU" | "PK")} className="filter-isi">
                  <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                  <option value="PK">Perjanjian Kerja (PK)</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDeleteOpen(true)} className="btn-outline btn-main">Hapus</button>
              <button onClick={() => { window.location.href = "/admin/master-indikator/tambah"; }} className="btn-main">Tambah</button>
            </div>
          </div>
          {loading ? (
            <p className="text-gray">Memuat data...</p>
          ) : hierarchy.length === 0 ? (
            <p className="text-gray">Belum ada data indikator.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table-universal">
                <thead>
                  <tr>
                    <th style={{ width: "5%", minWidth: 60 }}>Nomor</th>
                    <th style={{ width: "25%", minWidth: 150 }}>Sasaran Strategis</th>
                    <th style={{ width: "35%", minWidth: 200 }}>{filterJenis === "IKU" ? "Sub Indikator Kinerja Utama" : "Sub Indikator Perjanjian Kerja"}</th>
                    <th style={{ width: "12%", minWidth: 100, textAlign: "center" }}>Target Universitas</th>
                    <th style={{ width: "12%", minWidth: 100, textAlign: "center" }}>Tenggat</th>
                    <th style={{ width: "8%", minWidth: 80, textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsPerLevel0.map((row) => {
                    const level0Group = hierarchy.find((h) => h.record.id === row.parent.id) ?? null;
                    return row.entries.map((entry, idx) => (
                      <tr key={`${row.parent.id}-${entry.key}`}>
                        {idx === 0 && (
                          <td rowSpan={row.entries.length} style={{ textAlign: "center", verticalAlign: "top", fontWeight: 600 }}>{row.parent.kode}</td>
                        )}
                        {idx === 0 && (
                          <td rowSpan={row.entries.length} style={{ verticalAlign: "top" }}>{row.parent.nama}</td>
                        )}
                        <td style={{ paddingLeft: entry.isLevel1 ? 12 : 24 }}>
                          <span style={{ fontWeight: entry.isLevel1 ? 600 : 400, color: entry.isLevel1 ? "#1f2937" : "#374151" }}>
                            {entry.text && entry.text !== "-" ? entry.text : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Tidak ada sub indikator</span>}
                          </span>
                        </td>
                        {idx === 0 && (
                          <td rowSpan={row.entries.length} style={{ textAlign: "center", verticalAlign: "top", color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                            {targetMap[row.parent.id]?.targetUniversitas != null
                              ? targetMap[row.parent.id].targetUniversitas!.toLocaleString("id-ID")
                              : <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 12 }}>-</span>}
                          </td>
                        )}
                        {idx === 0 && (
                          <td rowSpan={row.entries.length} style={{ textAlign: "center", verticalAlign: "top", color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>
                            {targetMap[row.parent.id]?.tenggat ?? "-"}
                          </td>
                        )}
                        {idx === 0 && level0Group && (
                          <td rowSpan={row.entries.length} style={{ textAlign: "center", verticalAlign: "top" }}>
                            <button
                              onClick={() => handleEditClick(level0Group)}
                              style={{
                                padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                border: "1px solid #93c5fd", backgroundColor: "#eff6ff", color: "#2563eb",
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ));
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} style={{ fontSize: 12 }}>
                      Menampilkan {rowsPerLevel0.length} dari {rowsPerLevel0.length} sasaran strategis.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 20 }}>
            Tambah Indikator
          </h3>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["baru", "tambah"] as FormMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setFormMode(mode);
                  setNomor(""); setSasaranStrategis(""); setSelectedLevel0Id("");
                  setGroups([blankGroup()]);
                }}
                style={{ padding: "7px 18px", fontSize: 13, borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", fontWeight: 600, background: formMode === mode ? "#FF7900" : "white", color: formMode === mode ? "white" : "#374151" }}
              >
                {mode === "baru" ? "Data Baru" : "Tambah ke Data Ada"}
              </button>
            ))}
          </div>

          {formMode === "baru" ? (
            <>
              {/* Jenis + Tahun Target */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Jenis Indikator</label>
                  <select value={jenis} onChange={(e) => setJenis(e.target.value as "IKU" | "PK")} style={inputStyle}>
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
                  <label style={labelStyle}>Tenggat</label>
                  <select value={tenggat} onChange={(e) => setTenggat(e.target.value)} style={inputStyle}>
                    <option value="">-- Pilih Tenggat --</option>
                    {TRIWULAN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Nomor + Sasaran Strategis + Target Universitas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Nomor</label>
                  <input type="text" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="contoh: 1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sasaran Strategis</label>
                  <input type="text" value={sasaranStrategis} onChange={(e) => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan..." style={inputStyle} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={labelStyle}>Target Universitas</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={targetAcuan}
                      onChange={(e) => {
                        setTargetAcuan(e.target.value);
                        if (!e.target.value) { setTargetPersentase(""); }
                      }}
                      style={{ ...inputStyle, width: "auto", flex: 1 }}
                    >
                      <option value="">Manual / Nominal</option>
                      <option value="Dosen">Acuan: Dosen</option>
                      <option value="Tendik">Acuan: Tendik</option>
                      <option value="Mahasiswa">Acuan: Mahasiswa</option>
                    </select>

                    {targetAcuan && (
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: 6, width: 90 }}>
                        <input
                          type="number"
                          value={targetPersentase}
                          onChange={(e) => {
                            setTargetPersentase(e.target.value);
                            setTargetUniversitas(calcAngka(e.target.value, baselineAcuan));
                          }}
                          placeholder="%"
                          style={{ width: "100%", border: "none", padding: "8px", outline: "none", borderRadius: "6px 0 0 6px", fontSize: 13, textAlign: "center" }}
                        />
                        <span style={{ padding: "0 8px", color: "#6b7280", fontWeight: 600, borderLeft: "1px solid #d1d5db", background: "#f9fafb", borderRadius: "0 6px 6px 0", height: "100%", display: "flex", alignItems: "center", fontSize: 12 }}>%</span>
                      </div>
                    )}

                    <input
                      type="number"
                      min={0}
                      value={targetUniversitas}
                      onChange={(e) => {
                        setTargetUniversitas(e.target.value);
                        setTargetPersentase("");
                        setTargetAcuan("");
                      }}
                      placeholder="Nilai Total"
                      style={{ ...inputStyle, width: 100 }}
                    />
                  </div>
                  {targetAcuan && (
                    <span style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Total {targetAcuan}: <strong>{baselineAcuan ?? "0"}</strong>
                      {baselineAcuan ? ` (x ${targetPersentase || '0'}% = ${calcAngka(targetPersentase, baselineAcuan) || '0'})` : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Groups */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button type="button" onClick={addGroup} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer" }} title="Tambah Indikator">+</button>
              </div>

              {groups.map((group, gIdx) => (
                <div key={group.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Kode Indikator Kinerja Kegiatan</label>
                      <input type="text" value={group.kodeIndikator} onChange={(e) => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder={`contoh: ${nomor || "1"}.${gIdx + 1}`} style={inputStyle} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Indikator Kinerja Kegiatan</label>
                        <input type="text" value={group.indikatorKinerja} onChange={(e) => updateGroup(group.id, "indikatorKinerja", e.target.value)} placeholder="contoh: Hasil Lulusan..." style={inputStyle} />
                      </div>
                      {groups.length > 1 && <button type="button" onClick={() => removeGroup(group.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>}
                    </div>
                  </div>

                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Sub Indikator (Level 2)</p>
                  {group.subItems.map((sub, sIdx) => (
                    <div key={sub.id} style={{ background: "#f9fafb", borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                        <div>
                          <label style={labelStyle}>Kode Sub Indikator</label>
                          <input type="text" value={sub.kodeSubIndikator} onChange={(e) => updateSubItem(group.id, sub.id, "kodeSubIndikator", e.target.value)} placeholder={`contoh: ${group.kodeIndikator || `${nomor || "1"}.${gIdx + 1}`}.${sIdx + 1}`} style={inputStyle} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Nama Sub Indikator</label>
                            <input type="text" value={sub.subIndikatorKinerja} onChange={(e) => updateSubItem(group.id, sub.id, "subIndikatorKinerja", e.target.value)} placeholder="contoh: < 6 Bulan dan > 1,2 UMP" style={inputStyle} />
                          </div>
                          {group.subItems.length > 1 && <button type="button" onClick={() => removeSubItem(group.id, sub.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Jenis Data (untuk baseline)</label>
                          <input
                            type="text"
                            value={sub.jenisData}
                            onChange={(e) => handleJenisDataChange(group.id, sub.id, e.target.value)}
                            placeholder="contoh: mahasiswa_lulus"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ minWidth: 140, paddingBottom: 2 }}>
                          <label style={labelStyle}>Baseline ({targetTahun})</label>
                          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, background: "#f3f4f6", color: sub.baseline !== null ? "#1f2937" : "#9ca3af", minHeight: 36 }}>
                            {sub.baselineLoading
                              ? "Memuat..."
                              : sub.baseline !== null
                                ? sub.baseline.toLocaleString("id-ID")
                                : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => addSubItem(group.id)} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer" }}>+</button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Tambah ke Data Ada */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16, maxWidth: 400 }}>
                  <label style={labelStyle}>Tahun (untuk baseline)</label>
                  <select value={targetTahun} onChange={(e) => setTargetTahun(e.target.value)} style={inputStyle}>
                    {TAHUN_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <label style={labelStyle}>Pilih Sasaran Strategis (Level 0)</label>
                <select
                  value={selectedLevel0Id}
                  onChange={(e) => {
                    setSelectedLevel0Id(e.target.value === "" ? "" : Number(e.target.value));
                    setGroups([blankGroup()]);
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
                    <button type="button" onClick={addGroup} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer" }}>+</button>
                  </div>
                  {groups.map((group, gIdx) => (
                    <div key={group.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12 }}>
                      <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Indikator Kinerja Kegiatan (Level 1)</label>
                        <select
                          value={group.existingLevel1Id === null ? "__baru__" : String(group.existingLevel1Id)}
                          onChange={(e) => {
                            if (e.target.value === "__baru__") setGroupExistingLevel1(group.id, null);
                            else setGroupExistingLevel1(group.id, Number(e.target.value));
                          }}
                          style={inputStyle}
                        >
                          <option value="__baru__">+ Buat indikator kinerja kegiatan baru</option>
                          {availableLevel1.map((l1) => (<option key={l1.id} value={l1.id}>{l1.kode} — {l1.nama}</option>))}
                        </select>
                      </div>
                      {group.existingLevel1Id === null && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                          <div>
                            <label style={labelStyle}>Kode Indikator Kinerja Kegiatan</label>
                            <input type="text" value={group.kodeIndikator} onChange={(e) => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder={`contoh: kode.${gIdx + 1}`} style={inputStyle} />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>Nama Indikator Kinerja Kegiatan</label>
                              <input type="text" value={group.indikatorKinerja} onChange={(e) => updateGroup(group.id, "indikatorKinerja", e.target.value)} placeholder="contoh: Hasil Lulusan..." style={inputStyle} />
                            </div>
                            {groups.length > 1 && <button type="button" onClick={() => removeGroup(group.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>}
                          </div>
                        </div>
                      )}

                      <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Sub Indikator Baru (Level 2)</p>
                      {group.subItems.map((sub, sIdx) => (
                        <div key={sub.id} style={{ background: "#f9fafb", borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                            <div>
                              <label style={labelStyle}>Kode Sub Indikator</label>
                              <input type="text" value={sub.kodeSubIndikator} onChange={(e) => updateSubItem(group.id, sub.id, "kodeSubIndikator", e.target.value)} placeholder={`contoh: kode.${sIdx + 1}`} style={inputStyle} />
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <label style={labelStyle}>Nama Sub Indikator</label>
                                <input type="text" value={sub.subIndikatorKinerja} onChange={(e) => updateSubItem(group.id, sub.id, "subIndikatorKinerja", e.target.value)} placeholder="contoh: < 6 Bulan dan > 1,2 UMP" style={inputStyle} />
                              </div>
                              {group.subItems.length > 1 && <button type="button" onClick={() => removeSubItem(group.id, sub.id)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#dc2626", fontSize: 18, cursor: "pointer", paddingBottom: 6 }}>−</button>}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                            <div style={{ flex: 1 }}>
                              <label style={labelStyle}>Jenis Data (untuk baseline)</label>
                              <input
                                type="text"
                                value={sub.jenisData}
                                onChange={(e) => handleJenisDataChange(group.id, sub.id, e.target.value)}
                                placeholder="contoh: mahasiswa_lulus"
                                style={inputStyle}
                              />
                            </div>
                            <div style={{ minWidth: 140, paddingBottom: 2 }}>
                              <label style={labelStyle}>Baseline ({targetTahun})</label>
                              <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, background: "#f3f4f6", color: sub.baseline !== null ? "#1f2937" : "#9ca3af", minHeight: 36 }}>
                                {sub.baselineLoading
                                  ? "Memuat..."
                                  : sub.baseline !== null
                                    ? sub.baseline.toLocaleString("id-ID")
                                    : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => addSubItem(group.id)} style={{ background: "none", border: "none", color: "#374151", fontSize: 20, cursor: "pointer" }}>+</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

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
      {/* End of main content, removed PageTransition wrapper */}
    </div>
  );
}
