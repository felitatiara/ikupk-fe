"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import PageTransition from "@/components/layout/PageTransition";
import { getUsersByRole, getUsersByLevel, getRelatedUsersFor, getDosenByUnit, getReceivedDisposisiJumlah, getIndikatorGrouped, getIndikatorGroupedForUser, getDisposisi, upsertDisposisi, getRealisasiFiles, getAllRealisasiFiles, submitFileRealisasiWithAuth } from "../../lib/api";
import type { UnitUser, IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild } from "../../lib/api";
import { useAuth } from "@/hooks/useAuth";

// Popup sukses custom
function SuccessPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="success-overlay">
      <div className="success-box">
        <div className="success-icon-wrapper">
          <div className="success-icon-center">
            <div className="success-icon-circle">
              <svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="27" cy="27" r="27" fill="#4ADE80" />
                <path d="M16 28.5L24 36.5L38 20.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg className="success-sparkle-top" width="24" height="24"><circle cx="12" cy="12" r="12" fill="#FDE68A" /></svg>
              <svg className="success-sparkle-bottom" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#FDE68A" /></svg>
            </div>
          </div>
          <div className="success-text">Data berhasil disimpan!</div>
        </div>
        <button onClick={onClose} className="success-btn">Ya</button>
      </div>
    </div>
  );
}

// Data nyata diambil dari IKUPK-BE → repository-nest berdasarkan kode indikator

