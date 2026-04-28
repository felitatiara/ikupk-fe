"use client";

import { useEffect, useRef, useState } from "react";
// Popup sukses custom
function SuccessPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.25)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', textAlign: 'center' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ background: '#E6F9ED', borderRadius: '50%', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="27" cy="27" r="27" fill="#4ADE80" />
                <path d="M16 28.5L24 36.5L38 20.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="24" height="24" style={{ position: 'absolute', top: 8, right: -8 }}><circle cx="12" cy="12" r="12" fill="#FDE68A" /></svg>
              <svg width="16" height="16" style={{ position: 'absolute', bottom: 8, left: -8 }}><circle cx="8" cy="8" r="8" fill="#FDE68A" /></svg>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#22292f', marginBottom: 6 }}>Data berhasil disimpan!</div>
        </div>
        <button onClick={onClose} style={{ background: '#4ADE80', color: 'white', border: 'none', borderRadius: 8, padding: '10px 0', width: '100%', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>Ya</button>
      </div>
    </div>
  );
}
import { createPortal } from "react-dom";
import PageTransition from "@/components/layout/PageTransition";
import { getUsersByRole, getUsersByLevel, getRelatedUsersFor, getDosenByUnit, getReceivedDisposisiJumlah, getIndikatorGrouped, getIndikatorGroupedForUser, getDisposisi, upsertDisposisi, getRealisasiFiles, getAllRealisasiFiles, submitFileRealisasiWithAuth } from "../../lib/api";
import { useAuth } from "@/hooks/useAuth";

