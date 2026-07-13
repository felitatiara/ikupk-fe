"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import {
  getSubmissionsForAtasan,
  getSubmissionsForPimpinan,
  validateRealisasiAtasan,
  validatePimpinan,
  requestRevision,
  getAllRealisasiFiles,
  getIkupkFilesByUser,
  getLaporanWithRealisasi,
  getIndikator,
  getEkspektasiBawahan,
  upsertEkspektasi,
  SubmissionPerIndikator,
  RealisasiSubmission,
  EkspektasiBawahanRow,
  API_BASE_URL,
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type DosenSubmission = RealisasiSubmission & {
  indikatorId: number;
  indikatorKode: string;
  indikatorNama: string;
  sumberData?: string;
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
  fromPimpinan?: boolean;
};

type PimpinanDosenEntry = {
  realisasiId: number;
  dosenId: number;
  dosenNama: string;
  dosenEmail: string;
  targetDosen: number | null;
  validFileCount: number | null;
  status: string;
  tahun: string | null;
  periode: string | null;
};

type PimpinanIndikator = {
  indikatorId: number;
  kodeIndikator: string;
  namaIndikator: string;
  sumberData?: string;
  targetBawahan: number;
  totalValidFiles: number;
  dosenCount: number;
  pendingCount: number;
  dosenList: PimpinanDosenEntry[];
};

type PimpinanGroup = {
  bawahanId: number;
  bawahanNama: string;
  bawahanEmail: string;
  indikators: PimpinanIndikator[];
};

