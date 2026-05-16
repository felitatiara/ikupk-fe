"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import PageTransition from "@/components/layout/PageTransition";
import { getUsersByRole, getUsersByLevel, getRelatedUsersFor, getDosenByUnit, getReceivedDisposisiJumlah, getIndikatorGrouped, getIndikatorGroupedForUser, getDisposisi, upsertDisposisi, getAllRealisasiFiles, submitFileRealisasiWithAuth, submitRealisasiDirect, uploadIkupkFile, getIkupkFiles, deleteIkupkFile, getIndikatorCascadeChain, getAvailableYears, API_BASE_URL } from "../../lib/api";
import type { UnitUser, IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild, IndikatorGroupedLevel3, IkupkFile } from "../../lib/api";
import { useAuth } from "@/hooks/useAuth";

// Data nyata diambil dari IKUPK-BE → repository-nest berdasarkan kode indikator

export default function IKUPKContent({ role = 'user', pageTitle, headerSlot }: { role?: 'admin' | 'user' | 'dekan' | 'pimpinan'; pageTitle?: string; headerSlot?: React.ReactNode }) {
  const displayRole = role?.toLowerCase() === 'pimpinan' ? 'dekan' : role?.toLowerCase();

  const { user: authUser, token } = useAuth();
  const [loading, setLoading] = useState(true);

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

  // Ikupk file upload state (sumberData = 'ikupk')
  const [ikupkFiles, setIkupkFiles] = useState<IkupkFile[]>([]);
  const [ikupkFileUploading, setIkupkFileUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [directInputSubmitting, setDirectInputSubmitting] = useState(false);
  const ikupkFileInputRef = useRef<HTMLInputElement>(null);

  // Grouped data for admin/dekan view
  const [groupedData, setGroupedData] = useState<IndikatorGrouped[]>([]);
  // For isTopLevel non-admin (Dekan/WD) who may also receive disposisi from Kaprodi
  const [receivedGroupedData, setReceivedGroupedData] = useState<IndikatorGrouped[]>([]);
const [tahun, setTahun] = useState("2026");
  const [availableYears, setAvailableYears] = useState<string[]>(["2025", "2026", "2027"]);
  const [jenis, setJenis] = useState("IKU");
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

  // Fetch grouped data
  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    const isAdmin = displayRole === 'admin';

    // Hanya Admin dan Dekan (bukan WD) lihat semua indikator; WD hanya lihat yang didisposisi Dekan
    const fetchPromise = (isAdmin || isActualDekan)
      ? getIndikatorGrouped(jenis, tahun, unitId)
      : (authUser?.id)
        ? getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId)
        : Promise.resolve([]);

    fetchPromise
      .then((d) => { if (!cancelled) { setGroupedData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setGroupedData([]); setLoading(false); } });

    // Dekan/WD (isTopLevel non-admin) mungkin juga menerima disposisi dari Kaprodi
    if (isTopLevel && !isAdmin && authUser?.id) {
      getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId)
        .then((d) => { if (!cancelled) setReceivedGroupedData(d); })
        .catch(() => { if (!cancelled) setReceivedGroupedData([]); });
    } else if (!isTopLevel) {
      setReceivedGroupedData([]);
    }

    return () => { cancelled = true; };
  }, [displayRole, jenis, tahun, unitId, authUser?.id, roleLevel, isActualDekan, isTopLevel]);

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

      // Cascade chain (role-based): ambil chain dari L0 indikator
      if (l0Id) {
        try {
          const cascadeChain = await getIndikatorCascadeChain(l0Id); // [roleId, roleId, ...]
          if (cascadeChain.length > 0) {
            const normalizedChain = cascadeChain.map(Number);
            let nextRoleId: number | null = null;

            if (displayRole === 'admin') {
              // Admin → kirim ke chain[0]
              nextRoleId = normalizedChain[0];
            } else if (authUser?.roleId) {
              const myRoleId = Number(authUser.roleId);
              const currentIdx = normalizedChain.indexOf(myRoleId);
              if (currentIdx >= 0 && currentIdx < normalizedChain.length - 1) {
                // Role di tengah chain → kirim ke role berikutnya
                nextRoleId = normalizedChain[currentIdx + 1];
              } else if (currentIdx === -1 && isTopLevel) {
                // isTopLevel tidak ada di chain → kirim ke chain[0]
                nextRoleId = normalizedChain[0];
              }
              // currentIdx === chain.length - 1 → role terakhir, fall through ke bawahan logic
            }

            if (nextRoleId !== null) {
              users = await getUsersByRole(nextRoleId);
              users = users.filter((u) => u.id !== authUser?.id);
              usedCascade = true;
            }
          }
        } catch { /* fallback ke logika lama */ }
      }

      if (!usedCascade) {
        if (displayRole === 'admin') {
          // Admin: semua user di unit
          const allUsers = await getUsersByRole(unitId);
          users = allUsers.filter((u) => u.id !== authUser?.id);
        } else if (roleLevel <= 2) {
          // Level 1 (Dekan/WD/Kabag) DAN level 2 (Kajur): coba bawahan langsung dulu.
          const directBawahan = await getRelatedUsersFor(authUser.id);
          if (directBawahan.length > 0) {
            users = directBawahan;
          } else if (roleLevel <= 1) {
            // Dekan/WD: disposisi ke level-1 lainnya DAN Kajur (level 2)
            const [lvl1Users, lvl2Users] = await Promise.all([getUsersByLevel(1), getUsersByLevel(2)]);
            const merged = [...lvl1Users, ...lvl2Users].filter((u) => u.id !== authUser?.id);
            const seen = new Set<number>();
            users = merged.filter((u) => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
          } else {
            // Kajur: disposisi ke semua Kaprodi (level 3)
            users = await getUsersByLevel(3);
          }
        } else if (roleLevel === 3 && authUser?.unitNama) {
          // Kaprodi: semua Dosen di prodinya
          const dosenUsers = await getDosenByUnit(authUser.unitNama);
          users = dosenUsers.filter((u) => u.id !== authUser?.id);
        } else if (authUser?.id) {
          // Dosen (level 4): bawahan langsung via user_relations
          users = await getRelatedUsersFor(authUser.id);
        }
      }

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
        if ((displayRole === 'admin' || isActualDekan) && unitId) {
          const d = await getIndikatorGrouped(jenis, tahun, unitId);
          setGroupedData(d);
        } else if (authUser?.id && unitId) {
          const d = await getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId);
          setGroupedData(d);
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
    setDirectModalIndikatorId(indikatorId);
    setDirectModalNama(nama);
    setFileRepoPeriode(periodeOptions[0]);
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
      toast.success('Realisasi berhasil disimpan.');
      setDirectModalOpen(false);
    } catch {
      toast.error('Gagal menyimpan realisasi.');
    } finally {
      setDirectInputSubmitting(false);
    }
  };

  // showAtasanView=false → tampilkan file milik sendiri (seperti dosen)
  // showAtasanView=true  → tampilkan semua file bawahan (mode lihat progress)
  const handleInputFileClick = async (indikatorId: number, nama: string, target: number, children: IndikatorGroupedChild[] = [], showAtasanView = false) => {
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

    // Tentukan filter email bawahan berdasarkan user_relations.
    // Untuk level-1 non-admin (Kabag): user_relations berisi Tendik → batasi tampilan file.
    // Untuk Dekan/WD (tanpa user_relations): allowedEmails = undefined → tampilkan semua.
    let allowedEmails: Set<string> | undefined;
    if (showAtasanView && authUser?.id && displayRole !== 'admin') {
      if (roleLevel >= 2) {
        // Kajur (2), Kaprodi (3): filter ke bawahan langsung
        try {
          const bawahanUsers = await getRelatedUsersFor(authUser.id);
          if (bawahanUsers.length > 0) {
            allowedEmails = new Set(bawahanUsers.map(u => u.email.toLowerCase()).filter(Boolean));
          }
          // Dekan/WD (roleLevel <= 1) yang tidak masuk blok ini: allowedEmails undefined → tampilkan semua
        } catch {
          // Gagal fetch → tidak batasi
        }
      }
    } else if (!showAtasanView && !isDosen && authUser?.id) {
      // Non-dosen (misal Kabag) klik "Input File": fetch bawahan langsung agar file Tendik tampil
      try {
        const bawahanUsers = await getRelatedUsersFor(authUser.id);
        if (bawahanUsers.length > 0) {
          allowedEmails = new Set(bawahanUsers.map(u => u.email.toLowerCase()).filter(Boolean));
        }
      } catch { }
    }

    fetchRepoFiles(indikatorId, showAtasanView, allowedEmails);
  };

  const handleFileRepoSubmit = async () => {
    if (!fileRepoIndikatorId || !token || !unitId) return;
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
      // Re-fetch agar capaian (termasuk bawahan) langsung ter-update
      if (authUser?.id) {
        const d = await getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId);
        setGroupedData(d);
      }
    } catch {
      toast.error("Gagal menyimpan realisasi");
    } finally {
      setFileRepoSubmitting(false);
    }
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
      <div className="table-wrapper">
        <table className="table-universal">
          <thead>
            <tr>
              <th className="col-w5 text-center">No</th>
              <th className="col-w20">Sasaran Strategis</th>
              <th>Sub Indikator Kinerja</th>
              <th className="col-w10 text-center">Target Diterima</th>
              <th className="col-w10 text-center">Capaian</th>
              <th className="col-w15 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((group, groupIdx) => {
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
                return (
                  <tr key={`${keyPrefix}-${group.id}-${rowIdx}`}>
                    {rowIdx === 0 && (
                      <>
                        <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">{groupIdx + 1}</td>
                        <td rowSpan={totalRowSpan} className="td-cell v-top">{group.nama}</td>
                      </>
                    )}
                    <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''} ${row.level === 3 ? 'td-cell--indent2' : ''}`}>
                      {row.kode} {row.nama}
                    </td>
                    <td className="td-cell td-cell--center td-cell--bold">
                      {row.isLeaf ? (leafTarget !== null ? leafTarget : '-') : ''}
                    </td>
                    <td className={`td-cell td-cell--center fw-700 ${leafCapaianClass}`}>
                      {row.isLeaf ? leafCapaianPct : ''}
                    </td>
                    <td className="action-cell">
                      {row.isLeaf && !(row.actionSumberData === 'ikupk' && displayRole !== 'admin') && (
                        <button
                          onClick={() => row.actionSumberData === 'ikupk'
                            ? handleDirectInputClick(row.actionId, row.actionNama)
                            : handleInputFileClick(row.actionId, row.actionNama, Number(leafTarget || 0), [])}
                          className="btn-small btn-small--green"
                        >
                          Input File
                        </button>
                      )}
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
        <p className="ikupk-header-text">
          {pageTitle ?? 'Indikator Kinerja Utama & Perjanjian Kinerja'}
        </p>
        {headerSlot}

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
              <h3 className="modal-title modal-title--mb8">
                {fileRepoIsAtasan ? 'Progress Bawahan' : 'File Repository'} — {fileRepoNama}
              </h3>
              <p className="modal-subtitle">
                {fileRepoIsAtasan
                  ? 'Menampilkan semua file yang telah diunggah oleh bawahan untuk indikator ini.'
                  : 'File di bawah diambil otomatis dari folder repository yang sesuai dengan indikator ini.'}
              </p>

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
                      <div className="file-info-row">
                        <span className="file-info-label">Total File Bawahan</span>
                        <span className={fileRepoFiles.length > 0 ? 'file-count--green' : 'file-count--muted'}>
                          {fileRepoFiles.length} File dari {new Set(fileRepoFiles.map(f => f.ownerEmail || f.ownerName)).size} dosen
                          {fileRepoTarget > 0 && ` / Target: ${fileRepoTarget}`}
                        </span>
                      </div>

                      {fileRepoFiles.length > 0 ? (
                        <>
                          {Array.from(new Set(fileRepoFiles.map(f => f.ownerEmail || f.ownerName || 'Tidak diketahui'))).map((ownerKey) => {
                            const ownerFiles = fileRepoFiles.filter(f => (f.ownerEmail || f.ownerName || 'Tidak diketahui') === ownerKey);
                            const ownerName = ownerFiles[0]?.ownerName || ownerKey;
                            return (
                              <div key={ownerKey} className="owner-group">
                                <div className="owner-group-header">
                                  {ownerName} — {ownerFiles.length} file
                                </div>
                                <div className="file-table-wrapper" style={{ padding: 0 }}>
                                  <table className="file-table" style={{ margin: 0 }}>
                                    <tbody>
                                      {ownerFiles.map((f, idx) => (
                                        <tr key={idx}>
                                          <td className="atasan-file-no">{idx + 1}</td>
                                          <td className="atasan-file-name">
                                            {f.previewUrl
                                              ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer">{f.namaFile}</a>
                                              : f.namaFile}
                                          </td>
                                          <td className="atasan-file-date">{f.tanggal}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <div className="file-empty">
                          <div className="file-empty-icon">📂</div>
                          <div className="file-empty-text">Belum ada file yang diupload bawahan untuk indikator ini</div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── DOSEN: file sendiri ── */
                    <>
                      {fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget && (
                        <div className="alert-banner--warning-lg">
                          Jumlah file ({fileRepoFiles.length}) kurang dari target ({fileRepoTarget}). Mohon tambahkan file melalui{" "}
                          <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" className="repo-link">Repository.fik.upnvj.ac.id</a>
                        </div>
                      )}

                      <div className="periode-group">
                        <label className="periode-label">Pilih Periode</label>
                        <select value={fileRepoPeriode} onChange={(e) => setFileRepoPeriode(e.target.value)} className="periode-select">
                          {periodeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>

                      <div className="file-info-row">
                        <span className="file-info-label">File Ditemukan</span>
                        <span className={fileRepoFiles.length >= fileRepoTarget && fileRepoTarget > 0 ? 'file-count--green' : fileRepoFiles.length > 0 ? 'file-count--amber' : 'file-count--muted'}>
                          {fileRepoFiles.length > 0 ? `${fileRepoFiles.length} File` : "Tidak ada file"}
                          {fileRepoTarget > 0 && ` / Target: ${fileRepoTarget}`}
                        </span>
                      </div>

                      {fileRepoFiles.length > 0 ? (
                        <div className="file-table-wrapper">
                          <table className="file-table">
                            <thead>
                              <tr>
                                <th className="col-no">No</th>
                                <th className="text-left">Nama File</th>
                                <th className="col-tanggal">Tanggal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fileRepoFiles.map((f) => (
                                <tr key={f.no}>
                                  <td className="text-center">{f.no}</td>
                                  <td>{f.previewUrl ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer">{f.namaFile}</a> : f.namaFile}</td>
                                  <td className="text-center">{f.tanggal}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="file-empty">
                          <div className="file-empty-icon">📂</div>
                          <div className="file-empty-text">Belum ada file di folder ini</div>
                          <div className="file-empty-hint">
                            Upload file di{" "}
                            <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer">Repository FIK</a>
                            {" "}pada folder dengan nama kode indikator ini
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
            onClick={() => setDirectModalOpen(false)}
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
                <button onClick={() => setDirectModalOpen(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                  Tutup
                </button>
                <button
                  onClick={handleDirectInputSubmit}
                  disabled={directInputSubmitting || ikupkFiles.length === 0}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: directInputSubmitting || ikupkFiles.length === 0 ? 'not-allowed' : 'pointer',
                    background: directInputSubmitting || ikupkFiles.length === 0 ? '#d1d5db' : '#16a34a', color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {directInputSubmitting ? 'Menyimpan...' : `✓ Simpan Realisasi (${ikupkFiles.length} file)`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <div className="page-card">
          <h3 className="ikupk-card-title">
            Indikator Kinerja Utama & Perjanjian Kinerja
          </h3>

          {isTopLevel ? (
            <>
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

              {loading && <p className="text-loading">Loading...</p>}

              {(displayRole === 'admin' || isActualDekan) ? (
                <>
                {!loading && groupedData.length > 0 && (
                <div className="table-wrapper">
                  <table className="table-universal">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="col-w5 text-center">Nomor</th>
                        <th rowSpan={2} className="col-w20">Sasaran Strategis</th>
                        <th rowSpan={2} className="col-w35">Sub Indikator Kinerja Utama</th>
                        <th colSpan={2} className="text-center">Target Universitas</th>
                        <th rowSpan={2} className="text-center min-w100">Target</th>

                        <th rowSpan={2} className="col-w10 text-center">Disposisi</th>
                      </tr>
                      <tr>
                        <th className="text-center min-w100">Kuantitas</th>
                        <th className="text-center min-w100">Waktu</th>
                      </tr>
                    </thead>

                    <tbody>
                      {groupedData.filter(g => g.persentaseTarget !== null).flatMap((group, groupIdx) => {
                        // Tampilkan semua sub-indikator jika Sasaran Strategis memiliki target universitas
                        const filteredSubs = group.subIndikators;

                        if (filteredSubs.length === 0) return [];

                        type TF = { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; child: IndikatorGroupedChild | null; l3Obj: IndikatorGroupedLevel3 | null; isSubFirst: boolean; subTotalRows: number };
                        const flatRows: TF[] = [];
                        for (const sub of filteredSubs) {
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
                          const univKuantitas = group.targetAbsolut;
                          const hasPkL3 = row.sub.children.some((c: IndikatorGroupedChild) => (c.children ?? []).length > 0);
                          const isLeaf = hasPkL3 ? row.level === 3 : row.level === 2;
                          const leafNilaiTarget = row.level === 3
                            ? row.l3Obj?.nilaiTarget ?? null
                            : row.child?.nilaiTarget ?? null;
                          const leafTarget = Number(leafNilaiTarget || 0);
                          const leafSatuan = row.level === 3
                            ? (row.l3Obj?.satuan ?? null)
                            : (row.child?.satuan ?? null);

                          return (
                            <tr key={`${group.id}-${rowIdx}`}>
                              {rowIdx === 0 && (
                                <>
                                  <td rowSpan={totalRowSpan} className="td-cell td-cell--center">
                                    <p>{row.sub.kode.split('.')[0] || groupIdx + 1}</p>
                                  </td>
                                  <td rowSpan={totalRowSpan} className="td-cell v-top">
                                    <div className="fw-600 mb-4">{group.nama}</div>
                                  </td>
                                </>
                              )}
                              <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''} ${row.level === 3 ? 'td-cell--indent2' : ''}`}>
                                {row.kode} {row.nama}
                              </td>

                              {/* Target Universitas — merged per group */}
                              {rowIdx === 0 && (
                                <>
                                  <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--blue">
                                    {univKuantitas !== null
                                      ? `${univKuantitas}${group.satuan ? ` ${group.satuan}` : ''}`
                                      : "-"}
                                  </td>
                                  <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--blue">
                                    {group.tenggat || "-"}
                                  </td>
                                </>
                              )}
                              {/* Target per leaf row (L2 IKU / L3 PK) */}
                              <td className="td-cell td-cell--center">
                                {isLeaf && leafNilaiTarget !== null
                                  ? `${leafNilaiTarget}${leafSatuan ? ` ${leafSatuan}` : ''}`
                                  : '-'}
                              </td>

                              {/* Disposisi — per leaf row (L2 untuk IKU, L3 untuk PK) */}
                              {isLeaf ? (
                                <td className="action-cell">
                                  <div className="action-cell-inner">
                                    <button
                                      onClick={() => handleGroupedDisposisiClick(row.id, leafTarget, authUser?.id, group.id)}
                                      className="btn-small btn-small--green btn-small--w100"
                                    >
                                      Disposisi
                                    </button>
                                    {displayRole !== 'admin' && (
                                      <button
                                        onClick={() => handleInputFileClick(row.id, row.nama, leafTarget, [], true)}
                                        className="btn-small btn-small--outline btn-small--w100"
                                      >
                                        Lihat Progress
                                      </button>
                                    )}
                                  </div>
                                </td>
                              ) : (
                                <td className="td-cell" />
                              )}
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
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
                    <div className="table-wrapper">
                      <table className="table-universal">
                        <thead>
                          <tr>
                            <th className="col-w5 text-center">No</th>
                            <th className="col-w20">Sasaran Strategis</th>
                            <th>Sub Indikator Kinerja</th>
                            <th className="col-w10 text-center">Diterima</th>
                            <th className="col-w15 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receivedGroupedData.map((group, groupIdx) => {
                            type RF = { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; child: IndikatorGroupedChild | null; l3Obj: IndikatorGroupedLevel3 | null; isSubFirst: boolean; subTotalRows: number };
                            const flatRows: RF[] = [];
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
                              const hasPkL3 = row.sub.children.some((c: IndikatorGroupedChild) => (c.children ?? []).length > 0);
                              const isLeaf = hasPkL3 ? row.level === 3 : row.level === 2;
                              const leafDisposisi = row.level === 3 ? (row.l3Obj?.disposisiJumlah ?? null) : (row.child?.disposisiJumlah ?? null);
                              return (
                                <tr key={`recv-${group.id}-${rowIdx}`}>
                                  {rowIdx === 0 && (
                                    <>
                                      <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">{groupIdx + 1}</td>
                                      <td rowSpan={totalRowSpan} className="td-cell v-top">{group.nama}</td>
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

              {loading && <p className="text-loading">Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <>
                  {/* ── Tabel 1: Target untuk Input File ── */}
                  <h4 className="ikupk-section-title">Target IKU dan PK</h4>
                  {renderInputFileTable(groupedData, 'input')}

                  {/* ── Tabel 2: Disposisi ke Bawahan (hanya untuk non-dosen) ── */}
                  {!isDosen && (
                    <>
                      <div className="ikupk-section-divider" />
                      <h4 className="ikupk-section-title">Disposisi Target IKU dan PK</h4>
                      <div className="table-wrapper">
                        <table className="table-universal">
                          <thead>
                            <tr>
                              <th className="col-w5 text-center">No</th>
                              <th className="col-w20">Sasaran Strategis</th>
                              <th>Sub Indikator Kinerja</th>
                              <th className="col-w10 text-center">Target Diterima</th>
                              <th className="col-w15 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedData.map((group, groupIdx) => {
                              type DF = { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; child: IndikatorGroupedChild | null; l3Obj: IndikatorGroupedLevel3 | null; isSubFirst: boolean; subTotalRows: number };
                              const flatRows: DF[] = [];
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
                                const hasPkL3 = row.sub.children.some((c: IndikatorGroupedChild) => (c.children ?? []).length > 0);
                                const isLeaf = hasPkL3 ? row.level === 3 : row.level === 2;
                                const leafDisposisi = row.level === 3
                                  ? (row.l3Obj?.disposisiJumlah ?? null)
                                  : (row.child?.disposisiJumlah ?? null);
                                return (
                                  <tr key={`disp-${group.id}-${rowIdx}`}>
                                    {rowIdx === 0 && (
                                      <>
                                        <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">{groupIdx + 1}</td>
                                        <td rowSpan={totalRowSpan} className="td-cell v-top">{group.nama}</td>
                                      </>
                                    )}
                                    <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''} ${row.level === 3 ? 'td-cell--indent2' : ''}`}>
                                      {row.kode} {row.nama}
                                    </td>
                                    {isLeaf ? (
                                      <>
                                        <td className="td-cell td-cell--center td-cell--bold">
                                          {leafDisposisi !== null ? leafDisposisi : "-"}
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
