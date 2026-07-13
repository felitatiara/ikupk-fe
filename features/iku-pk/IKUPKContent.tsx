"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import PageTransition from "@/components/layout/PageTransition";
import { getUsersByRole, getUsersByLevel, getRelatedUsersFor, getDosenByUnit, getAllRoles, getAllDosen, getReceivedDisposisiJumlah, getIndikatorGrouped, getIndikatorGroupedForUser, getDisposisi, upsertDisposisi, getAllRealisasiFiles, submitFileRealisasiWithAuth, submitRealisasiDirect, uploadIkupkFile, getIkupkFiles, deleteIkupkFile, getIndikatorCascadeChain, getAvailableYears, getValidasiBiroPKU, getMyNeedsRevision, API_BASE_URL } from "../../lib/api";
import type { UnitUser, IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild, IndikatorGroupedLevel3, IkupkFile, ValidasiBiroPKUItem, NeedsRevisionItem } from "../../lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useOnConfigUpdate } from "@/hooks/useOnConfigUpdate";

// Data nyata diambil dari IKUPK-BE → repository-nest berdasarkan kode indikator

const IKU_KATEGORI: Record<string, string> = {
  '1': 'Wajib', '2': 'Wajib', '3': 'Wajib', '5': 'Wajib', '7': 'Wajib',
  '4': 'Pilihan', '6': 'Pilihan', '8': 'Pilihan', '10': 'Pilihan',
};
const KATEGORI_ORDER = ['Wajib', 'Pilihan', 'Partisipatif'];
const KATEGORI_LABEL: Record<string, string> = { 'Wajib': 'A. WAJIB', 'Pilihan': 'B. PILIHAN', 'Partisipatif': 'C. PARTISIPATIF' };
const getIkuKategori = (kode: string) => IKU_KATEGORI[kode] ?? 'Partisipatif';

const hasPkBerbasisIku = (group: IndikatorGrouped): boolean =>
  group.subIndikators.some(sub =>
    sub.children.some(child =>
      (child.children ?? []).some(l3 => l3.linkedIkuId != null)
    )
  );

type FlatRow = { id: number; kode: string; nama: string; level: number; sub: any; child: any; l3Obj: any; isSubFirst: boolean; subTotalRows: number };

