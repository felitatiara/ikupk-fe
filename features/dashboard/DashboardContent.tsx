"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PageTransition from "@/components/layout/PageTransition";
import {
  getIndikatorGroupedForUser,
  getDisposisi,
  upsertDisposisi,
  getRelatedUsersFor,
  getUsersByRole,
  getReceivedDisposisiJumlah,
} from "@/lib/api";
import type { IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild, UnitUser } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const MOCK_FOLDERS = [
  { id: "folder-1", name: "Penelitian 2025" },
  { id: "folder-2", name: "Pengabdian Masyarakat 2025" },
  { id: "folder-3", name: "Publikasi Jurnal 2025" },
  { id: "folder-4", name: "Bimbingan Skripsi 2025" },
  { id: "folder-5", name: "Seminar & Konferensi 2025" },
  { id: "folder-6", name: "Lulusan Tepat Waktu 2025" },
  { id: "folder-7", name: "Praktisi Mengajar 2025" },
  { id: "folder-8", name: "Sertifikasi Dosen 2025" },
];

const MOCK_FILES_BY_FOLDER: Record<string, { name: string; created_at: string }[]> = {
  "folder-1": [
    { name: "Proposal_Penelitian_Hibah_2025.pdf", created_at: "2025-02-10" },
    { name: "Laporan_Kemajuan_Penelitian_Q1.pdf", created_at: "2025-04-01" },
    { name: "Laporan_Akhir_Penelitian_2025.pdf", created_at: "2025-11-15" },
  ],
  "folder-2": [
    { name: "Proposal_PKM_Desa_Binaan.pdf", created_at: "2025-03-05" },
    { name: "Dokumentasi_Kegiatan_PKM.pdf", created_at: "2025-07-20" },
  ],
  "folder-3": [
    { name: "Artikel_Jurnal_Sinta2_2025.pdf", created_at: "2025-01-22" },
    { name: "Bukti_Acceptance_Scopus.pdf", created_at: "2025-05-11" },
    { name: "Publikasi_Prosiding_Internasional.pdf", created_at: "2025-08-30" },
    { name: "Artikel_Jurnal_Terakreditasi_2025.pdf", created_at: "2025-10-05" },
  ],
  "folder-4": [
    { name: "Daftar_Mahasiswa_Bimbingan_TA.pdf", created_at: "2025-02-14" },
    { name: "Berita_Acara_Sidang_Skripsi.pdf", created_at: "2025-06-18" },
  ],
  "folder-5": [
    { name: "Sertifikat_Seminar_Nasional_TI.pdf", created_at: "2025-03-28" },
    { name: "Bukti_Presentasi_Konferensi_Internasional.pdf", created_at: "2025-09-12" },
  ],
  "folder-6": [
    { name: "Data_Lulusan_S1_2024.xlsx", created_at: "2025-01-08" },
    { name: "Rekapitulasi_Kelulusan_Tepat_Waktu.pdf", created_at: "2025-04-22" },
  ],
  "folder-7": [
    { name: "SK_Praktisi_Mengajar_2025.pdf", created_at: "2025-02-01" },
    { name: "Laporan_Pelaksanaan_Kuliah_Tamu.pdf", created_at: "2025-05-30" },
    { name: "Daftar_Hadir_Praktisi_Sem_Ganjil.pdf", created_at: "2025-08-10" },
  ],
  "folder-8": [
    { name: "Sertifikat_Kompetensi_Nasional.pdf", created_at: "2025-03-15" },
    { name: "Sertifikat_Pelatihan_AI_2025.pdf", created_at: "2025-07-04" },
  ],
};

function SuccessPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.25)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, minWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", textAlign: "center" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{ background: "#E6F9ED", borderRadius: "50%", width: 90, height: 90, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <svg width="54" height="54" viewBox="0 0 54 54" fill="none"><circle cx="27" cy="27" r="27" fill="#4ADE80" /><path d="M16 28.5L24 36.5L38 20.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#22292f", marginBottom: 6 }}>Data berhasil disimpan!</div>
        </div>
        <button onClick={onClose} style={{ background: "#4ADE80", color: "white", border: "none", borderRadius: 8, padding: "10px 0", width: "100%", fontWeight: 700, fontSize: 18, cursor: "pointer" }}>Ya</button>
      </div>
    </div>
  );
}