export default function IKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' | 'dekan' | 'pimpinan' }) {
  const displayRole = role?.toLowerCase() === 'pimpinan' ? 'dekan' : role?.toLowerCase();

  const [showSuccess, setShowSuccess] = useState(false);
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
  const [fileRepoFiles, setFileRepoFiles] = useState<{ no: number; namaFile: string; tanggal: string; sumber: string; previewUrl?: string; ownerName?: string }[]>([]);
  const [fileRepoLoading, setFileRepoLoading] = useState(false);
  const [fileRepoSubmitting, setFileRepoSubmitting] = useState(false);
  const [fileRepoTarget, setFileRepoTarget] = useState<number>(0);
  const [fileRepoError, setFileRepoError] = useState<string | null>(null);
  const [fileRepoIsAtasan, setFileRepoIsAtasan] = useState(false);

  // Grouped data for admin/dekan view
  const [groupedData, setGroupedData] = useState<IndikatorGrouped[]>([]);
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [jenis, setJenis] = useState("IKU");
  const [disposisiSubId, setDisposisiSubId] = useState<number | null>(null);
  const [fileRepoChildren, setFileRepoChildren] = useState<IndikatorGroupedChild[]>([]);

  // Local realisasi: subId → fileCount (dari repository). Persisted in localStorage.
  const [localRealisasi, setLocalRealisasi] = useState<Record<number, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('ikupk_realisasi');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const saveRealisasi = (subId: number, fileCount: number) => {
    setLocalRealisasi(prev => {
      const next = { ...prev, [subId]: fileCount };
      try { localStorage.setItem('ikupk_realisasi', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const unitId = authUser?.roleId;

  const roleLevel = authUser?.roleLevel ?? 4;
  // Admin dan Dekan level-1 lihat semua data; Kajur/Kaprodi/User lihat data yang didisposisikan ke mereka
  const isTopLevel = displayRole === 'admin' || (displayRole === 'dekan' && roleLevel <= 1);

  // Fetch grouped data
  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;

    const fetchPromise = isTopLevel
      ? getIndikatorGrouped(jenis, tahun, unitId)
      : (authUser?.id)
        ? getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId)
        : Promise.resolve([]);

    fetchPromise
      .then((d) => { if (!cancelled) { setGroupedData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setGroupedData([]); setLoading(false); } });
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
      if (displayRole === 'admin') {
        // Admin: semua user di unit
        const allUsers = await getUsersByRole(unitId);
        users = allUsers.filter((u) => u.id !== authUser?.id);
      } else if (roleLevel <= 1) {
        // Dekan/WD (level 1): satu kesatuan pimpinan, bisa disposisi ke semua Kajur/Kabag (level 2)
        users = await getUsersByLevel(2);
        users = users.filter((u) => u.id !== authUser?.id);
      } else if (roleLevel === 2 && authUser?.id) {
        // Kajur/Kabag: disposisi ke Kaprodi bawahannya via user_relations
        users = await getRelatedUsersFor(authUser.id);
      } else if (roleLevel === 3 && authUser?.unitNama) {
        // Kaprodi: semua Dosen di prodinya (termasuk struktural yang juga Dosen)
        const dosenUsers = await getDosenByUnit(authUser.unitNama);
        users = dosenUsers.filter((u) => u.id !== authUser?.id);
      } else if (authUser?.id) {
        // Dosen (level 4): bawahan langsung via user_relations
        users = await getRelatedUsersFor(authUser.id);
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
        setShowSuccess(true);
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

  // Dosen (level 4) hanya lihat file sendiri; atasan lihat semua file dari bawahan.
  const isDosen = roleLevel >= 4;

  const fetchRepoFiles = (indikatorId: number, asAtasan: boolean) => {
    if (!token) { setFileRepoLoading(false); setFileRepoError('Token tidak ditemukan, silakan login ulang.'); return; }
    setFileRepoLoading(true);
    setFileRepoError(null);
    setFileRepoFiles([]);
    const fetcher = asAtasan
      ? getAllRealisasiFiles(indikatorId, token)
      : getRealisasiFiles(indikatorId, token);
    fetcher
      .then((result) => {
        const mapped = result.files.map((f, i) => ({
          no: i + 1,
          namaFile: f.name,
          tanggal: f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-',
          sumber: 'Repository FIK',
          previewUrl: f.preview_url,
          ownerName: f.ownerName || f.owner?.name,
        }));
        setFileRepoFiles(mapped);
      })
      .catch(() => setFileRepoError('Gagal memuat file dari repository.'))
      .finally(() => setFileRepoLoading(false));
  };

  const handleInputFileClick = (indikatorId: number, nama: string, target: number, children: IndikatorGroupedChild[] = []) => {
    const asAtasan = !isDosen;
    setFileRepoIndikatorId(indikatorId);
    setFileRepoNama(nama);
    setFileRepoPeriode(periodeOptions[0]);
    setFileRepoFiles([]);
    setFileRepoLoading(true);
    setFileRepoSubmitting(false);
    setFileRepoTarget(target);
    setFileRepoError(null);
    setFileRepoChildren(children);
    setFileRepoIsAtasan(asAtasan);
    setFileRepoModalOpen(true);
    fetchRepoFiles(indikatorId, asAtasan);
  };


  const handleFileRepoSubmit = async () => {
    if (!fileRepoIndikatorId || !token) return;
    setFileRepoSubmitting(true);
    try {
      await submitFileRealisasiWithAuth({
        indikatorId: fileRepoIndikatorId!,
        tahun,
        periode: fileRepoPeriode,
        fileCount: fileRepoFiles.length,
      }, token);
      setFileRepoModalOpen(false);
      setShowSuccess(true);
    } catch {
      toast.error("Gagal menyimpan realisasi");
    } finally {
      setFileRepoSubmitting(false);
    }
  };


  return (
    <div>
      <SuccessPopup open={showSuccess} onClose={() => setShowSuccess(false)} />
      <PageTransition>
        <p className="ikupk-header-text">
          Indikator Kinerja Utama &amp; Perjanjian Kerja
        </p>

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
                      <option key={u.id} value={u.id}>{u.nama} ({u.role})</option>
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
                File Repository — {fileRepoNama}
              </h3>
              <p className="modal-subtitle">
                File di bawah diambil otomatis dari folder repository yang sesuai dengan indikator ini.
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
                  {/* Warning if files < target */}
                  {fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget && (
                    <div className="alert-banner--warning-lg">
                      Jumlah file ({fileRepoFiles.length}) kurang dari target ({fileRepoTarget}).
                      Mohon tambahkan file melalui{" "}
                      <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" className="repo-link">
                        Repository.fik.upnvj.ac.id
                      </a>
                    </div>
                  )}

                  {/* Pilih Periode */}
                  <div className="periode-group">
                    <label className="periode-label">Pilih Periode</label>
                    <select
                      value={fileRepoPeriode}
                      onChange={(e) => setFileRepoPeriode(e.target.value)}
                      className="periode-select"
                    >
                      {periodeOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Kriteria */}
                  {fileRepoChildren.length > 0 && (
                    <div className="alert-banner--success">
                      Menampilkan semua file dari {fileRepoChildren.length} kriteria: {fileRepoChildren.map((c) => c.kode).join(', ')}
                    </div>
                  )}

                  {/* Info jumlah file */}
                  <div className="file-info-row">
                    <span className="file-info-label">File Ditemukan</span>
                    <span className={
                      fileRepoFiles.length >= fileRepoTarget && fileRepoTarget > 0 ? 'file-count--green' : fileRepoFiles.length > 0 ? 'file-count--amber' : 'file-count--muted'
                    }>
                      {fileRepoFiles.length > 0 ? `${fileRepoFiles.length} File` : "Tidak ada file"}
                      {fileRepoTarget > 0 && ` / Target: ${fileRepoTarget}`}
                    </span>
                  </div>

                  {/* File Table */}
                  {fileRepoFiles.length > 0 ? (
                    <div className="file-table-wrapper">
                      <table className="file-table">
                        <thead>
                          <tr>
                            <th className="col-no">No</th>
                            <th className="text-left">Nama File</th>
                            {fileRepoIsAtasan && (
                              <th className="col-dosen">Dosen</th>
                            )}
                            <th className="col-tanggal">Tanggal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fileRepoFiles.map((f) => (
                            <tr key={f.no}>
                              <td className="text-center">{f.no}</td>
                              <td>
                                {f.previewUrl ? (
                                  <a href={f.previewUrl} target="_blank" rel="noopener noreferrer">{f.namaFile}</a>
                                ) : f.namaFile}
                              </td>
                              {fileRepoIsAtasan && (
                                <td className="text-owner">{f.ownerName || '—'}</td>
                              )}
                              <td className="text-center">{f.tanggal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="file-empty">
                      <div className="file-empty-icon">📂</div>
                      <div className="file-empty-text">
                        {fileRepoIsAtasan ? 'Belum ada file yang diupload oleh bawahan untuk indikator ini' : 'Belum ada file di folder ini'}
                      </div>
                      {!fileRepoIsAtasan && (
                        <div className="file-empty-hint">
                          Upload file di{" "}
                          <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer">
                            Repository FIK
                          </a>
                          {" "}pada folder dengan nama kode indikator ini
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}


              {/* Buttons */}
              <div className="modal-footer">
                <button onClick={() => setFileRepoModalOpen(false)} className="btn-secondary">
                  Tutup
                </button>
                {/* Atasan hanya melihat file bawahan — tidak perlu "Simpan Realisasi" */}
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

                        const flatRows: { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; isSubFirst: boolean; subChildCount: number; baselineJumlah: number | null; nilaiTarget: number | null }[] = [];
                        for (const sub of filteredSubs) {
                          const childCount = 1 + sub.children.length;
                          flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subChildCount: childCount, baselineJumlah: sub.baselineJumlah, nilaiTarget: sub.nilaiTarget });
                          for (const child of sub.children) {
                            flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subChildCount: childCount, baselineJumlah: child.baselineJumlah, nilaiTarget: child.nilaiTarget });
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
                              <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''}`}>
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
                                <td rowSpan={row.subChildCount} className="action-cell">
                                  <button
                                    onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(group.targetAbsolut || 0), null)}
                                    className="btn-small btn-small--green"
                                  >
                                    Disposisi
                                  </button>
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
                <div className="table-wrapper">
                  <table className="table-universal">
                    <thead>
                      <tr>
                        <th className="col-w5 text-center">Nomor</th>
                        <th className="col-w20">Sasaran Strategis</th>
                        <th>Sub Indikator Kinerja Utama</th>
                        <th className="col-w10 text-center">Target Disposisi</th>
                        <th className="col-w10 text-center">Capaian</th>
                        <th className="col-w20 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedData.map((group, groupIdx) => {
                        const flatRows: { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; isSubFirst: boolean; subChildCount: number; baselineJumlah: number | null; nilaiTarget: number | null; disposisiJumlah?: number | null; realisasiJumlah?: number | null }[] = [];
                        for (const sub of group.subIndikators) {
                          const childCount = 1 + sub.children.length;
                          flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subChildCount: childCount, baselineJumlah: sub.baselineJumlah, nilaiTarget: sub.nilaiTarget });
                          for (const child of sub.children) {
                            flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subChildCount: childCount, baselineJumlah: child.baselineJumlah, nilaiTarget: child.nilaiTarget, disposisiJumlah: (child as IndikatorGroupedChild & { disposisiJumlah?: number | null }).disposisiJumlah ?? null });
                          }
                        }
                        const totalRowSpan = flatRows.length;

                        return flatRows.map((row, rowIdx) => {
                          const disposisiJumlah = row.sub.disposisiJumlah ?? null;
                          // Capaian dari repository file count (localStorage), fallback ke API
                          const realisasiJumlah = localRealisasi[row.sub.id] ?? (row.sub.realisasiJumlah ?? 0);

                          return (
                            <tr key={`${group.id}-${rowIdx}`}>
                              {rowIdx === 0 && (
                                <>
                                  <td rowSpan={totalRowSpan} className="td-cell td-cell--center td-cell--bold">
                                    {groupIdx + 1}
                                  </td>
                                  <td rowSpan={totalRowSpan} className="td-cell v-top">
                                    {group.nama}
                                  </td>
                                </>
                              )}
                              <td className={`td-cell ${row.level === 2 ? 'td-cell--indent' : ''}`}>
                                {row.kode} {row.nama}
                              </td>
                              {/* Target Disposisi & Capaian — merged per Sub (Level 1) */}
                              {row.isSubFirst && (
                                <>
                                  <td rowSpan={row.subChildCount} className="td-cell td-cell--center td-cell--bold">
                                    {disposisiJumlah !== null ? disposisiJumlah : "-"}
                                  </td>
                                  <td rowSpan={row.subChildCount} className={`td-cell td-cell--center fw-700 ${(realisasiJumlah > 0 && disposisiJumlah) ? (realisasiJumlah >= disposisiJumlah ? 'text-success' : 'text-warning') : 'text-dark'}`}>
                                    {(realisasiJumlah > 0 && disposisiJumlah && disposisiJumlah > 0)
                                      ? (realisasiJumlah >= disposisiJumlah ? '100%' : `${Math.round((realisasiJumlah / disposisiJumlah) * 100)}%`)
                                      : '-'}
                                  </td>
                                </>
                              )}

                              {/* Aksi — merged per Sub (Level 1) */}
                              {row.isSubFirst && (
                                <td rowSpan={row.subChildCount} className="action-cell">
                                  <div className="action-cell-inner">
                                    <button
                                      onClick={() => handleInputFileClick(row.sub.id, row.sub.nama, Number(disposisiJumlah || 0), row.sub.children)}
                                      className="btn-small btn-small--green btn-small--w100"
                                    >
                                      Input File
                                    </button>
                                    <button
                                      onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(disposisiJumlah || 0), authUser?.id)}
                                      className="btn-small btn-small--blue btn-small--w100"
                                    >
                                      {displayRole === 'dekan' ? 'Disposisi' : 'Redisposisi'}
                                    </button>
                                  </div>
                                </td>
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
                <p className="text-empty">Tidak ada data target yang didisposisikan kepada Anda</p>
              )}
            </>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