// Data nyata diambil dari IKUPK-BE → repository-nest berdasarkan kode indikator
import type { UnitUser, IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild } from "../../lib/api";

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
      alert("Gagal menyimpan disposisi");
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
      // Simpan ke database IKUPK-BE via JWT-authenticated endpoint
      await submitFileRealisasiWithAuth(
        {
          indikatorId: fileRepoIndikatorId,
          tahun,
          periode: fileRepoPeriode,
          fileCount: fileRepoFiles.length,
        },
        token,
      );
      // Juga simpan ke localStorage agar capaian langsung tampil di tabel
      saveRealisasi(fileRepoIndikatorId, fileRepoFiles.length);
      setFileRepoModalOpen(false);
      setShowSuccess(true);
    } catch {
      alert('Gagal menyimpan realisasi. Pastikan Anda terhubung ke sistem.');
    } finally {
      setFileRepoSubmitting(false);
    }
  };


  return (
    <div>
      <SuccessPopup open={showSuccess} onClose={() => setShowSuccess(false)} />
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Indikator Kinerja Utama &amp; Perjanjian Kerja
        </p>

        {/* DISPOSISI MODAL */}
        {disposisiModalOpen && (disposisiRow || disposisiSubId) && createPortal(
          <div
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setDisposisiModalOpen(false)}
          >
            <div
              style={{
                backgroundColor: "white", borderRadius: 12, padding: 28,
                width: 560, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#1f2937", textAlign: "center" }}>Disposisi Target</h3>
              <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 20 }}>
                {isTopLevel ? 'Disposisikan target kepada bawahan Anda' : 'Disposisikan ulang target yang Anda terima kepada bawahan Anda'}
              </p>

              {/* Info bar */}
              <div style={{ marginBottom: 16, padding: "12px 16px", backgroundColor: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{isTopLevel ? 'Target Universitas' : 'Jumlah Diterima'}: </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    {isUnconstrained ? '—' : disposisiTargetFakultas}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Sudah dialokasikan: </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{totalAllocated}</span>
                </div>
                {!isUnconstrained && (
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Sisa: </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isOverLimit ? "#dc2626" : "#16a34a" }}>{sisaTarget}</span>
                  </div>
                )}
              </div>

              {/* Info: target belum diset tapi tetap bisa disposisi */}
              {isUnconstrained && (
                <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#eff6ff", borderRadius: 6, border: "1px solid #93c5fd", fontSize: 12, color: "#1d4ed8" }}>
                  ℹ️ Target universitas belum diset. Anda tetap dapat mendisposisikan tanpa batas atas.
                </div>
              )}

              {/* Warning: total melebihi batas */}
              {isOverLimit && (
                <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#fef2f2", borderRadius: 6, border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>
                  ⚠️ Total disposisi melebihi jumlah yang tersedia. Harap kurangi jumlah.
                </div>
              )}

              {/* Warning: tidak ada user bawahan */}
              {unitUsers.length === 0 && (
                <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#fef3c7", borderRadius: 6, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
                  ℹ️ Tidak ada user yang dapat menerima disposisi. Pastikan relasi user sudah dikonfigurasi di Master User.
                </div>
              )}

              {/* Allocation rows */}
              {disposisiAllocations.map((alloc, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", width: "100%" }}>
                  <select
                    value={alloc.userId}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDisposisiAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, userId: val } : a));
                    }}
                    style={{ flex: 2, minWidth: 0, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#374151", boxSizing: "border-box" }}
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
                    style={{ width: 80, flexShrink: 0, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, textAlign: "center", color: "#374151", boxSizing: "border-box" }}
                  />
                  <button
                    onClick={() => removeAllocation(idx)}
                    style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 6, border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={addAllocation}
                disabled={unitUsers.length === 0}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6,
                  border: "1px dashed #d1d5db", backgroundColor: unitUsers.length === 0 ? "#f3f4f6" : "#f9fafb",
                  color: unitUsers.length === 0 ? "#9ca3af" : "#374151", fontSize: 13, fontWeight: 600,
                  cursor: unitUsers.length === 0 ? "not-allowed" : "pointer",
                  marginBottom: 20,
                }}
              >
                + Tambah Penerima
              </button>

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  onClick={() => setDisposisiModalOpen(false)}
                  style={{ padding: "8px 24px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
                >
                  Kembali
                </button>
                <button
                  onClick={handleDisposisiSubmit}
                  disabled={disposisiAllocations.length === 0 || isOverLimit || unitUsers.length === 0}
                  style={{
                    padding: "8px 24px", borderRadius: 6, border: "none",
                    backgroundColor: disposisiAllocations.length > 0 && !isOverLimit && unitUsers.length > 0 ? "#16a34a" : "#9ca3af",
                    color: "white", fontSize: 13, fontWeight: 600,
                    cursor: disposisiAllocations.length > 0 && !isOverLimit && unitUsers.length > 0 ? "pointer" : "not-allowed",
                  }}
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
          <div
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setFileRepoModalOpen(false)}
          >
            <div
              style={{
                backgroundColor: "white", borderRadius: 12, padding: 28,
                width: 640, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#1f2937", textAlign: "center" }}>
                File Repository — {fileRepoNama}
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 20 }}>
                File di bawah diambil otomatis dari folder repository yang sesuai dengan indikator ini.
              </p>

              {/* Error state */}
              {fileRepoError && (
                <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: "#fef2f2", borderRadius: 8, border: "1px solid #fca5a5", fontSize: 13, color: "#dc2626", textAlign: "center" }}>
                  ⚠️ {fileRepoError}
                </div>
              )}
              {/* Loading state */}
              {fileRepoLoading && (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 14 }}>
                  <div style={{ marginBottom: 8 }}>🔄 Memuat file dari repository...</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>Mengambil file berdasarkan kode indikator ini</div>
                </div>
              )}

              {!fileRepoLoading && !fileRepoError && (
                <>
                  {/* Warning if files < target */}
                  {fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget && (
                    <div style={{
                      marginBottom: 16, padding: "10px 14px", backgroundColor: "#fef3c7",
                      borderRadius: 8, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e",
                      textAlign: "center", lineHeight: 1.5,
                    }}>
                      Jumlah file ({fileRepoFiles.length}) kurang dari target ({fileRepoTarget}).
                      Mohon tambahkan file melalui{" "}
                      <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>
                        Repository.fik.upnvj.ac.id
                      </a>
                    </div>
                  )}

                  {/* Pilih Periode */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Pilih Periode</label>
                    <select
                      value={fileRepoPeriode}
                      onChange={(e) => setFileRepoPeriode(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 6,
                        border: "1px solid #d1d5db", fontSize: 13, color: "#374151",
                        boxSizing: "border-box", backgroundColor: "white",
                      }}
                    >
                      {periodeOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Kriteria (info saja, tidak dipakai untuk filter karena semua diambil sekaligus) */}
                  {fileRepoChildren.length > 0 && (
                    <div style={{ marginBottom: 14, padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: 6, border: "1px solid #bbf7d0", fontSize: 12, color: "#15803d" }}>
                      Menampilkan semua file dari {fileRepoChildren.length} kriteria: {fileRepoChildren.map((c) => c.kode).join(', ')}
                    </div>
                  )}

                  {/* Info jumlah file */}
                  <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>File Ditemukan</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: fileRepoFiles.length >= fileRepoTarget && fileRepoTarget > 0 ? "#16a34a" : fileRepoFiles.length > 0 ? "#d97706" : "#6b7280"
                    }}>
                      {fileRepoFiles.length > 0 ? `${fileRepoFiles.length} File` : "Tidak ada file"}
                      {fileRepoTarget > 0 && ` / Target: ${fileRepoTarget}`}
                    </span>
                  </div>

                  {/* File Table */}
                  {fileRepoFiles.length > 0 ? (
                    <div style={{ marginBottom: 20, maxHeight: 260, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f9fafb" }}>
                            <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, width: 36 }}>No</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700 }}>Nama File</th>
                            {fileRepoIsAtasan && (
                              <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, width: 130 }}>Dosen</th>
                            )}
                            <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, width: 90 }}>Tanggal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fileRepoFiles.map((f) => (
                            <tr key={f.no} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={{ padding: "7px 10px", textAlign: "center", color: "#6b7280" }}>{f.no}</td>
                              <td style={{ padding: "7px 10px", color: "#1f2937" }}>
                                {f.previewUrl ? (
                                  <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>{f.namaFile}</a>
                                ) : f.namaFile}
                              </td>
                              {fileRepoIsAtasan && (
                                <td style={{ padding: "7px 10px", color: "#6b7280", fontSize: 11 }}>{f.ownerName || '—'}</td>
                              )}
                              <td style={{ padding: "7px 10px", textAlign: "center", color: "#6b7280" }}>{f.tanggal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px 0", marginBottom: 20 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                        {fileRepoIsAtasan ? 'Belum ada file yang diupload oleh bawahan untuk indikator ini' : 'Belum ada file di folder ini'}
                      </div>
                      {!fileRepoIsAtasan && (
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>
                          Upload file di{" "}
                          <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
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
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  onClick={() => setFileRepoModalOpen(false)}
                  style={{
                    padding: "8px 24px", borderRadius: 6,
                    border: "1px solid #d1d5db", backgroundColor: "white",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151",
                  }}
                >
                  Tutup
                </button>
                {/* Atasan hanya melihat file bawahan — tidak perlu "Simpan Realisasi" */}
                {!fileRepoIsAtasan && (
                  <button
                    onClick={handleFileRepoSubmit}
                    disabled={fileRepoLoading || fileRepoFiles.length === 0 || fileRepoSubmitting}
                    style={{
                      padding: "8px 24px", borderRadius: 6, border: "none",
                      backgroundColor: !fileRepoLoading && fileRepoFiles.length > 0 && !fileRepoSubmitting ? "#16a34a" : "#9ca3af",
                      color: "white", fontSize: 13, fontWeight: 600,
                      cursor: !fileRepoLoading && fileRepoFiles.length > 0 && !fileRepoSubmitting ? "pointer" : "not-allowed",
                    }}
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
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Indikator Kinerja Utama & Perjanjian Kerja
          </h3>

          {isTopLevel ? (
            <>
              <div className="filter" style={{ marginBottom: 20 }}>
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

              {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <div className="table-wrapper">
                  <table className="table-universal">
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ width: "5%", textAlign: "center" }}>Nomor</th>
                        <th rowSpan={2} style={{ width: "20%" }}>Sasaran Strategis</th>
                        <th rowSpan={2} style={{ width: "35%" }}>Sub Indikator Kinerja Utama</th>
                        <th colSpan={2} style={{ textAlign: "center" }}>Target Universitas</th>
                        <th rowSpan={2} style={{ width: "10%", textAlign: "center" }}>Disposisi</th>
                      </tr>
                      <tr>
                        <th style={{ textAlign: "center", minWidth: 100 }}>Kuantitas</th>
                        <th style={{ textAlign: "center", minWidth: 100 }}>Waktu</th>
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
                            <tr key={`${group.id}-${rowIdx}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                              {rowIdx === 0 && (
                                <>
                                  <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}>
                                    <p>{row.sub.kode.split('.')[0] || groupIdx + 1}</p>
                                  </td>
                                  <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{group.nama}</div>
                                  </td>
                                </>
                              )}
                              <td style={{ padding: "10px 12px", color: "#374151", borderRight: "1px solid #e5e7eb", paddingLeft: row.level === 2 ? 28 : 12 }}>
                                {row.kode} {row.nama}
                              </td>

                              {/* Target Universitas — merged per group */}
                              {rowIdx === 0 && (
                                <>
                                  <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#1d4ed8", fontWeight: 700 }}>
                                    {univKuantitas !== null ? `${univKuantitas} Lulusan` : "-"}
                                  </td>
                                  <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#1d4ed8", fontWeight: 700 }}>
                                    {group.tenggat || "-"}
                                  </td>
                                </>
                              )}

                              {/* Disposisi — merged per Sub (Level 1) */}
                              {row.isSubFirst ? (
                                <td rowSpan={row.subChildCount} style={{ textAlign: "center", verticalAlign: "top" }}>
                                  <button
                                    onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(group.targetAbsolut || 0), null)}
                                    className="btn-small"
                                    style={{ border: "1px solid #86efac", backgroundColor: "#ecfdf5", color: "#16a34a" }}
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
                <p style={{ color: "#9ca3af", padding: 12, textAlign: "center" }}>Tidak ada data indikator</p>
              )}
            </>
          ) : (
            <>
              <div className="filter" style={{ marginBottom: 20 }}>
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

              {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <div className="table-wrapper">
                  <table className="table-universal">
                    <thead>
                      <tr>
                        <th style={{ width: "5%", textAlign: "center" }}>Nomor</th>
                        <th style={{ width: "20%" }}>Sasaran Strategis</th>
                        <th>Sub Indikator Kinerja Utama</th>
                        <th style={{ width: "10%", textAlign: "center" }}>Target Disposisi</th>
                        <th style={{ width: "10%", textAlign: "center" }}>Capaian</th>
                        <th style={{ width: "20%", textAlign: "center" }}>Aksi</th>
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
                            <tr key={`${group.id}-${rowIdx}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                              {rowIdx === 0 && (
                                <>
                                  <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {groupIdx + 1}
                                  </td>
                                  <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}>
                                    {group.nama}
                                  </td>
                                </>
                              )}
                              <td style={{ padding: "10px 12px", color: "#374151", borderRight: "1px solid #e5e7eb", paddingLeft: row.level === 2 ? 28 : 12 }}>
                                {row.kode} {row.nama}
                              </td>
                              {/* Target Disposisi & Capaian — merged per Sub (Level 1) */}
                              {row.isSubFirst && (
                                <>
                                  <td rowSpan={row.subChildCount} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {disposisiJumlah !== null ? disposisiJumlah : "-"}
                                  </td>
                                  <td rowSpan={row.subChildCount} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: (realisasiJumlah > 0 && disposisiJumlah) ? (realisasiJumlah >= disposisiJumlah ? '#16a34a' : '#eab308') : '#374151', fontWeight: 700 }}>
                                    {(realisasiJumlah > 0 && disposisiJumlah && disposisiJumlah > 0)
                                      ? (realisasiJumlah >= disposisiJumlah ? '100%' : `${Math.round((realisasiJumlah / disposisiJumlah) * 100)}%`)
                                      : '-'}
                                  </td>
                                </>
                              )}

                              {/* Aksi — merged per Sub (Level 1) */}
                              {row.isSubFirst && (
                                <td rowSpan={row.subChildCount} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                                    <button
                                      onClick={() => handleInputFileClick(row.sub.id, row.sub.nama, Number(disposisiJumlah || 0), row.sub.children)}
                                      className="btn-small"
                                      style={{ border: "1px solid #86efac", backgroundColor: "#ecfdf5", color: "#16a34a", width: 100 }}
                                    >
                                      Input File
                                    </button>
                                    <button
                                      onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(disposisiJumlah || 0), authUser?.id)}
                                      className="btn-small"
                                      style={{ border: "1px solid #93c5fd", backgroundColor: "#eff6ff", color: "#2563eb", width: 100 }}
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
                <p style={{ color: "#9ca3af", padding: 12, textAlign: "center" }}>Tidak ada data target yang didisposisikan kepada Anda</p>
              )}
            </>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
