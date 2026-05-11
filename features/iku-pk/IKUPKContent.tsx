"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import PageTransition from "@/components/layout/PageTransition";
import { getUsersByRole, getUsersByLevel, getRelatedUsersFor, getDosenByUnit, getReceivedDisposisiJumlah, getIndikatorGrouped, getIndikatorGroupedForUser, getDisposisi, upsertDisposisi, getAllRealisasiFiles, submitFileRealisasiWithAuth } from "../../lib/api";
import type { UnitUser, IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild } from "../../lib/api";
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

  // Grouped data for admin/dekan view
  const [groupedData, setGroupedData] = useState<IndikatorGrouped[]>([]);
  // For isTopLevel non-admin (Dekan/WD) who may also receive disposisi from Kaprodi
  const [receivedGroupedData, setReceivedGroupedData] = useState<IndikatorGrouped[]>([]);
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [jenis, setJenis] = useState("IKU");
  const [disposisiSubId, setDisposisiSubId] = useState<number | null>(null);
  const [fileRepoChildren, setFileRepoChildren] = useState<IndikatorGroupedChild[]>([]);

  const unitId = authUser?.roleId;

  const roleLevel = authUser?.roleLevel ?? 4;
  // Admin dan Dekan level-1 lihat semua data; Kajur/Kaprodi/User lihat data yang didisposisikan ke mereka
  const isTopLevel = displayRole === 'admin' || (displayRole === 'dekan' && roleLevel <= 1);

  // Fetch grouped data
  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    const isAdmin = displayRole === 'admin';

    const fetchPromise = isTopLevel
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
  }, [displayRole, jenis, tahun, unitId, authUser?.id, roleLevel]);

  const handleGroupedDisposisiClick = async (subId: number, targetAmount: number, disposedByUserId?: number | null) => {
    setDisposisiSubId(subId);
    setDisposisiRow(null);
    setDisposisiTargetFakultas(targetAmount);
    setDisposisiAllocations([]);
    setDisposedBy(disposedByUserId ?? null);
    if (!unitId) return;

    try {
      let users: UnitUser[] = [];
      let usedDirectBawahan = false;
      if (displayRole === 'admin') {
        // Admin: semua user di unit
        const allUsers = await getUsersByRole(unitId);
        users = allUsers.filter((u) => u.id !== authUser?.id);
      } else if (roleLevel <= 2) {
        // Level 1 (Dekan/WD/Kabag) DAN level 2 (Kajur): coba bawahan langsung dulu.
        // Jika ada (misal Kabag → Tendik), gunakan itu. Jika kosong, gunakan level-based.
        const directBawahan = await getRelatedUsersFor(authUser.id);
        if (directBawahan.length > 0) {
          users = directBawahan;
          usedDirectBawahan = true;
        } else if (roleLevel <= 1) {
          // Dekan/WD: disposisi ke level-1 lainnya (Kabag, WD) DAN Kajur (level 2)
          const [lvl1Users, lvl2Users] = await Promise.all([getUsersByLevel(1), getUsersByLevel(2)]);
          const merged = [...lvl1Users, ...lvl2Users].filter((u) => u.id !== authUser?.id);
          const seen = new Set<number>();
          users = merged.filter((u) => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
        } else {
          // Kajur: disposisi ke semua Kaprodi (level 3)
          users = await getUsersByLevel(3);
        }
      } else if (roleLevel === 3 && authUser?.unitNama) {
        // Kaprodi: semua Dosen di prodinya (termasuk struktural yang juga Dosen)
        const dosenUsers = await getDosenByUnit(authUser.unitNama);
        users = dosenUsers.filter((u) => u.id !== authUser?.id);
      } else if (authUser?.id) {
        // Dosen (level 4): bawahan langsung via user_relations
        users = await getRelatedUsersFor(authUser.id);
      }
      // Non-top-level users yang menerima disposisi bisa disposisi ke diri sendiri,
      // kecuali saat bawahan langsung sudah dipakai (misal Kabag → Tendik).
      if (authUser && !usedDirectBawahan && roleLevel >= 2 && roleLevel <= 3) {
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
        // Refresh data
        if (!isTopLevel && authUser?.id) {
          const d = await getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId);
          setGroupedData(d);
        } else {
          const d = await getIndikatorGrouped(jenis, tahun, unitId);
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
        } else if (authUser?.email) {
          // Mode self (Input File): hanya tampilkan file milik sendiri
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
    if (showAtasanView && authUser?.id && roleLevel <= 2 && displayRole !== 'admin') {
      try {
        const bawahanUsers = await getRelatedUsersFor(authUser.id);
        if (bawahanUsers.length > 0) {
          allowedEmails = new Set(bawahanUsers.map(u => u.email.toLowerCase()).filter(Boolean));
        }
        // Jika kosong (Dekan/WD): allowedEmails tetap undefined → tampilkan semua
      } catch {
        // Gagal fetch → tidak batasi (aman: biarkan tampil semua)
      }
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
      actionId: number; actionNama: string;
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
                flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subTotalRows: subTotal, hasPkL3, showAction: !hasPkL3, actionId: sub.id, actionNama: sub.nama });
                for (const child of sub.children) {
                  flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subTotalRows: subTotal, hasPkL3, showAction: false, actionId: child.id, actionNama: child.nama });
                  if (hasPkL3) {
                    for (const l3 of (child.children ?? [])) {
                      flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, isSubFirst: false, subTotalRows: subTotal, hasPkL3, showAction: true, actionId: l3.id, actionNama: l3.nama });
                    }
                  }
                }
              }
              const totalRowSpan = flatRows.length;
              return flatRows.map((row, rowIdx) => {
                const disposisiJumlah = row.sub.disposisiJumlah ?? null;
                const capaianBase = row.sub.realisasiJumlah ?? 0;
                const capaianPct = (capaianBase > 0 && disposisiJumlah && disposisiJumlah > 0)
                  ? (capaianBase >= disposisiJumlah ? '100%' : `${Math.round((capaianBase / disposisiJumlah) * 100)}%`)
                  : '-';
                const capaianClass = (capaianBase > 0 && disposisiJumlah)
                  ? (capaianBase >= disposisiJumlah ? 'text-success' : 'text-warning')
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
                    {row.isSubFirst && (
                      <>
                        <td rowSpan={row.subTotalRows} className="td-cell td-cell--center td-cell--bold">
                          {disposisiJumlah !== null ? disposisiJumlah : "-"}
                        </td>
                        <td rowSpan={row.subTotalRows} className={`td-cell td-cell--center fw-700 ${capaianClass}`}>
                          {capaianPct}
                        </td>
                        {!row.hasPkL3 ? (
                          <td rowSpan={row.subTotalRows} className="action-cell">
                            <button
                              onClick={() => handleInputFileClick(row.actionId, row.actionNama, Number(disposisiJumlah || 0), row.sub.children)}
                              className="btn-small btn-small--green"
                            >
                              Input File
                            </button>
                          </td>
                        ) : <td className="action-cell" />}
                      </>
                    )}
                    {!row.isSubFirst && row.hasPkL3 && (
                      <td className="action-cell">
                        {row.showAction && (
                          <button
                            onClick={() => handleInputFileClick(row.actionId, row.actionNama, Number(disposisiJumlah || 0), [])}
                            className="btn-small btn-small--green"
                          >
                            Input File
                          </button>
                        )}
                      </td>
                    )}
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
          {pageTitle ?? 'Indikator Kinerja Utama & Perjanjian Kerja'}
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


        <div className="page-card">
          <h3 className="ikupk-card-title">
            Indikator Kinerja Utama & Perjanjian Kerja
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
                    <option value="PK">Perjanjian Kerja</option>
                  </select>
                </div>
                <div className="filter-content">
                  <label className="filter-content-label">Tahun</label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    className="filter-isi"
                  >
                    {["2024", "2025", "2026", "2027"].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && <p className="text-loading">Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <div className="table-wrapper">
                  <table className="table-universal">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="col-w5 text-center">Nomor</th>
                        <th rowSpan={2} className="col-w20">Sasaran Strategis</th>
                        <th rowSpan={2} className="col-w35">Sub Indikator Kinerja Utama</th>
                        <th colSpan={2} className="text-center">Target Universitas</th>
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

                        type TF = { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; isSubFirst: boolean; subTotalRows: number };
                        const flatRows: TF[] = [];
                        for (const sub of filteredSubs) {
                          const hasPkL3 = sub.children.some(c => (c.children ?? []).length > 0);
                          let subTotal = 1;
                          if (hasPkL3) {
                            for (const child of sub.children) subTotal += 1 + (child.children ?? []).length;
                          } else {
                            subTotal += sub.children.length;
                          }
                          flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subTotalRows: subTotal });
                          for (const child of sub.children) {
                            flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subTotalRows: subTotal });
                            if (hasPkL3) {
                              for (const l3 of (child.children ?? [])) {
                                flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, isSubFirst: false, subTotalRows: subTotal });
                              }
                            }
                          }
                        }
                        const totalRowSpan = flatRows.length;

                        return flatRows.map((row, rowIdx) => {
                          const univKuantitas = group.targetAbsolut;

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
                                    {univKuantitas !== null ? `${univKuantitas} Lulusan` : "-"}
                                  </td>
                                  <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--blue">
                                    {group.tenggat || "-"}
                                  </td>
                                </>
                              )}

                              {/* Disposisi — merged per Sub (Level 1) */}
                              {row.isSubFirst ? (
                                <td rowSpan={row.subTotalRows} className="action-cell">
                                  <div className="action-cell-inner">
                                    <button
                                      onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(group.targetAbsolut || 0), authUser?.id)}
                                      className="btn-small btn-small--green btn-small--w100"
                                    >
                                      Disposisi
                                    </button>
                                    {displayRole !== 'admin' && (
                                      <button
                                        onClick={() => handleInputFileClick(row.sub.id, row.sub.nama, Number(group.targetAbsolut || 0), row.sub.children, true)}
                                        className="btn-small btn-small--outline btn-small--w100"
                                      >
                                        Lihat Progress
                                      </button>
                                    )}
                                  </div>
                                </td>
                              ) : null}
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

              {/* Tabel Input File untuk Dekan/WD yang juga menerima disposisi dari Kaprodi */}
              {!loading && receivedGroupedData.length > 0 && (
                <>
                  <div className="ikupk-section-divider" />
                  <h4 className="ikupk-section-title">Target yang Didisposisikan kepada Anda</h4>
                  {renderInputFileTable(receivedGroupedData, 'received')}
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
                    <option value="PK">Perjanjian Kerja</option>
                  </select>
                </div>
                <div className="filter-content">
                  <label className="filter-content-label">Tahun</label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    className="filter-isi"
                  >
                    {["2024", "2025", "2026", "2027"].map((y) => (
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
                              type DF = { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; isSubFirst: boolean; subTotalRows: number };
                              const flatRows: DF[] = [];
                              for (const sub of group.subIndikators) {
                                const hasPkL3 = sub.children.some(c => (c.children ?? []).length > 0);
                                let subTotal = 1;
                                if (hasPkL3) {
                                  for (const child of sub.children) subTotal += 1 + (child.children ?? []).length;
                                } else {
                                  subTotal += sub.children.length;
                                }
                                flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subTotalRows: subTotal });
                                for (const child of sub.children) {
                                  flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subTotalRows: subTotal });
                                  if (hasPkL3) {
                                    for (const l3 of (child.children ?? [])) {
                                      flatRows.push({ id: l3.id, kode: l3.kode, nama: l3.nama, level: 3, sub, isSubFirst: false, subTotalRows: subTotal });
                                    }
                                  }
                                }
                              }
                              const totalRowSpan = flatRows.length;
                              return flatRows.map((row, rowIdx) => {
                                const hasPkL3 = row.sub.children.some((c: any) => (c.children ?? []).length > 0);
                                const disposisiJumlah = row.sub.disposisiJumlah ?? null;
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
                                    {row.isSubFirst && (
                                      <>
                                        <td rowSpan={row.subTotalRows} className="td-cell td-cell--center td-cell--bold">
                                          {disposisiJumlah !== null ? disposisiJumlah : "-"}
                                        </td>
                                        <td rowSpan={row.subTotalRows} className="action-cell">
                                          <div className="action-cell-inner">
                                            <button
                                              onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(disposisiJumlah || 0), authUser?.id)}
                                              className="btn-small btn-small--blue btn-small--w100"
                                            >
                                              Redisposisi
                                            </button>
                                            <button
                                              onClick={() => handleInputFileClick(row.sub.id, row.sub.nama, Number(disposisiJumlah || 0), hasPkL3 ? [] : row.sub.children, true)}
                                              className="btn-small btn-small--outline btn-small--w100"
                                            >
                                              Lihat Progress
                                            </button>
                                          </div>
                                        </td>
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
