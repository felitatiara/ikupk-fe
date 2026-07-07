"use client";


import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";

import { getIndikator, createIndikator, updateIndikator, deleteIndikator, deleteAllIndikator, upsertTargetUniversitas, getTargetUniversitas, getBaselineByJenisData, getAvailableYears, importIndikatorBulk, Indikator, IndikatorImportRow } from "../../lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import DistribusiTargetModal from "./DistribusiTargetModal";
import ImportTurunanModal from "./ImportTurunanModal";


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
    children: Array<{
      record: Indikator;
      children: Indikator[];
    }>;
  }>;
}

function naturalSortKode(a: string, b: string): number {
  const ap = a.split('.').map(Number);
  const bp = b.split('.').map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const diff = (ap[i] ?? 0) - (bp[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
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

const TAHUN_OPTIONS_FALLBACK = [
  String(new Date().getFullYear() - 1),
  String(new Date().getFullYear()),
  String(new Date().getFullYear() + 1),
];
const TRIWULAN_OPTIONS = ["Triwulan 1", "Triwulan 2", "Triwulan 3", "Triwulan 4"];
const SATUAN_OPTIONS = [
  "%", "Mahasiswa", "Lulusan", "Dosen", "Artikel", "Judul", "Laporan", "Kegiatan",
  "Buku", "Mata Kuliah", "Luaran/IA", "Unit Kerja", "Dokumen", "Dokumen per prodi valid",
  "Laporan AMI valid per prodi", "Laporan per semester prodi", "Laporan per semester fakultas",
  "PS", "Publikasi", "Inovasi", "Rp./Tahun", "% dari RPD/bulan", "Triwulan", "Surveyor",
  "Kegiatan/semester", "% Total keg. lit per PS", "% Total keg. abdimas per PS",
  "Kegiatan/Fakultas/Smt", "Kegiatan/Jurusan/Smt", "% Mhs Aktif", "MoA per Fakultas",
  "IA per Fakultas", "Rp/Fakultas", "IA/PKS/LoA Per fakultas", "Publikasi/Fakultas",
  "% dari jumlah prodi", "Kali/tahun/fakultas", "Judul/dosen", "Professor", "Keg/Smt", "Keg/Tahun",
];

const labelStyle = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151", width: "100%" };


function parseIndikatorExcel(file: File): Promise<IndikatorImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

        // Detect header rows (scan first 10 rows)
        let h1 = -1, h2 = -1;
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const texts = (rawRows[i] ?? []).map(c => String(c ?? "").toLowerCase().trim());
          if (texts.some(t => t === "no" || t === "no." || t.includes("kategori"))) {
            h1 = i;
            if (i + 1 < rawRows.length) {
              const nextTexts = (rawRows[i + 1] ?? []).map(c => String(c ?? "").toLowerCase().trim());
              if (nextTexts.some(t => t === "kode" || t.includes("nama"))) h2 = i + 1;
            }
            break;
          }
        }
        const dataStart = h2 >= 0 ? h2 + 1 : h1 >= 0 ? h1 + 1 : 0;

        // Detect column positions from header rows
        const headerCols: Record<string, number> = {};
        [h1, h2].filter(h => h >= 0).forEach(h => {
          (rawRows[h] ?? []).forEach((cell, idx) => {
            const t = String(cell ?? "").toLowerCase().trim();
            if (!t) return;
            if (t === "no" || t === "no.") headerCols["no"] = idx;
            else if (t.includes("kategori")) headerCols["kategori"] = idx;
            else if (t.includes("sasaran")) headerCols["sasaran"] = idx;
            else if (t === "kode") headerCols["kode"] = idx;
            // "Indikator Kinerja Kegiatan" adalah merged header yang mencakup 2 kolom: kode di idx, nama di idx+1
            else if (t.includes("indikator kinerja") || t.includes("kinerja kegiatan")) {
              if (headerCols["kode"] === undefined) headerCols["kode"] = idx;
              if (headerCols["nama"] === undefined) headerCols["nama"] = idx + 1;
            }
            // "Nama" saja (bukan bagian dari "Indikator Kinerja")
            else if (t === "nama" || (t.includes("nama") && !t.includes("indikator") && !t.includes("kinerja"))) headerCols["nama"] = idx;
            else if (t.includes("tenggat")) headerCols["tenggat"] = idx;
            else if (t.includes("target")) headerCols["target"] = idx;
            else if (t.includes("satuan")) headerCols["satuan"] = idx;
            else if (t.includes("sumber")) headerCols["sumber"] = idx;
          });
        });
        const COL = {
          no:       headerCols["no"]       ?? 0,
          kategori: headerCols["kategori"] ?? 1,
          sasaran:  headerCols["sasaran"]  ?? 2,
          kode:     headerCols["kode"]     ?? 3,
          nama:     headerCols["nama"]     ?? 4,
          tenggat:  headerCols["tenggat"]  ?? 5,
          target:   headerCols["target"]   ?? 6,
          satuan:   headerCols["satuan"]   ?? 7,
          sumber:   headerCols["sumber"]   ?? 8,
        };
        // Safety: pastikan kode dan nama tidak baca kolom yang sama
        if (COL.kode === COL.nama) COL.nama = COL.kode + 1;

        const result: IndikatorImportRow[] = [];
        let lastKategori = "";
        let lastSasaran = "";
        const l0Created = new Set<string>();

        for (let i = dataStart; i < rawRows.length; i++) {
          const row = rawRows[i] ?? [];
          if (row.every(c => c === null)) continue;

          const rawNo       = row[COL.no];
          const rawKategori = row[COL.kategori];
          const rawSasaran  = row[COL.sasaran];
          const rawKode     = row[COL.kode];
          const rawNama     = row[COL.nama];

          if (rawKategori != null && String(rawKategori).trim()) lastKategori = String(rawKategori).trim();
          if (rawSasaran  != null && String(rawSasaran).trim())  lastSasaran  = String(rawSasaran).trim();

          // L0: dari kolom No. + Sasaran Program
          if (rawNo != null && String(rawNo).trim()) {
            const no = String(rawNo).trim();
            if (!l0Created.has(no) && lastSasaran) {
              result.push({ kode: no, nama: lastSasaran, level: 0, parentKode: null, kategori: lastKategori || null, tenggat: null, target: null, satuan: null, sumberData: "repository" });
              l0Created.add(no);
            }
          }

          if (rawKode == null || String(rawKode).trim() === "") continue;
          const kode = String(rawKode).trim();
          const nama = String(rawNama ?? "").trim();
          if (!nama) continue;

          const parts = kode.split(".");
          const level = parts.length - 1;
          const parentKode = level > 0 ? parts.slice(0, -1).join(".") : null;

          const rawSumber = String(row[COL.sumber] ?? "").trim().toLowerCase();
          const sumberData = rawSumber.includes("ikupk") ? "ikupk" : "repository";
          const tenggat = row[COL.tenggat] != null && String(row[COL.tenggat]).trim() ? String(row[COL.tenggat]).trim() : null;
          const rawTarget = row[COL.target];
          const targetNum = rawTarget != null && String(rawTarget).trim() !== "" ? Number(rawTarget) : null;
          const satuan = row[COL.satuan] != null && String(row[COL.satuan]).trim() ? String(row[COL.satuan]).trim() : null;

          result.push({ kode, nama, level, parentKode, kategori: null, tenggat, target: targetNum !== null && isNaN(targetNum) ? null : targetNum, satuan, sumberData });
        }

        resolve(result);
      } catch (err: any) {
        reject(new Error("Gagal parse Excel: " + err.message));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function MasterIndikatorContent() {
  const { token } = useAuth();

  // State declarations
  const [indikatorList, setIndikatorList] = useState<Indikator[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterJenis, setFilterJenis] = useState<"IKU" | "PK">("IKU");
  const [formMode, setFormMode] = useState<FormMode>("baru");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteSingleId, setConfirmDeleteSingleId] = useState<number | null>(null);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Available years from DB (shared between form and edit modal)
  const [availableYears, setAvailableYears] = useState<string[]>(TAHUN_OPTIONS_FALLBACK);

  // Edit inline page state
  const [editMode, setEditMode] = useState(false);
  const [editRow, setEditRow] = useState<Level0WithChildren | null>(null);
  const [editTahun, setEditTahun] = useState("");
  const [editTenggat, setEditTenggat] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);
  // Single sumberData for all children
  const [editSumberData, setEditSumberData] = useState<string>('repository');
  // Leaf-level targets: indikatorId → target string
  const [editLeafTargets, setEditLeafTargets] = useState<Record<number, string>>({});
  // Leaf-level satuan: indikatorId → satuan string
  const [editLeafSatuan, setEditLeafSatuan] = useState<Record<number, string>>({});
  // L3 children for PK: l2Id → Indikator[]
  const [editL3Map, setEditL3Map] = useState<Record<number, Indikator[]>>({});
  // PK L3 berbasis IKU: l3Id → linkedIkuId (null = tidak berbasis IKU)
  const [editL3LinkedIku, setEditL3LinkedIku] = useState<Record<number, number | null>>({});
  const [editLeafLoading, setEditLeafLoading] = useState(false);

  // Form fields
  const [jenis, setJenis] = useState<"IKU" | "PK">("IKU");
  const [nomor, setNomor] = useState("");
  const [sasaranStrategis, setSasaranStrategis] = useState("");
  const [kategori, setKategori] = useState("Wajib");
  const [collapsedMasterKat, setCollapsedMasterKat] = useState<Set<string>>(new Set());
  const [targetUniversitas, setTargetUniversitas] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [targetTahun, setTargetTahun] = useState("");
  const [selectedLevel0Id, setSelectedLevel0Id] = useState<number | "">("");
  const [groups, setGroups] = useState<IndikatorGroupForm[]>([blankGroup()]);

  // Distribusi target modal state
  const [distribusiModalOpen, setDistribusiModalOpen] = useState(false);
  const [importTurunanOpen, setImportTurunanOpen] = useState(false);

  // Import Excel state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<IndikatorImportRow[]>([]);
  const [importJenis, setImportJenis] = useState<"IKU" | "PK">("IKU");
  const [importTahun, setImportTahun] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Debounce timers per sub item id
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const refreshList = useCallback(() => {
    setLoading(true);
    getIndikator()
      .then(setIndikatorList)
      .catch(() => setIndikatorList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  useEffect(() => {
    const cy = new Date().getFullYear();
    getAvailableYears().then(dbYears => {
      const merged = [...new Set([...dbYears, String(cy - 1), String(cy), String(cy + 1)])].sort();
      setAvailableYears(merged);
      const defaultYear = merged.includes("2026") ? "2026" : (merged[merged.length - 1] ?? "2026");
      setTargetTahun(defaultYear);
    }).catch(() => {
      setAvailableYears([String(cy - 1), String(cy), String(cy + 1)]);
      setTargetTahun("2026");
    });
  }, []);

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
    const filtered = [...indikatorList.filter((i) => i.jenis === filterJenis)]
      .sort((a, b) => naturalSortKode(a.kode, b.kode));
    const level0 = filtered.filter((i) => i.level === 0);
    return level0.map((l0) => {
      const level1 = filtered.filter((i) => i.level === 1 && i.parentId === l0.id);
      return {
        record: l0,
        children: level1.map((l1) => {
          const level2 = filtered.filter((i) => i.level === 2 && i.parentId === l1.id);
          return {
            record: l1,
            children: level2.map((l2) => ({
              record: l2,
              children: filtered.filter((i) => i.level === 3 && i.parentId === l2.id),
            })),
          };
        }),
      };
    });
  };

  const hierarchy = buildHierarchy();
  const availableLevel1 = selectedLevel0Id !== ""
    ? indikatorList.filter((i) => i.level === 1 && i.parentId === selectedLevel0Id)
    : [];

  const rowsPerLevel0 = hierarchy.map((h) => {
    const entries: { key: string; text: string; level: 1 | 2 | 3 }[] = [];
    h.children.forEach((l1) => {
      entries.push({ key: `l1-${l1.record.id}`, text: `${l1.record.kode} ${l1.record.nama}`, level: 1 });
      l1.children.forEach((l2) => {
        entries.push({ key: `l2-${l2.record.id}`, text: `${l2.record.kode} ${l2.record.nama}`, level: 2 });
        if (filterJenis === 'PK') {
          l2.children.forEach((l3) => {
            entries.push({ key: `l3-${l3.id}`, text: `${l3.kode} ${l3.nama}`, level: 3 });
          });
        }
      });
    });
    if (entries.length === 0) entries.push({ key: `empty-${h.record.id}`, text: "-", level: 2 });
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
    setGroups([blankGroup()]);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = hierarchy.map((h) => h.record.id);
    setSelectedIds((prev) => prev.size === allIds.length ? new Set() : new Set(allIds));
  };

  const handleDeleteAll = async () => {
    setDeleteLoading(true);
    try {
      await deleteAllIndikator();
      toast.success("Semua data indikator berhasil dihapus.");
      setConfirmDeleteOpen(false);
      setSelectedIds(new Set());
      refreshList();
    } catch (err) {
      toast.error("Gagal menghapus: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (confirmDeleteSingleId == null) return;
    setDeleteLoading(true);
    try {
      await deleteIndikator(confirmDeleteSingleId);
      toast.success("Indikator berhasil dihapus.");
      setConfirmDeleteSingleId(null);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(confirmDeleteSingleId); return n; });
      refreshList();
    } catch (err) {
      toast.error("Gagal menghapus: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    setDeleteLoading(true);
    try {
      for (const id of selectedIds) await deleteIndikator(id);
      toast.success(`${selectedIds.size} indikator berhasil dihapus.`);
      setConfirmDeleteSelected(false);
      setSelectedIds(new Set());
      refreshList();
    } catch (err) {
      toast.error("Gagal menghapus: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (formMode === "baru") {
      if (!nomor.trim() || !sasaranStrategis.trim()) { toast.error("Nomor dan Sasaran Program wajib diisi."); return; }
      if (!targetUniversitas || isNaN(Number(targetUniversitas))) { toast.error("Target Universitas wajib diisi dengan angka."); return; }
      if (!tenggat) { toast.error("Pilih Tenggat (Triwulan) terlebih dahulu."); return; }
      for (const g of groups) {
        if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) { toast.error("Kode dan nama Indikator Kinerja Kegiatan wajib diisi."); return; }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { toast.error("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
      setSubmitLoading(true);
      try {
        const level0 = await createIndikator({ jenis, kode: nomor.trim(), nama: sasaranStrategis.trim(), tahun: targetTahun, level: 0, parentId: null, ...(jenis === 'IKU' ? { kategori } : {}) });
        for (const g of groups) {
          const level1 = await createIndikator({ jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), tahun: targetTahun, level: 1, parentId: level0.id });
          for (const s of g.subItems) {
            await createIndikator({
              jenis,
              kode: s.kodeSubIndikator.trim(),
              nama: s.subIndikatorKinerja.trim(),
              tahun: targetTahun,
              level: 2,
              parentId: level1.id,
              jenisData: s.jenisData.trim() || null,
            });
          }
        }
        await upsertTargetUniversitas(level0.id, targetTahun, Number(targetUniversitas), tenggat);
        toast.success("Indikator berhasil disimpan.");
        resetForm(); setShowForm(false); refreshList();
      } catch (err) {
        toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
      } finally { setSubmitLoading(false); }

    } else {
      if (selectedLevel0Id === "") { toast.error("Pilih Sasaran Program terlebih dahulu."); return; }
      const parentLevel0 = indikatorList.find((i) => i.id === selectedLevel0Id);
      if (!parentLevel0) return;
      for (const g of groups) {
        if (g.existingLevel1Id === null && (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim())) { toast.error("Kode dan nama Indikator Kinerja Kegiatan baru wajib diisi."); return; }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { toast.error("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
      setSubmitLoading(true);
      try {
        for (const g of groups) {
          let level1Id: number;
          if (g.existingLevel1Id !== null) {
            level1Id = g.existingLevel1Id;
          } else {
            const newL1 = await createIndikator({ jenis: parentLevel0.jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), tahun: targetTahun, level: 1, parentId: parentLevel0.id });
            level1Id = newL1.id;
          }
          for (const s of g.subItems) {
            await createIndikator({
              jenis: parentLevel0.jenis,
              kode: s.kodeSubIndikator.trim(),
              nama: s.subIndikatorKinerja.trim(),
              tahun: targetTahun,
              level: 2,
              parentId: level1Id,
              jenisData: s.jenisData.trim() || null,
            });
          }
        }
        toast.success("Indikator berhasil ditambahkan.");
        resetForm(); setShowForm(false); refreshList();
      } catch (err) {
        toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
      } finally { setSubmitLoading(false); }
    }
  };

  const fetchLeafTargets = async (row: Level0WithChildren, jenis: string, tahun: string, l3map: Record<number, Indikator[]>) => {
    setEditLeafLoading(true);
    setEditLeafTargets({});
    setEditLeafSatuan({});
    const targets: Record<number, string> = {};
    const satuans: Record<number, string> = {};
    try {
      for (const l1 of row.children) {
        for (const l2 of l1.children) {
          const l3s = l3map[l2.record.id] ?? [];
          if (jenis === 'PK' && l3s.length > 0) {
            for (const l3 of l3s) {
              try {
                const data = await getTargetUniversitas(l3.id, tahun);
                if (data && data.targetAngka) {
                  targets[l3.id] = String(data.targetAngka);
                  satuans[l3.id] = data.satuan || '';
                }
              } catch { /* skip individual failure */ }
            }
          } else {
            try {
              const data = await getTargetUniversitas(l2.record.id, tahun);
              if (data && data.targetAngka) {
                targets[l2.record.id] = String(data.targetAngka);
                satuans[l2.record.id] = data.satuan || '';
              }
            } catch { /* skip individual failure */ }
          }
        }
      }
    } finally {
      setEditLeafTargets(targets);
      setEditLeafSatuan(satuans);
      setEditLeafLoading(false);
    }
  };

  const handleEditClick = (row: Level0WithChildren) => {
    setEditRow(row);
    const tahun = availableYears.includes("2026") ? "2026" : (availableYears[availableYears.length - 1] ?? "2026");
    setEditTahun(tahun);
    setEditLeafTargets({});
    setEditLeafSatuan({});
    setEditTenggat('');

    // Single sumberData from first L1 child (or default)
    const firstL1 = row.children[0]?.record;
    setEditSumberData((firstL1 as any)?.sumberData || 'repository');

    // Build L3 map and load linkedIkuId per L3 for PK
    const l3map: Record<number, Indikator[]> = {};
    const l3LinkedIku: Record<number, number | null> = {};
    if (filterJenis === 'PK') {
      for (const l1 of row.children) {
        for (const l2 of l1.children) {
          l3map[l2.record.id] = l2.children;
          for (const l3 of l2.children) {
            l3LinkedIku[l3.id] = l3.linkedIkuId ?? null;
          }
        }
      }
    }
    setEditL3Map(l3map);
    setEditL3LinkedIku(l3LinkedIku);

    setEditMode(true);
    fetchLeafTargets(row, filterJenis, tahun, l3map);
    getTargetUniversitas(row.record.id, tahun).then(t => setEditTenggat(t?.tenggat || ''));
  };

  const handleEditTahunChange = (tahun: string) => {
    setEditTahun(tahun);
    if (editRow) {
      fetchLeafTargets(editRow, filterJenis, tahun, editL3Map);
      getTargetUniversitas(editRow.record.id, tahun).then(t => setEditTenggat(t?.tenggat || ''));
    }
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      // Save leaf-level targets + satuan (tenggat NOT saved at leaf level — it lives at L0)
      const leafUpdates = Object.entries(editLeafTargets)
        .filter(([, v]) => v.trim() !== '' && !isNaN(Number(v)))
        .map(([id, v]) => upsertTargetUniversitas(Number(id), editTahun, Number(v), undefined, editLeafSatuan[Number(id)] || undefined));
      await Promise.all(leafUpdates);

      // Save tenggat to L0 target_universitas (preserving existing persentase)
      const l0Current = await getTargetUniversitas(editRow.record.id, editTahun);
      await upsertTargetUniversitas(editRow.record.id, editTahun, l0Current?.targetAngka ?? 0, editTenggat || undefined, l0Current?.satuan || undefined);

      // Apply single sumberData to all children (L1, L2, L3)
      const allChildIds: number[] = [];
      for (const l1 of editRow.children) {
        allChildIds.push(l1.record.id);
        for (const l2 of l1.children) {
          allChildIds.push(l2.record.id);
          for (const l3 of (editL3Map[l2.record.id] ?? [])) {
            allChildIds.push(l3.id);
          }
        }
      }
      await Promise.all(allChildIds.map(id => updateIndikator(id, { sumberData: editSumberData })));

      // Save linkedIkuId per L3 for PK
      if (filterJenis === 'PK') {
        await Promise.all(
          Object.entries(editL3LinkedIku).map(([id, linkedIkuId]) =>
            updateIndikator(Number(id), { linkedIkuId })
          )
        );
      }

      toast.success("Indikator berhasil diperbarui.");
      setEditMode(false);
      setEditRow(null);
      refreshList();
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEditSaving(false);
    }
  };

  /* ─── Reusable confirm dialog ─── */
  const Confirm = ({
    open, onClose, onConfirm, title, desc, loading, confirmLabel = "Ya, Hapus",
  }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc: string; loading: boolean; confirmLabel?: string }) => {
    if (!open) return null;
    return createPortal(
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
      }}
        onClick={() => !loading && onClose()}>
        <div style={{
          background: "#fff", borderRadius: 16, padding: "32px 28px", width: 400, maxWidth: "92vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
        }} onClick={e => e.stopPropagation()}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: "#fef2f2",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px"
          }}>🗑️</div>
          <h5 style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 6px", color: "#111" }}>{title}</h5>
          <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>{desc}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={onClose} disabled={loading}
              style={{
                padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff",
                fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151"
              }}>Kembali</button>
            <button onClick={onConfirm} disabled={loading}
              style={{
                padding: "8px 22px", borderRadius: 8, border: "none", background: "#dc2626",
                fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff", opacity: loading ? 0.6 : 1
              }}>
              {loading ? "Menghapus..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const fInput: React.CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px",
    fontSize: 13, color: "#111", width: "100%", background: "#fff", outline: "none", boxSizing: "border-box"
  };
  const fLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 };

  // Gabungkan tahun dari DB + range tahun di sekitar sekarang agar bisa pilih tahun yang belum ada datanya
  const currentYear = new Date().getFullYear();
  const editModalYears = [...new Set([
    ...availableYears,
    String(currentYear - 1),
    String(currentYear),
    String(currentYear + 1),
    String(currentYear + 2),
  ])].sort();

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

      {/* ── Distribusi Target Modal ── */}
      <DistribusiTargetModal
        open={distribusiModalOpen}
        onClose={() => setDistribusiModalOpen(false)}
        defaultJenis={filterJenis}
        defaultTahun={targetTahun || String(new Date().getFullYear())}
      />

      {/* ── Import Rencana Turunan Modal ── */}
      <ImportTurunanModal
        open={importTurunanOpen}
        onClose={() => setImportTurunanOpen(false)}
        defaultTahun={targetTahun || String(new Date().getFullYear())}
      />

      {/* ── Import Excel Modal ── */}
      {importModalOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", width: "100%", maxWidth: 860, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Import Indikator dari Excel</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Upload file Excel sesuai template, lalu konfirmasi untuk menyimpan.</div>
              </div>
              <button onClick={() => setImportModalOpen(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
              {/* Jenis + Tahun selector */}
              <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>Jenis</div>
                  <select value={importJenis} onChange={e => setImportJenis(e.target.value as "IKU" | "PK")} style={{ ...inputStyle, width: "100%" }}>
                    <option value="IKU">IKU</option>
                    <option value="PK">PK</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>Tahun</div>
                  <input value={importTahun} onChange={e => setImportTahun(e.target.value)} placeholder="2026" style={{ ...inputStyle }} />
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>File Excel</div>
                  <input ref={importFileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImportFileError(null);
                      setImportRows([]);
                      try {
                        const rows = await parseIndikatorExcel(file);
                        if (rows.length === 0) { setImportFileError("Tidak ada data yang terbaca dari file ini."); return; }
                        setImportRows(rows);
                      } catch (err: any) {
                        setImportFileError(err.message ?? "Gagal membaca file.");
                      }
                      e.target.value = "";
                    }}
                  />
                  <button onClick={() => importFileRef.current?.click()}
                    style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: 13, cursor: "pointer", fontWeight: 600, color: "#374151" }}>
                    Pilih File...
                  </button>
                  {importFileError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{importFileError}</div>}
                </div>
              </div>

              {/* Preview table */}
              {importRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                    Preview — {importRows.length} baris akan diimpor
                  </div>
                  <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          {["Kode", "Nama", "Level", "Parent", "Kategori", "Tenggat", "Target", "Satuan", "Sumber"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: r.level === 0 ? "#fef9f0" : r.level === 1 ? "#f9fafb" : "#fff" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 700, color: importJenis === "IKU" ? "#FF7900" : "#7c3aed" }}>{r.kode}</td>
                            <td style={{ padding: "6px 10px", paddingLeft: 10 + r.level * 12 }}>{r.nama}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>L{r.level}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.parentKode ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.kategori ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.tenggat ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.target ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.satuan ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.sumberData}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setImportModalOpen(false)} disabled={importLoading}
                style={{ padding: "8px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                Batal
              </button>
              <button
                disabled={importRows.length === 0 || importLoading || !importTahun}
                onClick={async () => {
                  if (!token) { toast.error("Token tidak ditemukan, silakan login ulang."); return; }
                  setImportLoading(true);
                  try {
                    const result = await importIndikatorBulk(importJenis, importTahun, importRows, token);
                    if (result.errors.length > 0) {
                      toast.error(`Import selesai dengan ${result.errors.length} error. ${result.errors[0]}`);
                    } else {
                      toast.success(`${result.imported} indikator berhasil diimpor.`);
                    }
                    setImportModalOpen(false);
                    refreshList();
                  } catch {
                    toast.error("Import gagal, coba lagi.");
                  } finally {
                    setImportLoading(false);
                  }
                }}
                style={{ padding: "8px 24px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: importRows.length === 0 || importLoading ? "not-allowed" : "pointer", background: importRows.length === 0 || importLoading ? "#d1d5db" : "#16a34a", color: "#fff" }}>
                {importLoading ? "Menyimpan..." : `Simpan ${importRows.length} Indikator`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Confirm Dialogs ── */}
      <Confirm open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteAll} title="Hapus Semua Data?"
        desc="Semua data indikator beserta target terkait akan dihapus permanen." loading={deleteLoading} />
      <Confirm open={confirmDeleteSingleId != null} onClose={() => setConfirmDeleteSingleId(null)}
        onConfirm={handleDeleteSingle} title="Hapus Indikator?"
        desc="Indikator beserta seluruh data turunannya akan dihapus permanen." loading={deleteLoading} />
      <Confirm open={confirmDeleteSelected} onClose={() => setConfirmDeleteSelected(false)}
        onConfirm={handleDeleteSelected} title={`Hapus ${selectedIds.size} Indikator?`}
        desc={`${selectedIds.size} indikator terpilih beserta data turunannya akan dihapus.`}
        loading={deleteLoading} confirmLabel={`Hapus ${selectedIds.size} Item`} />

      {/* ── Edit Inline Page ── */}
      {editMode && editRow && (() => {
        const ikuLeafList = indikatorList.filter(i => i.jenis === 'IKU' && i.level === 2);
        return (
          <div>
            {/* Back + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <button
                onClick={() => !editSaving && setEditMode(false)}
                disabled={editSaving}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                ← Kembali
              </button>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>Edit Indikator</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {editRow.record.kode} — {editRow.record.nama}
                </p>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px 28px", marginBottom: 16 }}>
              {/* Tahun + Tenggat */}
              <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={fLabel}>Tahun</label>
                  <select value={editTahun} onChange={(e) => handleEditTahunChange(e.target.value)} style={{ ...fInput, maxWidth: 160 }}>
                    {editModalYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fLabel}>Tenggat (Batas Waktu)</label>
                  <input type="date" value={editTenggat} onChange={(e) => setEditTenggat(e.target.value)} style={{ ...fInput, maxWidth: 200 }} />
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6", marginBottom: 20 }} />

              {/* Sumber Data */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ width: 3, height: 14, borderRadius: 2, background: "#6366f1", display: "inline-block" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sumber Data Realisasi</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <select value={editSumberData} onChange={(e) => setEditSumberData(e.target.value)}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#374151", background: "#fff", cursor: "pointer" }}>
                    <option value="repository">Repository FIK</option>
                    <option value="ikupk">IKU PK (Upload)</option>
                  </select>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Berlaku untuk semua sub-indikator</span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f3f4f6", marginBottom: 20 }} />

              {/* Target per leaf */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ width: 3, height: 14, borderRadius: 2, background: "#059669", display: "inline-block" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Target per {filterJenis === 'PK' ? 'Rincian (Level 3)' : 'Sub-Indikator (Level 2)'}
                  </span>
                  {editLeafLoading && <span style={{ fontSize: 11, color: "#9ca3af" }}>Memuat…</span>}
                </div>

                {editRow.children.length === 0 && (
                  <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>Tidak ada sub-indikator.</p>
                )}

                {editRow.children.map((l1) => (
                  <div key={l1.record.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, marginBottom: 6, border: "1px solid #e5e7eb" }}>
                      <span style={{ width: 3, height: 12, borderRadius: 2, flexShrink: 0, background: filterJenis === "IKU" ? "#FF7900" : "#7c3aed" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{l1.record.kode} {l1.record.nama}</span>
                    </div>
                    {l1.children.length === 0 && (
                      <p style={{ fontSize: 12, color: "#9ca3af", paddingLeft: 20, fontStyle: "italic" }}>Tidak ada sub-indikator level 2.</p>
                    )}
                    {l1.children.map((l2) => {
                      const l3s = editL3Map[l2.record.id] ?? [];
                      const showL3 = filterJenis === 'PK' && l3s.length > 0;
                      return (
                        <div key={l2.record.id} style={{ paddingLeft: 16, marginBottom: showL3 ? 10 : 0 }}>
                          {showL3 ? (
                            <>
                              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, padding: "6px 0 4px", borderBottom: "1px dashed #e5e7eb", marginBottom: 6 }}>
                                {l2.record.kode} {l2.record.nama}
                              </div>
                              {l3s.map((l3) => {
                                const isLinked = editL3LinkedIku[l3.id] !== null && editL3LinkedIku[l3.id] !== undefined;
                                return (
                                  <div key={l3.id} style={{ padding: "10px 0 10px 14px", borderBottom: "1px solid #f9fafb" }}>
                                    {/* L3 name + target + satuan */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                      <span style={{ color: "#d1d5db", fontSize: 11, fontFamily: "monospace", flexShrink: 0 }}>└─</span>
                                      <span style={{ fontSize: 12, color: "#374151", flex: 1 }}>{l3.kode} {l3.nama}</span>
                                      <input type="number" min={0}
                                        value={editLeafTargets[l3.id] ?? ''}
                                        onChange={(e) => setEditLeafTargets(prev => ({ ...prev, [l3.id]: e.target.value }))}
                                        placeholder="Target" disabled={editLeafLoading}
                                        style={{ width: 90, border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 10px", fontSize: 13, textAlign: "right", background: editLeafLoading ? "#f9fafb" : "#fff" }}
                                      />
                                      <select value={editLeafSatuan[l3.id] ?? ''}
                                        onChange={(e) => setEditLeafSatuan(prev => ({ ...prev, [l3.id]: e.target.value }))}
                                        disabled={editLeafLoading}
                                        style={{ width: 110, border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: editLeafLoading ? "#f9fafb" : "#fff", color: "#374151" }}>
                                        <option value="">— Satuan —</option>
                                        {SATUAN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    </div>
                                    {/* Berbasis IKU toggle */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 20 }}>
                                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 600 }}>
                                        <input type="checkbox" checked={isLinked}
                                          onChange={() => setEditL3LinkedIku(prev => ({
                                            ...prev,
                                            [l3.id]: isLinked ? null : (ikuLeafList[0]?.id ?? null),
                                          }))}
                                          style={{ cursor: "pointer", accentColor: "#7c3aed" }}
                                        />
                                        Berbasis IKU
                                      </label>
                                      {isLinked && (
                                        <select
                                          value={editL3LinkedIku[l3.id] ?? ''}
                                          onChange={(e) => setEditL3LinkedIku(prev => ({ ...prev, [l3.id]: Number(e.target.value) || null }))}
                                          style={{ border: "1px solid #c4b5fd", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#374151", background: "#faf5ff", flex: 1, maxWidth: 400 }}
                                        >
                                          <option value="">— Pilih Indikator IKU —</option>
                                          {ikuLeafList.map(iku => (
                                            <option key={iku.id} value={iku.id}>{iku.kode} {iku.nama}</option>
                                          ))}
                                        </select>
                                      )}
                                      {isLinked && (
                                        <span style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: 4, padding: "2px 8px" }}>
                                          File diambil dari folder IKU
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0" }}>
                              <span style={{ color: "#d1d5db", fontSize: 11, fontFamily: "monospace", flexShrink: 0 }}>└─</span>
                              <span style={{ fontSize: 12, color: "#374151", flex: 1 }}>{l2.record.kode} {l2.record.nama}</span>
                              <input type="number" min={0}
                                value={editLeafTargets[l2.record.id] ?? ''}
                                onChange={(e) => setEditLeafTargets(prev => ({ ...prev, [l2.record.id]: e.target.value }))}
                                placeholder="Target" disabled={editLeafLoading}
                                style={{ width: 90, border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 10px", fontSize: 13, textAlign: "right", background: editLeafLoading ? "#f9fafb" : "#fff" }}
                              />
                              <select value={editLeafSatuan[l2.record.id] ?? ''}
                                onChange={(e) => setEditLeafSatuan(prev => ({ ...prev, [l2.record.id]: e.target.value }))}
                                disabled={editLeafLoading}
                                style={{ width: 110, border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: editLeafLoading ? "#f9fafb" : "#fff", color: "#374151" }}>
                                <option value="">— Satuan —</option>
                                {SATUAN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Save button row */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setEditMode(false)} disabled={editSaving}
                style={{ padding: "9px 22px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                Kembali
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: editSaving ? "#d1d5db" : "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: editSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {editSaving ? "Menyimpan…" : "✓ Simpan Perubahan"}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Main content (hidden while in edit mode) ── */}
      {!editMode && <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="ikupk-card-title">Master Indikator</h3>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Daftar Sasaran Program dan hierarki indikator kinerja.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectedIds.size > 0 && (
            <button onClick={() => setConfirmDeleteSelected(true)}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none", background: "#dc2626",
                fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#fff"
              }}>
              Hapus ({selectedIds.size})
            </button>
          )}
          <button onClick={() => setConfirmDeleteOpen(true)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #fca5a5",
              background: "#fff7f7", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#dc2626"
            }}>
            Hapus Semua
          </button>
          <button
            onClick={() => setDistribusiModalOpen(true)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #16a34a", background: "#f0fdf4", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#15803d" }}>
            Distribusi Target
          </button>
          <button
            onClick={() => setImportTurunanOpen(true)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #FF7900", background: "#fff8f0", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#c05a00" }}>
            Import Turunan
          </button>
          <button
            onClick={() => {
              setImportJenis(filterJenis);
              setImportTahun(targetTahun || String(new Date().getFullYear()));
              setImportRows([]);
              setImportFileError(null);
              setImportModalOpen(true);
            }}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #0284c7", background: "#f0f9ff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#0369a1" }}>
            Import Indikator
          </button>
          <button onClick={() => { window.location.href = "/admin/master-indikator/tambah"; }}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none", background: "#FF7900",
              fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#fff"
            }}>
            + Tambah
          </button>
        </div>
      </div>

      {/* ── Jenis Toggle ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "inline-flex", background: "#f3f4f6", borderRadius: 10, padding: 3, gap: 2 }}>
          {(["IKU", "PK"] as const).map(j => (
            <button key={j} onClick={() => setFilterJenis(j)}
              style={{
                padding: "6px 18px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: filterJenis === j ? (j === "IKU" ? "#FF7900" : "#7c3aed") : "transparent",
                color: filterJenis === j ? "#fff" : "#6b7280", transition: "all 0.15s"
              }}>
              {j === "IKU" ? "Indikator Kinerja Utama" : "Perjanjian Kinerja"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          <b style={{ color: "#374151" }}>{hierarchy.length}</b> Sasaran Program
        </span>
      </div>

      {/* ── Table Card ── */}
      <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {loading && (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "#9ca3af" }}>
            <div className="spinner-border spinner-border-sm text-secondary me-2" />
            <span style={{ fontSize: 14 }}>Memuat data indikator...</span>
          </div>
        )}
        {!loading && hierarchy.length === 0 && (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.35 }}>📋</div>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>Belum Ada Indikator</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Klik "+ Tambah" untuk membuat indikator baru.</div>
          </div>
        )}
        {!loading && hierarchy.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
                  <th style={{ padding: "11px 14px", textAlign: "center", width: 44 }}>
                    <input type="checkbox"
                      checked={selectedIds.size === hierarchy.length && hierarchy.length > 0}
                      onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
                  </th>
                  {[
                    { label: "Kode", w: "8%" }, { label: "Sasaran Program", w: "26%" },
                    { label: filterJenis === "IKU" ? "Indikator Kinerja" : "Indikator PK", w: "auto" },
                    { label: "Aksi", w: "9%" },
                  ].map((h, i) => (
                    <th key={i} style={{
                      padding: "11px 14px", fontSize: 11, fontWeight: 700, color: "#9ca3af",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: i === 3 ? "center" : "left", width: h.w, whiteSpace: "nowrap"
                    }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const KAT_ORDER = ['Wajib', 'Pilihan', 'Partisipatif'];
                  const KAT_LABEL: Record<string, string> = { Wajib: 'A. WAJIB', Pilihan: 'B. PILIHAN', Partisipatif: 'C. PARTISIPATIF' };
                  const IKU_KAT: Record<string, string> = { '1':'Wajib','2':'Wajib','3':'Wajib','5':'Wajib','7':'Wajib','4':'Pilihan','6':'Pilihan','8':'Pilihan','10':'Pilihan' };

                  const renderRows = (rows: typeof rowsPerLevel0): React.ReactNode[] =>
                    rows.flatMap((row, rowGroupIdx) => {
                      const level0Group = hierarchy.find(h => h.record.id === row.parent.id) ?? null;
                      const isLastGroup = rowGroupIdx === rows.length - 1;
                      return row.entries.map((entry, idx) => (
                        <tr key={`${row.parent.id}-${entry.key}`} style={{ borderBottom: idx === row.entries.length - 1 && !isLastGroup ? "2px solid #f0f0f0" : "1px solid #f8f8f8" }}>
                          {idx === 0 && <td rowSpan={row.entries.length} style={{ padding: 14, textAlign: "center", verticalAlign: "middle" }}><input type="checkbox" checked={selectedIds.has(row.parent.id)} onChange={() => toggleSelect(row.parent.id)} style={{ cursor: "pointer" }} /></td>}
                          {idx === 0 && <td rowSpan={row.entries.length} style={{ padding: "14px", verticalAlign: "top", fontFamily: "monospace", fontWeight: 700, color: "#374151", fontSize: 13, borderRight: "1px solid #f3f4f6" }}>{row.parent.kode}</td>}
                          {idx === 0 && <td rowSpan={row.entries.length} style={{ padding: "14px", verticalAlign: "top", borderRight: "1px solid #f3f4f6" }}><span style={{ fontWeight: 700, fontSize: 13, color: "#111", lineHeight: 1.5 }}>{row.parent.nama}</span></td>}
                          <td style={{ padding: 0 }}>
                            {entry.level === 1 ? (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px 11px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ width: 3, height: 14, borderRadius: 2, flexShrink: 0, background: filterJenis === "IKU" ? "#FF7900" : "#7c3aed" }} />
                                  <span style={{ fontWeight: 600, color: "#1f2937", fontSize: 12 }}>{entry.text}</span>
                                </div>
                                <button
                                  onClick={() => { const l1Id = entry.key.split('-')[1]; window.location.href = `/admin/master-indikator/${l1Id}/cascade?jenis=${filterJenis}&tahun=${targetTahun}`; }}
                                  style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", whiteSpace: "nowrap" }}
                                >
                                  Alur
                                </button>
                              </div>
                            ) : entry.level === 2 ? (
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "7px 14px 7px 40px" }}>
                                <span style={{ color: "#d1d5db", fontSize: 11, lineHeight: "1.7", flexShrink: 0, fontFamily: "monospace" }}>└─</span>
                                <span style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5 }}>{entry.text}</span>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "7px 14px 7px 64px" }}>
                                <span style={{ color: "#e5e7eb", fontSize: 11, lineHeight: "1.7", flexShrink: 0, fontFamily: "monospace" }}>└─</span>
                                <span style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5 }}>{entry.text}</span>
                              </div>
                            )}
                          </td>
                          {idx === 0 && level0Group && (
                            <td rowSpan={row.entries.length} style={{ padding: "14px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid #f3f4f6" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
                                <button onClick={() => handleEditClick(level0Group)} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151", width: "100%" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "#d1d5db")} onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>Edit</button>
                                <button onClick={() => setConfirmDeleteSingleId(row.parent.id)} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #fca5a5", background: "#fff7f7", color: "#dc2626", width: "100%" }} onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")} onMouseLeave={e => (e.currentTarget.style.background = "#fff7f7")}>Hapus</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ));
                    });

                  if (filterJenis !== 'IKU') return renderRows(rowsPerLevel0);

                  const grouped: Record<string, typeof rowsPerLevel0> = { Wajib: [], Pilihan: [], Partisipatif: [] };
                  rowsPerLevel0.forEach(r => { const raw = r.parent.kategori || IKU_KAT[r.parent.kode] || 'Partisipatif'; const k = KAT_ORDER.includes(raw) ? raw : 'Partisipatif'; grouped[k].push(r); });
                  return KAT_ORDER.flatMap(kat => {
                    const items = grouped[kat];
                    if (items.length === 0) return [];
                    const isCollapsed = collapsedMasterKat.has(kat);
                    return [
                      <tr key={`master-kat-${kat}`} onClick={() => setCollapsedMasterKat(prev => { const s = new Set(prev); s.has(kat) ? s.delete(kat) : s.add(kat); return s; })} style={{ background: "#1e3a5f", cursor: "pointer", userSelect: "none" }}>
                        <td colSpan={5} style={{ padding: "9px 16px", color: "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em" }}>
                          <span style={{ marginRight: 8, fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
                          {KAT_LABEL[kat]}
                        </td>
                      </tr>,
                      ...(isCollapsed ? [] : renderRows(items)),
                    ];
                  });
                })()}
              </tbody>
              <tfoot>
                <tr style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
                  <td colSpan={5} style={{ padding: "10px 14px", fontSize: 12, color: "#9ca3af" }}>
                    <b>{rowsPerLevel0.length}</b> Sasaran Program · <b>{hierarchy.reduce((a, h) => a + h.children.length, 0)}</b> indikator kinerja
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
                    <option value="PK">Perjanjian Kinerja (PK)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tahun Target</label>
                  <select value={targetTahun} onChange={(e) => setTargetTahun(e.target.value)} style={inputStyle}>
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
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

              {/* Nomor + Sasaran Program + Kategori (IKU) + Target Universitas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 16, marginBottom: jenis === "IKU" ? 8 : 16 }}>
                <div>
                  <label style={labelStyle}>Nomor</label>
                  <input type="text" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="contoh: 1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sasaran Program</label>
                  <input type="text" value={sasaranStrategis} onChange={(e) => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Target Universitas</label>
                  <input
                    type="number"
                    min={0}
                    value={targetUniversitas}
                    onChange={(e) => setTargetUniversitas(e.target.value)}
                    placeholder="contoh: 80"
                    style={inputStyle}
                  />
                </div>
              </div>

              {jenis === "IKU" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Kategori</label>
                  <select value={kategori} onChange={(e) => setKategori(e.target.value)} style={inputStyle}>
                    <option value="Wajib">A. Wajib</option>
                    <option value="Pilihan">B. Pilihan</option>
                    <option value="Partisipatif">C. Partisipatif</option>
                  </select>
                </div>
              )}

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
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <label style={labelStyle}>Pilih Sasaran Program (Level 0)</label>
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
      </>}
    </div>
  );
}