export default function IKUPKContent({ role = 'user', pageTitle, headerSlot, externalJenis, externalTahun, hideFilter }: { role?: 'admin' | 'user' | 'dekan' | 'pimpinan'; pageTitle?: string; headerSlot?: React.ReactNode; externalJenis?: string; externalTahun?: string; hideFilter?: boolean }) {
  const displayRole = role?.toLowerCase() === 'pimpinan' ? 'dekan' : role?.toLowerCase();

  const { user: authUser, token } = useAuth();
  const [loading, setLoading] = useState(true);

  // Incremented by real-time config events to re-trigger the data fetch effect.
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh when admin changes indikator, cascade, target, or disposisi data.
  useOnConfigUpdate(['indikator', 'cascade', 'target', 'disposisi'], () => {
    setRefreshKey(k => k + 1);
  });

  // Disposisi modal state
  const [disposisiModalOpen, setDisposisiModalOpen] = useState(false);
  const [disposisiRow, setDisposisiRow] = useState<Record<string, unknown> | null>(null);
  const [unitUsers, setUnitUsers] = useState<UnitUser[]>([]);
  // Multi-user disposisi: array of { userId, jumlah }
  const [disposisiAllocations, setDisposisiAllocations] = useState<{ userId: number; jumlah: string }[]>([]);
  const [disposisiTargetFakultas, setDisposisiTargetFakultas] = useState<number>(0);
  const [disposedBy, setDisposedBy] = useState<number | null>(null);

  // File repository modal state
  const [fileRepoModalOpen, setFileRepoModalOpen] = useState(false);
  const [fileRepoNama, setFileRepoNama] = useState("");
  const [fileRepoIndikatorId, setFileRepoIndikatorId] = useState<number | null>(null);
  const [fileRepoPeriode, setFileRepoPeriode] = useState("");
  const [fileRepoFiles, setFileRepoFiles] = useState<{ no: number; namaFile: string; tanggal: string; sumber: string; previewUrl?: string; ownerName?: string; ownerEmail?: string }[]>([]);
  const [fileRepoLoading, setFileRepoLoading] = useState(false);
  const [fileRepoSubmitting, setFileRepoSubmitting] = useState(false);
  const [fileRepoTarget, setFileRepoTarget] = useState<number>(0);
  const [fileRepoError, setFileRepoError] = useState<string | null>(null);
  const [fileRepoIsAtasan, setFileRepoIsAtasan] = useState(false);
  const [fileRepoDisposisiTargets, setFileRepoDisposisiTargets] = useState<Map<string, number>>(new Map());

  // Ikupk file upload state (sumberData = 'ikupk')
  const [ikupkFiles, setIkupkFiles] = useState<IkupkFile[]>([]);
  const [ikupkFileUploading, setIkupkFileUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [directInputSubmitting, setDirectInputSubmitting] = useState(false);
  const ikupkFileInputRef = useRef<HTMLInputElement>(null);

  // Revision state — indikator yang perlu direvisi oleh user ini
  const [needsRevisionMap, setNeedsRevisionMap] = useState<Map<number, NeedsRevisionItem>>(new Map());
  const [directNeedsRevision, setDirectNeedsRevision] = useState<NeedsRevisionItem | null>(null);

  // Grouped data for admin/dekan view
  const [groupedData, setGroupedData] = useState<IndikatorGrouped[]>([]);
  // For isTopLevel non-admin (Dekan/WD) who may also receive disposisi from Kaprodi
  const [receivedGroupedData, setReceivedGroupedData] = useState<IndikatorGrouped[]>([]);
  const [validasiBiroPKU, setValidasiBiroPKU] = useState<ValidasiBiroPKUItem[]>([]);
  const [collapsedKategori, setCollapsedKategori] = useState<Set<string>>(new Set());
const [internalTahun, setInternalTahun] = useState("2026");
  const [availableYears, setAvailableYears] = useState<string[]>(["2025", "2026", "2027"]);
  const [internalJenis, setInternalJenis] = useState("IKU");
  const jenis = externalJenis ?? internalJenis;
  const tahun = externalTahun ?? internalTahun;
  const setJenis = (v: string) => setInternalJenis(v);
  const setTahun = (v: string) => setInternalTahun(v);
  const [disposisiSubId, setDisposisiSubId] = useState<number | null>(null);
  const [fileRepoChildren, setFileRepoChildren] = useState<IndikatorGroupedChild[]>([]);

  const unitId = authUser?.roleId;

  const roleLevel = authUser?.roleLevel ?? 4;
  const roleName = (authUser?.role ?? '').toLowerCase();
  // Dekan sesungguhnya: level 1 dan bukan Wakil Dekan
  const isActualDekan = roleLevel <= 1 && !roleName.includes('wakil');
  // isTopLevel: kontrol tampilan JSX — Dekan DAN WD pakai view Dekan/Wadek
  const isTopLevel = displayRole === 'admin' || (displayRole === 'dekan' && roleLevel <= 1);

  // Auto-select tahun berdasarkan tahun yang punya data di DB
  useEffect(() => {
    const cy = new Date().getFullYear();
    getAvailableYears().then(dbYears => {
      const merged = [...new Set([
        ...dbYears,
        String(cy - 1),
        String(cy),
        String(cy + 1),
      ])].sort();
      setAvailableYears(merged);
      if (!merged.includes("2026")) {
        setTahun(merged[merged.length - 1]);
      }
    }).catch(() => {
      setAvailableYears([String(cy - 1), String(cy), String(cy + 1)]);
    });
  }, []);

  // Fetch indikator yang perlu direvisi oleh user ini
  useEffect(() => {
    if (!authUser?.id) return;
    getMyNeedsRevision(authUser.id, tahun).then((items) => {
      const map = new Map<number, NeedsRevisionItem>();
      for (const item of items) map.set(item.indikatorId, item);
      setNeedsRevisionMap(map);
    }).catch(() => {});
  }, [authUser?.id, tahun, refreshKey]);

  // Fetch grouped data
  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    const isAdmin = displayRole === 'admin';

    // Reset loading + clear stale data whenever filters change so old jenis data doesn't linger.
    setLoading(true);
    setGroupedData([]);
    setReceivedGroupedData([]);

    // Hanya Admin dan Dekan (bukan WD) lihat semua indikator; WD hanya lihat yang didisposisi Dekan
    const effectiveJenis = jenis === 'PK_IKU' ? 'PK' : jenis;
    const applyPkIkuFilter = <T extends IndikatorGrouped>(data: T[]): T[] =>
      jenis === 'PK_IKU' ? data.filter(hasPkBerbasisIku) : data;

    const fetchPromise = (isAdmin || isActualDekan)
      ? getIndikatorGrouped(effectiveJenis, tahun, unitId)
      : (authUser?.id)
        ? getIndikatorGroupedForUser(effectiveJenis, tahun, authUser.id, unitId)
        : Promise.resolve([]);

    // For WD2/pimpinan non-admin: "Target yang Anda Terima" uses receivedGroupedData.
    // Resolve loading only after BOTH fetches complete so the user never sees stale data.
    if (isTopLevel && !isAdmin && authUser?.id) {
      Promise.all([
        fetchPromise,
        getIndikatorGroupedForUser(effectiveJenis, tahun, authUser.id, unitId),
      ])
        .then(([main, received]) => {
          if (!cancelled) {
            setGroupedData(applyPkIkuFilter(main));
            setReceivedGroupedData(applyPkIkuFilter(received));
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGroupedData([]);
            setReceivedGroupedData([]);
            setLoading(false);
          }
        });
    } else {
      fetchPromise
        .then((d) => { if (!cancelled) { setGroupedData(applyPkIkuFilter(d)); setLoading(false); } })
        .catch(() => { if (!cancelled) { setGroupedData([]); setLoading(false); } });

      if (!isTopLevel) setReceivedGroupedData([]);
    }

    // Fetch hasil Biro PKU — hanya untuk pimpinan (Dekan/WD)
    if (isTopLevel) {
      getValidasiBiroPKU(tahun)
        .then((d) => { if (!cancelled) setValidasiBiroPKU(d); })
        .catch(() => { if (!cancelled) setValidasiBiroPKU([]); });
    }

    return () => { cancelled = true; };
  }, [displayRole, jenis, tahun, unitId, authUser?.id, roleLevel, isActualDekan, isTopLevel, refreshKey]);

  const handleGroupedDisposisiClick = async (subId: number, targetAmount: number, disposedByUserId?: number | null, l0Id?: number | null) => {
    setDisposisiSubId(subId);
    setDisposisiRow(null);
    setDisposisiTargetFakultas(targetAmount);
    setDisposisiAllocations([]);
    setDisposedBy(disposedByUserId ?? null);
    if (!unitId) return;

    try {
      let users: UnitUser[] = [];
      let usedCascade = false;

      // Helper: resolve next-step users from a cascade chain ID
      // Returns: 'used' (chain ada & ada next step), 'ended' (chain ada tapi user di akhir), 'none' (chain kosong)
      const tryCascadeId = async (chainIndikatorId: number): Promise<'used' | 'ended' | 'none'> => {
        try {
          const chain = await getIndikatorCascadeChain(chainIndikatorId);
          if (chain.length === 0) return 'none';
          const normalized: number[][] = chain.map(step => Array.isArray(step) ? step.map(Number) : [Number(step)]);
          let nextRoleIds: number[] = [];
          if (displayRole === 'admin') {
            nextRoleIds = normalized[0] ?? [];
          } else if (authUser?.roleId) {
            const myRoleId = Number(authUser.roleId);
            const idx = normalized.findIndex(s => s.includes(myRoleId));
            if (idx >= 0 && idx < normalized.length - 1) nextRoleIds = normalized[idx + 1];
            else if (idx === -1 && isTopLevel) nextRoleIds = normalized[0] ?? [];
          }
          if (nextRoleIds.length === 0) return 'ended';
          const byRole = await Promise.all(nextRoleIds.map(rid => getUsersByRole(rid)));
          const merged = byRole.flat();
          const seen = new Set<number>();
          users = merged.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
          users = users.filter(u => u.id !== authUser?.id);
          return 'used';
        } catch { return 'none'; }
      };

      // 1. Try L1 parent cascade chain (chain is stored at L1 sub-indicator level)
      let l1Id: number | null = null;
      for (const g of [...groupedData, ...receivedGroupedData]) {
        for (const sub of g.subIndikators) {
          if (sub.children.some(c => c.id === subId || c.children.some(gc => gc.id === subId))) {
            l1Id = sub.id; break;
          }
        }
        if (l1Id) break;
      }
      // 1. Coba cascade chain → jika ada next step, tampilkan role berikutnya
      // Jika l1Id punya chain sendiri (meski berakhir di user ini), jangan cek l0Id (hindari chain parent yang stale)
      let l1Result: 'used' | 'ended' | 'none' = 'none';
      if (l1Id) l1Result = await tryCascadeId(l1Id);
      usedCascade = l1Result === 'used';
      if (l1Result === 'none' && l0Id) usedCascade = (await tryCascadeId(l0Id)) === 'used';

      // 2. Cascade tidak ada next step → prioritas UserRelation, fallback level jika belum dikonfigurasi
      const isKajur = roleLevel === 2 || ((authUser?.roles as any[])?.some((r: any) => r.level === 2) ?? false);
      if (!usedCascade) {
        if (displayRole === 'admin') {
          users = await getUsersByLevel(1);
        } else if (authUser?.id) {
          // Prioritas: ambil bawahan langsung dari struktur organisasi (UserRelation WHERE parent_id = userId)
          let bawahanLangsung: UnitUser[] = [];
          try { bawahanLangsung = await getRelatedUsersFor(authUser.id); } catch { /* fallback below */ }
          if (bawahanLangsung.length > 0) {
            users = bawahanLangsung.filter((u) => u.id !== authUser.id);
          } else {
            // Fallback berdasarkan level jika UserRelation belum dikonfigurasi untuk user ini
            if (roleLevel <= 1) {
              const [lvl1Users, lvl2Users] = await Promise.all([getUsersByLevel(1), getUsersByLevel(2)]);
              const merged = [...lvl1Users, ...lvl2Users].filter((u) => u.id !== authUser?.id);
              const seen = new Set<number>();
              users = merged.filter((u) => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
            } else if (isKajur) {
              const [allKaprodi, allDosenUsers] = await Promise.all([getUsersByLevel(3), getAllDosen()]);
              const toMerge = [...allKaprodi, ...allDosenUsers];
              const seen = new Set<number>();
              users = toMerge.filter((u) => { if (seen.has(u.id) || u.id === authUser.id) return false; seen.add(u.id); return true; });
            } else if (roleLevel === 3 && authUser?.unitNama) {
              const dosenUsers = await getDosenByUnit(authUser.unitNama);
              users = dosenUsers.filter((u) => u.id !== authUser?.id);
            }
          }
        }
      }

      // Urutkan alfabetis sebelum menambah entri diri sendiri
      users = [...users].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

      // Semua user non-admin bisa disposisi ke diri sendiri.
      if (authUser && displayRole !== 'admin' && !users.some(u => u.id === authUser.id)) {
        const selfEntry: UnitUser = {
          id: authUser.id,
          nama: `${authUser.nama ?? authUser.email} (Saya sendiri)`,
          email: authUser.email ?? '',
          role: authUser.role ?? '',
        };
        users = [selfEntry, ...users];
      }
      setUnitUsers(users);
    } catch {
      setUnitUsers([]);
    }

    // Ambil batas: berapa jumlah yang diterima disposedByUserId dari disposisi sebelumnya
    if (disposedByUserId) {
      try {
        const received = await getReceivedDisposisiJumlah(disposedByUserId, subId, tahun);
        // Jika batas = 0, gunakan targetAmount (dari pimpinan tidak ada batas khusus)
        if (received > 0) setDisposisiTargetFakultas(received);
      } catch {
        // ignore
      }
    }

    // Ambil existing disposisi
    try {
      const existing = await getDisposisi(subId, tahun, disposedByUserId ?? null);
      if (existing.length > 0) {
        setDisposisiAllocations(
          existing.map((d) => ({ userId: d.toUserId, jumlah: String(Number(d.jumlahTarget)) }))
        );
      }
    } catch {
      // disposisi table may not exist yet
    }
    setDisposisiModalOpen(true);
  };

  const addAllocation = () => {
    setDisposisiAllocations((prev) => [...prev, { userId: 0, jumlah: "" }]);
  };

  const removeAllocation = (index: number) => {
    setDisposisiAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAllocated = disposisiAllocations.reduce((sum, a) => sum + (parseFloat(a.jumlah) || 0), 0);
  const sisaTarget = disposisiTargetFakultas - totalAllocated;
  // Ketika Dekan/WD belum ada target universitas, disposisi tetap diizinkan tanpa batas atas
  const isUnconstrained = isTopLevel && disposisiTargetFakultas === 0;
  const isOverLimit = !isUnconstrained && sisaTarget < 0;

  const handleDisposisiSubmit = async () => {
    const validItems = disposisiAllocations
      .filter((a) => a.userId > 0 && parseFloat(a.jumlah) > 0)
      .map((a) => ({ toUserId: a.userId, jumlahTarget: parseFloat(a.jumlah) }));
    if (validItems.length === 0) return;
    try {
      if (disposisiSubId && unitId) {
        await upsertDisposisi(disposisiSubId, tahun, validItems, disposedBy);
        // Refresh data: admin/Dekan pakai getIndikatorGrouped, WD/bawahan pakai getIndikatorGroupedForUser
        const effJenis = jenis === 'PK_IKU' ? 'PK' : jenis;
        const pkIkuFilter = <T extends IndikatorGrouped>(arr: T[]): T[] =>
          jenis === 'PK_IKU' ? arr.filter(hasPkBerbasisIku) : arr;
        if ((displayRole === 'admin' || isActualDekan) && unitId) {
          const d = await getIndikatorGrouped(effJenis, tahun, unitId);
          setGroupedData(pkIkuFilter(d));
        } else if (authUser?.id && unitId) {
          const d = await getIndikatorGroupedForUser(effJenis, tahun, authUser.id, unitId);
          setGroupedData(pkIkuFilter(d));
        }
        toast.success("Disposisi berhasil disimpan.");
      }
    } catch {
      toast.error("Gagal menyimpan disposisi");
    } finally {
      setDisposisiModalOpen(false);
      setDisposisiRow(null);
      setDisposisiSubId(null);
      setDisposedBy(null);
    }
  };

  // File repository modal helpers
  const periodeOptions = [
    `Januari ${tahun} - Mei ${tahun}`,
    `Juni ${tahun} - Agustus ${tahun}`,
    `September ${tahun} - Desember ${tahun}`,
  ];

  const isDosen = roleLevel >= 4;

  const fetchRepoFiles = (indikatorId: number, asAtasan: boolean, allowedEmails?: Set<string>) => {
    if (!token) { setFileRepoLoading(false); setFileRepoError('Token tidak ditemukan, silakan login ulang.'); return; }
    setFileRepoLoading(true);
    setFileRepoError(null);
    setFileRepoFiles([]);
    // Selalu pakai getAllRealisasiFiles agar setiap file memiliki ownerEmail untuk filtering.
    getAllRealisasiFiles(indikatorId, token)
      .then((result) => {
        let files = result.files;
        if (asAtasan) {
          // Mode atasan: filter ke bawahan yang diizinkan (misal Kabag → hanya Tendik)
          if (allowedEmails && allowedEmails.size > 0) {
            files = files.filter(f => {
              const email = (f.ownerEmail || f.owner?.email || '').toLowerCase();
              return allowedEmails.has(email);
            });
          }
          // Jika allowedEmails undefined → tampilkan semua (Dekan/WD)
        } else if (allowedEmails && allowedEmails.size > 0) {
          // Non-dosen (misal Kabag): tampilkan file milik bawahan langsung
          files = files.filter(f => {
            const email = (f.ownerEmail || f.owner?.email || '').toLowerCase();
            return allowedEmails!.has(email);
          });
        } else if (authUser?.email) {
          // Dosen: hanya tampilkan file milik sendiri
          const selfEmail = authUser.email.toLowerCase();
          files = files.filter(f => {
            const ownerEmail = (f.ownerEmail || f.owner?.email || '').toLowerCase();
            return ownerEmail === selfEmail;
          });
        }
        const mapped = files.map((f, i) => ({
          no: i + 1,
          namaFile: f.name,
          tanggal: f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-',
          sumber: 'Repository FIK',
          previewUrl: f.preview_url,
          ownerName: f.ownerName || f.owner?.name,
          ownerEmail: f.ownerEmail || f.owner?.email,
        }));
        setFileRepoFiles(mapped);
      })
      .catch(() => setFileRepoError('Gagal memuat file dari repository.'))
      .finally(() => setFileRepoLoading(false));
  };

  // Direct-input modal (sumberData = 'ikupk')
  const [directModalOpen, setDirectModalOpen] = useState(false);
  const [directModalIndikatorId, setDirectModalIndikatorId] = useState<number | null>(null);
  const [directModalNama, setDirectModalNama] = useState('');

  const handleDirectInputClick = async (indikatorId: number, nama: string) => {
    if (!token) { toast.error('Token tidak ditemukan, silakan login ulang.'); return; }
    const revisionItem = needsRevisionMap.get(indikatorId) ?? null;
    setDirectNeedsRevision(revisionItem);
    setDirectModalIndikatorId(indikatorId);
    setDirectModalNama(nama);
    // Pre-select periode dari record yang perlu direvisi agar upsert menemukan record yang tepat
    setFileRepoPeriode(revisionItem?.periode ?? periodeOptions[0]);
    setIkupkFiles([]);
    setDirectModalOpen(true);
    try {
      const files = await getIkupkFiles(indikatorId, tahun, token);
      setIkupkFiles(files);
    } catch { }
  };

  const handleIkupkUpload = async (file: File) => {
    if (!directModalIndikatorId || !token) return;
    setIkupkFileUploading(true);
    try {
      await uploadIkupkFile({ indikatorId: directModalIndikatorId, tahun, periode: fileRepoPeriode, file }, token);
      const files = await getIkupkFiles(directModalIndikatorId, tahun, token);
      setIkupkFiles(files);
      toast.success('File berhasil diupload.');
    } catch {
      toast.error('Gagal mengupload file.');
    } finally {
      setIkupkFileUploading(false);
    }
  };

  const handleDeleteIkupkFile = async (id: number) => {
    if (!token || !directModalIndikatorId) return;
    try {
      await deleteIkupkFile(id, token);
      const files = await getIkupkFiles(directModalIndikatorId, tahun, token);
      setIkupkFiles(files);
      toast.success('File dihapus.');
    } catch {
      toast.error('Gagal menghapus file.');
    }
  };

  const handleDirectInputSubmit = async () => {
    if (!directModalIndikatorId || !token) return;
    if (ikupkFiles.length === 0) { toast.error('Upload minimal satu file terlebih dahulu.'); return; }
    setDirectInputSubmitting(true);
    try {
      await submitRealisasiDirect({
        indikatorId: directModalIndikatorId,
        tahun,
        periode: fileRepoPeriode,
        realisasiAngka: ikupkFiles.length,
      }, token);
      toast.success(directNeedsRevision ? 'Upload ulang berhasil, menunggu re-validasi.' : 'Realisasi berhasil disimpan.');
      setDirectNeedsRevision(null);
      setDirectModalOpen(false);
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Gagal menyimpan realisasi.');
    } finally {
      setDirectInputSubmitting(false);
    }
  };

  // showAtasanView=false → tampilkan file milik sendiri (seperti dosen)
  // showAtasanView=true  → tampilkan semua file bawahan (mode lihat progress)
  const handleInputFileClick = async (indikatorId: number, nama: string, target: number, children: IndikatorGroupedChild[] = [], showAtasanView = false) => {
    // Akan di-update setelah allowedEmails diketahui
    setFileRepoIsAtasan(showAtasanView);
    setFileRepoIndikatorId(indikatorId);
    setFileRepoNama(nama);
    setFileRepoPeriode(periodeOptions[0]);
    setFileRepoFiles([]);
    setFileRepoLoading(true);
    setFileRepoSubmitting(false);
    setFileRepoTarget(target);
    setFileRepoError(null);
    setFileRepoChildren(children);
    setFileRepoModalOpen(true);

    // Filter email bawahan: gunakan disposisi (siapa yang menerima dari user ini untuk indikator ini)
    // sebagai sumber utama, bukan user_relations (struktur org).
    let allowedEmails: Set<string> | undefined;
    const disposisiTargetMap = new Map<string, number>();
    setFileRepoDisposisiTargets(new Map());
    if (showAtasanView && authUser?.id && displayRole !== 'admin') {
      if (roleLevel >= 2) {
        // Kajur (2), Kaprodi (3): filter ke penerima disposisi untuk indikator ini
        try {
          const disposisiRecords = await getDisposisi(indikatorId, tahun, authUser.id);
          if (disposisiRecords.length > 0) {
            const emails = disposisiRecords
              .map(d => d.toUser?.email ?? '')
              .filter(Boolean)
              .map(e => e.toLowerCase());
            // Build per-user target map
            for (const d of disposisiRecords) {
              const email = d.toUser?.email?.toLowerCase();
              if (email) disposisiTargetMap.set(email, d.jumlahTarget);
            }
            if (emails.length > 0) {
              allowedEmails = new Set(emails);
            } else {
              // toUser.email not populated — fallback to org relations
              const bawahanUsers = await getRelatedUsersFor(authUser.id);
              allowedEmails = new Set(bawahanUsers.map(u => u.email.toLowerCase()).filter(Boolean));
            }
          } else {
            // No disposisi set for this indicator: fall back to org bawahan.
            // Empty set prevents showing all-user files (which would happen with undefined).
            const bawahanUsers = await getRelatedUsersFor(authUser.id);
            allowedEmails = bawahanUsers.length > 0
              ? new Set(bawahanUsers.map(u => u.email.toLowerCase()).filter(Boolean))
              : new Set<string>();
          }
          setFileRepoDisposisiTargets(new Map(disposisiTargetMap));
          // Dekan/WD (roleLevel <= 1): allowedEmails undefined → tampilkan semua
        } catch {
          // Gagal fetch → tidak batasi
        }
      }
    } else if (!showAtasanView && !isDosen && authUser?.id) {
      // Non-dosen klik "Input File": hanya gunakan disposisi yang dikirim user ini.
      // Jangan fallback ke UserRelation — struktur org tidak mencerminkan alur disposisi
      // (misal: Widya adalah dosen di bawah Ridwan secara org, tapi atasan Ridwan untuk indikator ini).
      try {
        const disposisiRecords = await getDisposisi(indikatorId, tahun, authUser.id);
        const emails = disposisiRecords
          .map(d => d.toUser?.email ?? '')
          .filter(Boolean)
          .map(e => e.toLowerCase());
        if (emails.length > 0) {
          allowedEmails = new Set(emails);
        }
      } catch { }
    }

    // Include atasan's own files in the "Lihat Progress" view so their own
    // contribution is counted in capaian and shown as a separate row.
    if (showAtasanView && allowedEmails !== undefined && authUser?.email) {
      allowedEmails.add(authUser.email.toLowerCase());
    }

    // Hanya Dekan/WD (roleLevel <= 1) tanpa disposisi terkirim yang melihat semua file.
    // User lain tanpa disposisi terkirim = leaf → tampilkan file milik sendiri.
    const effectiveAsAtasan = !isDosen && !showAtasanView && allowedEmails === undefined
      ? roleLevel <= 1
      : showAtasanView;

    setFileRepoIsAtasan(effectiveAsAtasan);
    fetchRepoFiles(indikatorId, effectiveAsAtasan, allowedEmails);
  };

  const handleFileRepoSubmit = async () => {
    if (!fileRepoIndikatorId || !token) return;
    setFileRepoSubmitting(true);
    try {
      await submitFileRealisasiWithAuth({
        indikatorId: fileRepoIndikatorId,
        tahun,
        periode: fileRepoPeriode,
        fileCount: fileRepoFiles.length,
      }, token);
      setFileRepoModalOpen(false);
      toast.success("Realisasi berhasil disimpan.");
      setRefreshKey(k => k + 1);
    } catch {
      toast.error("Gagal menyimpan realisasi");
    } finally {
      setFileRepoSubmitting(false);
    }
  };


  const renderWithKategori = (
    data: IndikatorGrouped[],
    colSpan: number,
    keyPrefix: string,
    renderGroupFn: (group: IndikatorGrouped, groupIdx: number) => React.ReactNode[],
  ): React.ReactNode[] => {
    if (jenis !== 'IKU') return data.flatMap((g, i) => renderGroupFn(g, i));
    const grouped: Record<string, IndikatorGrouped[]> = { Wajib: [], Pilihan: [], Partisipatif: [] };
    data.forEach(g => grouped[g.kategori ?? getIkuKategori(g.kode)].push(g));
    return KATEGORI_ORDER.flatMap(kat => {
      const items = grouped[kat];
      if (items.length === 0) return [];
      const isCollapsed = collapsedKategori.has(kat);
      return [
        <tr key={`${keyPrefix}-kat-${kat}`}
          onClick={() => setCollapsedKategori(prev => { const s = new Set(prev); s.has(kat) ? s.delete(kat) : s.add(kat); return s; })}
          style={{ background: "#1e3a5f", cursor: "pointer", userSelect: "none" }}>
          <td colSpan={colSpan} style={{ padding: "9px 16px", color: "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em" }}>
            <span style={{ marginRight: 8, fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
            {KATEGORI_LABEL[kat]}
          </td>
        </tr>,
        ...(isCollapsed ? [] : items.flatMap((g, i) => renderGroupFn(g, i))),
      ];
    });
  };

  // Helper: render the "Input File" table — handles PK level 3
  const renderInputFileTable = (data: IndikatorGrouped[], keyPrefix: string) => {
    type FR = {
      id: number; kode: string; nama: string; level: number;
      sub: IndikatorGroupedSub;
      isSubFirst: boolean; subTotalRows: number;
      hasPkL3: boolean; showAction: boolean;
      actionId: number; actionNama: string; actionSumberData: string;
      leafDisposisi: number | null;
      leafRealisasi: number | null;
      isLeaf: boolean;
    };
    return (
      <div className="table-wrapper ikupk-table-wrapper">
        <table className="table-universal ikupk-table">
          <thead>
            <tr>
              <th className="col-w5 text-center">No</th>
              <th className="col-w20">Sasaran Program</th>
              <th>Sub Indikator Kinerja</th>
              <th className="col-w10 text-center">Target Diterima</th>
              <th className="col-w10 text-center">Tenggat</th>
              <th className="col-w10 text-center">Realisasi</th>
              <th className="col-w15 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {renderWithKategori(data, 7, keyPrefix, (group, groupIdx) => {
              const flatRows: FR[] = [];
              for (const sub of group.subIndikators) {
                const hasPkL3 = sub.children.some(c => (c.children ?? []).length > 0);
                let subTotal = 1;
                if (hasPkL3) {
                  for (const child of sub.children) subTotal += 1 + (child.children ?? []).length;
                } else {
                  subTotal += sub.children.length;
                }
                flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subTotalRows: subTotal, hasPkL3, showAction: false, actionId: sub.id, actionNama: sub.nama, actionSumberData: sub.sumberData ?? 'repository', leafDisposisi: null, leafRealisasi: null, isLeaf: false });
                for (const child of sub.children) {
                  const childIsLeaf = !hasPkL3;
                  const childLeafDisposisi = childIsLeaf ? (child.disposisiJumlah ?? null) : null;
                  const childLeafRealisasi = childIsLeaf ? (child.realisasiJumlah ?? null) : null;
                  flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subTotalRows: subTotal, hasPkL3, showAction: childIsLeaf, actionId: child.id, actionNama: child.nama, actionSumberData: child.sumberData ?? 'repository', leafDisposisi: childLeafDisposisi, leafRealisasi: childLeafRealisasi, isLeaf: childIsLeaf });
                  if (hasPkL3) {
                    for (const l3 of (child.children ?? [])) {
                      flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, isSubFirst: false, subTotalRows: subTotal, hasPkL3, showAction: true, actionId: l3.id, actionNama: l3.nama, actionSumberData: l3.sumberData ?? 'repository', leafDisposisi: l3.disposisiJumlah ?? null, leafRealisasi: l3.realisasiJumlah ?? null, isLeaf: true });
                    }
                  }
                }
              }
              const totalRowSpan = flatRows.length;
              return flatRows.map((row, rowIdx) => {
                const leafTarget = row.leafDisposisi;
                const leafReal = row.leafRealisasi ?? 0;
                const leafCapaianPct = (row.isLeaf && leafTarget && leafTarget > 0 && leafReal > 0)
                  ? `${Math.round((leafReal / leafTarget) * 100)}%`
                  : '-';
                const leafCapaianClass = (row.isLeaf && leafTarget && leafReal >= leafTarget)
                  ? 'text-success'
                  : row.isLeaf && leafTarget && leafReal > 0
                    ? 'text-warning'
                    : 'text-dark';

                // Non-leaf rows (L1 sub headers, or L2 in PK L3 structure) span rightward
                if (!row.isLeaf) {
                  return (
                    <tr key={`${keyPrefix}-${group.id}-${rowIdx}`} style={{ background: '#f8fafc' }}>
                      {rowIdx === 0 && (
                        <>
                          <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">{group.kode}</td>
                          <td rowSpan={totalRowSpan} className="td-cell v-top">
                            <div>{group.nama}</div>
                          </td>
                        </>
                      )}
                      <td colSpan={5} className="td-cell" style={{
                        paddingLeft: row.level === 2 ? 32 : 16,
                        fontWeight: 600,
                        color: row.level === 2 ? '#4b5563' : '#374151',
                        fontSize: 12,
                        background: '#f8fafc',
                        borderBottom: '1px solid #f0f0f0',
                      }}>
                        {row.level === 2 && <span style={{ marginRight: 5, color: '#94a3b8' }}>↳</span>}
                        {row.kode} {row.nama}
                      </td>
                    </tr>
                  );
                }

                // Leaf rows: show all data columns normally
                return (
                  <tr key={`${keyPrefix}-${group.id}-${rowIdx}`}>
                    <td className="td-cell" style={{
                      paddingLeft: row.level === 3 ? 48 : row.level === 2 ? 28 : 16,
                      color: '#6b7280',
                    }}>
                      <span style={{ marginRight: 4, color: '#c4c9d0' }}>↳</span>
                      {row.kode} {row.nama}
                    </td>
                    <td className="td-cell td-cell--center td-cell--bold">
                      {leafTarget !== null ? leafTarget : '-'}
                    </td>
                    <td className="td-cell td-cell--center" style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {group.tenggat ?? '—'}
                    </td>
                    <td className={`td-cell td-cell--center fw-700 ${leafCapaianClass}`}>
                      {leafCapaianPct}
                    </td>
                    <td className="action-cell" style={{ whiteSpace: 'nowrap' }}>
                      {needsRevisionMap.has(row.actionId) && (
                        <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 4, padding: '2px 6px', marginRight: 6, fontWeight: 700, verticalAlign: 'middle' }}>
                          ⚠ Revisi
                        </span>
                      )}
                      <button
                        onClick={() => row.actionSumberData === 'ikupk'
                          ? handleDirectInputClick(row.actionId, row.actionNama)
                          : handleInputFileClick(row.actionId, row.actionNama, Number(leafTarget || 0), [])}
                        className="btn-small btn-small--green"
                      >
                        {row.actionSumberData === 'ikupk' ? 'Input Data' : 'Input File'}
                      </button>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    );
  };


  return (
    <div>
      <PageTransition>
       
        {/* DISPOSISI MODAL */}
        {disposisiModalOpen && (disposisiRow || disposisiSubId) && createPortal(
          <div className="modal-overlay" onClick={() => setDisposisiModalOpen(false)}>
            <div className="modal-content modal-content--sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">Disposisi Target</h3>
              <p className="modal-subtitle">
                {isTopLevel ? 'Disposisikan target kepada bawahan Anda' : 'Disposisikan ulang target yang Anda terima kepada bawahan Anda'}
              </p>

              {/* Info bar */}
              <div className="info-bar-green">
                <div>
                  <span className="info-label">{isTopLevel ? 'Target Universitas' : 'Jumlah Diterima'}: </span>
                  <span className="info-value">
                    {isUnconstrained ? '—' : disposisiTargetFakultas}
                  </span>
                </div>
                <div>
                  <span className="info-label">Sudah dialokasikan: </span>
                  <span className="info-value info-value--muted">{totalAllocated}</span>
                </div>
                {!isUnconstrained && (
                  <div>
                    <span className="info-label">Sisa: </span>
                    <span className={`info-value ${isOverLimit ? 'text-danger' : 'text-success'}`}>{sisaTarget}</span>
                  </div>
                )}
              </div>

              {/* Info: target belum diset tapi tetap bisa disposisi */}
              {isUnconstrained && (
                <div className="alert-banner alert-banner--info">
                  ℹ️ Target universitas belum diset. Anda tetap dapat mendisposisikan tanpa batas atas.
                </div>
              )}

              {/* Warning: total melebihi batas */}
              {isOverLimit && (
                <div className="alert-banner alert-banner--error">
                  ⚠️ Total disposisi melebihi jumlah yang tersedia. Harap kurangi jumlah.
                </div>
              )}

              {/* Warning: tidak ada user bawahan */}
              {unitUsers.length === 0 && (
                <div className="alert-banner alert-banner--warning">
                  ℹ️ Tidak ada user yang dapat menerima disposisi. Pastikan relasi user sudah dikonfigurasi di Master User.
                </div>
              )}

              {/* Allocation rows */}
              {disposisiAllocations.map((alloc, idx) => (
                <div key={idx} className="alloc-row">
                  <select
                    value={alloc.userId}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDisposisiAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, userId: val } : a));
                    }}
                    className="alloc-select"
                  >
                    <option value={0} disabled>Pilih nama...</option>
                    {unitUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.nama} </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={disposisiTargetFakultas}
                    placeholder="Jumlah"
                    value={alloc.jumlah}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDisposisiAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, jumlah: val } : a));
                    }}
                    className="alloc-input"
                  />
                  <button onClick={() => removeAllocation(idx)} className="alloc-remove-btn">
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={addAllocation}
                disabled={unitUsers.length === 0}
                className="btn-add-penerima"
              >
                + Tambah Penerima
              </button>

              <div className="modal-footer">
                <button onClick={() => setDisposisiModalOpen(false)} className="btn-secondary">
                  Kembali
                </button>
                <button
                  onClick={handleDisposisiSubmit}
                  disabled={disposisiAllocations.length === 0 || isOverLimit || unitUsers.length === 0}
                  className="btn-green"
                >
                  Simpan Disposisi
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* FILE REPOSITORY MODAL */}
        {fileRepoModalOpen && createPortal(
          <div className="modal-overlay" onClick={() => setFileRepoModalOpen(false)}>
            <div className="modal-content modal-content--md" onClick={(e) => e.stopPropagation()}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: fileRepoIsAtasan ? '#dcfce7' : '#eff6ff', color: fileRepoIsAtasan ? '#16a34a' : '#2563eb', borderRadius: 20, padding: '2px 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {fileRepoIsAtasan ? 'Progress Bawahan' : 'File Repository'}
                  </span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px', lineHeight: 1.4 }}>
                  {fileRepoNama}
                </h3>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                  {fileRepoIsAtasan
                    ? 'Semua file yang diunggah bawahan untuk indikator ini.'
                    : 'File diambil otomatis dari folder repository yang sesuai indikator ini.'}
                </p>
              </div>

              {/* Error state */}
              {fileRepoError && (
                <div className="alert-banner--error-lg">
                  ⚠️ {fileRepoError}
                </div>
              )}
              {/* Loading state */}
              {fileRepoLoading && (
                <div className="file-loading">
                  <div className="mb-8">🔄 Memuat file dari repository...</div>
                  <div className="file-loading-sub">Mengambil file berdasarkan kode indikator ini</div>
                </div>
              )}

              {!fileRepoLoading && !fileRepoError && (
                <>
                  {fileRepoChildren.length > 0 && (
                    <div className="alert-banner--success">
                      Menampilkan semua file dari {fileRepoChildren.length} kriteria: {fileRepoChildren.map((c) => c.kode).join(', ')}
                    </div>
                  )}

                  {/* ── ATASAN: semua file bawahan, dikelompokkan per dosen ── */}
                  {fileRepoIsAtasan ? (
                    <>
                      {/* Stats bar */}
                      {(() => {
                        const capaianPct = fileRepoTarget > 0 ? Math.round((fileRepoFiles.length / fileRepoTarget) * 100) : 0;
                        const capaianColor = capaianPct >= 100 ? '#16a34a' : capaianPct >= 50 ? '#d97706' : capaianPct > 0 ? '#ea580c' : '#9ca3af';
                        const capaianBg = capaianPct >= 100 ? '#f0fdf4' : capaianPct >= 50 ? '#fffbeb' : capaianPct > 0 ? '#fff7ed' : '#f9fafb';
                        const capaianBorder = capaianPct >= 100 ? '#bbf7d0' : capaianPct >= 50 ? '#fde68a' : capaianPct > 0 ? '#fed7aa' : '#e5e7eb';
                        return (
                          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                            <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px' }}>
                              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Total File</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: fileRepoFiles.length > 0 ? '#16a34a' : '#9ca3af' }}>{fileRepoFiles.length}</div>
                            </div>
                            <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
                              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Pengumpul</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{new Set(fileRepoFiles.map(f => f.ownerEmail || f.ownerName)).size}</div>
                            </div>
                            {fileRepoTarget > 0 && (
                              <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Target</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{fileRepoTarget}</div>
                              </div>
                            )}
                            {fileRepoTarget > 0 && (
                              <div style={{ flex: 1, background: capaianBg, border: `1px solid ${capaianBorder}`, borderRadius: 10, padding: '10px 14px' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>Capaian Anda</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: capaianColor }}>{capaianPct}%</div>
                                <div style={{ marginTop: 4 }}>
                                  <div style={{ height: 4, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, capaianPct)}%`, height: '100%', background: capaianColor, borderRadius: 99, transition: 'width 0.4s' }} />
                                  </div>
                                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{fileRepoFiles.length} dari {fileRepoTarget}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {fileRepoFiles.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {Array.from(new Set(fileRepoFiles.map(f => f.ownerEmail || f.ownerName || 'Tidak diketahui')))
                            .sort((a, b) => {
                              const aIsSelf = authUser?.email && a.toLowerCase() === authUser.email.toLowerCase();
                              const bIsSelf = authUser?.email && b.toLowerCase() === authUser.email.toLowerCase();
                              if (aIsSelf) return -1;
                              if (bIsSelf) return 1;
                              return 0;
                            })
                            .map((ownerKey) => {
                            const ownerFiles = fileRepoFiles.filter(f => (f.ownerEmail || f.ownerName || 'Tidak diketahui') === ownerKey);
                            const ownerName = ownerFiles[0]?.ownerName || ownerKey;
                            const initials = ownerName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                            const isSelf = authUser?.email && ownerKey.toLowerCase() === authUser.email.toLowerCase();
                            return (
                              <div key={ownerKey} style={{ border: `1px solid ${isSelf ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: 10, overflow: 'hidden' }}>
                                {/* Owner header */}
                                {(() => {
                                  const ownerTarget = fileRepoDisposisiTargets.get(ownerKey.toLowerCase()) ?? fileRepoTarget;
                                  const ownerPct = ownerTarget > 0 ? Math.round((ownerFiles.length / ownerTarget) * 100) : 0;
                                  const ownerCapColor = ownerPct >= 100 ? '#16a34a' : ownerPct >= 50 ? '#d97706' : ownerPct > 0 ? '#ea580c' : '#9ca3af';
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSelf ? '#eff6ff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelf ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'linear-gradient(135deg, #0f9f6e, #087a55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                        {initials}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ownerName}</div>
                                          {isSelf && <span style={{ fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '1px 8px', flexShrink: 0 }}>Anda</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>{ownerFiles.length} file diunggah</div>
                                      </div>
                                      {/* Capaian per bawahan */}
                                      {ownerTarget > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#16a34a', borderRadius: 20, padding: '2px 10px' }}>
                                              {ownerFiles.length} file
                                            </span>
                                            <span style={{ fontSize: 12, fontWeight: 800, color: ownerCapColor }}>
                                              {ownerPct}%
                                            </span>
                                          </div>
                                          <div style={{ width: 90, height: 4, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, ownerPct)}%`, height: '100%', background: ownerCapColor, borderRadius: 99 }} />
                                          </div>
                                          <span style={{ fontSize: 9.5, color: '#9ca3af' }}>{ownerFiles.length}/{ownerTarget} target</span>
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#16a34a', borderRadius: 20, padding: '2px 10px' }}>
                                          {ownerFiles.length} file
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                                {/* File list */}
                                <div>
                                  {ownerFiles.map((f, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: idx < ownerFiles.length - 1 ? '1px solid #f3f4f6' : 'none', background: '#fff' }}>
                                      <span style={{ width: 20, fontSize: 11, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f9f6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      <span style={{ flex: 1, fontSize: 13, color: '#374151', minWidth: 0 }}>
                                        {f.previewUrl
                                          ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0f9f6e', textDecoration: 'none', fontWeight: 500 }}>{f.namaFile}</a>
                                          : f.namaFile}
                                      </span>
                                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{f.tanggal}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>Belum ada file yang diupload bawahan</div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── DOSEN: file sendiri ── */
                    <>

                      {/* Periode + Stats row */}
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, marginBottom: fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget ? 6 : 14 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>PERIODE</label>
                          <select
                            value={fileRepoPeriode}
                            onChange={(e) => setFileRepoPeriode(e.target.value)}
                            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#111827', background: '#fff', outline: 'none', cursor: 'pointer' }}
                          >
                            {periodeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        {(() => {
                          const isOk = fileRepoTarget <= 0 || fileRepoFiles.length >= fileRepoTarget;
                          const isWarn = !isOk && fileRepoFiles.length > 0;
                          const bg = isOk ? '#f0fdf4' : isWarn ? '#fff7ed' : '#f9fafb';
                          const border = isOk ? '#bbf7d0' : isWarn ? '#fed7aa' : '#e5e7eb';
                          const color = isOk ? '#16a34a' : isWarn ? '#d97706' : '#9ca3af';
                          return (
                            <div style={{ flexShrink: 0, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '0 14px', textAlign: 'center', minWidth: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>File / Target</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color }}>
                                {fileRepoFiles.length} / {fileRepoTarget > 0 ? fileRepoTarget : '—'}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Inline warning */}
                      {fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 12, color: '#d97706' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          <span>Kurang {fileRepoTarget - fileRepoFiles.length} file — upload via <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" style={{ color: '#d97706', fontWeight: 600 }}>Repository FIK</a></span>
                        </div>
                      )}

                      {/* File list */}
                      {fileRepoFiles.length > 0 ? (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                          {fileRepoFiles.map((f, idx) => (
                            <div key={f.no} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < fileRepoFiles.length - 1 ? '1px solid #f3f4f6' : 'none', background: '#fff' }}>
                              <span style={{ width: 22, fontSize: 11, color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>{f.no}</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f9f6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>
                                {f.previewUrl
                                  ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0f9f6e', textDecoration: 'none', fontWeight: 500 }}>{f.namaFile}</a>
                                  : <span style={{ color: '#374151' }}>{f.namaFile}</span>}
                              </span>
                              <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{f.tanggal}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Belum ada file di folder ini</div>
                          <div style={{ fontSize: 12 }}>
                            Upload di{' '}
                            <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" style={{ color: '#0f9f6e', fontWeight: 600 }}>Repository FIK</a>
                            {' '}pada folder dengan kode indikator ini
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}


              {/* Buttons */}
              <div className="modal-footer">
                <button onClick={() => setFileRepoModalOpen(false)} className="btn-secondary">
                  Tutup
                </button>
                {!fileRepoIsAtasan && (
                  <button
                    onClick={handleFileRepoSubmit}
                    disabled={fileRepoLoading || fileRepoFiles.length === 0 || fileRepoSubmitting}
                    className="btn-green"
                  >
                    {fileRepoSubmitting ? "Menyimpan..." : "Simpan Realisasi"}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}


        {/* DIRECT INPUT MODAL (sumberData = 'ikupk') — drag & drop upload */}
        {directModalOpen && createPortal(
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
            onClick={() => { setDirectModalOpen(false); setDirectNeedsRevision(null); }}
          >
            <div
              style={{ background: '#fff', borderRadius: 16, width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 25px 80px rgba(0,0,0,0.22)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.3 }}>Upload File Realisasi</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{directModalNama}</p>
                  </div>
                  <button onClick={() => setDirectModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1, padding: 4, flexShrink: 0 }}>✕</button>
                </div>
              </div>

              <div style={{ padding: '18px 24px' }}>
                {/* Banner revisi — muncul jika indikator ini punya record needs_revision */}
                {directNeedsRevision && (
                  <div className="alert-banner alert-banner--warning" style={{ marginBottom: 16 }}>
                    <div className="fw-700 mb-4">⚠ Revisi Diperlukan</div>
                    {directNeedsRevision.catatanRevisi && (
                      <div className="alert-banner alert-banner--warning" style={{ fontSize: 12, marginBottom: 6 }}>
                        <span className="fw-700">Catatan validator: </span>{directNeedsRevision.catatanRevisi}
                      </div>
                    )}
                    {!directNeedsRevision.catatanRevisi && directNeedsRevision.keterangan && (
                      <div className="mb-4" style={{ fontSize: 12 }}>{directNeedsRevision.keterangan}</div>
                    )}
                    {directNeedsRevision.validFileCount !== null && (
                      <div className="mb-4" style={{ fontSize: 11 }}>
                        {directNeedsRevision.validFileCount} file sebelumnya sudah tervalidasi — unggah file yang perlu diperbaiki saja.
                      </div>
                    )}
                    <div style={{ fontSize: 11 }}>Upload file baru lalu klik Simpan untuk mengirim ulang ke validator.</div>
                  </div>
                )}

                {/* Periode */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Periode</label>
                  <select
                    value={fileRepoPeriode}
                    onChange={(e) => setFileRepoPeriode(e.target.value)}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', color: '#374151', cursor: 'pointer' }}
                  >
                    {periodeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); if (!ikupkFileUploading) setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && !ikupkFileUploading) void handleIkupkUpload(file);
                  }}
                  onClick={() => !ikupkFileUploading && ikupkFileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragOver ? '#6366f1' : ikupkFileUploading ? '#e5e7eb' : '#d1d5db'}`,
                    borderRadius: 12,
                    padding: '28px 20px',
                    marginBottom: 16,
                    textAlign: 'center',
                    background: isDragOver ? '#f5f3ff' : '#fafafa',
                    cursor: ikupkFileUploading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                  }}
                >
                  <input
                    ref={ikupkFileInputRef}
                    type="file"
                    disabled={ikupkFileUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { void handleIkupkUpload(file); e.target.value = ''; }
                    }}
                    style={{ display: 'none' }}
                  />

                  {ikupkFileUploading ? (
                    <div>
                      <div style={{ width: 44, height: 44, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="22" cy="22" r="18" stroke="#e5e7eb" strokeWidth="4" />
                          <path d="M22 4 a18 18 0 0 1 18 18" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#6366f1' }}>Mengupload file...</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Mohon tunggu sebentar</p>
                      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                  ) : (
                    <div>
                      <div style={{ width: 52, height: 52, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                          <circle cx="26" cy="26" r="26" fill={isDragOver ? '#ede9fe' : '#f3f4f6'} />
                          <path d="M26 34V24M26 24L22 28M26 24L30 28" stroke={isDragOver ? '#6366f1' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18 32c-2.76 0-5-2.24-5-5 0-2.42 1.72-4.44 4-4.9A7 7 0 0 1 26 16a7 7 0 0 1 6.96 6.1C35.28 22.56 37 24.58 37 27c0 2.76-2.24 5-5 5H18z" stroke={isDragOver ? '#6366f1' : '#9ca3af'} strokeWidth="2" fill="none" />
                        </svg>
                      </div>
                      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: isDragOver ? '#4f46e5' : '#1f2937' }}>
                        {isDragOver ? 'Lepaskan file di sini' : 'Pilih file atau drag & drop di sini'}
                      </p>
                      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9ca3af' }}>PDF, DOC, gambar, dan format lainnya — maks. 10 MB</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); ikupkFileInputRef.current?.click(); }}
                        style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                      >
                        Browse File
                      </button>
                    </div>
                  )}
                </div>

                {/* File list */}
                {ikupkFiles.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>File Terupload</span>
                      <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{ikupkFiles.length} file</span>
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                      {ikupkFiles.map((f, idx) => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none', background: '#fff' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                            {f.fileName.match(/\.(pdf)$/i) ? '📄' : f.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' : f.fileName.match(/\.(doc|docx)$/i) ? '📝' : '📎'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a href={`${API_BASE_URL}${f.fileUrl}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                              {f.fileName}
                            </a>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.periode ?? '-'}</span>
                          </div>
                          <button
                            onClick={() => void handleDeleteIkupkFile(f.id)}
                            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ikupkFiles.length === 0 && !ikupkFileUploading && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: 0 }}>
                    Belum ada file — upload file lalu klik Simpan Realisasi
                  </p>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setDirectModalOpen(false); setDirectNeedsRevision(null); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Tutup
                </button>
                <button
                  onClick={handleDirectInputSubmit}
                  disabled={directInputSubmitting || ikupkFiles.length === 0}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: directInputSubmitting || ikupkFiles.length === 0 ? 'not-allowed' : 'pointer',
                    background: directInputSubmitting || ikupkFiles.length === 0 ? '#d1d5db' : directNeedsRevision ? '#d97706' : '#16a34a', color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {directInputSubmitting ? 'Menyimpan...' : directNeedsRevision ? `↑ Upload Ulang (${ikupkFiles.length} file)` : `✓ Simpan Realisasi (${ikupkFiles.length} file)`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <style>{`
          .ikupk-hero { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px 32px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
          .ikupk-hero-eyebrow { font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
          .ikupk-hero-title { font-size: 22px; font-weight: 800; color: #0f2f4f; margin: 0 0 6px; }
          .ikupk-hero-sub { font-size: 13px; color: #6b7280; margin: 0; }
          .ikupk-stats-card { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; display: flex; flex-direction: row; align-items: center; gap: 0; }
          .ikupk-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 18px; }
          .ikupk-stat + .ikupk-stat { border-left: 1px solid #e5e7eb; }
          .ikupk-stat-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
          .ikupk-stat-val { font-size: 18px; font-weight: 800; color: #2563eb; }
          .ikupk-toolbar { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
          .ikupk-filter-group { display: flex; flex-direction: column; gap: 4px; }
          .ikupk-filter-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
          .ikupk-select { border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; font-size: 13px; color: #374151; background: #fff; cursor: pointer; outline: none; }
          .ikupk-select:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.12); }
          .ikupk-vpanel-header { background: #0f2f4f !important; }
          .ikupk-vpanel-header .verification-panel__eyebrow { color: #7dd3fc !important; }
          .ikupk-vpanel-header .verification-panel__title { color: #ffffff !important; }
          .ikupk-vpanel-header .verification-panel__summary span { color: #cbd5e1 !important; }
          .ikupk-table th { background-color: #0f2f4f !important; color: #e8eef7 !important; font-weight: 900 !important; border-bottom: 1px solid rgba(255,255,255,0.12) !important; letter-spacing: 0.06em; text-transform: uppercase; }
          .ikupk-table { overflow: hidden; }
          .ikupk-table-card { overflow: hidden; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15,23,42,0.07); }
          .ikupk-table-wrapper { overflow: hidden; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15,23,42,0.07); margin-bottom: 20px; }
        `}</style>

        {/* ── Header Slot (e.g. MonitoringBoxes on dashboard) ── */}
        {headerSlot}

        {/* ── Hero Card — hidden when headerSlot already provides a dashboard summary ── */}
        {!headerSlot && (
          <div className="ikupk-hero">
            <div>
              <h3 className="ikupk-card-title">
                {pageTitle ?? 'Indikator Kinerja Utama & Perjanjian Kinerja'}
              </h3>
              <p className="ikupk-hero-sub">Target dan realisasi indikator kinerja kegiatan dan perjanjian kinerja.</p>
            </div>
            {isTopLevel && !loading && groupedData.length > 0 && (
              <div className="ikupk-stats-card">
                <div className="ikupk-stat">
                  <span className="ikupk-stat-label">Sasaran</span>
                  <span className="ikupk-stat-val">{groupedData.length}</span>
                </div>
                {displayRole === 'admin' && (
                  <div className="ikupk-stat">
                    <span className="ikupk-stat-label">Terverifikasi</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#047857" }}>{validasiBiroPKU.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          {isTopLevel ? (
            <>
              <div className="ikupk-toolbar">
                <div className="ikupk-filter-group">
                  <span className="ikupk-filter-label">Target</span>
                  <select
                    value={jenis}
                    onChange={(e) => setJenis(e.target.value)}
                    className="ikupk-select"
                  >
                    <option value="IKU">Indikator Kinerja Utama</option>
                    <option value="PK">Perjanjian Kinerja</option>
                    <option value="PK_IKU">PK Berbasis IKU</option>
                  </select>
                </div>
                <div className="ikupk-filter-group">
                  <span className="ikupk-filter-label">Tahun</span>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    className="ikupk-select"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && <p className="text-loading">Loading...</p>}

              {displayRole === 'admin' ? (
                <>
                {!loading && groupedData.length > 0 && (
                <div className="verification-panel">
                  <div className="verification-panel__header ikupk-vpanel-header">
                    <div>
                      <p className="verification-panel__eyebrow">Verifikasi Biro PKU</p>
                      <h4 className="verification-panel__title">
                        Target {jenis === 'PK_IKU' ? 'PK Berbasis IKU' : jenis} Tahun {tahun}
                      </h4>
                    </div>
                    <div className="verification-panel__summary">
                      <span>{groupedData.length} sasaran</span>
                      <span>{validasiBiroPKU.length} hasil verifikasi</span>
                    </div>
                  </div>
                <div className="table-wrapper verification-table-wrapper">
                  <table className="table-universal verification-table ikupk-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="col-w5 text-center">Nomor</th>
                        <th rowSpan={2} className="col-w20">Sasaran Program</th>
                        <th rowSpan={2} className="col-w35">Sub Indikator Kinerja Utama</th>
                        <th colSpan={2} className="text-center">Target Universitas</th>
                        <th rowSpan={2} className="text-center min-w100">Target</th>

                        {displayRole !== 'admin' && (
                          <th rowSpan={2} className="col-w10 text-center">Disposisi</th>
                        )}
                      </tr>
                      <tr>
                        <th className="text-center min-w100">Kuantitas</th>
                        <th className="text-center min-w100">Waktu</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(() => {
                        const allGroups = jenis === 'IKU'
                          ? groupedData.filter(g => g.persentaseTarget !== null)
                          : groupedData;
                        const colSpan = displayRole !== 'admin' ? 7 : 6;

                        const renderGroupRows = (group: typeof allGroups[0], groupIdx: number): React.ReactNode[] => {
                          const filteredSubs = group.subIndikators;
                          if (filteredSubs.length === 0) return [];
                          const flatRows: FlatRow[] = [];
                          for (const sub of filteredSubs) {
                            const hasPkL3 = sub.children.some(c => (c.children ?? []).length > 0);
                            let subTotal = 1;
                            if (hasPkL3) { for (const child of sub.children) subTotal += 1 + (child.children ?? []).length; }
                            else { subTotal += sub.children.length; }
                            flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, child: null, l3Obj: null, isSubFirst: true, subTotalRows: subTotal });
                            for (const child of sub.children) {
                              flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, child, l3Obj: null, isSubFirst: false, subTotalRows: subTotal });
                              if (hasPkL3) { for (const l3 of (child.children ?? [])) { flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, child, l3Obj: l3, isSubFirst: false, subTotalRows: subTotal }); } }
                            }
                          }
                          const totalRowSpan = flatRows.length;
                          return flatRows.map((row, rowIdx) => {
                            const univKuantitas = group.targetAbsolut;
                            const hasPkL3 = row.sub.children.some((c: IndikatorGroupedChild) => (c.children ?? []).length > 0);
                            const isLeaf = hasPkL3 ? row.level === 3 : row.level === 2;
                            const leafNilaiTarget = row.level === 3 ? row.l3Obj?.nilaiTarget ?? null : row.child?.nilaiTarget ?? null;
                            const leafTarget = Number(leafNilaiTarget || 0);
                            const leafSatuan = row.level === 3 ? (row.l3Obj?.satuan ?? null) : (row.child?.satuan ?? null);
                            return (
                              <tr key={`${group.id}-${rowIdx}`}>
                                {rowIdx === 0 && (
                                  <>
                                    <td rowSpan={totalRowSpan} className="td-cell td-cell--center">
                                      <p>{row.sub.kode.split('.')[0] || groupIdx + 1}</p>
                                    </td>
                                    <td rowSpan={totalRowSpan} className="td-cell v-top">
                                      <div className="fw-600 mb-4">{group.nama}</div>
                                      {(() => {
                                        const biroPKU = validasiBiroPKU.find((v) => v.indikatorId === group.id);
                                        if (!biroPKU || biroPKU.jumlahValid == null) return null;
                                        return (
                                          <div className="biro-pku-result">
                                            <div className="biro-pku-result__top">
                                              <span className="biro-pku-result__label">Biro PKU</span>
                                              <span className="biro-pku-result__value">{biroPKU.jumlahValid} valid</span>
                                            </div>
                                            {biroPKU.keterangan && (
                                              <div className="biro-pku-result__note">{biroPKU.keterangan}</div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                  </>
                                )}
                                <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''} ${row.level === 3 ? 'td-cell--indent2' : ''}`}>
                                  {row.kode} {row.nama}
                                </td>
                                {rowIdx === 0 && (
                                  <>
                                    <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--blue">
                                      {univKuantitas !== null ? `${univKuantitas}${group.satuan ? ` ${group.satuan}` : ''}` : "-"}
                                    </td>
                                    <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--blue">
                                      {group.tenggat || "-"}
                                    </td>
                                  </>
                                )}
                                <td className="td-cell td-cell--center">
                                  {isLeaf && leafNilaiTarget !== null ? `${leafNilaiTarget}${leafSatuan ? ` ${leafSatuan}` : ''}` : '-'}
                                </td>
                                {displayRole !== 'admin' && (
                                  isLeaf ? (
                                    <td className="action-cell">
                                      <div className="action-cell-inner">
                                        <button onClick={() => handleGroupedDisposisiClick(row.id, leafTarget, authUser?.id, group.id)} className="btn-small btn-small--green btn-small--w100">Disposisi</button>
                                        <button onClick={() => handleInputFileClick(row.id, row.nama, leafTarget, [], true)} className="btn-small btn-small--outline btn-small--w100">Lihat Progress</button>
                                      </div>
                                    </td>
                                  ) : <td className="td-cell" />
                                )}
                              </tr>
                            );
                          });
                        };

                        if (jenis === 'IKU') {
                          const grouped: Record<string, typeof allGroups> = { Wajib: [], Pilihan: [], Partisipatif: [] };
                          allGroups.forEach(g => grouped[getIkuKategori(g.kode)].push(g));
                          return KATEGORI_ORDER.flatMap(kat => {
                            const items = grouped[kat];
                            if (items.length === 0) return [];
                            const isCollapsed = collapsedKategori.has(kat);
                            return [
                              <tr key={`kat-${kat}`}
                                onClick={() => setCollapsedKategori(prev => { const s = new Set(prev); s.has(kat) ? s.delete(kat) : s.add(kat); return s; })}
                                style={{ background: "#1e3a5f", cursor: "pointer", userSelect: "none" }}>
                                <td colSpan={colSpan} style={{ padding: "9px 16px", color: "#fff", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em" }}>
                                  <span style={{ marginRight: 8, fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
                                  {KATEGORI_LABEL[kat]}
                                </td>
                              </tr>,
                              ...(isCollapsed ? [] : items.flatMap((g, i) => renderGroupRows(g, i))),
                            ];
                          });
                        }

                        return allGroups.flatMap((g, i) => renderGroupRows(g, i));
                      })()}
                    </tbody>
                  </table>
                </div>
                </div>
              )}

              {!loading && groupedData.length === 0 && (
                <p className="text-empty">Tidak ada data indikator</p>
              )}
                </>
              ) : (
              <>
              {loading && <p className="text-loading">Loading...</p>}

              {/* Section 1: Target yang diterima via disposisi → bisa disposisi ulang */}
              {!loading && (
                <>
                  <h4 className="ikupk-section-title">Target yang Anda Terima</h4>
                  {receivedGroupedData.length === 0 ? (
                    <p className="text-empty">Belum ada target yang didisposisikan kepada Anda melalui alur disposisi.</p>
                  ) : (
                    <div className="table-wrapper ikupk-table-wrapper">
                      <table className="table-universal ikupk-table">
                        <thead>
                          <tr>
                            <th className="col-w5 text-center">No</th>
                            <th className="col-w20">Sasaran Program</th>
                            <th>Sub Indikator Kinerja</th>
                            <th className="col-w10 text-center">Diterima</th>
                            <th className="col-w15 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderWithKategori(receivedGroupedData, 5, 'recv', (group, groupIdx) => {
                            const flatRows: FlatRow[] = [];
                            for (const sub of group.subIndikators) {
                              const hasPkL3 = sub.children.some(c => (c.children ?? []).length > 0);
                              let subTotal = 1;
                              if (hasPkL3) { for (const child of sub.children) subTotal += 1 + (child.children ?? []).length; }
                              else { subTotal += sub.children.length; }
                              flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, child: null, l3Obj: null, isSubFirst: true, subTotalRows: subTotal });
                              for (const child of sub.children) {
                                flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, child, l3Obj: null, isSubFirst: false, subTotalRows: subTotal });
                                if (hasPkL3) { for (const l3 of (child.children ?? [])) flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, child, l3Obj: l3, isSubFirst: false, subTotalRows: subTotal }); }
                              }
                            }
                            const totalRowSpan = flatRows.length;
                            return flatRows.map((row, rowIdx) => {
                              const hasPkL3 = (row.sub as IndikatorGroupedSub).children.some((c: IndikatorGroupedChild) => (c.children ?? []).length > 0);
                              const isLeaf = hasPkL3 ? row.level === 3 : row.level === 2;
                              const leafDisposisi = row.level === 3 ? (row.l3Obj?.disposisiJumlah ?? null) : (row.child?.disposisiJumlah ?? null);
                              return (
                                <tr key={`recv-${group.id}-${rowIdx}`}>
                                  {rowIdx === 0 && (
                                    <>
                                      <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">{group.kode}</td>
                                      <td rowSpan={totalRowSpan} className="td-cell v-top">
                                        <div>{group.nama}</div>
                                      </td>
                                    </>
                                  )}
                                  <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''} ${row.level === 3 ? 'td-cell--indent2' : ''}`}>{row.kode} {row.nama}</td>
                                  {isLeaf ? (
                                    <>
                                      <td className="td-cell td-cell--center td-cell--bold">{leafDisposisi !== null ? leafDisposisi : "-"}</td>
                                      <td className="action-cell">
                                        <div className="action-cell-inner">
                                          <button onClick={() => handleGroupedDisposisiClick(row.id, Number(leafDisposisi || 0), authUser?.id, group.id)} className="btn-small btn-small--blue btn-small--w100">Disposisi</button>
                                          <button onClick={() => handleInputFileClick(row.id, row.nama, Number(leafDisposisi || 0), [], true)} className="btn-small btn-small--outline btn-small--w100">Lihat Progress</button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="td-cell" />
                                      <td className="td-cell" />
                                    </>
                                  )}
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
              )}
            </>
          ) : (
            <>
              {!hideFilter && (
                <div className="filter filter--mb20">
                  <div className="filter-content">
                    <label className="filter-content-label">Target</label>
                    <select
                      value={jenis}
                      onChange={(e) => setJenis(e.target.value)}
                      className="filter-isi"
                    >
                      <option value="IKU">Indikator Kinerja Utama</option>
                      <option value="PK">Perjanjian Kinerja</option>
                      <option value="PK_IKU">PK Berbasis IKU</option>
                    </select>
                  </div>
                  <div className="filter-content">
                    <label className="filter-content-label">Tahun</label>
                    <select
                      value={tahun}
                      onChange={(e) => setTahun(e.target.value)}
                      className="filter-isi"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {loading && <p className="text-loading">Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <>
                  {/* ── Tabel 1: Target untuk Input File ──
                      Hanya ditampilkan ketika user adalah leaf (Dosen) atau punya secondary Dosen role.
                      Untuk non-Dosen (Kajur/Kaprodi) tanpa secondary Dosen role: hanya section Disposisi. */}
                  {/* ── Tabel 1: Target untuk Input File — hanya Dosen ── */}
                  {isDosen && (
                    <>
                      <h4 className="ikupk-section-title">Target {jenis === 'PK_IKU' ? 'PK Berbasis IKU' : jenis}</h4>
                      {renderInputFileTable(groupedData, 'input')}
                    </>
                  )}

                  {/* ── Tabel 2: Disposisi ke Bawahan (hanya untuk non-dosen / pimpinan) ── */}
                  {!isDosen && (
                    <>
                      <div className="ikupk-section-divider" />
                      <h4 className="ikupk-section-title">Disposisi Target {jenis === 'PK_IKU' ? 'PK Berbasis IKU' : jenis}</h4>
                      <div className="table-wrapper ikupk-table-wrapper">
                        <table className="table-universal ikupk-table">
                          <thead>
                            <tr>
                              <th className="col-w5 text-center">No</th>
                              <th className="col-w20">Sasaran Program</th>
                              <th>Sub Indikator Kinerja</th>
                              <th className="col-w10 text-center">Target Diterima</th>
                              <th className="col-w10 text-center">Tenggat</th>
                              <th className="col-w15 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {renderWithKategori(groupedData, 6, 'disp', (group, groupIdx) => {
                              const flatRows: FlatRow[] = [];
                              for (const sub of group.subIndikators) {
                                const hasPkL3 = sub.children.some(c => (c.children ?? []).length > 0);
                                let subTotal = 1;
                                if (hasPkL3) {
                                  for (const child of sub.children) subTotal += 1 + (child.children ?? []).length;
                                } else {
                                  subTotal += sub.children.length;
                                }
                                flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, child: null, l3Obj: null, isSubFirst: true, subTotalRows: subTotal });
                                for (const child of sub.children) {
                                  flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, child, l3Obj: null, isSubFirst: false, subTotalRows: subTotal });
                                  if (hasPkL3) {
                                    for (const l3 of (child.children ?? [])) {
                                      flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, child, l3Obj: l3, isSubFirst: false, subTotalRows: subTotal });
                                    }
                                  }
                                }
                              }
                              const totalRowSpan = flatRows.length;
                              return flatRows.map((row, rowIdx) => {
                                const hasPkL3 = (row.sub as IndikatorGroupedSub).children.some((c: IndikatorGroupedChild) => (c.children ?? []).length > 0);
                                const isLeaf = hasPkL3 ? row.level === 3 : row.level === 2;
                                const leafDisposisi = row.level === 3
                                  ? (row.l3Obj?.disposisiJumlah ?? null)
                                  : (row.child?.disposisiJumlah ?? null);

                                if (!isLeaf) {
                                  return (
                                    <tr key={`disp-${group.id}-${rowIdx}`} style={{ background: '#f8fafc' }}>
                                      {rowIdx === 0 && (
                                        <>
                                          <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">{group.kode}</td>
                                          <td rowSpan={totalRowSpan} className="td-cell v-top">{group.nama}</td>
                                        </>
                                      )}
                                      <td colSpan={4} className="td-cell" style={{
                                        paddingLeft: row.level === 2 ? 32 : 16,
                                        fontWeight: 600,
                                        color: row.level === 2 ? '#4b5563' : '#374151',
                                        fontSize: 12,
                                        background: '#f8fafc',
                                        borderBottom: '1px solid #f0f0f0',
                                      }}>
                                        {row.level === 2 && <span style={{ marginRight: 5, color: '#94a3b8' }}>↳</span>}
                                        {row.kode} {row.nama}
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr key={`disp-${group.id}-${rowIdx}`}>
                                    <td className="td-cell" style={{
                                      paddingLeft: row.level === 3 ? 48 : row.level === 2 ? 28 : 16,
                                      color: '#6b7280',
                                    }}>
                                      <span style={{ marginRight: 4, color: '#c4c9d0' }}>↳</span>
                                      {row.kode} {row.nama}
                                    </td>
                                    <td className="td-cell td-cell--center td-cell--bold">
                                      {leafDisposisi !== null ? leafDisposisi : "-"}
                                    </td>
                                    <td className="td-cell td-cell--center" style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                                      {group.tenggat ?? '—'}
                                    </td>
                                    <td className="action-cell">
                                      <div className="action-cell-inner">
                                        <button
                                          onClick={() => handleGroupedDisposisiClick(row.id, Number(leafDisposisi || 0), authUser?.id, group.id)}
                                          className="btn-small btn-small--blue btn-small--w100"
                                        >
                                          Redisposisi
                                        </button>
                                        <button
                                          onClick={() => handleInputFileClick(row.id, row.nama, Number(leafDisposisi || 0), [], true)}
                                          className="btn-small btn-small--outline btn-small--w100"
                                        >
                                          Lihat Progress
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {!loading && groupedData.length === 0 && (
                <p className="text-empty">Tidak ada data target yang didisposisikan kepada Anda</p>
              )}

            </>
          )}

        </div>
      </PageTransition>
    </div>
  );
}
