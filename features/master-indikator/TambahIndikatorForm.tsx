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

type NavEntry = { id: number | null; nama: string; kode: string };
type Level3Item = { id: number; kode: string; nama: string };
type SubItem = {
  id: number; kodeSubIndikator: string; subIndikatorKinerja: string;
  jenisData: string; baseline: number | null | string;
  baselineLoading: boolean; level3Items: Level3Item[];
};
type Group = { id: number; kodeIndikator: string; indikatorKinerja: string; subItems: SubItem[] };

const blankL3 = (): Level3Item => ({ id: nextId(), kode: "", nama: "" });
const blankSub = (): SubItem => ({
  id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "",
  jenisData: "", baseline: null, baselineLoading: false, level3Items: [blankL3()],
});
const blankGroup = (): Group => ({
  id: nextId(), kodeIndikator: "", indikatorKinerja: "", subItems: [blankSub()],
});
const blankNav = (): NavEntry => ({ id: null, nama: "", kode: "" });

// ─────────────────────────────────────────
//  ComboBox — searchable + creatable
// ─────────────────────────────────────────
function ComboBox({
  value, onSelect, options, placeholder, disabled,
}: {
  value: NavEntry;
  onSelect: (entry: NavEntry) => void;
  options: Indikator[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value.nama);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value.nama); }, [value.nama]);

  const filtered = query.trim()
    ? options.filter(o => `${o.kode} ${o.nama}`.toLowerCase().includes(query.toLowerCase()))
    : options;

  const hasExactMatch = options.some(
    o => o.nama.toLowerCase() === query.trim().toLowerCase()
  );
  const showCreate = query.trim().length > 0 && !hasExactMatch;

  function pickExisting(o: Indikator) {
    setQuery(o.nama);
    onSelect({ id: o.id, nama: o.nama, kode: o.kode });
    setOpen(false);
  }

  function pickNew() {
    onSelect({ id: null, nama: query.trim(), kode: value.kode });
    setOpen(false);
  }

  const showDropdown = open && !disabled && (filtered.length > 0 || showCreate);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelect({ id: null, nama: e.target.value, kode: value.kode });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          placeholder={disabled ? "Pilih level di atas terlebih dahulu" : placeholder}
          className="form-input"
          style={{ paddingRight: 32, backgroundColor: disabled ? "#f9fafb" : undefined, cursor: disabled ? "not-allowed" : undefined }}
          autoComplete="off"
        />
        <span style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          color: "#9ca3af", fontSize: 10, pointerEvents: "none", lineHeight: 1,
        }}>▾</span>
      </div>

      {showDropdown && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.09)", overflow: "hidden", maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.length === 0 && !showCreate && (
            <div style={{ padding: "10px 14px", fontSize: 13, color: "#9ca3af" }}>Tidak ada data</div>
          )}
          {filtered.slice(0, 10).map(o => (
            <button key={o.id} type="button"
              onMouseDown={() => pickExisting(o)}
              style={{
                display: "flex", alignItems: "baseline", gap: 8, width: "100%",
                textAlign: "left", padding: "10px 14px", border: "none",
                background: "none", cursor: "pointer", fontSize: 13,
                borderBottom: "1px solid #f9fafb",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", flexShrink: 0 }}>{o.kode}</span>
              <span style={{ color: "#111827" }}>{o.nama}</span>
            </button>
          ))}
          {showCreate && (
            <button type="button"
              onMouseDown={pickNew}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                textAlign: "left", padding: "10px 14px", border: "none",
                background: "none", cursor: "pointer", fontSize: 13, color: "#2563eb",
                borderTop: filtered.length > 0 ? "1px solid #f3f4f6" : "none",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#eff6ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 13 }}>+</span>
              Buat baru &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
//  Small kode input shown when entry is new
// ─────────────────────────────────────────
function KodeHint({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>Kode:</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="contoh: 1.1"
        className="form-input"
        style={{ fontSize: 12, padding: "5px 10px", maxWidth: 120 }}
      />
      <span style={{ fontSize: 11, color: "#9ca3af" }}>akan dibuat baru</span>
    </div>
  );
}

// ─────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────
export default function TambahIndikatorForm() {
  const router = useRouter();

  const [jenis, setJenis] = useState("IKU");
  const [targetTahun, setTargetTahun] = useState(String(new Date().getFullYear()));
  const [submitLoading, setSubmitLoading] = useState(false);
  const [baselineOptions, setBaselineOptions] = useState<BaselineData[]>([]);
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const [mode, setMode] = useState<"new" | "append">("new");

  // ── New mode ──
  const [nomor, setNomor] = useState("");
  const [sasaranStrategis, setSasaranStrategis] = useState("");
  const [targetUniversitas, setTargetUniversitas] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [groups, setGroups] = useState<Group[]>([blankGroup()]);

  // ── Append mode navigation ──
  const [allIndikators, setAllIndikators] = useState<Indikator[]>([]);
  const [appendL0Id, setAppendL0Id] = useState<number | null>(null);
  const [nav1, setNav1] = useState<NavEntry>(blankNav()); // L1
  const [nav2, setNav2] = useState<NavEntry>(blankNav()); // L2

  // ── Append form data (what to create below the nav) ──
  const [appendSubs, setAppendSubs] = useState<SubItem[]>([blankSub()]);
  const [appendL3Items, setAppendL3Items] = useState<Level3Item[]>([blankL3()]);

  // Derived options for comboboxes
  const existingL0 = allIndikators.filter(i => i.level === 0 && i.jenis === jenis);
  const existingL1 = allIndikators.filter(i => i.level === 1 && i.parentId === appendL0Id);
  const existingL2 = nav1.id !== null
    ? allIndikators.filter(i => i.level === 2 && i.parentId === nav1.id)
    : [];

  // Is nav1/nav2 "active" (has a value)
  const nav1Active = nav1.nama.trim() !== "";
  const nav2Active = nav2.nama.trim() !== "";

  // Which level form to show below navigation
  // no nav1 → show groups (L1+L2), nav1 but no nav2 → show L2 subs, nav1+nav2 → show L3
  const appendFormLevel = !nav1Active ? "L1" : !nav2Active ? "L2" : "L3";

  useEffect(() => {
    getAllBaselineData(targetTahun).then(setBaselineOptions).catch(() => setBaselineOptions([]));
  }, [targetTahun]);

  useEffect(() => {
    if (mode !== "append") return;
    getIndikator(targetTahun).then(setAllIndikators).catch(() => setAllIndikators([]));
    setAppendL0Id(null);
    setNav1(blankNav());
    setNav2(blankNav());
  }, [mode, targetTahun, jenis]);

  useEffect(() => { setNav1(blankNav()); setNav2(blankNav()); }, [appendL0Id]);
  useEffect(() => { setNav2(blankNav()); }, [nav1.id]);

  // ── Group (L1+L2) handlers ──
  const addGroup = () => setGroups(p => [...p, blankGroup()]);
  const removeGroup = (id: number) => setGroups(p => p.filter(g => g.id !== id));
  const updateGroup = (id: number, field: string, val: string) =>
    setGroups(p => p.map(g => g.id === id ? { ...g, [field]: val } : g));
  const addSub = (gid: number) =>
    setGroups(p => p.map(g => g.id === gid ? { ...g, subItems: [...g.subItems, blankSub()] } : g));
  const removeSub = (gid: number, sid: number) =>
    setGroups(p => p.map(g => g.id === gid ? { ...g, subItems: g.subItems.filter(s => s.id !== sid) } : g));
  const updateSub = (gid: number, sid: number, field: string, val: string) =>
    setGroups(p => p.map(g => g.id === gid ? {
      ...g, subItems: g.subItems.map(s => s.id === sid ? { ...s, [field]: val } : s),
    } : g));
  const addSubL3 = (gid: number, sid: number) =>
    setGroups(p => p.map(g => g.id === gid ? {
      ...g, subItems: g.subItems.map(s => s.id === sid ? { ...s, level3Items: [...s.level3Items, blankL3()] } : s),
    } : g));
  const removeSubL3 = (gid: number, sid: number, lid: number) =>
    setGroups(p => p.map(g => g.id === gid ? {
      ...g, subItems: g.subItems.map(s => s.id === sid ? {
        ...s, level3Items: s.level3Items.filter(l => l.id !== lid),
      } : s),
    } : g));
  const updateSubL3 = (gid: number, sid: number, lid: number, field: "kode" | "nama", val: string) =>
    setGroups(p => p.map(g => g.id === gid ? {
      ...g, subItems: g.subItems.map(s => s.id === sid ? {
        ...s, level3Items: s.level3Items.map(l => l.id === lid ? { ...l, [field]: val } : l),
      } : s),
    } : g));

  // ── AppendSubs handlers ──
  const addAppendSub = () => setAppendSubs(p => [...p, blankSub()]);
  const removeAppendSub = (id: number) => setAppendSubs(p => p.filter(s => s.id !== id));
  const updateAppendSub = (id: number, field: string, val: string) =>
    setAppendSubs(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));
  const addAppendSubL3 = (sid: number) =>
    setAppendSubs(p => p.map(s => s.id === sid ? { ...s, level3Items: [...s.level3Items, blankL3()] } : s));
  const removeAppendSubL3 = (sid: number, lid: number) =>
    setAppendSubs(p => p.map(s => s.id === sid ? { ...s, level3Items: s.level3Items.filter(l => l.id !== lid) } : s));
  const updateAppendSubL3 = (sid: number, lid: number, field: "kode" | "nama", val: string) =>
    setAppendSubs(p => p.map(s => s.id === sid ? {
      ...s, level3Items: s.level3Items.map(l => l.id === lid ? { ...l, [field]: val } : l),
    } : s));

  // ── Baseline helpers ──
  function triggerBaseline(val: string, id: number, setter: React.Dispatch<React.SetStateAction<SubItem[]>>) {
    clearTimeout(debounceRefs.current[id]);
    debounceRefs.current[id] = setTimeout(async () => {
      if (!val.trim()) return;
      setter(p => p.map(s => s.id === id ? { ...s, baselineLoading: true } : s));
      try {
        const result = await getBaselineByJenisData(val.trim(), targetTahun);
        setter(p => p.map(s => s.id === id ? { ...s, baseline: result?.jumlah ?? null, baselineLoading: false } : s));
      } catch {
        setter(p => p.map(s => s.id === id ? { ...s, baseline: null, baselineLoading: false } : s));
      }
    }, 600);
  }

  const handleGroupBaseline = (gid: number, sid: number, val: string) => {
    updateSub(gid, sid, "jenisData", val);
    triggerBaseline(val, sid, fn => setGroups(p => p.map(g => g.id === gid ? { ...g, subItems: fn(g.subItems) } : g)));
  };

  const handleAppendSubBaseline = (sid: number, val: string) => {
    updateAppendSub(sid, "jenisData", val);
    triggerBaseline(val, sid, setAppendSubs);
  };

  // ── Submit ──
  async function handleSubmit() {
    if (mode === "new") {
      if (!nomor.trim() || !sasaranStrategis.trim()) { toast.error("Nomor dan Sasaran Strategis wajib diisi."); return; }
      if (!targetUniversitas || isNaN(Number(targetUniversitas)) || Number(targetUniversitas) < 0) { toast.error("Target Universitas wajib diisi."); return; }
      if (!tenggat) { toast.error("Pilih Tenggat terlebih dahulu."); return; }
      for (const g of groups) {
        if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) { toast.error("Kode dan nama Level 1 wajib diisi."); return; }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { toast.error("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
    } else {
      if (!appendL0Id) { toast.error("Pilih Sasaran Strategis terlebih dahulu."); return; }
      if (appendFormLevel === "L2" || appendFormLevel === "L3") {
        if (!nav1.nama.trim()) { toast.error("Isi Level 1 terlebih dahulu."); return; }
        if (nav1.id === null && !nav1.kode.trim()) { toast.error("Isi kode untuk Level 1 baru."); return; }
      }
      if (appendFormLevel === "L3") {
        if (!nav2.nama.trim()) { toast.error("Isi Level 2 terlebih dahulu."); return; }
        if (nav2.id === null && !nav2.kode.trim()) { toast.error("Isi kode untuk Level 2 baru."); return; }
        if (jenis !== "PK") { toast.error("Level 3 hanya tersedia untuk Perjanjian Kerja (PK)."); return; }
      }
      if (appendFormLevel === "L2") {
        for (const s of appendSubs) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { toast.error("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
      if (appendFormLevel === "L1") {
        for (const g of groups) {
          if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) { toast.error("Kode dan nama Level 1 wajib diisi."); return; }
          for (const s of g.subItems) {
            if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { toast.error("Kode dan nama Sub Indikator wajib diisi."); return; }
          }
        }
      }
      if (appendFormLevel === "L3") {
        if (!appendL3Items.some(l => l.kode.trim() && l.nama.trim())) { toast.error("Isi minimal satu rincian Level 3."); return; }
      }
    }

    setSubmitLoading(true);
    try {
      if (mode === "new") {
        const l0 = await createIndikator({ jenis, kode: nomor.trim(), nama: sasaranStrategis.trim(), tahun: targetTahun, level: 0, parentId: null });
        await upsertTargetUniversitas(l0.id, targetTahun, Number(targetUniversitas), tenggat);
        await saveGroupsUnder(l0.id, groups);
      } else {
        if (appendFormLevel === "L1") {
          await saveGroupsUnder(appendL0Id!, groups);
        } else if (appendFormLevel === "L2") {
          // Resolve L1
          let l1Id: number;
          if (nav1.id !== null) {
            l1Id = nav1.id;
          } else {
            const l1 = await createIndikator({ jenis, kode: nav1.kode.trim(), nama: nav1.nama.trim(), tahun: targetTahun, level: 1, parentId: appendL0Id! });
            l1Id = l1.id;
          }
          await saveSubsUnder(l1Id, appendSubs);
        } else if (appendFormLevel === "L3") {
          // Resolve L1
          let l1Id: number;
          if (nav1.id !== null) { l1Id = nav1.id; }
          else {
            const l1 = await createIndikator({ jenis, kode: nav1.kode.trim(), nama: nav1.nama.trim(), tahun: targetTahun, level: 1, parentId: appendL0Id! });
            l1Id = l1.id;
          }
          // Resolve L2
          let l2Id: number;
          if (nav2.id !== null) { l2Id = nav2.id; }
          else {
            const l2 = await createIndikator({ jenis, kode: nav2.kode.trim(), nama: nav2.nama.trim(), tahun: targetTahun, level: 2, parentId: l1Id });
            l2Id = l2.id;
          }
          // Create L3
          for (const l3 of appendL3Items) {
            if (l3.kode.trim() && l3.nama.trim()) {
              await createIndikator({ jenis, kode: l3.kode.trim(), nama: l3.nama.trim(), tahun: targetTahun, level: 3, parentId: l2Id });
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
  }

  async function saveGroupsUnder(parentId: number, gs: Group[]) {
    for (const g of gs) {
      const l1 = await createIndikator({ jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), tahun: targetTahun, level: 1, parentId });
      await saveSubsUnder(l1.id, g.subItems);
    }
  }

  async function saveSubsUnder(parentId: number, subs: SubItem[]) {
    for (const s of subs) {
      const l2 = await createIndikator({
        jenis, kode: s.kodeSubIndikator.trim(), nama: s.subIndikatorKinerja.trim(),
        tahun: targetTahun, level: 2, parentId, jenisData: s.jenisData.trim() || null,
      });
      if (jenis === "PK") {
        for (const l3 of s.level3Items) {
          if (l3.kode.trim() && l3.nama.trim()) {
            await createIndikator({ jenis, kode: l3.kode.trim(), nama: l3.nama.trim(), tahun: targetTahun, level: 3, parentId: l2.id });
          }
        }
      }
    }
  }

  // ── Sub item renderer (reused by groups and appendSubs) ──
  function SubItemRow({
    sub, idx, total, parentKode,
    onUpdateField, onBaselineChange, onRemove,
    onAddL3, onRemoveL3, onUpdateL3,
  }: {
    sub: SubItem; idx: number; total: number; parentKode: string;
    onUpdateField: (f: string, v: string) => void;
    onBaselineChange: (v: string) => void;
    onRemove: (() => void) | null;
    onAddL3: () => void; onRemoveL3: (id: number) => void;
    onUpdateL3: (id: number, f: "kode" | "nama", v: string) => void;
  }) {
    return (
      <div className="form-sub-item">
        <div className="form-row form-row--kode" style={{ marginBottom: 10 }}>
          <div className="form-field">
            <label>Kode</label>
            <input className="form-input" type="text" value={sub.kodeSubIndikator}
              onChange={e => onUpdateField("kodeSubIndikator", e.target.value)}
              placeholder={`${parentKode}.${idx + 1}`} />
          </div>
          <div className="form-sub-name-row">
            <div className="form-field">
              <label>Nama Sub Indikator</label>
              <input className="form-input" type="text" value={sub.subIndikatorKinerja}
                onChange={e => onUpdateField("subIndikatorKinerja", e.target.value)}
                placeholder="contoh: Lulusan bekerja dalam 6 bulan" />
            </div>
            {onRemove && total > 1 && (
              <button type="button" className="form-remove-icon" onClick={onRemove}>−</button>
            )}
          </div>
        </div>
        <div className="form-row--baseline">
          <div className="form-field">
            <label>Jenis Data (baseline)</label>
            <select className="form-input" value={sub.jenisData} onChange={e => onBaselineChange(e.target.value)}>
              <option value="">— Pilih —</option>
              {baselineOptions.map(b => (
                <option key={b.id} value={b.jenisData}>{b.jenisData}{b.keterangan ? ` (${b.keterangan})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-baseline-wrapper">
            <label>Baseline {targetTahun}</label>
            <div className="form-baseline">
              {sub.baselineLoading ? "Memuat…" : sub.baseline !== null
                ? (typeof sub.baseline === "number" ? sub.baseline.toLocaleString("id-ID") : sub.baseline) : "—"}
            </div>
          </div>
        </div>
        {jenis === "PK" && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>Level 3 — Rincian</span>
              <button type="button" className="form-add-btn--l3" onClick={onAddL3}>+ Tambah</button>
            </div>
            {sub.level3Items.map((l3, l3Idx) => (
              <div key={l3.id} className="form-level3-row">
                <div className="form-field">
                  <label style={{ color: "#7c3aed" }}>Kode</label>
                  <input className="form-input form-input--sm" type="text" value={l3.kode}
                    onChange={e => onUpdateL3(l3.id, "kode", e.target.value)}
                    placeholder={`${sub.kodeSubIndikator || "x"}.${l3Idx + 1}`} />
                </div>
                <div className="form-field">
                  <label style={{ color: "#7c3aed" }}>Nama Rincian</label>
                  <input className="form-input form-input--sm" type="text" value={l3.nama}
                    onChange={e => onUpdateL3(l3.id, "nama", e.target.value)}
                    placeholder="contoh: Rincian detail kegiatan" />
                </div>
                <button type="button" className="form-remove-icon"
                  onClick={() => onRemoveL3(l3.id)} disabled={sub.level3Items.length <= 1}>−</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render ──
  const card: React.CSSProperties = {
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 14,
  };
  const sectionLabel = (color = "#9ca3af"): React.CSSProperties => ({
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 16px", color,
  });

  return (
    <PageTransition>
      <div className="form-page">

        <nav className="form-breadcrumb">
          <button className="form-breadcrumb__link" onClick={() => router.push("/admin/master-indikator")}>
            Master Indikator
          </button>
          <span className="form-breadcrumb__sep">/</span>
          <span className="form-breadcrumb__current">Form Tambah</span>
        </nav>

        <h3 className="form-title">Tambah Indikator</h3>
        <p className="form-subtitle">Buat indikator baru atau tambahkan ke data yang sudah ada.</p>

        {/* Mode toggle */}
        <div className="form-mode-toggle">
          <button type="button" className={`form-mode-btn${mode === "new" ? " form-mode-btn--active" : ""}`}
            onClick={() => setMode("new")}>Buat Baru</button>
          <button type="button" className={`form-mode-btn${mode === "append" ? " form-mode-btn--active" : ""}`}
            onClick={() => setMode("append")}>Tambah ke Yang Ada</button>
        </div>

        {/* ── NEW MODE ── */}
        {mode === "new" && (
          <>
            {/* Level 0 */}
            <div style={card}>
              <p style={sectionLabel()}>Level 0 — Sasaran Strategis</p>
              <div className="form-row form-row--3" style={{ marginBottom: 14 }}>
                <div className="form-field">
                  <label>Jenis Indikator</label>
                  <select className="form-input" value={jenis} onChange={e => setJenis(e.target.value)}>
                    <option value="IKU">IKU — Indikator Kinerja Utama</option>
                    <option value="PK">PK — Perjanjian Kerja</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Tahun</label>
                  <select className="form-input" value={targetTahun} onChange={e => setTargetTahun(e.target.value)}>
                    {TAHUN_OPTIONS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Tenggat Waktu</label>
                  <select className="form-input" value={tenggat} onChange={e => setTenggat(e.target.value)}>
                    <option value="">— Pilih Tenggat —</option>
                    {TRIWULAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row form-row--kode-target form-row--last">
                <div className="form-field">
                  <label>Nomor / Kode</label>
                  <input className="form-input" type="text" value={nomor} onChange={e => setNomor(e.target.value)} placeholder="1" />
                </div>
                <div className="form-field">
                  <label>Sasaran Strategis</label>
                  <input className="form-input" type="text" value={sasaranStrategis} onChange={e => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan" />
                </div>
                <div className="form-field">
                  <label>Target Universitas</label>
                  <input className="form-input" type="number" min={0} value={targetUniversitas}
                    onChange={e => setTargetUniversitas(String(Math.max(0, Number(e.target.value))))} placeholder="100" />
                </div>
              </div>
            </div>

            {/* Level 1 + 2 */}
            <div className="form-section-header">
              <p style={{ ...sectionLabel("#374151"), margin: 0 }}>Level 1 — Indikator Kinerja</p>
              <button type="button" className="form-add-btn" onClick={addGroup}>+ Tambah Level 1</button>
            </div>
            {groups.map((group, gIdx) => (
              <div key={group.id} style={card}>
                <div className="form-section-header">
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Indikator Kinerja #{gIdx + 1}</span>
                  {groups.length > 1 && <button type="button" className="form-remove-btn" onClick={() => removeGroup(group.id)}>Hapus</button>}
                </div>
                <div className="form-row form-row--kode" style={{ marginBottom: 16 }}>
                  <div className="form-field">
                    <label>Kode</label>
                    <input className="form-input" type="text" value={group.kodeIndikator}
                      onChange={e => updateGroup(group.id, "kodeIndikator", e.target.value)}
                      placeholder={`${nomor || "1"}.${gIdx + 1}`} />
                  </div>
                  <div className="form-field">
                    <label>Nama Indikator Kinerja</label>
                    <input className="form-input" type="text" value={group.indikatorKinerja}
                      onChange={e => updateGroup(group.id, "indikatorKinerja", e.target.value)}
                      placeholder="contoh: Hasil Lulusan yang Bekerja Sesuai Bidang" />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Level 2 — Sub Indikator
                  </span>
                </div>
                {group.subItems.map((sub, sIdx) => (
                  <SubItemRow key={sub.id} sub={sub} idx={sIdx} total={group.subItems.length}
                    parentKode={group.kodeIndikator || `${nomor || "1"}.${gIdx + 1}`}
                    onUpdateField={(f, v) => updateSub(group.id, sub.id, f, v)}
                    onBaselineChange={(v) => handleGroupBaseline(group.id, sub.id, v)}
                    onRemove={() => removeSub(group.id, sub.id)}
                    onAddL3={() => addSubL3(group.id, sub.id)}
                    onRemoveL3={(lid) => removeSubL3(group.id, sub.id, lid)}
                    onUpdateL3={(lid, f, v) => updateSubL3(group.id, sub.id, lid, f, v)}
                  />
                ))}
                <div className="form-sub-footer">
                  <button type="button" className="form-add-btn--sub" onClick={() => addSub(group.id)}>+ Sub Indikator</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── APPEND MODE ── */}
        {mode === "append" && (
          <>
            {/* Jenis + Tahun */}
            <div style={card}>
              <p style={sectionLabel()}>Konfigurasi</p>
              <div className="form-row form-row--3" style={{ marginBottom: 0 }}>
                <div className="form-field">
                  <label>Jenis Indikator</label>
                  <select className="form-input" value={jenis} onChange={e => setJenis(e.target.value)}>
                    <option value="IKU">IKU — Indikator Kinerja Utama</option>
                    <option value="PK">PK — Perjanjian Kerja</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Tahun</label>
                  <select className="form-input" value={targetTahun} onChange={e => setTargetTahun(e.target.value)}>
                    {TAHUN_OPTIONS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Navigasi hierarki */}
            <div style={card}>
              <p style={sectionLabel()}>Pilih Posisi dalam Hierarki</p>

              {/* Level 0 — dropdown */}
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label>Level 0 — Sasaran Strategis</label>
                <select className="form-input" value={appendL0Id ?? ""}
                  onChange={e => setAppendL0Id(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Pilih Sasaran Strategis —</option>
                  {existingL0.map(i => <option key={i.id} value={i.id}>{i.kode} — {i.nama}</option>)}
                </select>
                {existingL0.length === 0 && (
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>Tidak ada data {jenis} untuk tahun {targetTahun}.</p>
                )}
              </div>

              {/* Level 1 — combobox (shown when L0 selected) */}
              {appendL0Id && (
                <div style={{ marginBottom: nav1Active ? 14 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb" }}>Level 1</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>— ketik untuk cari atau buat baru</span>
                  </div>
                  <ComboBox
                    value={nav1}
                    onSelect={(entry) => setNav1(entry)}
                    options={existingL1}
                    placeholder="Cari atau ketik nama indikator kinerja…"
                  />
                  {nav1.id === null && nav1.nama.trim() && (
                    <KodeHint value={nav1.kode} onChange={v => setNav1(p => ({ ...p, kode: v }))} />
                  )}
                </div>
              )}

              {/* Level 2 — combobox (shown when L1 has a value) */}
              {nav1Active && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>Level 2</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>— opsional, ketik untuk cari atau buat baru</span>
                  </div>
                  <ComboBox
                    value={nav2}
                    onSelect={(entry) => setNav2(entry)}
                    options={existingL2}
                    placeholder="Cari atau ketik nama sub indikator…"
                    disabled={nav1.id === null && !nav1.nama.trim()}
                  />
                  {nav2.id === null && nav2.nama.trim() && (
                    <KodeHint value={nav2.kode} onChange={v => setNav2(p => ({ ...p, kode: v }))} />
                  )}
                </div>
              )}
            </div>

            {/* ── What to add ── */}
            {appendL0Id && (
              <>
                {/* Add L1+L2 groups below L0 */}
                {appendFormLevel === "L1" && (
                  <>
                    <div className="form-section-header">
                      <p style={{ ...sectionLabel("#374151"), margin: 0 }}>Tambahkan Level 1 baru di bawah sasaran ini</p>
                      <button type="button" className="form-add-btn" onClick={addGroup}>+ Level 1</button>
                    </div>
                    {groups.map((group, gIdx) => (
                      <div key={group.id} style={card}>
                        <div className="form-section-header">
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Indikator Kinerja #{gIdx + 1}</span>
                          {groups.length > 1 && <button type="button" className="form-remove-btn" onClick={() => removeGroup(group.id)}>Hapus</button>}
                        </div>
                        <div className="form-row form-row--kode" style={{ marginBottom: 16 }}>
                          <div className="form-field">
                            <label>Kode</label>
                            <input className="form-input" type="text" value={group.kodeIndikator}
                              onChange={e => updateGroup(group.id, "kodeIndikator", e.target.value)} placeholder="1.1" />
                          </div>
                          <div className="form-field">
                            <label>Nama Indikator Kinerja</label>
                            <input className="form-input" type="text" value={group.indikatorKinerja}
                              onChange={e => updateGroup(group.id, "indikatorKinerja", e.target.value)}
                              placeholder="contoh: Hasil Lulusan yang Bekerja Sesuai Bidang" />
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em" }}>Level 2 — Sub Indikator</span>
                        </div>
                        {group.subItems.map((sub, sIdx) => (
                          <SubItemRow key={sub.id} sub={sub} idx={sIdx} total={group.subItems.length}
                            parentKode={group.kodeIndikator}
                            onUpdateField={(f, v) => updateSub(group.id, sub.id, f, v)}
                            onBaselineChange={(v) => handleGroupBaseline(group.id, sub.id, v)}
                            onRemove={() => removeSub(group.id, sub.id)}
                            onAddL3={() => addSubL3(group.id, sub.id)}
                            onRemoveL3={(lid) => removeSubL3(group.id, sub.id, lid)}
                            onUpdateL3={(lid, f, v) => updateSubL3(group.id, sub.id, lid, f, v)}
                          />
                        ))}
                        <div className="form-sub-footer">
                          <button type="button" className="form-add-btn--sub" onClick={() => addSub(group.id)}>+ Sub Indikator</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Add L2 subs below selected/new L1 */}
                {appendFormLevel === "L2" && (
                  <>
                    <div className="form-section-header">
                      <p style={{ ...sectionLabel("#374151"), margin: 0 }}>
                        Tambahkan Level 2 baru di bawah &ldquo;{nav1.nama}&rdquo;
                      </p>
                      <button type="button" className="form-add-btn" onClick={addAppendSub}>+ Sub Indikator</button>
                    </div>
                    {appendSubs.map((sub, sIdx) => (
                      <SubItemRow key={sub.id} sub={sub} idx={sIdx} total={appendSubs.length}
                        parentKode=""
                        onUpdateField={(f, v) => updateAppendSub(sub.id, f, v)}
                        onBaselineChange={(v) => handleAppendSubBaseline(sub.id, v)}
                        onRemove={appendSubs.length > 1 ? () => removeAppendSub(sub.id) : null}
                        onAddL3={() => addAppendSubL3(sub.id)}
                        onRemoveL3={(lid) => removeAppendSubL3(sub.id, lid)}
                        onUpdateL3={(lid, f, v) => updateAppendSubL3(sub.id, lid, f, v)}
                      />
                    ))}
                  </>
                )}

                {/* Add L3 items below selected/new L2 (PK only) */}
                {appendFormLevel === "L3" && jenis === "PK" && (
                  <>
                    <div className="form-section-header">
                      <p style={{ ...sectionLabel("#374151"), margin: 0 }}>
                        Tambahkan Level 3 baru di bawah &ldquo;{nav2.nama}&rdquo;
                      </p>
                      <button type="button" className="form-add-btn" onClick={() => setAppendL3Items(p => [...p, blankL3()])}>
                        + Rincian
                      </button>
                    </div>
                    <div style={card}>
                      {appendL3Items.map((l3, idx) => (
                        <div key={l3.id} className="form-level3-row" style={{ marginBottom: 10 }}>
                          <div className="form-field">
                            <label>Kode</label>
                            <input className="form-input" type="text" value={l3.kode}
                              onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, kode: e.target.value } : x))}
                              placeholder={`x.x.x.${idx + 1}`} />
                          </div>
                          <div className="form-field">
                            <label>Nama Rincian</label>
                            <input className="form-input" type="text" value={l3.nama}
                              onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, nama: e.target.value } : x))}
                              placeholder="contoh: Rincian detail kegiatan" />
                          </div>
                          <button type="button" className="form-remove-icon"
                            onClick={() => setAppendL3Items(p => p.filter(x => x.id !== l3.id))}
                            disabled={appendL3Items.length <= 1}>−</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {appendFormLevel === "L3" && jenis !== "PK" && (
                  <div style={{ ...card, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    Level 3 hanya tersedia untuk Perjanjian Kerja (PK).
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Actions */}
        <div className="form-actions">
          <button type="button" className="btn-outline"
            onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading}>
            Kembali
          </button>
          <button type="button" className="btn-main" onClick={handleSubmit} disabled={submitLoading}
            style={{ opacity: submitLoading ? 0.6 : 1, cursor: submitLoading ? "not-allowed" : "pointer" }}>
            {submitLoading ? "Menyimpan…" : "Simpan Indikator"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
