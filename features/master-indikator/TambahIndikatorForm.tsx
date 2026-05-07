"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createIndikator,
  getAllBaselineData,
  getBaselineByJenisData,
  upsertTargetUniversitas,
  getTargetUniversitas,
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
type Level3Item = { id: number; kode: string; nama: string; target: string; satuan: string; tenggat: string; sumberData: string };
type SubItem = {
  id: number; kodeSubIndikator: string; subIndikatorKinerja: string;
  level3Items: Level3Item[];
};
type Group = { id: number; kodeIndikator: string; indikatorKinerja: string; sumberData: string; subItems: SubItem[] };

const blankL3 = (): Level3Item => ({ id: nextId(), kode: "", nama: "", target: "", satuan: "", tenggat: "", sumberData: "repository" });
const blankSub = (): SubItem => ({
  id: nextId(), kodeSubIndikator: "", subIndikatorKinerja: "",
  level3Items: [blankL3()],
});
const blankGroup = (): Group => ({
  id: nextId(), kodeIndikator: "", indikatorKinerja: "", sumberData: "repository", subItems: [blankSub()],
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
  const [lastNama, setLastNama] = useState(value.nama);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // React-recommended derived-state pattern: detect external prop change during render
  if (lastNama !== value.nama) {
    setLastNama(value.nama);
    setQuery(value.nama);
  }

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

  const [mode, setMode] = useState<"new" | "append">("new");

  // ── New mode ──
  const [nomor, setNomor] = useState("");
  const [sasaranStrategis, setSasaranStrategis] = useState("");
  const [targetUniversitas, setTargetUniversitas] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [l0JenisData, setL0JenisData] = useState("");
  const [l0Baseline, setL0Baseline] = useState<number | null>(null);
  const [l0BaselineLoading, setL0BaselineLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([blankGroup()]);

  // ── Append mode navigation ──
  const [allIndikators, setAllIndikators] = useState<Indikator[]>([]);
  const [appendL0Id, setAppendL0Id] = useState<number | null>(null);
  const [nav1, setNav1] = useState<NavEntry>(blankNav()); // L1
  const [nav2, setNav2] = useState<NavEntry>(blankNav()); // L2
  const [appendL3Items, setAppendL3Items] = useState<Level3Item[]>([blankL3()]);
  const [appendL1SumberData, setAppendL1SumberData] = useState("repository");

  // ── Append mode: editable target for selected L0 ──
  const [appendTargetUni, setAppendTargetUni] = useState("");
  const [appendSatuan, setAppendSatuan] = useState("");
  const [appendTenggat, setAppendTenggat] = useState("");
  const [appendTargetLoading, setAppendTargetLoading] = useState(false);

  // Derived options for comboboxes
  const existingL0 = allIndikators.filter(i => i.level === 0 && i.jenis === jenis);
  const existingL1 = allIndikators.filter(i => i.level === 1 && i.parentId === appendL0Id);
  const existingL2 = nav1.id !== null
    ? allIndikators.filter(i => i.level === 2 && i.parentId === nav1.id)
    : [];

  const nav1Active = nav1.nama.trim() !== "";
  const nav2Active = nav2.nama.trim() !== "";

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

  useEffect(() => {
    setNav1(blankNav());
    setNav2(blankNav());
    setAppendTargetUni("");
    setAppendSatuan("");
    setAppendTenggat("");
    if (!appendL0Id) return;
    setAppendTargetLoading(true);
    getTargetUniversitas(appendL0Id, targetTahun)
      .then(t => {
        setAppendTargetUni(t ? String(t.targetAngka ?? "") : "");
        setAppendSatuan(t?.satuan ?? "");
        setAppendTenggat(t?.tenggat ?? "");
      })
      .catch(() => {})
      .finally(() => setAppendTargetLoading(false));
  }, [appendL0Id, targetTahun]);

  useEffect(() => {
    setNav2(blankNav());
    setAppendL3Items([blankL3()]);
  }, [nav1.id]);

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
  const updateSubL3 = (gid: number, sid: number, lid: number, field: "kode" | "nama" | "target" | "satuan" | "tenggat" | "sumberData", val: string) =>
    setGroups(p => p.map(g => g.id === gid ? {
      ...g, subItems: g.subItems.map(s => s.id === sid ? {
        ...s, level3Items: s.level3Items.map(l => l.id === lid ? { ...l, [field]: val } : l),
      } : s),
    } : g));

  // ── L0 baseline helper ──
  const l0BaselineDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleL0Baseline = (val: string) => {
    setL0JenisData(val);
    setL0Baseline(null);
    if (l0BaselineDebounce.current) clearTimeout(l0BaselineDebounce.current);
    if (!val.trim()) return;
    setL0BaselineLoading(true);
    l0BaselineDebounce.current = setTimeout(async () => {
      try {
        const result = await getBaselineByJenisData(val.trim(), targetTahun);
        setL0Baseline(result?.jumlah ?? null);
      } catch { setL0Baseline(null); }
      finally { setL0BaselineLoading(false); }
    }, 600);
  };

  // ── Submit ──
  async function handleSubmit() {
    if (mode === "new") {
      if (!nomor.trim() || !sasaranStrategis.trim()) { toast.error("Nomor dan Sasaran Strategis wajib diisi."); return; }
      if (jenis === "IKU" && (!targetUniversitas || isNaN(Number(targetUniversitas)) || Number(targetUniversitas) < 0)) { toast.error("Target Universitas wajib diisi."); return; }
      if (jenis === "IKU" && !tenggat) { toast.error("Pilih Tenggat terlebih dahulu."); return; }
      for (const g of groups) {
        if (!g.kodeIndikator.trim() || !g.indikatorKinerja.trim()) { toast.error("Kode dan nama Level 1 wajib diisi."); return; }
        for (const s of g.subItems) {
          if (!s.kodeSubIndikator.trim() || !s.subIndikatorKinerja.trim()) { toast.error("Kode dan nama Sub Indikator wajib diisi."); return; }
        }
      }
    } else {
      if (!appendL0Id) { toast.error("Pilih Sasaran Strategis terlebih dahulu."); return; }
      if (!nav1.nama.trim()) { toast.error("Isi Level 1 terlebih dahulu."); return; }
      if (nav1.id === null && !nav1.kode.trim()) { toast.error("Isi kode untuk Level 1 baru."); return; }
      if (nav2.nama.trim()) {
        if (nav2.id === null && !nav2.kode.trim()) { toast.error("Isi kode untuk Level 2 baru."); return; }
        if (nav2Active && jenis === "PK" && !appendL3Items.some(l => l.kode.trim() && l.nama.trim())) {
          toast.error("Isi minimal satu rincian Level 3."); return;
        }
      }
    }

    setSubmitLoading(true);
    try {
      if (mode === "new") {
        const l0 = await createIndikator({
          jenis, kode: nomor.trim(), nama: sasaranStrategis.trim(),
          tahun: targetTahun, level: 0, parentId: null,
          jenisData: l0JenisData.trim() || null,
        });
        if (jenis === "IKU") {
          await upsertTargetUniversitas(l0.id, targetTahun, Number(targetUniversitas), tenggat);
        }
        await saveGroupsUnder(l0.id, groups);
      } else {
        // IKU: update target di L0; PK: target disimpan per L3 item
        if (jenis === "IKU" && appendTargetUni.trim() && !isNaN(Number(appendTargetUni))) {
          await upsertTargetUniversitas(appendL0Id!, targetTahun, Number(appendTargetUni), appendTenggat || undefined, appendSatuan.trim() || undefined);
        }
        // Resolve / create L1
        let l1Id: number;
        if (nav1.id !== null) {
          l1Id = nav1.id;
        } else {
          const l1 = await createIndikator({ jenis, kode: nav1.kode.trim(), nama: nav1.nama.trim(), tahun: targetTahun, level: 1, parentId: appendL0Id!, sumberData: appendL1SumberData || 'repository' });
          l1Id = l1.id;
        }

        if (!nav2.nama.trim()) {
          // Only creating / selecting L1 — done
        } else {
          // Resolve / create L2
          let l2Id: number;
          if (nav2.id !== null) {
            l2Id = nav2.id;
          } else {
            const l2 = await createIndikator({
              jenis, kode: nav2.kode.trim(), nama: nav2.nama.trim(),
              tahun: targetTahun, level: 2, parentId: l1Id,
            });
            l2Id = l2.id;
          }

          // Create L3 items (PK only) with target per item
          if (jenis === "PK") {
            for (const l3 of appendL3Items) {
              if (l3.kode.trim() && l3.nama.trim()) {
                const l3Entity = await createIndikator({ jenis, kode: l3.kode.trim(), nama: l3.nama.trim(), tahun: targetTahun, level: 3, parentId: l2Id, sumberData: l3.sumberData || 'repository' });
                if (l3.target.trim() && !isNaN(Number(l3.target))) {
                  await upsertTargetUniversitas(l3Entity.id, targetTahun, Number(l3.target), l3.tenggat || undefined, l3.satuan.trim() || undefined);
                }
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
  }

  async function saveGroupsUnder(parentId: number, gs: Group[]) {
    for (const g of gs) {
      const l1 = await createIndikator({ jenis, kode: g.kodeIndikator.trim(), nama: g.indikatorKinerja.trim(), tahun: targetTahun, level: 1, parentId, sumberData: g.sumberData || 'repository' });
      await saveSubsUnder(l1.id, g.subItems);
    }
  }

  async function saveSubsUnder(parentId: number, subs: SubItem[]) {
    for (const s of subs) {
      const l2 = await createIndikator({
        jenis, kode: s.kodeSubIndikator.trim(), nama: s.subIndikatorKinerja.trim(),
        tahun: targetTahun, level: 2, parentId,
      });
      if (jenis === "PK") {
        for (const l3 of s.level3Items) {
          if (l3.kode.trim() && l3.nama.trim()) {
            const l3Entity = await createIndikator({ jenis, kode: l3.kode.trim(), nama: l3.nama.trim(), tahun: targetTahun, level: 3, parentId: l2.id, sumberData: l3.sumberData || 'repository' });
            if (l3.target.trim() && !isNaN(Number(l3.target))) {
              await upsertTargetUniversitas(l3Entity.id, targetTahun, Number(l3.target), l3.tenggat || undefined, l3.satuan.trim() || undefined);
            }
          }
        }
      }
    }
  }

  // ── Sub item renderer (used by groups in new mode) ──
  function SubItemRow({
    sub, idx, total, parentKode,
    onUpdateField, onRemove,
    onAddL3, onRemoveL3, onUpdateL3,
  }: {
    sub: SubItem; idx: number; total: number; parentKode: string;
    onUpdateField: (f: string, v: string) => void;
    onRemove: (() => void) | null;
    onAddL3: () => void; onRemoveL3: (id: number) => void;
    onUpdateL3: (id: number, f: "kode" | "nama" | "target" | "satuan" | "tenggat" | "sumberData", v: string) => void;
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
        {jenis === "PK" && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>Level 3 — Rincian</span>
              <button type="button" className="form-add-btn--l3" onClick={onAddL3}>+ Tambah</button>
            </div>
            {sub.level3Items.map((l3, l3Idx) => (
              <div key={l3.id} style={{ background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <div className="form-field" style={{ width: 110 }}>
                    <label style={{ color: "#7c3aed" }}>Kode</label>
                    <input className="form-input form-input--sm" type="text" value={l3.kode}
                      onChange={e => onUpdateL3(l3.id, "kode", e.target.value)}
                      placeholder={`${sub.kodeSubIndikator || "x"}.${l3Idx + 1}`} />
                  </div>
                  <div className="form-field" style={{ flex: 1 }}>
                    <label style={{ color: "#7c3aed" }}>Nama Rincian</label>
                    <input className="form-input form-input--sm" type="text" value={l3.nama}
                      onChange={e => onUpdateL3(l3.id, "nama", e.target.value)}
                      placeholder="contoh: Rincian detail kegiatan" />
                  </div>
                  <button type="button" className="form-remove-icon"
                    onClick={() => onRemoveL3(l3.id)} disabled={sub.level3Items.length <= 1}>−</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  <div className="form-field">
                    <label style={{ color: "#7c3aed" }}>Target Fakultas</label>
                    <input className="form-input form-input--sm" type="number" min={0} value={l3.target}
                      onChange={e => onUpdateL3(l3.id, "target", e.target.value)}
                      placeholder="5" />
                  </div>
                  <div className="form-field">
                    <label style={{ color: "#7c3aed" }}>Satuan</label>
                    <input className="form-input form-input--sm" type="text" value={l3.satuan}
                      onChange={e => onUpdateL3(l3.id, "satuan", e.target.value)}
                      placeholder="Dokumen, Kegiatan, ..." />
                  </div>
                  <div className="form-field">
                    <label style={{ color: "#7c3aed" }}>Tenggat</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <select className="form-input form-input--sm" style={{ flex: 3 }}
                        value={l3.tenggat.match(/^(Triwulan [IV]+)/)?.[1] ?? ""}
                        onChange={e => {
                          const year = l3.tenggat.match(/(\d{4})$/)?.[1] ?? "";
                          const triwulan = e.target.value;
                          onUpdateL3(l3.id, "tenggat", triwulan && year ? `${triwulan} ${year}` : triwulan || year);
                        }}>
                        <option value="">— Triwulan —</option>
                        {TRIWULAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <select className="form-input form-input--sm" style={{ flex: 2 }}
                        value={l3.tenggat.match(/(\d{4})$/)?.[1] ?? ""}
                        onChange={e => {
                          const triwulan = l3.tenggat.match(/^(Triwulan [IV]+)/)?.[1] ?? "";
                          const year = e.target.value;
                          onUpdateL3(l3.id, "tenggat", triwulan && year ? `${triwulan} ${year}` : triwulan || year);
                        }}>
                        <option value="">— Tahun —</option>
                        {TAHUN_OPTIONS.map(y => <option key={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label style={{ color: "#7c3aed" }}>Sumber Data</label>
                    <select className="form-input form-input--sm" value={l3.sumberData}
                      onChange={e => onUpdateL3(l3.id, "sumberData", e.target.value)}>
                      <option value="repository">Repository</option>
                      <option value="ikupk">IKU PK</option>
                    </select>
                  </div>
                </div>
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

  // ── style helpers ──
  const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 };
  const fieldInput: React.CSSProperties = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#374151", outline: "none", background: "#fff" };
  const levelBadge = (color: string, bg: string, label: string) => (
    <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
  );

  return (
    <PageTransition>
      <div style={{ margin: "0", padding: "4px 0 80px", fontFamily: "var(--font-nunito-sans), Nunito Sans, sans-serif" }}>

        {/* ── Breadcrumb ── */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 }}>
          <button onClick={() => router.push("/admin/master-indikator")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#FF7900", fontWeight: 600, padding: 0 }}>
            Master Indikator
          </button>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ color: "#6b7280" }}>Form Indikator</span>
        </nav>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontWeight: 800, fontSize: 22, color: "#111", margin: "0 0 4px" }}>Tambah Indikator</h2>
        </div>

        {/* ── Mode Toggle ── */}
        <div style={{ display: "inline-flex", background: "#f0f0f0", borderRadius: 10, padding: 4, gap: 3, marginBottom: 16 }}>
          {[{ id: "new", label: "✦ Buat Baru" }, { id: "append", label: "↳ Tambah data" }].map(m => (
            <button key={m.id} type="button" onClick={() => setMode(m.id as "new" | "append")}
              style={{
                padding: "7px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: mode === m.id ? (m.id === "new" ? "#FF7900" : "#111") : "transparent",
                color: mode === m.id ? "#fff" : "#6b7280", transition: "all 0.15s",
              }}>{m.label}</button>
          ))}
        </div>

        {/* ══════════ NEW MODE ══════════ */}
        {mode === "new" && (
          <>
            {/* Level 0 card */}
            <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                {levelBadge("#fff", "#FF7900", "Level 0")}
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Sasaran Strategis</span>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label style={fieldLabel}>Jenis Indikator <span style={{ color: "#ef4444" }}>*</span></label>
                  <select style={fieldInput} value={jenis} onChange={e => setJenis(e.target.value)}>
                    <option value="IKU">IKU — Indikator Kinerja Utama</option>
                    <option value="PK">PK — Perjanjian Kerja</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label style={fieldLabel}>Tahun <span style={{ color: "#ef4444" }}>*</span></label>
                  <select style={fieldInput} value={targetTahun} onChange={e => setTargetTahun(e.target.value)}>
                    {TAHUN_OPTIONS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                {jenis !== "PK" && (
                  <div className="col-md-4">
                    <label style={fieldLabel}>Tenggat Waktu</label>
                    <select style={fieldInput} value={tenggat} onChange={e => setTenggat(e.target.value)}>
                      <option value="">— Pilih Triwulan —</option>
                      {TRIWULAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-2">
                  <label style={fieldLabel}>Nomor / Kode <span style={{ color: "#ef4444" }}>*</span></label>
                  <input style={fieldInput} type="text" value={nomor} onChange={e => setNomor(e.target.value)} placeholder="1" />
                </div>
                <div className="col">
                  <label style={fieldLabel}>Sasaran Strategis <span style={{ color: "#ef4444" }}>*</span></label>
                  <input style={fieldInput} type="text" value={sasaranStrategis} onChange={e => setSasaranStrategis(e.target.value)} placeholder="contoh: Meningkatnya kualitas lulusan" />
                </div>
                {jenis !== "PK" && (
                  <div className="col-md-3">
                    <label style={fieldLabel}>Target Universitas (%)</label>
                    <input style={fieldInput} type="number" min={0} max={100} value={targetUniversitas}
                      onChange={e => setTargetUniversitas(String(Math.max(0, Number(e.target.value))))} placeholder="80" />
                  </div>
                )}
              </div>

              {jenis !== "PK" && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label style={fieldLabel}>Jenis Data (baseline)</label>
                    <select style={fieldInput} value={l0JenisData} onChange={e => handleL0Baseline(e.target.value)}>
                      <option value="">— Pilih —</option>
                      {baselineOptions.map(b => <option key={b.id} value={b.jenisData}>{b.jenisData}{b.keterangan ? ` (${b.keterangan})` : ""}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label style={fieldLabel}>Baseline {targetTahun}</label>
                    <div style={{ ...fieldInput, background: "#f9fafb", color: "#374151", fontWeight: 600, minHeight: 38, display: "flex", alignItems: "center" }}>
                      {l0BaselineLoading ? <span style={{ color: "#9ca3af", fontSize: 12 }}>Memuat…</span> : l0Baseline !== null ? l0Baseline.toLocaleString("id-ID") : <span style={{ color: "#d1d5db" }}>—</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Level 1 header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {levelBadge("#1d4ed8", "#dbeafe", "Level 1")}
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Indikator Kinerja</span>
              </div>
              <button type="button" onClick={addGroup}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px dashed #d1d5db", background: "#fafafa", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Tambah Level 1
              </button>
            </div>

            {groups.map((group, gIdx) => (
              <div key={group.id} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, padding: "18px 22px", marginBottom: 14, boxShadow: "0 1px 3px rgba(37,99,235,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>Indikator Kinerja #{gIdx + 1}</span>
                  {groups.length > 1 && (
                    <button type="button" onClick={() => removeGroup(group.id)}
                      style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff7f7", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Hapus</button>
                  )}
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-2">
                    <label style={fieldLabel}>Kode</label>
                    <input style={fieldInput} type="text" value={group.kodeIndikator}
                      onChange={e => updateGroup(group.id, "kodeIndikator", e.target.value)}
                      placeholder={`${nomor || "1"}.${gIdx + 1}`} />
                  </div>
                  <div className="col">
                    <label style={fieldLabel}>Nama Indikator Kinerja</label>
                    <input style={fieldInput} type="text" value={group.indikatorKinerja}
                      onChange={e => updateGroup(group.id, "indikatorKinerja", e.target.value)}
                      placeholder="contoh: Hasil Lulusan yang Bekerja Sesuai Bidang" />
                  </div>
                  <div className="col-md-3">
                    <label style={fieldLabel}>Sumber Data</label>
                    <select style={fieldInput} value={group.sumberData}
                      onChange={e => updateGroup(group.id, "sumberData", e.target.value)}>
                      <option value="repository">Repository</option>
                      <option value="ikupk">IKU PK (Input Langsung)</option>
                    </select>
                  </div>
                </div>

                {/* Level 2 sub-items */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {levelBadge("#059669", "#d1fae5", "Level 2")}
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Sub Indikator</span>
                </div>
                {group.subItems.map((sub, sIdx) => (
                  <SubItemRow key={sub.id} sub={sub} idx={sIdx} total={group.subItems.length}
                    parentKode={group.kodeIndikator || `${nomor || "1"}.${gIdx + 1}`}
                    onUpdateField={(f, v) => updateSub(group.id, sub.id, f, v)}
                    onRemove={() => removeSub(group.id, sub.id)}
                    onAddL3={() => addSubL3(group.id, sub.id)}
                    onRemoveL3={(lid) => removeSubL3(group.id, sub.id, lid)}
                    onUpdateL3={(lid, f, v) => updateSubL3(group.id, sub.id, lid, f, v)}
                  />
                ))}
                <button type="button" onClick={() => addSub(group.id)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px dashed #a7f3d0", background: "#f0fdf4", color: "#059669", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                  + Sub Indikator
                </button>
              </div>
            ))}
          </>
        )}

        {/* ══════════ APPEND MODE ══════════ */}
        {mode === "append" && (
          <>
            {/* Config card */}
            <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 14px" }}>Konfigurasi</p>
              <div className="row g-3">
                <div className="col-md-6">
                  <label style={fieldLabel}>Jenis Indikator</label>
                  <select style={fieldInput} value={jenis} onChange={e => setJenis(e.target.value)}>
                    <option value="IKU">IKU — Indikator Kinerja Utama</option>
                    <option value="PK">PK — Perjanjian Kerja</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label style={fieldLabel}>Tahun</label>
                  <select style={fieldInput} value={targetTahun} onChange={e => setTargetTahun(e.target.value)}>
                    {TAHUN_OPTIONS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Hierarchy navigation card */}
            <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14, padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 16px" }}>Pilih Posisi & Isi Data Baru</p>

              {/* L0 */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {levelBadge("#fff", "#FF7900", "Level 0")}
                  <label style={{ ...fieldLabel, margin: 0 }}>Sasaran Strategis</label>
                </div>
                <select style={fieldInput} value={appendL0Id ?? ""} onChange={e => setAppendL0Id(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Pilih Sasaran Strategis —</option>
                  {existingL0.map(i => <option key={i.id} value={i.id}>{i.kode} — {i.nama}</option>)}
                </select>
                {existingL0.length === 0 && <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>Tidak ada data {jenis} untuk tahun {targetTahun}.</p>}
              </div>

              {/* IKU target box */}
              {appendL0Id && jenis === "IKU" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                    Target Universitas (opsional — perbarui jika berubah)
                  </p>
                  {appendTargetLoading ? (
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Memuat target saat ini…</p>
                  ) : (
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label style={fieldLabel}>Target (%)</label>
                        <input style={fieldInput} type="number" min={0} max={100} value={appendTargetUni} onChange={e => setAppendTargetUni(e.target.value)} placeholder="misal 80" />
                      </div>
                      <div className="col-md-4">
                        <label style={fieldLabel}>Tenggat Waktu</label>
                        <select style={fieldInput} value={appendTenggat} onChange={e => setAppendTenggat(e.target.value)}>
                          <option value="">— Pilih Triwulan —</option>
                          {TRIWULAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* L1 */}
              {appendL0Id && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {levelBadge("#1d4ed8", "#dbeafe", "Level 1")}
                    <label style={{ ...fieldLabel, margin: 0 }}>Indikator Kinerja</label>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>— ketik untuk cari atau buat baru</span>
                  </div>
                  <ComboBox value={nav1} onSelect={entry => setNav1(entry)} options={existingL1} placeholder="Cari atau ketik nama indikator kinerja…" />
                  {nav1.id === null && nav1.nama.trim() && <KodeHint value={nav1.kode} onChange={v => setNav1(p => ({ ...p, kode: v }))} />}
                  {nav1.id === null && nav1.nama.trim() && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>Sumber Data:</span>
                      <select style={{ fontSize: 12, padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: 8, color: "#374151" }}
                        value={appendL1SumberData} onChange={e => setAppendL1SumberData(e.target.value)}>
                        <option value="repository">Repository</option>
                        <option value="ikupk">IKU PK (Input Langsung)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* L2 */}
              {nav1Active && (
                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {levelBadge("#059669", "#d1fae5", "Level 2")}
                    <label style={{ ...fieldLabel, margin: 0 }}>Sub Indikator</label>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>— opsional</span>
                  </div>
                  <ComboBox value={nav2} onSelect={setNav2} options={existingL2}
                    placeholder="Cari atau ketik nama sub indikator…"
                    disabled={nav1.id === null && !nav1.nama.trim()} />
                  {nav2.id === null && nav2.nama.trim() && <KodeHint value={nav2.kode} onChange={v => setNav2(p => ({ ...p, kode: v }))} />}

                  {/* L3 (PK only) */}
                  {nav2Active && jenis === "PK" && (
                    <div style={{ marginTop: 18, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {levelBadge("#7c3aed", "#ede9fe", "Level 3")}
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Rincian</span>
                        </div>
                        <button type="button" onClick={() => setAppendL3Items(p => [...p, blankL3()])}
                          style={{ padding: "5px 12px", borderRadius: 7, border: "1px dashed #c4b5fd", background: "#f5f3ff", color: "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          + Tambah
                        </button>
                      </div>
                      {appendL3Items.map((l3, idx) => (
                        <div key={l3.id} style={{ background: "#faf5ff", border: "1px solid #ede9fe", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                          <div className="row g-2 mb-2 align-items-end">
                            <div className="col-md-2">
                              <label style={{ ...fieldLabel, color: "#7c3aed" }}>Kode</label>
                              <input style={{ ...fieldInput, fontSize: 12 }} type="text" value={l3.kode}
                                onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, kode: e.target.value } : x))}
                                placeholder={`x.x.${idx + 1}`} />
                            </div>
                            <div className="col">
                              <label style={{ ...fieldLabel, color: "#7c3aed" }}>Nama Rincian</label>
                              <input style={{ ...fieldInput, fontSize: 12 }} type="text" value={l3.nama}
                                onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, nama: e.target.value } : x))}
                                placeholder="contoh: Rincian detail kegiatan" />
                            </div>
                            <div className="col-auto">
                              <button type="button" onClick={() => setAppendL3Items(p => p.filter(x => x.id !== l3.id))}
                                disabled={appendL3Items.length <= 1}
                                style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid #fca5a5", background: "#fff7f7", color: "#dc2626", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            </div>
                          </div>
                          <div className="row g-2">
                            <div className="col-md-2">
                              <label style={{ ...fieldLabel, color: "#7c3aed", fontSize: 11 }}>Target Fakultas</label>
                              <input style={{ ...fieldInput, fontSize: 12 }} type="number" min={0} value={l3.target}
                                onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, target: e.target.value } : x))}
                                placeholder="5" />
                            </div>
                            <div className="col-md-2">
                              <label style={{ ...fieldLabel, color: "#7c3aed", fontSize: 11 }}>Satuan</label>
                              <input style={{ ...fieldInput, fontSize: 12 }} type="text" value={l3.satuan}
                                onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, satuan: e.target.value } : x))}
                                placeholder="Dokumen, Kegiatan..." />
                            </div>
                            <div className="col-md-2">
                              <label style={{ ...fieldLabel, color: "#7c3aed", fontSize: 11 }}>Sumber Data</label>
                              <select style={{ ...fieldInput, fontSize: 12 }} value={l3.sumberData}
                                onChange={e => setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, sumberData: e.target.value } : x))}>
                                <option value="repository">Repository</option>
                                <option value="ikupk">IKU PK</option>
                              </select>
                            </div>
                            <div className="col-md-4">
                              <label style={{ ...fieldLabel, color: "#7c3aed", fontSize: 11 }}>Tenggat</label>
                              <div style={{ display: "flex", gap: 4 }}>
                                <select style={{ ...fieldInput, fontSize: 12, flex: 3 }}
                                  value={l3.tenggat.match(/^(Triwulan [IV]+)/)?.[1] ?? ""}
                                  onChange={e => {
                                    const year = l3.tenggat.match(/(\d{4})$/)?.[1] ?? "";
                                    const triwulan = e.target.value;
                                    setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, tenggat: triwulan && year ? `${triwulan} ${year}` : triwulan || year } : x));
                                  }}>
                                  <option value="">— Triwulan —</option>
                                  {TRIWULAN_OPTIONS.map(t => <option key={t}>{t}</option>)}
                                </select>
                                <select style={{ ...fieldInput, fontSize: 12, flex: 2 }}
                                  value={l3.tenggat.match(/(\d{4})$/)?.[1] ?? ""}
                                  onChange={e => {
                                    const triwulan = l3.tenggat.match(/^(Triwulan [IV]+)/)?.[1] ?? "";
                                    const year = e.target.value;
                                    setAppendL3Items(p => p.map(x => x.id === l3.id ? { ...x, tenggat: triwulan && year ? `${triwulan} ${year}` : triwulan || year } : x));
                                  }}>
                                  <option value="">— Tahun —</option>
                                  {TAHUN_OPTIONS.map(y => <option key={y}>{y}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Sticky Action Bar ── */}
        <div style={{
          position: "sticky", bottom: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
          borderTop: "1px solid #f0f0f0", padding: "14px 0", marginTop: 8,
          display: "flex", gap: 10, justifyContent: "flex-end"
        }}>
          <button type="button" onClick={() => router.push("/admin/master-indikator")} disabled={submitLoading}
            style={{ padding: "9px 24px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Kembali
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitLoading}
            style={{
              padding: "9px 28px", borderRadius: 9, border: "none", background: "#FF7900", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: submitLoading ? "not-allowed" : "pointer",
              opacity: submitLoading ? 0.65 : 1, display: "flex", alignItems: "center", gap: 8
            }}>
            {submitLoading && <div className="spinner-border spinner-border-sm" style={{ width: 14, height: 14, borderWidth: 2 }} />}
            {submitLoading ? "Menyimpan…" : "Simpan Indikator"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}