export default function DashboardContent() {
  const { user: authUser } = useAuth();
  const unitId = authUser?.roleId;
  const tahun = new Date().getFullYear().toString();
  const [jenis, setJenis] = useState("IKU");

  const [groupedData, setGroupedData] = useState<IndikatorGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  // Disposisi modal
  const [disposisiModalOpen, setDisposisiModalOpen] = useState(false);
  const [disposisiSubId, setDisposisiSubId] = useState<number | null>(null);
  const [unitUsers, setUnitUsers] = useState<UnitUser[]>([]);
  const [disposisiAllocations, setDisposisiAllocations] = useState<{ userId: number; jumlah: string }[]>([]);
  const [disposisiTargetFakultas, setDisposisiTargetFakultas] = useState<number>(0);
  const [disposedBy, setDisposedBy] = useState<number | null>(null);

  // File repo modal
  const [fileRepoModalOpen, setFileRepoModalOpen] = useState(false);
  const [fileRepoNama, setFileRepoNama] = useState("");
  const [fileRepoIndikatorId, setFileRepoIndikatorId] = useState<number | null>(null);
  const [fileRepoPeriode, setFileRepoPeriode] = useState("");
  const [fileRepoFiles, setFileRepoFiles] = useState<{ no: number; namaFile: string; tanggal: string; sumber: string }[]>([]);
  const [fileRepoLoading, setFileRepoLoading] = useState(false);
  const [fileRepoSubmitting, setFileRepoSubmitting] = useState(false);
  const [fileRepoTarget, setFileRepoTarget] = useState<number>(0);
  const [fileRepoFolders, setFileRepoFolders] = useState<{ id: string; name: string }[]>([]);
  const [fileRepoViewMode, setFileRepoViewMode] = useState<"folders" | "files">("folders");
  const [selectedRepoFolderId, setSelectedRepoFolderId] = useState<string | null>(null);
  const [selectedRepoFolderName, setSelectedRepoFolderName] = useState<string | null>(null);
  const [fileRepoChildren, setFileRepoChildren] = useState<IndikatorGroupedChild[]>([]);
  const [fileRepoChildId, setFileRepoChildId] = useState<number>(0);

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

  const periodeOptions = [
    `Januari ${tahun} - Mei ${tahun}`,
    `Juni ${tahun} - Agustus ${tahun}`,
    `September ${tahun} - Desember ${tahun}`,
  ];

  // Fetch user grouped data
  useEffect(() => {
    if (!unitId || !authUser?.id) return;
    let cancelled = false;
    setLoading(true);
    getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId)
      .then((d) => { if (!cancelled) { setGroupedData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setGroupedData([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [jenis, tahun, unitId, authUser?.id]);

  // Load mock folders/files for repo modal
  useEffect(() => {
    if (!fileRepoModalOpen) return;
    if (fileRepoViewMode === "folders") {
      setFileRepoLoading(true);
      setTimeout(() => {
        setFileRepoFolders(MOCK_FOLDERS);
        setFileRepoLoading(false);
      }, 300);
    } else if (fileRepoViewMode === "files" && selectedRepoFolderId) {
      setFileRepoLoading(true);
      setTimeout(() => {
        const rawFiles = MOCK_FILES_BY_FOLDER[selectedRepoFolderId] ?? [];
        setFileRepoFiles(rawFiles.map((f, i) => ({
          no: i + 1,
          namaFile: f.name,
          tanggal: new Date(f.created_at).toLocaleDateString("id-ID"),
          sumber: "Repository FIK",
        })));
        setFileRepoLoading(false);
      }, 300);
    }
  }, [fileRepoModalOpen, fileRepoViewMode, selectedRepoFolderId]);

  const handleInputFileClick = (indikatorId: number, nama: string, target: number, children: IndikatorGroupedChild[] = []) => {
    setFileRepoIndikatorId(indikatorId);
    setFileRepoNama(nama);
    setFileRepoPeriode(periodeOptions[0]);
    setFileRepoFiles([]);
    setFileRepoLoading(false);
    setFileRepoSubmitting(false);
    setFileRepoTarget(target);
    setFileRepoChildren(children);
    setFileRepoChildId(children.length > 0 ? children[0].id : 0);
    setFileRepoViewMode("folders");
    setSelectedRepoFolderId(null);
    setSelectedRepoFolderName(null);
    setFileRepoFolders([]);
    setFileRepoModalOpen(true);
  };

  const handleFileRepoSubmit = async () => {
    if (!fileRepoIndikatorId || !unitId || !authUser?.id) return;
    setFileRepoSubmitting(true);
    try {
      // Simpan realisasi ke localStorage (jumlah file = capaian, tidak perlu backend)
      saveRealisasi(fileRepoIndikatorId, fileRepoFiles.length);
      setFileRepoModalOpen(false);
      setShowSuccess(true);
    } catch {
      alert("Gagal menyimpan realisasi");
    } finally {
      setFileRepoSubmitting(false);
    }
  };

  const handleGroupedDisposisiClick = async (subId: number, targetAmount: number, disposedByUserId?: number | null) => {
    setDisposisiSubId(subId);
    setDisposisiTargetFakultas(targetAmount);
    setDisposisiAllocations([]);
    setDisposedBy(disposedByUserId ?? null);
    if (!unitId) return;
    try {
      let users: UnitUser[] = await getRelatedUsersFor(authUser!.id);
      if (users.length === 0) {
        const all = await getUsersByRole(unitId);
        users = all.filter((u) => u.id !== authUser?.id);
      }
      setUnitUsers(users);
    } catch { setUnitUsers([]); }
    if (disposedByUserId) {
      try {
        const received = await getReceivedDisposisiJumlah(disposedByUserId, subId, tahun);
        if (received > 0) setDisposisiTargetFakultas(received);
      } catch { /* ignore */ }
    }
    try {
      const existing = await getDisposisi(subId, tahun, disposedByUserId ?? null);
      if (existing.length > 0) setDisposisiAllocations(existing.map((d) => ({ userId: d.toUserId, jumlah: String(Number(d.jumlahTarget)) })));
    } catch { /* ignore */ }
    setDisposisiModalOpen(true);
  };

  const totalAllocated = disposisiAllocations.reduce((sum, a) => sum + (parseFloat(a.jumlah) || 0), 0);
  const sisaTarget = disposisiTargetFakultas - totalAllocated;

  const handleDisposisiSubmit = async () => {
    const validItems = disposisiAllocations.filter((a) => a.userId > 0 && parseFloat(a.jumlah) > 0).map((a) => ({ toUserId: a.userId, jumlahTarget: parseFloat(a.jumlah) }));
    if (validItems.length === 0) return;
    try {
      if (disposisiSubId && unitId) {
        await upsertDisposisi(disposisiSubId, tahun, validItems, disposedBy);
        if (authUser?.id) {
          const d = await getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId);
          setGroupedData(d);
        }
        setShowSuccess(true);
      }
    } catch { alert("Gagal menyimpan disposisi"); }
    finally { setDisposisiModalOpen(false); setDisposisiSubId(null); setDisposedBy(null); }
  };

  return (
    <div>
      <SuccessPopup open={showSuccess} onClose={() => setShowSuccess(false)} />
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Beranda</p>

        {/* Notif Card */}
        <div style={{ backgroundColor: "#dcfce7", borderRadius: 12, padding: 24, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #bbf7d0" }}>
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 16, color: "#15803d" }}>Target Baru</h3>
            <p style={{ fontSize: 14, color: "#3f6619", margin: 0 }}>Segera periksa target Indikator Kinerja Utama dan Perjanjian Kerja mu lalu lakukan penyesuaian sebelum tanggal 30 Oktober</p>
          </div>
          <button style={{ backgroundColor: "#16a34a", color: "white", padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", marginLeft: 20 }}>
            Telusuri
          </button>
        </div>

        {/* DISPOSISI MODAL */}
        {disposisiModalOpen && disposisiSubId && createPortal(
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setDisposisiModalOpen(false)}>
            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 28, width: 560, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#1f2937", textAlign: "center" }}>Disposisi Target</h3>
              <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 20 }}>Disposisikan ulang target kepada bawahan Anda</p>
              <div style={{ marginBottom: 16, padding: "12px 16px", backgroundColor: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Jumlah Diterima: </span><span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{disposisiTargetFakultas}</span></div>
                <div><span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Dialokasikan: </span><span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{totalAllocated}</span></div>
                <div><span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Sisa: </span><span style={{ fontSize: 14, fontWeight: 700, color: sisaTarget < 0 ? "#dc2626" : "#16a34a" }}>{sisaTarget}</span></div>
              </div>
              {sisaTarget < 0 && <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#fef2f2", borderRadius: 6, border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>⚠️ Total disposisi melebihi jumlah tersedia.</div>}
              {unitUsers.length === 0 && <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#fef3c7", borderRadius: 6, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>ℹ️ Tidak ada user yang dapat menerima disposisi.</div>}
              {disposisiAllocations.map((alloc, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                  <select value={alloc.userId} onChange={(e) => setDisposisiAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, userId: Number(e.target.value) } : a))} style={{ flex: 2, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#374151" }}>
                    <option value={0} disabled>Pilih nama...</option>
                    {unitUsers.map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.role})</option>)}
                  </select>
                  <input type="number" min={0} placeholder="Jumlah" value={alloc.jumlah} onChange={(e) => setDisposisiAllocations((prev) => prev.map((a, i) => i === idx ? { ...a, jumlah: e.target.value } : a))} style={{ width: 80, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, textAlign: "center" }} />
                  <button onClick={() => setDisposisiAllocations((prev) => prev.filter((_, i) => i !== idx))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <button onClick={() => setDisposisiAllocations((prev) => [...prev, { userId: 0, jumlah: "" }])} disabled={unitUsers.length === 0} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px dashed #d1d5db", backgroundColor: "#f9fafb", color: "#374151", fontSize: 13, fontWeight: 600, cursor: unitUsers.length === 0 ? "not-allowed" : "pointer", marginBottom: 20 }}>+ Tambah Penerima</button>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setDisposisiModalOpen(false)} style={{ padding: "8px 24px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Kembali</button>
                <button onClick={handleDisposisiSubmit} disabled={disposisiAllocations.length === 0 || sisaTarget < 0} style={{ padding: "8px 24px", borderRadius: 6, border: "none", backgroundColor: disposisiAllocations.length > 0 && sisaTarget >= 0 ? "#16a34a" : "#9ca3af", color: "white", fontSize: 13, fontWeight: 600, cursor: disposisiAllocations.length > 0 && sisaTarget >= 0 ? "pointer" : "not-allowed" }}>Simpan Disposisi</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* FILE REPOSITORY MODAL */}
        {fileRepoModalOpen && createPortal(
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setFileRepoModalOpen(false)}>
            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 28, width: 640, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#1f2937", textAlign: "center" }}>
                {fileRepoViewMode === "folders" ? "Pilih Folder Repository" : `Pilih File: ${selectedRepoFolderName}`}
              </h3>
              {fileRepoViewMode === "folders" ? (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Folder Tersedia</label>
                  {fileRepoLoading ? <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 13 }}>Memuat daftar folder...</div>
                    : fileRepoFolders.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxHeight: 300, overflowY: "auto", padding: 4 }}>
                        {fileRepoFolders.map((folder) => (
                          <div key={folder.id} onClick={() => { setSelectedRepoFolderId(folder.id); setSelectedRepoFolderName(folder.name); setFileRepoViewMode("files"); }} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{folder.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13 }}>Tidak ada folder ditemukan</div>}
                </div>
              ) : (
                <>
                  {!fileRepoLoading && fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e", textAlign: "center" }}>
                      Jumlah file ({fileRepoFiles.length}) kurang dari target ({fileRepoTarget}). Mohon penuhi target melalui{" "}
                      <a href="https://repository.fik.upnvj.ac.id" target="_blank" rel="noopener noreferrer" style={{ color: "#b45309", fontWeight: 700, textDecoration: "underline" }}>Repository.fik.upnvj.ac.id</a>
                    </div>
                  )}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Pilih Periode</label>
                    <select value={fileRepoPeriode} onChange={(e) => setFileRepoPeriode(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#374151" }}>
                      {periodeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Nama Target</label>
                    <div style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#374151", backgroundColor: "#f9fafb" }}>{fileRepoNama}</div>
                  </div>
                  {fileRepoChildren.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Jenis File (Anakan)</label>
                      <select value={fileRepoChildId} onChange={(e) => setFileRepoChildId(Number(e.target.value))} style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#374151" }}>
                        {fileRepoChildren.map((c) => <option key={c.id} value={c.id}>{c.kode} {c.nama}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Jumlah File Ditemukan</label>
                    <div style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, color: "#374151", backgroundColor: "#f9fafb" }}>
                      {fileRepoLoading ? "Mencari..." : fileRepoFiles.length > 0 ? `${fileRepoFiles.length} File` : "-"}
                    </div>
                  </div>
                  {fileRepoLoading ? <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 13 }}>Memuat data file...</div>
                    : fileRepoFiles.length > 0 ? (
                      <div style={{ marginBottom: 20, maxHeight: 260, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ backgroundColor: "#f9fafb" }}>
                              <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, width: 36 }}>No</th>
                              <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700 }}>Nama File</th>
                              <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, width: 90 }}>Tanggal</th>
                              <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, width: 100 }}>Sumber</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fileRepoFiles.map((f) => (
                              <tr key={f.no} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                <td style={{ padding: "7px 10px", textAlign: "center", color: "#6b7280" }}>{f.no}</td>
                                <td style={{ padding: "7px 10px", color: "#1f2937" }}>{f.namaFile}</td>
                                <td style={{ padding: "7px 10px", textAlign: "center", color: "#6b7280" }}>{f.tanggal}</td>
                                <td style={{ padding: "7px 10px", textAlign: "center", color: "#6b7280" }}>{f.sumber}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>Tidak ada file ditemukan</div>}
                </>
              )}
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => { if (fileRepoViewMode === "files") { setFileRepoViewMode("folders"); } else { setFileRepoModalOpen(false); } }} style={{ padding: "8px 24px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Kembali</button>
                <button onClick={handleFileRepoSubmit} disabled={fileRepoViewMode === "folders" || fileRepoLoading || fileRepoFiles.length === 0 || fileRepoSubmitting} style={{ padding: "8px 24px", borderRadius: 6, border: "none", backgroundColor: fileRepoViewMode === "files" && !fileRepoLoading && fileRepoFiles.length > 0 && !fileRepoSubmitting ? "#16a34a" : "#9ca3af", color: "white", fontSize: 13, fontWeight: 600, cursor: fileRepoViewMode === "files" && !fileRepoLoading && fileRepoFiles.length > 0 && !fileRepoSubmitting ? "pointer" : "not-allowed" }}>{fileRepoSubmitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* TABEL */}
        <div className="page-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", margin: 0 }}>Indikator Kinerja Utama & Perjanjian Kerja</h3>
            <div className="filter" style={{ marginBottom: 0 }}>
              <div className="filter-content">
                <label className="filter-content-label">Target</label>
                <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="filter-isi">
                  <option value="IKU">Indikator Kinerja Utama</option>
                  <option value="PK">Perjanjian Kerja</option>
                </select>
              </div>
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
                      const realisasiJumlah = localRealisasi[row.sub.id] ?? (row.sub.realisasiJumlah ?? 0);
                      return (
                        <tr key={`${group.id}-${rowIdx}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          {rowIdx === 0 && (
                            <>
                              <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>{groupIdx + 1}</td>
                              <td rowSpan={totalRowSpan} style={{ padding: "10px 12px", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}>{group.nama}</td>
                            </>
                          )}
                          <td style={{ padding: "10px 12px", color: "#374151", borderRight: "1px solid #e5e7eb", paddingLeft: row.level === 2 ? 28 : 12 }}>
                            {row.kode} {row.nama}
                          </td>
                          {row.isSubFirst && (
                            <>
                              <td rowSpan={row.subChildCount} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>{disposisiJumlah !== null ? disposisiJumlah : "-"}</td>
                              <td rowSpan={row.subChildCount} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", fontWeight: 700, color: (realisasiJumlah > 0 && disposisiJumlah) ? (realisasiJumlah >= disposisiJumlah ? "#16a34a" : "#eab308") : "#374151" }}>
                                {(realisasiJumlah > 0 && disposisiJumlah && disposisiJumlah > 0)
                                  ? (realisasiJumlah >= disposisiJumlah ? "100%" : `${Math.round((realisasiJumlah / disposisiJumlah) * 100)}%`) : "-"}
                              </td>
                            </>
                          )}
                          {row.isSubFirst && (
                            <td rowSpan={row.subChildCount} style={{ textAlign: "center", verticalAlign: "top" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                                <button onClick={() => handleInputFileClick(row.sub.id, row.sub.nama, Number(disposisiJumlah || 0), row.sub.children)} className="btn-small" style={{ border: "1px solid #86efac", backgroundColor: "#ecfdf5", color: "#16a34a", width: 100 }}>Input File</button>
                                <button onClick={() => handleGroupedDisposisiClick(row.sub.id, Number(disposisiJumlah || 0), authUser?.id)} className="btn-small" style={{ border: "1px solid #93c5fd", backgroundColor: "#eff6ff", color: "#2563eb", width: 100 }}>Redisposisi</button>
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
        </div>
      </PageTransition>
    </div>
  );
}

