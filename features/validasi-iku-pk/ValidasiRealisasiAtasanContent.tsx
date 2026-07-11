"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import {
  getSubmissionsForAtasan,
  getSubmissionsForWD2,
  validateRealisasiAtasan,
  validateWD2Batch,
  getAllRealisasiFiles,
  getIkupkFilesByUser,
  getLaporanWithRealisasi,
  getIndikator,
  SubmissionPerIndikator,
  RealisasiSubmission,
  API_BASE_URL,
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type DosenSubmission = RealisasiSubmission & {
  indikatorId: number;
  indikatorKode: string;
  indikatorNama: string;
};

type DosenGroup = {
  dosenId: number;
  dosenNama: string;
  dosenEmail: string;
  submissions: DosenSubmission[];
};

type DetailModal = {
  dosenNama: string;
  dosenEmail: string;
  submission: DosenSubmission;
};

export default function ValidasiRealisasiAtasanContent() {
  const { user, token } = useAuth();
  const [rawGroups, setRawGroups] = useState<SubmissionPerIndikator[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [jenisFilter, setJenisFilter] = useState<"IKU" | "PK" | "PK_IKU">("IKU");
  const [pkBerbasisIkuIds, setPkBerbasisIkuIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"dosen" | "indikator">("dosen");

  // WD2 state
  const roleName = (user?.role ?? "").toLowerCase();
  const isWD2 = roleName.includes("wakil dekan 2") || roleName.includes("wd2") || roleName.includes("wakil dekan ii");

  type WD2UserGroup = { userId: number; nama: string; email: string; realisasi: { id: number; kodeIndikator: string; namaIndikator: string; realisasiAngka: number; validFileCount: number | null; status: string; periode: string | null }[] };
  const [wd2Groups, setWd2Groups] = useState<WD2UserGroup[]>([]);
  const [validatingWD2, setValidatingWD2] = useState<number | null>(null);

  // Detail modal
  const [detail, setDetail] = useState<DetailModal | null>(null);
  const [detailFiles, setDetailFiles] = useState<{ name: string; previewUrl?: string; tanggal: string; ownerName?: string; ownerEmail?: string; sumber?: 'repository' | 'repository-all' | 'ikupk'; }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkedFiles, setCheckedFiles] = useState<Set<number>>(new Set());
  const [savingModal, setSavingModal] = useState(false);

  // Export loading
  const [exporting, setExporting] = useState(false);
  const [exportingLaporan, setExportingLaporan] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
  }, [user?.id, tahun]);

  useEffect(() => {
    if (!detail || !token) return;
    setDetailLoading(true);
    setDetailFiles([]);
    setCheckedFiles(new Set());

    const dosenEmailLower = detail.dosenEmail.toLowerCase();
    const tahunNow = tahun;

    Promise.all([
      getAllRealisasiFiles(detail.submission.indikatorId, token).catch(() => ({ files: [] as any[] })),
      getIkupkFilesByUser(detail.submission.dosenId, detail.submission.indikatorId, tahunNow).catch(() => [] as any[]),
    ]).then(([repoResult, ikupkFiles]) => {
      type DetailFile = { name: string; previewUrl?: string; tanggal: string; ownerName?: string; ownerEmail?: string; sumber?: 'repository' | 'repository-all' | 'ikupk' };
      const mapRepoFile = (f: any, isAll = false): DetailFile => ({
        name: f.name,
        previewUrl: f.preview_url,
        tanggal: f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-',
        ownerName: f.ownerName || f.owner?.name,
        ownerEmail: f.ownerEmail || f.owner?.email,
        sumber: (isAll ? 'repository-all' : 'repository') as 'repository' | 'repository-all',
      });

      // File repo milik dosen ini
      const ownRepoFiles = repoResult.files
        .filter((f: any) => (f.ownerEmail || f.owner?.email || '').toLowerCase() === dosenEmailLower)
        .map((f: any) => mapRepoFile(f));

      const ikupkMapped = (ikupkFiles as any[]).map((f: any) => ({
        name: f.fileName,
        previewUrl: `${API_BASE_URL}${f.fileUrl}`,
        tanggal: f.createdAt ? new Date(f.createdAt).toLocaleDateString('id-ID') : '-',
        ownerName: detail.dosenNama,
        ownerEmail: detail.dosenEmail,
        sumber: 'ikupk' as const,
      }));

      let merged = [...ownRepoFiles, ...ikupkMapped];

      // Fallback: jika tidak ada file milik dosen ini, tampilkan semua file indikator
      // (terjadi ketika dosen/kajur submit realisasi berdasarkan agregat bawahan)
      if (merged.length === 0 && repoResult.files.length > 0) {
        merged = repoResult.files.map((f: any) => mapRepoFile(f, true));
      }

      setDetailFiles(merged);
      const savedCount = detail.submission.validFileCount ?? 0;
      setCheckedFiles(new Set(Array.from({ length: Math.min(savedCount, merged.length) }, (_, i) => i)));
    }).finally(() => setDetailLoading(false));
  }, [detail, token, tahun]);

  async function fetchData() {
    setLoading(true);
    try {
      // Build set of PK-berbasis-IKU indikator IDs (level 3 with linkedIkuId)
      getIndikator(tahun).then(all => {
        const ids = new Set(all.filter(i => i.jenis === "PK" && i.linkedIkuId != null).map(i => i.id));
        setPkBerbasisIkuIds(ids);
      }).catch(() => {});

      if (isWD2) {
        const data = await getSubmissionsForWD2(tahun);
        setWd2Groups(data);
      } else {
        const data = await getSubmissionsForAtasan(user!.id, tahun);
        setRawGroups(data);
      }
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
      setRawGroups([]);
      setWd2Groups([]);
    } finally {
      setLoading(false);
    }
  }

  const handleValidasiWD2 = async (userId: number) => {
    setValidatingWD2(userId);
    try {
      await validateWD2Batch(userId, tahun);
      toast.success("Validasi final berhasil.");
      setWd2Groups((prev) => prev.filter((g) => g.userId !== userId));
    } catch {
      toast.error("Gagal melakukan validasi final.");
    } finally {
      setValidatingWD2(null);
    }
  };

  const matchesJenisFilter = (g: SubmissionPerIndikator): boolean => {
    const jenis = g.indikator.jenis.toUpperCase();
    if (jenisFilter === "PK_IKU") return jenis === "PK" && pkBerbasisIkuIds.has(g.indikator.id);
    return jenis === jenisFilter;
  };

  // Transform indikator-grouped → dosen-grouped
  const dosenGroups: DosenGroup[] = (() => {
    const filtered = rawGroups.filter(matchesJenisFilter);
    const map = new Map<number, DosenGroup>();
    filtered.forEach(g => {
      g.submissions.forEach(s => {
        if (!map.has(s.dosenId)) {
          map.set(s.dosenId, { dosenId: s.dosenId, dosenNama: s.dosenNama, dosenEmail: s.dosenEmail, submissions: [] });
        }
        map.get(s.dosenId)!.submissions.push({
          ...s,
          indikatorId: g.indikator.id,
          indikatorKode: g.indikator.kode,
          indikatorNama: g.indikator.nama,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
  })();

  const indikatorGroups = rawGroups
    .filter(matchesJenisFilter)
    .slice()
    .sort((a, b) => a.indikator.kode.localeCompare(b.indikator.kode));

  const totalSubmissions = rawGroups.reduce((n, g) => n + g.submissions.length, 0);
  const totalValidated = rawGroups.reduce(
    (n, g) => n + g.submissions.filter((s) => s.validFileCount !== null).length,
    0
  );

  const handleSaveModal = async () => {
    if (!detail || !token) return;
    setSavingModal(true);
    const val = checkedFiles.size;
    try {
      await validateRealisasiAtasan(detail.submission.id, val, token ?? undefined);
      setRawGroups((prev) =>
        prev.map((g) => ({
          ...g,
          submissions: g.submissions.map((s) =>
            s.id === detail.submission.id ? { ...s, validFileCount: val, status: "validated" } : s
          ),
        }))
      );
      setDetail((prev) => prev ? { ...prev, submission: { ...prev.submission, validFileCount: val } } : prev);
      toast.success("Validasi berhasil disimpan.");
    } catch {
      toast.error("Gagal menyimpan validasi.");
    } finally {
      setSavingModal(false);
    }
  };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      // Fetch folder link per unique indikatorId
      const indikatorIds = [...new Set(
        dosenGroups.flatMap(dg => dg.submissions.map(s => s.indikatorId))
      )];
      const fileResults = await Promise.all(
        indikatorIds.map(id =>
          getAllRealisasiFiles(id, token).catch(() => ({ folderLink: null, files: [] as any[] }))
        )
      );
      // Map: indikatorId → folder link
      const folderLinkMap = new Map<number, string>();
      indikatorIds.forEach((id, idx) => {
        const link = (fileResults[idx] as any).folderLink;
        if (link) folderLinkMap.set(id, link);
      });

      // Build flat rows: header row + data
      type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };
      const COLS = ["Nama Dosen", "Email", "Indikator", "Periode", "Target", "File Diunggah", "File Valid", "Status", "Link Folder"];
      const aoa: (string | number)[][] = [COLS];
      const merges: MergeRange[] = [];

      dosenGroups.forEach((dg) => {
        dg.submissions.forEach((s) => {
          const rowIdx = aoa.length;
          const folderLink = folderLinkMap.get(s.indikatorId) || "-";
          aoa.push([
            dg.dosenNama,
            dg.dosenEmail,
            s.indikatorKode + " — " + s.indikatorNama,
            s.periode ?? "-",
            s.targetDosen ?? "-",
            s.fileCount,
            s.validFileCount ?? "-",
            s.status,
            folderLink,
          ]);

          // Merge "Link Folder" cells for same indikatorId vertically
          // (collect ranges after building all rows — handled below)
          void rowIdx;
        });
      });

      // Merge Link Folder (col 8) for consecutive rows with same indikator link
      const LINK_COL = 8;
      let i = 1; // skip header
      while (i < aoa.length) {
        const link = aoa[i][LINK_COL];
        let j = i + 1;
        while (j < aoa.length && aoa[j][LINK_COL] === link && link !== "-") j++;
        if (j - i > 1) {
          merges.push({ s: { r: i, c: LINK_COL }, e: { r: j - 1, c: LINK_COL } });
        }
        i = j;
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"] = merges;
      ws["!cols"] = [
        { wch: 24 }, { wch: 28 }, { wch: 40 }, { wch: 22 },
        { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 50 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Validasi Realisasi");
      XLSX.writeFile(wb, `Validasi_Realisasi_${tahun}.xlsx`);
    } catch {
      toast.error("Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  };

  const exportLaporanIKUPK = async () => {
    if (!user?.roleId || !token) return;
    setExportingLaporan(true);
    try {
      const wb = XLSX.utils.book_new();

      for (const jenisExport of ["IKU", "PK"]) {
        const grouped = await getLaporanWithRealisasi(jenisExport, tahun, user.roleId);
        if (grouped.length === 0) continue;

        // Kumpulkan leaf ID untuk folder links (L2 untuk IKU, L3 untuk PK)
        const leafIds: number[] = [];
        for (const group of grouped) {
          for (const sub of group.subIndikators) {
            if (jenisExport === "IKU") {
              if (sub.children.length > 0) {
                sub.children.forEach(c => leafIds.push(c.id));
              } else {
                leafIds.push(sub.id);
              }
            } else {
              for (const child of sub.children) {
                for (const l3 of child.children) leafIds.push(l3.id);
              }
            }
          }
        }

        const uniqueIds = [...new Set(leafIds)];
        const folderResults = await Promise.all(
          uniqueIds.map(id => getAllRealisasiFiles(id, token).catch(() => ({ folderLink: null }))),
        );
        const folderLinkMap = new Map<number, string>();
        uniqueIds.forEach((id, idx) => {
          const link = (folderResults[idx] as { folderLink?: string | null }).folderLink;
          if (link) folderLinkMap.set(id, link);
        });

        type Row = (string | number | null)[];
        const aoa: Row[] = [];

        if (jenisExport === "IKU") {
          aoa.push(["No.", "Kode", "Indikator", "Target (%)", "Tenggat", "Realisasi (%)", "Realisasi (Angka)", "Capaian (%)", "Data Link"]);

          let no = 0;
          for (const group of grouped) {
            // L0 header
            aoa.push(["", group.kode, group.nama.toUpperCase(), group.persentaseTarget ?? "", group.tenggat ?? "", "", "", group.sdPersen != null ? `${group.sdPersen.toFixed(1)}%` : "", ""]);

            for (const sub of group.subIndikators) {
              if (sub.children.length === 0) {
                // L1 = leaf (tidak ada L2)
                no++;
                aoa.push([no, sub.kode, `  ${sub.nama}`, sub.nilaiTarget ?? "", sub.tenggat ?? "", sub.realisasiKualitas != null ? `${sub.realisasiKualitas.toFixed(1)}%` : "", sub.realisasiKuantitas ?? 0, sub.persenCapaian != null ? `${sub.persenCapaian.toFixed(1)}%` : "", folderLinkMap.get(sub.id) ?? ""]);
              } else {
                // L1 = sub-header, L2 = leaf
                aoa.push(["", sub.kode, `  ${sub.nama}`, "", "", "", "", "", ""]);
                for (const child of sub.children) {
                  no++;
                  aoa.push([no, child.kode, `    ${child.nama}`, child.nilaiTarget ?? "", child.tenggat ?? "", child.realisasiKualitas != null ? `${child.realisasiKualitas.toFixed(1)}%` : "", child.realisasiKuantitas ?? 0, child.persenCapaian != null ? `${child.persenCapaian.toFixed(1)}%` : "", folderLinkMap.get(child.id) ?? ""]);
                }
              }
            }
          }

          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 55 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 13 }, { wch: 55 }];
          XLSX.utils.book_append_sheet(wb, ws, "Laporan IKU");

        } else {
          aoa.push(["No.", "Kode", "Indikator Kinerja", "Tenggat", "Satuan", `Target ${tahun}`, "Realisasi", "Capaian (%)", "Data Link"]);

          let no = 0;
          for (const group of grouped) {
            aoa.push(["", group.kode, group.nama.toUpperCase(), "", "", "", "", "", ""]);
            for (const sub of group.subIndikators) {
              aoa.push(["", sub.kode, `  ${sub.nama}`, "", "", "", "", "", ""]);
              for (const child of sub.children) {
                aoa.push(["", child.kode, `    ${child.nama}`, "", "", "", "", "", ""]);
                for (const l3 of child.children) {
                  no++;
                  aoa.push([no, l3.kode, `      ${l3.nama}`, l3.tenggat ?? "", l3.satuan ?? "", l3.nilaiTarget ?? "", l3.realisasiKuantitas ?? 0, l3.persenCapaian != null ? `${l3.persenCapaian.toFixed(1)}%` : "", folderLinkMap.get(l3.id) ?? ""]);
                }
              }
            }
          }

          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 55 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 55 }];
          XLSX.utils.book_append_sheet(wb, ws, "Laporan PK");
        }
      }

      XLSX.writeFile(wb, `Laporan_IKU_PK_${tahun}.xlsx`);
      toast.success("Export laporan berhasil.");
    } catch {
      toast.error("Gagal mengekspor laporan.");
    } finally {
      setExportingLaporan(false);
    }
  };

  return (
    <div>
      <PageTransition>
        <p className="ikupk-header-text">Validasi Realisasi</p>

        {/* Statistik */}
        <div className="stats-grid">
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #ffffff 140%)" }}>
            <p className="stat-card-label" style={{ color: "#6366f1" }}>Total Dosen</p>
            <p className="stat-card-value">{dosenGroups.length}</p>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 140%)" }}>
            <p className="stat-card-label" style={{ color: "#d97706" }}>Total Submission</p>
            <p className="stat-card-value">{totalSubmissions}</p>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 140%)" }}>
            <p className="stat-card-label" style={{ color: "#16a34a" }}>Sudah Divalidasi</p>
            <p className="stat-card-value">{totalValidated}</p>
          </div>
          <div className="stat-card" style={{ background: "linear-gradient(135deg, #fef2f2 0%, #ffffff 140%)" }}>
            <p className="stat-card-label" style={{ color: "#dc2626" }}>Belum Divalidasi</p>
            <p className="stat-card-value">{totalSubmissions - totalValidated}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="filter-card">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label className="filter-label">Jenis</label>
                <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value as "IKU" | "PK" | "PK_IKU")} className="filter-isi">
                  <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                  <option value="PK">Perjanjian Kinerja (PK)</option>
                  <option value="PK_IKU">PK Berbasis IKU</option>
                </select>
              </div>
              <div>
                <label className="filter-label">Tahun</label>
                <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="filter-isi">
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="filter-label">Tampilan</label>
                <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#f9fafb", height: 36 }}>
                  {(["dosen", "indikator"] as const).map((mode) => (
                    <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: "0 16px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: viewMode === mode ? "#0f9f6e" : "transparent", color: viewMode === mode ? "#fff" : "#6b7280", transition: "all 0.15s" }}>
                      {mode === "dosen" ? "Per Dosen" : "Per Indikator"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportToExcel} disabled={exporting} className="btn-green-sm">
                {exporting ? "Mengekspor..." : "Export Validasi"}
              </button>
              <button onClick={exportLaporanIKUPK} disabled={exportingLaporan} className="btn-green-sm">
                {exportingLaporan ? "Mengekspor..." : "Export Laporan IKU/PK"}
              </button>
            </div>
          </div>
        </div>

        {/* Detail Modal */}
        {detail && createPortal(
          <div className="modal-overlay" onClick={() => setDetail(null)}>
            <div className="modal-content modal-content--md" onClick={e => e.stopPropagation()} style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: "85vh", overflow: "hidden" }}>

              {/* Header */}
              <div style={{ padding: "18px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #0f9f6e, #087a55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {detail.dosenNama.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail.dosenNama}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{detail.dosenEmail}</div>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280", fontSize: 13, flexShrink: 0 }}>✕</button>
              </div>

              {/* Info section */}
              <div style={{ padding: "14px 24px", borderBottom: "1px solid #f3f4f6" }}>
                {/* Indikator */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Indikator</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    {detail.submission.indikatorKode} — {detail.submission.indikatorNama}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>File Diunggah</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#15803d" }}>{detail.submission.fileCount}</div>
                  </div>
                  <div style={{ background: checkedFiles.size > 0 ? "#f0fdf4" : "#f9fafb", border: `1px solid ${checkedFiles.size > 0 ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>File Valid</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: checkedFiles.size > 0 ? "#15803d" : "#9ca3af" }}>
                      {checkedFiles.size > 0 ? checkedFiles.size : "—"}
                    </div>
                  </div>
                  <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>Target</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#374151" }}>
                      {detail.submission.targetDosen !== null ? detail.submission.targetDosen : "—"}
                    </div>
                  </div>
                  <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>Periode</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", lineHeight: 1.4, marginTop: 4 }}>
                      {detail.submission.periode ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* File list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Daftar File</span>
                  {!detailLoading && detailFiles.length > 0 && (
                    <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", borderRadius: 20, padding: "1px 8px", fontWeight: 600 }}>{detailFiles.length}</span>
                  )}
                </div>

                {detailLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>Memuat file…</div>
                ) : detailFiles.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 0", color: "#9ca3af" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                    <div style={{ fontSize: 13 }}>Tidak ada file ditemukan</div>
                  </div>
                ) : (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                    {detailFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < detailFiles.length - 1 ? "1px solid #f3f4f6" : "none", background: checkedFiles.has(i) ? "#f0fdf4" : "#fff", transition: "background 0.15s" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f9f6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {f.previewUrl
                              ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: "#0f9f6e", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{f.name}</a>
                              : <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{f.name}</span>
                            }
                            {f.sumber && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, flexShrink: 0, background: f.sumber === 'ikupk' ? '#ede9fe' : '#eff6ff', color: f.sumber === 'ikupk' ? '#7c3aed' : '#2563eb' }}>
                                {f.sumber === 'ikupk' ? 'IKUPK' : 'REPO'}
                              </span>
                            )}
                          </div>
                          {f.ownerName && (
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{f.ownerName}{f.ownerEmail ? ` · ${f.ownerEmail}` : ""}</div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, marginRight: 6 }}>{f.tanggal}</span>
                        <button
                          onClick={() => setCheckedFiles((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          })}
                          style={{ width: 22, height: 22, borderRadius: 6, border: checkedFiles.has(i) ? "none" : "2px solid #d1d5db", background: checkedFiles.has(i) ? "#0f9f6e" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s", padding: 0 }}
                        >
                          {checkedFiles.has(i) && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 24px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: 8, background: "#fafafa", borderRadius: "0 0 16px 16px" }}>
                <button onClick={() => setDetail(null)} style={{ padding: "7px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#374151" }}>
                  Tutup
                </button>
                {!detailLoading && detailFiles.length > 0 && (
                  <button onClick={handleSaveModal} disabled={savingModal} style={{ padding: "7px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: savingModal ? "#9ca3af" : "#0f9f6e", color: "#fff", cursor: savingModal ? "not-allowed" : "pointer" }}>
                    {savingModal ? "Menyimpan…" : "Simpan Validasi"}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Content — WD2 view */}
        {isWD2 && (
          loading ? (
            <p className="text-loading text-center" style={{ padding: 40 }}>Memuat data…</p>
          ) : wd2Groups.length === 0 ? (
            <p className="text-empty">Tidak ada realisasi yang sudah divalidasi atasan untuk tahun {tahun}.</p>
          ) : (
            <div className="table-section-card" style={{ overflow: "hidden", padding: 0 }}>
              <div className="table-wrapper" style={{ margin: 0 }}>
                <table className="atasan-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40, paddingLeft: 16 }}>No</th>
                      <th className="text-left">Nama</th>
                      <th className="text-left">Email</th>
                      <th className="text-center">Indikator</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wd2Groups.map((g, i) => (
                      <tr key={g.userId}>
                        <td className="text-center" style={{ paddingLeft: 16, color: "#6b7280", fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{g.nama}</div>
                        </td>
                        <td style={{ fontSize: 12, color: "#6b7280" }}>{g.email}</td>
                        <td className="text-center">
                          <span style={{ background: "#eff6ff", color: "#2563eb", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                            {g.realisasi.length} indikator
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleValidasiWD2(g.userId)}
                            disabled={validatingWD2 === g.userId}
                            style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, background: validatingWD2 === g.userId ? "#9ca3af" : "#0f9f6e", color: "#fff", cursor: validatingWD2 === g.userId ? "not-allowed" : "pointer" }}
                          >
                            {validatingWD2 === g.userId ? "Memvalidasi…" : "Validasi Final"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Content — Atasan view */}
        {!isWD2 && (loading ? (
          <p className="text-loading text-center" style={{ padding: 40 }}>Memuat data…</p>
        ) : (viewMode === "dosen" ? dosenGroups.length === 0 : indikatorGroups.length === 0) ? (
          <p className="text-empty">Tidak ada submission {jenisFilter === "PK_IKU" ? "PK Berbasis IKU" : jenisFilter} dari bawahan Anda untuk tahun {tahun}.</p>
        ) : (
          <div className="table-section-card" style={{ overflow: "hidden", padding: 0 }}>
            <div className="table-wrapper" style={{ margin: 0 }}>
              {viewMode === "dosen" ? (
                <table className="atasan-table">
                  <thead>
                    <tr>
                      <th className="text-left" style={{ width: "22%", paddingLeft: 16 }}>Dosen</th>
                      <th className="text-left" style={{ width: "30%" }}>Indikator</th>
                      <th className="text-center">Periode</th>
                      <th className="text-center">Target</th>
                      <th className="text-center">File</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dosenGroups.map((dg, gi) => {
                      const validCount = dg.submissions.filter((s) => s.validFileCount !== null).length;
                      return (
                        <>
                          <tr key={`gh-${dg.dosenId}`} style={{ background: "#fafafa" }}>
                            <td colSpan={7} style={{ padding: "8px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #0f9f6e, #087a55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                  {dg.dosenNama.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{dg.dosenNama}</span>
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>{dg.dosenEmail}</span>
                                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: validCount === dg.submissions.length ? "#16a34a" : "#6b7280" }}>
                                  {validCount}/{dg.submissions.length} divalidasi
                                </span>
                              </div>
                            </td>
                          </tr>
                          {dg.submissions.map((s) => (
                            <tr key={s.id}>
                              <td style={{ paddingLeft: 52 }} />
                              <td>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{s.indikatorKode}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{s.indikatorNama}</div>
                              </td>
                              <td className="text-center" style={{ fontSize: 12 }}>{s.periode ?? "-"}</td>
                              <td className="text-center" style={{ fontSize: 13, fontWeight: 600 }}>{s.targetDosen ?? "-"}</td>
                              <td className="text-center">
                                <span className={s.fileCount > 0 ? "file-count-green" : "file-count-gray"}>{s.fileCount} file</span>
                              </td>
                              <td className="text-center">
                                {s.validFileCount !== null ? (
                                  <span className="status-validated">{s.validFileCount} valid</span>
                                ) : (
                                  <span className="badge-pending">Belum</span>
                                )}
                              </td>
                              <td className="text-center">
                                <button
                                  onClick={() => setDetail({ dosenNama: dg.dosenNama, dosenEmail: dg.dosenEmail, submission: s })}
                                  style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#374151" }}
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                          {gi < dosenGroups.length - 1 && (
                            <tr key={`sep-${dg.dosenId}`}><td colSpan={7} style={{ padding: 0, height: 6, background: "#f0f2f5" }} /></tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="atasan-table">
                  <thead>
                    <tr>
                      <th className="text-left" style={{ width: "32%", paddingLeft: 16 }}>Indikator</th>
                      <th className="text-left" style={{ width: "22%" }}>Dosen</th>
                      <th className="text-center">Periode</th>
                      <th className="text-center">Target</th>
                      <th className="text-center">File</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indikatorGroups.map((g, gi) => {
                      const validCount = g.submissions.filter((s) => s.validFileCount !== null).length;
                      return (
                        <>
                          <tr key={`gh-${g.indikator.id}`} style={{ background: "#fafafa" }}>
                            <td colSpan={7} style={{ padding: "8px 16px" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{g.indikator.kode}</span>
                              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{g.indikator.nama}</span>
                              <span style={{ float: "right", fontSize: 11, fontWeight: 600, color: validCount === g.submissions.length ? "#16a34a" : "#6b7280" }}>
                                {validCount}/{g.submissions.length} divalidasi
                              </span>
                            </td>
                          </tr>
                          {g.submissions.map((s) => (
                            <tr key={s.id}>
                              <td style={{ paddingLeft: 16 }} />
                              <td>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{s.dosenNama}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{s.dosenEmail}</div>
                              </td>
                              <td className="text-center" style={{ fontSize: 12 }}>{s.periode ?? "-"}</td>
                              <td className="text-center" style={{ fontSize: 13, fontWeight: 600 }}>{s.targetDosen ?? "-"}</td>
                              <td className="text-center">
                                <span className={s.fileCount > 0 ? "file-count-green" : "file-count-gray"}>{s.fileCount} file</span>
                              </td>
                              <td className="text-center">
                                {s.validFileCount !== null ? (
                                  <span className="status-validated">{s.validFileCount} valid</span>
                                ) : (
                                  <span className="badge-pending">Belum</span>
                                )}
                              </td>
                              <td className="text-center">
                                <button
                                  onClick={() => setDetail({ dosenNama: s.dosenNama, dosenEmail: s.dosenEmail, submission: { ...s, indikatorId: g.indikator.id, indikatorKode: g.indikator.kode, indikatorNama: g.indikator.nama } })}
                                  style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#374151" }}
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                          {gi < indikatorGroups.length - 1 && (
                            <tr key={`sep-${g.indikator.id}`}><td colSpan={7} style={{ padding: 0, height: 6, background: "#f0f2f5" }} /></tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </PageTransition>
    </div>
  );
}