const EKSPEKTASI_CONFIG = [
  { nilai: 'melebihi', label: 'Melebihi Ekspektasi', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { nilai: 'sesuai', label: 'Sesuai Ekspektasi', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { nilai: 'di_bawah', label: 'Di Bawah Ekspektasi', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
] as const;


export default function ValidasiRealisasiAtasanContent() {
  const { user, token } = useAuth();
  const pathname = usePathname();

  // ── Verifikasi File state ────────────────────────────────────────────────
  const [rawGroups, setRawGroups] = useState<SubmissionPerIndikator[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [jenisFilter, setJenisFilter] = useState<"IKU" | "PK" | "PK_IKU">("IKU");
  const [pkBerbasisIkuIds, setPkBerbasisIkuIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"dosen" | "indikator">("dosen");

  const [pimpinanGroups, setPimpinanGroups] = useState<PimpinanGroup[]>([]);
  const [validatingPimpinan, setValidatingPimpinan] = useState<string | null>(null);
  const [expandedPimpinan, setExpandedPimpinan] = useState<Set<string>>(new Set());

  const [detail, setDetail] = useState<DetailModal | null>(null);
  const [detailFiles, setDetailFiles] = useState<{ name: string; previewUrl?: string; tanggal: string; ownerName?: string; ownerEmail?: string; sumber?: 'repository' | 'repository-all' | 'ikupk'; }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkedFiles, setCheckedFiles] = useState<Set<number>>(new Set());
  const [savingModal, setSavingModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [revisiMode, setRevisiMode] = useState(false);
  const [revisiCatatan, setRevisiCatatan] = useState('');
  const [requestingRevisi, setRequestingRevisi] = useState(false);
  const [exportingLaporan, setExportingLaporan] = useState(false);

  // ── Penilaian Ekspektasi state ───────────────────────────────────────────
  const [ekspektasiRows, setEkspektasiRows] = useState<EkspektasiBawahanRow[]>([]);
  const [savingEkspektasi, setSavingEkspektasi] = useState<number | null>(null);

  // Tutup modal portal saat navigasi agar tidak menutupi halaman SKP atau halaman lain
  useEffect(() => {
    setDetail(null);
    setRevisiMode(false);
    setRevisiCatatan('');
  }, [pathname]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    setLoading(true);
    getIndikator(tahun).then(all => {
      const ids = new Set(all.filter(i => i.jenis === "PK" && i.linkedIkuId != null).map(i => i.id));
      setPkBerbasisIkuIds(ids);
    }).catch(() => {});
    Promise.all([
      getSubmissionsForAtasan(uid, tahun),
      getSubmissionsForPimpinan(uid, tahun),
    ]).then(([atasanData, pimpinanData]) => {
      setRawGroups(atasanData);
      setPimpinanGroups(pimpinanData);
    }).catch(() => {
      setRawGroups([]);
      setPimpinanGroups([]);
    }).finally(() => setLoading(false));
  }, [user?.id, tahun]);

  useEffect(() => {
    if (!user?.id) return;
    getEkspektasiBawahan(user.id, tahun).then(setEkspektasiRows).catch(() => {});
  }, [user?.id, tahun]);

  useEffect(() => {
    if (!detail || !token) return;
    setDetailLoading(true);
    setDetailFiles([]);
    setCheckedFiles(new Set());

    type RepoFile = { name: string; preview_url?: string; created_at?: string; ownerName?: string; ownerEmail?: string; owner?: { name?: string; email?: string } };
    type IkupkFile = { fileName: string; fileUrl: string; createdAt?: string };
    type DetailFile = { name: string; previewUrl?: string; tanggal: string; ownerName?: string; ownerEmail?: string; sumber?: 'repository' | 'repository-all' | 'ikupk' };

    const dosenEmailLower = detail.dosenEmail.toLowerCase();
    const isIkupk = (detail.submission.sumberData ?? 'repository') === 'ikupk';

    Promise.all([
      isIkupk
        ? Promise.resolve({ files: [] as RepoFile[] })
        : getAllRealisasiFiles(detail.submission.indikatorId, token).catch(() => ({ files: [] as RepoFile[] })),
      isIkupk
        ? getIkupkFilesByUser(detail.submission.dosenId, detail.submission.indikatorId, tahun).catch(() => [] as IkupkFile[])
        : Promise.resolve([] as IkupkFile[]),
    ]).then(([repoResult, ikupkFiles]) => {
      const mapRepoFile = (f: RepoFile, isAll = false): DetailFile => ({
        name: f.name,
        previewUrl: f.preview_url,
        tanggal: f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-',
        ownerName: f.ownerName || f.owner?.name,
        ownerEmail: f.ownerEmail || f.owner?.email,
        sumber: (isAll ? 'repository-all' : 'repository') as 'repository' | 'repository-all',
      });

      let merged: DetailFile[];
      if (isIkupk) {
        merged = (ikupkFiles as IkupkFile[]).map((f) => ({
          name: f.fileName,
          previewUrl: `${API_BASE_URL}${f.fileUrl}`,
          tanggal: f.createdAt ? new Date(f.createdAt).toLocaleDateString('id-ID') : '-',
          ownerName: detail.dosenNama,
          ownerEmail: detail.dosenEmail,
          sumber: 'ikupk' as const,
        }));
      } else {
        const ownRepoFiles = (repoResult.files as RepoFile[])
          .filter((f) => (f.ownerEmail || f.owner?.email || '').toLowerCase() === dosenEmailLower)
          .map((f) => mapRepoFile(f));
        merged = ownRepoFiles;
        if (merged.length === 0 && repoResult.files.length > 0) {
          merged = (repoResult.files as RepoFile[]).map((f) => mapRepoFile(f, true));
        }
      }

      setDetailFiles(merged);
      const savedCount = detail.submission.validFileCount ?? 0;
      setCheckedFiles(new Set(Array.from({ length: Math.min(savedCount, merged.length) }, (_, i) => i)));
    }).finally(() => setDetailLoading(false));
  }, [detail, token, tahun]);

  const handleValidasiPimpinan = async (bawahanId: number, indikatorId: number) => {
    if (!user?.id) return;
    const key = `${bawahanId}:${indikatorId}`;
    setValidatingPimpinan(key);
    try {
      await validatePimpinan(user.id, bawahanId, indikatorId, tahun);
      toast.success("Validasi pimpinan berhasil.");
      setPimpinanGroups(prev => prev.map(g => {
        if (g.bawahanId !== bawahanId) return g;
        return {
          ...g,
          indikators: g.indikators.map(ind => {
            if (ind.indikatorId !== indikatorId) return ind;
            return {
              ...ind,
              dosenList: ind.dosenList.map(d => ({ ...d, status: 'validated_wd2' })),
              pendingCount: 0,
            };
          }),
        };
      }));
    } catch {
      toast.error("Gagal melakukan validasi pimpinan.");
    } finally {
      setValidatingPimpinan(null);
    }
  };

  const handleSetEkspektasi = async (targetUserId: number, nilai: string) => {
    if (!user?.id) return;
    setSavingEkspektasi(targetUserId);
    try {
      await upsertEkspektasi({ penilaiId: user.id, targetUserId, tahun, ekspektasi: nilai });
      setEkspektasiRows(prev =>
        prev.map(r => r.userId === targetUserId ? { ...r, ekspektasi: nilai as EkspektasiBawahanRow['ekspektasi'] } : r)
      );
      toast.success("Penilaian ekspektasi berhasil disimpan.");
    } catch {
      toast.error("Gagal menyimpan penilaian.");
    } finally {
      setSavingEkspektasi(null);
    }
  };

  const matchesJenisFilter = (g: SubmissionPerIndikator): boolean => {
    const jenis = g.indikator.jenis.toUpperCase();
    if (jenisFilter === "PK_IKU") return jenis === "PK" && pkBerbasisIkuIds.has(g.indikator.id);
    return jenis === jenisFilter;
  };

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
          sumberData: g.indikator.sumberData ?? 'repository',
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
  })();

  const indikatorGroups = rawGroups.filter(matchesJenisFilter).slice().sort((a, b) => a.indikator.kode.localeCompare(b.indikator.kode));
  const totalSubmissions = rawGroups.reduce((n, g) => n + g.submissions.length, 0);
  const totalValidated = rawGroups.reduce((n, g) => n + g.submissions.filter((s) => s.validFileCount !== null).length, 0);

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

  const handleRequestRevisi = async () => {
    if (!detail || !token) return;
    setRequestingRevisi(true);
    try {
      // Simpan jumlah file valid terlebih dahulu jika ada yang diceklis
      if (checkedFiles.size > 0) {
        await validateRealisasiAtasan(detail.submission.id, checkedFiles.size, token ?? undefined);
      }
      // Kirim permintaan revisi dengan catatan (validFileCount tetap dipertahankan di backend)
      await requestRevision(detail.submission.id, revisiCatatan || undefined, token);
      const newValidCount = checkedFiles.size > 0 ? checkedFiles.size : detail.submission.validFileCount;
      setRawGroups((prev) =>
        prev.map((g) => ({
          ...g,
          submissions: g.submissions.map((s) =>
            s.id === detail.submission.id
              ? { ...s, validFileCount: newValidCount, catatanRevisi: revisiCatatan || null, status: "needs_revision" }
              : s
          ),
        }))
      );
      toast.success("Permintaan revisi berhasil dikirim. Notifikasi telah dikirim ke dosen.");
      setDetail(null);
      setRevisiMode(false);
      setRevisiCatatan('');
    } catch {
      toast.error("Gagal mengirim permintaan revisi.");
    } finally {
      setRequestingRevisi(false);
    }
  };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const freshRaw = await getSubmissionsForAtasan(user!.id, tahun);
      const filteredFresh = freshRaw.filter(g => g.indikator.jenis.toUpperCase() === jenisFilter);
      const freshDosenMap = new Map<number, DosenGroup>();
      filteredFresh.forEach(g => {
        g.submissions.forEach(s => {
          if (!freshDosenMap.has(s.dosenId)) {
            freshDosenMap.set(s.dosenId, { dosenId: s.dosenId, dosenNama: s.dosenNama, dosenEmail: s.dosenEmail, submissions: [] });
          }
          freshDosenMap.get(s.dosenId)!.submissions.push({
            ...s,
            indikatorId: g.indikator.id,
            indikatorKode: g.indikator.kode,
            indikatorNama: g.indikator.nama,
          });
        });
      });
      const freshDosenGroups = Array.from(freshDosenMap.values()).sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
      const indikatorIds = [...new Set(freshDosenGroups.flatMap(dg => dg.submissions.map(s => s.indikatorId)))];
      const fileResults = await Promise.allSettled(indikatorIds.map(id => getAllRealisasiFiles(id, token)));
      const folderLinkMap = new Map<number, string>();
      indikatorIds.forEach((id, idx) => {
        const result = fileResults[idx];
        if (result.status === "fulfilled" && result.value.folderLink) folderLinkMap.set(id, result.value.folderLink);
      });

      type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };
      const COLS = ["Nama Dosen", "Email", "Indikator", "Periode", "Target", "File Diunggah", "File Valid", "Status", "Link Folder"];
      const aoa: (string | number)[][] = [COLS];
      const merges: MergeRange[] = [];

      freshDosenGroups.forEach((dg) => {
        dg.submissions.forEach((s) => {
          const folderLink = folderLinkMap.get(s.indikatorId) || "-";
          aoa.push([dg.dosenNama, dg.dosenEmail, s.indikatorKode + " — " + s.indikatorNama, s.periode ?? "-", s.targetDosen ?? "-", s.fileCount, s.validFileCount ?? "-", s.status, folderLink]);
          void 0;
        });
      });

      const LINK_COL = 8;
      let i = 1;
      while (i < aoa.length) {
        const link = aoa[i][LINK_COL];
        let j = i + 1;
        while (j < aoa.length && aoa[j][LINK_COL] === link && link !== "-") j++;
        if (j - i > 1) merges.push({ s: { r: i, c: LINK_COL }, e: { r: j - 1, c: LINK_COL } });
        i = j;
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"] = merges;
      ws["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 40 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 50 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Verifikasi Capaian");
      XLSX.writeFile(wb, `Verifikasi_Capaian_${tahun}.xlsx`);
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

        const leafIds: number[] = [];
        for (const group of grouped) {
          for (const sub of group.subIndikators) {
            if (jenisExport === "IKU") {
              if (sub.children.length > 0) sub.children.forEach(c => leafIds.push(c.id));
              else leafIds.push(sub.id);
            } else {
              for (const child of sub.children) {
                for (const l3 of child.children) leafIds.push(l3.id);
              }
            }
          }
        }

        const uniqueIds = [...new Set(leafIds)];
        const folderResults = await Promise.all(uniqueIds.map(id => getAllRealisasiFiles(id, token).catch(() => ({ folderLink: null }))));
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
            aoa.push(["", group.kode, group.nama.toUpperCase(), group.persentaseTarget ?? "", group.tenggat ?? "", "", "", group.sdPersen != null ? `${group.sdPersen.toFixed(1)}%` : "", ""]);
            for (const sub of group.subIndikators) {
              if (sub.children.length === 0) {
                no++;
                aoa.push([no, sub.kode, `  ${sub.nama}`, sub.nilaiTarget ?? "", sub.tenggat ?? "", sub.realisasiKualitas != null ? `${sub.realisasiKualitas.toFixed(1)}%` : "", sub.realisasiKuantitas ?? 0, sub.persenCapaian != null ? `${sub.persenCapaian.toFixed(1)}%` : "", folderLinkMap.get(sub.id) ?? ""]);
              } else {
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
      <style>{`
        .vc-hero { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px 32px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .vc-eyebrow { font-size: 11px; font-weight: 700; color: #0f9f6e; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .vc-title { font-size: 22px; font-weight: 800; color: #0f2f4f; margin: 0 0 6px; }
        .vc-sub { font-size: 13px; color: #6b7280; margin: 0; }
        .vc-stats-card { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; display: flex; flex-direction: row; align-items: center; gap: 0; }
        .vc-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 14px; }
        .vc-stat + .vc-stat { border-left: 1px solid #e5e7eb; }
        .vc-stat-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .vc-toolbar { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 10px 14px; margin-bottom: 20px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .vc-tab { padding: 8px 18px; border-radius: 10px; border: none; background: transparent; color: #6b7280; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .vc-tab:hover { background: #f0fdf4; color: #0f9f6e; }
        .vc-tab--active { background: #f0fdf4; color: #0f9f6e; font-weight: 700; box-shadow: 0 1px 4px rgba(15,159,110,0.12); }
        .atasan-table thead tr { background: #0f2f4f !important; }
        .atasan-table th { color: #e8eef7 !important; font-weight: 900 !important; border-bottom: 1px solid rgba(255,255,255,0.12) !important; }
        .vc-table-card { overflow: hidden; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15,23,42,0.07); }
      `}</style>
      <PageTransition>

        {/* ── Hero Card ── */}
        <div className="vc-hero">
          <div>
            <h3 className="ikupk-card-title">Verifikasi Capaian Dosen</h3>
            <p className="vc-sub">Validasi file realisasi dan tentukan penilaian ekspektasi kinerja dosen.</p>
          </div>
          {!loading && dosenGroups.length > 0 && (
            <div className="vc-stats-card">
              <div className="vc-stat">
                <span className="vc-stat-label">Total Dosen</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#6366f1" }}>{dosenGroups.length}</span>
              </div>
              <div className="vc-stat">
                <span className="vc-stat-label">Submission</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#d97706" }}>{totalSubmissions}</span>
              </div>
              <div className="vc-stat">
                <span className="vc-stat-label">Divalidasi</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{totalValidated}</span>
              </div>
              <div className="vc-stat">
                <span className="vc-stat-label">Belum</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#dc2626" }}>{totalSubmissions - totalValidated}</span>
              </div>
            </div>
          )}
        </div>

        {/* Filter */}
            <div className="filter-card">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <>
                      <div>
                        <label className="filter-label">Target</label>
                        <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value as "IKU" | "PK" | "PK_IKU")} className="filter-isi">
                          <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                          <option value="PK">Perjanjian Kinerja (PK)</option>
                          <option value="PK_IKU">PK Berbasis IKU</option>
                        </select>
                      </div>
                      <div>
                        <label className="filter-label">Jenis</label>
                        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#f9fafb", height: 36 }}>
                          {(["dosen", "indikator"] as const).map((mode) => (
                            <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: "0 16px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: viewMode === mode ? "#0f9f6e" : "transparent", color: viewMode === mode ? "#fff" : "#6b7280", transition: "all 0.15s" }}>
                              {mode === "dosen" ? "Per Dosen" : "Per Indikator"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  <div>
                    <label className="filter-label">Tahun</label>
                    <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="filter-isi">
                      {[2023, 2024, 2025, 2026].map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
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
                  <div style={{ padding: "18px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #0f9f6e, #087a55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {detail.dosenNama.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail.dosenNama}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{detail.dosenEmail}</div>
                    </div>
                    <button onClick={() => { setDetail(null); setRevisiMode(false); setRevisiCatatan(''); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280", fontSize: 13, flexShrink: 0 }}>✕</button>
                  </div>

                  <div style={{ padding: "14px 24px", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Indikator</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{detail.submission.indikatorKode} — {detail.submission.indikatorNama}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>File Diunggah</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#15803d" }}>{detail.submission.fileCount}</div>
                      </div>
                      <div style={{ background: checkedFiles.size > 0 ? "#f0fdf4" : "#f9fafb", border: `1px solid ${checkedFiles.size > 0 ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>File Valid</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: checkedFiles.size > 0 ? "#15803d" : "#9ca3af" }}>{checkedFiles.size > 0 ? checkedFiles.size : "—"}</div>
                      </div>
                      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>Target</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#374151" }}>{detail.submission.targetDosen !== null ? detail.submission.targetDosen : "—"}</div>
                      </div>
                      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginBottom: 2 }}>Periode</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", lineHeight: 1.4, marginTop: 4 }}>{detail.submission.periode ?? "—"}</div>
                      </div>
                    </div>
                  </div>

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
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {f.previewUrl
                                  ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: "#0f9f6e", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{f.name}</a>
                                  : <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{f.name}</span>
                                }
                                {f.sumber && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, flexShrink: 0, background: f.sumber === "ikupk" ? "#ede9fe" : "#eff6ff", color: f.sumber === "ikupk" ? "#7c3aed" : "#2563eb" }}>
                                    {f.sumber === "ikupk" ? "IKUPK" : "REPO"}
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

                  <div style={{ padding: "12px 24px", borderTop: "1px solid #f3f4f6", background: "#fafafa", borderRadius: "0 0 16px 16px" }}>
                    {/* Banner catatan revisi sebelumnya — tampil jika ada */}
                    {!detailLoading && !detail?.fromPimpinan && !revisiMode && detail.submission.catatanRevisi && (
                      <div className="alert-banner alert-banner--warning" style={{ marginBottom: 10 }}>
                        <span className="fw-700">Catatan revisi sebelumnya: </span>
                        {detail.submission.catatanRevisi}
                      </div>
                    )}
                    {/* Form catatan revisi — tampil saat revisiMode aktif */}
                    {!detailLoading && !detail?.fromPimpinan && revisiMode && (
                      <div style={{ marginBottom: 10 }}>
                        <label className="catatan-label">
                          Catatan untuk dosen {checkedFiles.size > 0 ? `(${checkedFiles.size} file valid akan disimpan)` : ""}:
                        </label>
                        <textarea
                          value={revisiCatatan}
                          onChange={(e) => setRevisiCatatan(e.target.value)}
                          placeholder="Jelaskan dokumen mana yang perlu diperbaiki dan alasannya..."
                          rows={2}
                          className="catatan-textarea"
                          style={{ border: "1px solid #fca5a5" }}
                        />
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        onClick={() => { setDetail(null); setRevisiMode(false); setRevisiCatatan(''); }}
                        style={{ padding: "7px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#374151" }}
                      >
                        Tutup
                      </button>
                      {!detailLoading && !detail?.fromPimpinan && !revisiMode && (
                        <button
                          onClick={() => { setRevisiMode(true); setRevisiCatatan(detail.submission.catatanRevisi ?? ''); }}
                          disabled={savingModal}
                          style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1.5px solid #dc2626", background: "#fff", color: "#dc2626", cursor: "pointer" }}
                        >
                          ↩ Minta Revisi
                        </button>
                      )}
                      {!detailLoading && !detail?.fromPimpinan && revisiMode && (
                        <>
                          <button
                            onClick={() => { setRevisiMode(false); setRevisiCatatan(''); }}
                            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#374151" }}
                          >
                            Batal
                          </button>
                          <button
                            onClick={handleRequestRevisi}
                            disabled={requestingRevisi}
                            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: requestingRevisi ? "#9ca3af" : "#dc2626", color: "#fff", cursor: requestingRevisi ? "not-allowed" : "pointer" }}
                          >
                            {requestingRevisi ? "Memproses…" : checkedFiles.size > 0 ? `Simpan ${checkedFiles.size} Valid & Minta Revisi` : "Konfirmasi Revisi"}
                          </button>
                        </>
                      )}
                      {!detailLoading && detailFiles.length > 0 && !detail?.fromPimpinan && !revisiMode && (
                        <button onClick={handleSaveModal} disabled={savingModal} style={{ padding: "7px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: savingModal ? "#9ca3af" : "#0f9f6e", color: "#fff", cursor: savingModal ? "not-allowed" : "pointer" }}>
                          {savingModal ? "Menyimpan…" : "Simpan Validasi"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Content — Validasi Pimpinan (disposisi-chain-based) */}
            {pimpinanGroups.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                </div>
                <div className="vc-table-card">
                  <div className="table-wrapper" style={{ margin: 0 }}>
                    <table className="atasan-table">
                      <thead>
                        <tr>
                          <th className="text-left" style={{ width: "20%", paddingLeft: 16 }}>Bawahan</th>
                          <th className="text-left" style={{ width: "28%" }}>Indikator</th>
                          <th className="text-center">Target</th>
                          <th className="text-center">Total Valid</th>
                          <th className="text-center">Dosen</th>
                          <th className="text-center">Ekspektasi</th>
                          <th className="text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pimpinanGroups.map((g, gi) => (
                          <React.Fragment key={`pg-g-${g.bawahanId}`}>
                            {/* Bawahan group header */}
                            <tr style={{ background: "#f0fdf4" }}>
                              <td colSpan={7} style={{ padding: "8px 16px", borderBottom: "1px solid #dcfce7" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #0f9f6e, #087a55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                    {g.bawahanNama.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{g.bawahanNama}</span>
                                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{g.bawahanEmail}</span>
                                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
                                    {g.indikators.length} indikator
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {/* Per-indikator rows */}
                            {g.indikators.map((ind) => {
                              const pKey = `${g.bawahanId}:${ind.indikatorId}`;
                              const isValidating = validatingPimpinan === pKey;
                              const isExpanded = expandedPimpinan.has(pKey);
                              const allDone = ind.pendingCount === 0;
                              const ekspRow = ekspektasiRows.find(r => r.userId === g.bawahanId);
                              const currentEksp = ekspRow?.ekspektasi ?? "";
                              const cfg = EKSPEKTASI_CONFIG.find(c => c.nilai === currentEksp);
                              return (
                                <React.Fragment key={pKey}>
                                  <tr>
                                    <td style={{ paddingLeft: 48 }}>
                                      <button
                                        onClick={() => setExpandedPimpinan(prev => {
                                          const next = new Set(prev);
                                          if (next.has(pKey)) next.delete(pKey); else next.add(pKey);
                                          return next;
                                        })}
                                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, padding: 0 }}
                                      >
                                        <span style={{ fontSize: 10, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                                        {ind.dosenCount} dosen
                                      </button>
                                    </td>
                                    <td>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{ind.kodeIndikator}</div>
                                      <div style={{ fontSize: 11, color: "#6b7280" }}>{ind.namaIndikator}</div>
                                    </td>
                                    <td className="text-center" style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{ind.targetBawahan}</td>
                                    <td className="text-center">
                                      <span style={{ fontSize: 13, fontWeight: 700, color: ind.totalValidFiles > 0 ? "#16a34a" : "#9ca3af" }}>{ind.totalValidFiles}</span>
                                      <span style={{ fontSize: 11, color: "#9ca3af" }}> / {ind.targetBawahan}</span>
                                    </td>
                                    <td className="text-center">
                                      {allDone ? (
                                        <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Semua tervalidasi</span>
                                      ) : (
                                        <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{ind.pendingCount} menunggu</span>
                                      )}
                                    </td>
                                    <td className="text-center">
                                      <select
                                        value={currentEksp}
                                        disabled={savingEkspektasi === g.bawahanId}
                                        onChange={(e) => { if (e.target.value) handleSetEkspektasi(g.bawahanId, e.target.value); }}
                                        style={{ fontSize: 11, padding: "3px 7px", borderRadius: 7, border: `1.5px solid ${cfg?.border ?? "#e5e7eb"}`, background: cfg?.bg ?? "#f9fafb", color: cfg?.color ?? "#6b7280", fontWeight: 700, cursor: savingEkspektasi === g.bawahanId ? "not-allowed" : "pointer", opacity: savingEkspektasi === g.bawahanId ? 0.6 : 1, minWidth: 140 }}
                                      >
                                        <option value="">— Ekspektasi —</option>
                                        {EKSPEKTASI_CONFIG.map(({ nilai, label }) => (
                                          <option key={nilai} value={nilai}>{label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="text-center">
                                      <button
                                        onClick={() => handleValidasiPimpinan(g.bawahanId, ind.indikatorId)}
                                        disabled={isValidating}
                                        style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, border: allDone ? "1.5px solid #059669" : "none", borderRadius: 6, background: isValidating ? "#9ca3af" : allDone ? "#f0fdf4" : "#0f9f6e", color: isValidating ? "#fff" : allDone ? "#059669" : "#fff", cursor: isValidating ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                                      >
                                        {isValidating ? "Memvalidasi…" : allDone ? "↺ Validasi Ulang" : "Validasi Final"}
                                      </button>
                                    </td>
                                  </tr>
                                  {/* Dosen detail rows — expandable */}
                                  {isExpanded && ind.dosenList.map((d) => (
                                    <tr key={`pg-d-${d.realisasiId}`} style={{ background: "#fafffe" }}>
                                      <td style={{ paddingLeft: 72 }} />
                                      <td style={{ paddingLeft: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{d.dosenNama}</div>
                                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{d.dosenEmail}</div>
                                      </td>
                                      <td className="text-center" style={{ fontSize: 12, color: "#6b7280" }}>{d.targetDosen ?? "—"}</td>
                                      <td className="text-center">
                                        {d.validFileCount !== null ? (
                                          <span className="status-validated">{d.validFileCount} valid</span>
                                        ) : d.status === 'needs_revision' ? (
                                          <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Perlu Revisi</span>
                                        ) : (
                                          <span className="badge-pending">Belum</span>
                                        )}
                                      </td>
                                      <td className="text-center" style={{ fontSize: 11, color: d.status === 'validated_wd2' ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>
                                        {d.status === 'validated_wd2' ? '✓ Final' : 'Menunggu validasi'}
                                      </td>
                                      <td />
                                      <td className="text-center">
                                        <button
                                          onClick={() => setDetail({
                                            dosenNama: d.dosenNama,
                                            dosenEmail: d.dosenEmail,
                                            fromPimpinan: true,
                                            submission: {
                                              id: d.realisasiId,
                                              dosenId: d.dosenId,
                                              dosenNama: d.dosenNama,
                                              dosenEmail: d.dosenEmail,
                                              fileCount: d.validFileCount ?? 0,
                                              validFileCount: d.validFileCount,
                                              catatanRevisi: null,
                                              targetDosen: d.targetDosen,
                                              status: d.status,
                                              tahun: d.tahun ?? tahun,
                                              periode: d.periode,
                                              indikatorId: ind.indikatorId,
                                              indikatorKode: ind.kodeIndikator,
                                              indikatorNama: ind.namaIndikator,
                                              sumberData: ind.sumberData ?? 'repository',
                                            },
                                          })}
                                          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#374151" }}
                                        >
                                          Lihat Dokumen
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                            {gi < pimpinanGroups.length - 1 && (
                              <tr><td colSpan={7} style={{ padding: 0, height: 8, background: "#f0f2f5" }} /></tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Content — Atasan view (validasi langsung ke bawahan) */}
            {(loading ? (
              <p className="text-loading text-center" style={{ padding: 40 }}>Memuat data…</p>
            ) : (viewMode === "dosen" ? dosenGroups.length === 0 : indikatorGroups.length === 0) ? (
              <p className="text-empty">Tidak ada submission {jenisFilter === "PK_IKU" ? "PK Berbasis IKU" : jenisFilter} dari bawahan Anda untuk tahun {tahun}.</p>
            ) : (
              <div className="vc-table-card">
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
                            <React.Fragment key={`dg-${dg.dosenId}`}>
                              <tr style={{ background: "#fafafa" }}>
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
                                    {(() => {
                                      const ekspRow = ekspektasiRows.find(r => r.userId === dg.dosenId);
                                      const currentEksp = ekspRow?.ekspektasi ?? "";
                                      const cfg = EKSPEKTASI_CONFIG.find(c => c.nilai === currentEksp);
                                      return (
                                        <select
                                          value={currentEksp}
                                          disabled={savingEkspektasi === dg.dosenId}
                                          onChange={(e) => { if (e.target.value) handleSetEkspektasi(dg.dosenId, e.target.value); }}
                                          style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, border: `1.5px solid ${cfg?.border ?? "#e5e7eb"}`, background: cfg?.bg ?? "#f9fafb", color: cfg?.color ?? "#6b7280", fontWeight: 700, cursor: savingEkspektasi === dg.dosenId ? "not-allowed" : "pointer", opacity: savingEkspektasi === dg.dosenId ? 0.6 : 1, minWidth: 160 }}
                                        >
                                          <option value="">— Ekspektasi —</option>
                                          {EKSPEKTASI_CONFIG.map(({ nilai, label }) => (
                                            <option key={nilai} value={nilai}>{label}</option>
                                          ))}
                                        </select>
                                      );
                                    })()}
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
                                    ) : s.status === 'needs_revision' ? (
                                      <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Perlu Revisi</span>
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
                                <tr><td colSpan={7} style={{ padding: 0, height: 6, background: "#f0f2f5" }} /></tr>
                              )}
                            </React.Fragment>
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
                            <React.Fragment key={`ig-${g.indikator.id}`}>
                              <tr style={{ background: "#fafafa" }}>
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
                                    ) : s.status === 'needs_revision' ? (
                                      <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Perlu Revisi</span>
                                    ) : (
                                      <span className="badge-pending">Belum</span>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    <button
                                      onClick={() => setDetail({ dosenNama: s.dosenNama, dosenEmail: s.dosenEmail, submission: { ...s, indikatorId: g.indikator.id, indikatorKode: g.indikator.kode, indikatorNama: g.indikator.nama, sumberData: g.indikator.sumberData ?? 'repository' } })}
                                      style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#374151" }}
                                    >
                                      Detail
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {gi < indikatorGroups.length - 1 && (
                                <tr><td colSpan={7} style={{ padding: 0, height: 6, background: "#f0f2f5" }} /></tr>
                              )}
                            </React.Fragment>
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
