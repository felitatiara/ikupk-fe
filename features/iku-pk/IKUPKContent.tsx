"use client";

import { useEffect, useState } from "react";
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
                <circle cx="27" cy="27" r="27" fill="#4ADE80"/>
                <path d="M16 28.5L24 36.5L38 20.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <svg width="24" height="24" style={{ position: 'absolute', top: 8, right: -8 }}><circle cx="12" cy="12" r="12" fill="#FDE68A"/></svg>
              <svg width="16" height="16" style={{ position: 'absolute', bottom: 8, left: -8 }}><circle cx="8" cy="8" r="8" fill="#FDE68A"/></svg>
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
import { getUsersByUnit, getIndikatorGrouped, getIndikatorGroupedForUser, getDisposisi, upsertDisposisi, submitFileRealisasi } from "../../lib/api";
import type { UnitUser, IndikatorGrouped, IndikatorGroupedSub, IndikatorGroupedChild } from "../../lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function IKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' | 'dekan' }) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { user: authUser } = useAuth();
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
  const [fileRepoFiles, setFileRepoFiles] = useState<{ no: number; namaFile: string; tanggal: string; sumber: string }[]>([]);
  const [fileRepoLoading, setFileRepoLoading] = useState(false);
  const [fileRepoSubmitting, setFileRepoSubmitting] = useState(false);
  const [fileRepoTarget, setFileRepoTarget] = useState<number>(0);

  // Grouped data for admin/dekan view
  const [groupedData, setGroupedData] = useState<IndikatorGrouped[]>([]);
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [jenis, setJenis] = useState("IKU");
  const [disposisiSubId, setDisposisiSubId] = useState<number | null>(null);

  const unitId = authUser?.unitId;

  // Fetch grouped data for admin/dekan/user
  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    setLoading(true);
    const fetchPromise = role === 'user' && authUser?.id
      ? getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId)
      : (role === 'admin' || role === 'dekan')
        ? getIndikatorGrouped(jenis, tahun, unitId)
        : Promise.resolve([]);
    fetchPromise
      .then((d) => { if (!cancelled) { setGroupedData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setGroupedData([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [role, jenis, tahun, unitId, authUser?.id]);

  const handleGroupedDisposisiClick = async (subId: number, targetAmount: number, disposedByUserId?: number | null) => {
    setDisposisiSubId(subId);
    setDisposisiRow(null);
    setDisposisiTargetFakultas(targetAmount);
    setDisposisiAllocations([]);
    setDisposedBy(disposedByUserId ?? null);
    if (!unitId) return;
    try {
      const users = await getUsersByUnit(unitId);
      setUnitUsers(users);
    } catch {
      setUnitUsers([]);
    }
    try {
      const existing = await getDisposisi(subId, unitId, tahun, disposedByUserId ?? null);
      if (existing.length > 0) {
        setDisposisiAllocations(
          existing.map((d) => ({ userId: d.assignedTo, jumlah: String(Number(d.jumlah)) }))
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

  const handleDisposisiSubmit = async () => {
    const validItems = disposisiAllocations
      .filter((a) => a.userId > 0 && parseFloat(a.jumlah) > 0)
      .map((a) => ({ assignedTo: a.userId, jumlah: parseFloat(a.jumlah) }));
    if (validItems.length === 0) return;
    try {
      if (disposisiSubId && unitId) {
        await upsertDisposisi(disposisiSubId, unitId, tahun, validItems, disposedBy);
        // Refresh data
        if (role === 'user' && authUser?.id) {
          const d = await getIndikatorGroupedForUser(jenis, tahun, authUser.id, unitId);
          setGroupedData(d);
        } else {
          const d = await getIndikatorGrouped(jenis, tahun, unitId);
          setGroupedData(d);
        }
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

  const handleInputFileClick = (indikatorId: number, nama: string, target: number) => {
    setFileRepoIndikatorId(indikatorId);
    setFileRepoNama(nama);
    setFileRepoPeriode(periodeOptions[0]);
    setFileRepoFiles([]);
    setFileRepoLoading(false);
    setFileRepoSubmitting(false);
    setFileRepoTarget(target);
    setFileRepoModalOpen(true);
  };

  // Mock: simulate fetching files from external repository app
  // In production, replace with real API call matching user + target name
  useEffect(() => {
    if (!fileRepoModalOpen || !fileRepoPeriode || !fileRepoIndikatorId) return;
    setFileRepoLoading(true);
    const timer = setTimeout(() => {
      // Generate mock files based on indikator name and periode
      const count = Math.floor(Math.random() * 8) + 2;
      const mockFiles = Array.from({ length: count }, (_, i) => {
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
        const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
        return {
          no: i + 1,
          namaFile: `${fileRepoNama} - Dokumen ${i + 1}.pdf`,
          tanggal: `${day}/${month}/${tahun}`,
          sumber: "Repository FIK",
        };
      });
      setFileRepoFiles(mockFiles);
      setFileRepoLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [fileRepoModalOpen, fileRepoPeriode, fileRepoIndikatorId, fileRepoNama, tahun]);

  const handleFileRepoSubmit = async () => {
    if (!fileRepoIndikatorId || !unitId || !authUser?.id) return;
    setFileRepoSubmitting(true);
    try {
      await submitFileRealisasi({
        indikatorId: fileRepoIndikatorId,
        unitId,
        tahun,
        periode: fileRepoPeriode,
        fileCount: fileRepoFiles.length,
        userId: authUser.id,
      });
      setFileRepoModalOpen(false);
      setShowSuccess(true);
    } catch {
      alert("Gagal menyimpan realisasi");
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
                width: 540, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937", textAlign: "center" }}>Disposisi Target</h3>

              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Target Fakultas: </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{disposisiTargetFakultas}</span>
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Sisa: </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sisaTarget < 0 ? "#dc2626" : "#16a34a" }}>{sisaTarget}</span>
                </div>
              </div>

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
                      <option key={u.id} value={u.id}>{u.nama}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
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
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 6,
                  border: "1px dashed #d1d5db", backgroundColor: "#f9fafb",
                  color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  marginBottom: 20,
                }}
              >
                + Tambah
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
                  disabled={disposisiAllocations.length === 0 || sisaTarget < 0}
                  style={{
                    padding: "8px 24px", borderRadius: 6, border: "none",
                    backgroundColor: disposisiAllocations.length > 0 && sisaTarget >= 0 ? "#16a34a" : "#9ca3af",
                    color: "white", fontSize: 13, fontWeight: 600,
                    cursor: disposisiAllocations.length > 0 && sisaTarget >= 0 ? "pointer" : "not-allowed",
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
              
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#1f2937", textAlign: "center" }}>
                Pilih File Repository
              </h3>

               {/* Warning if files < target */}
              {!fileRepoLoading && fileRepoFiles.length > 0 && fileRepoFiles.length < fileRepoTarget && (
                <div style={{
                  marginBottom: 16, padding: "10px 14px", backgroundColor: "#fef3c7",
                  borderRadius: 8, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e",
                  textAlign: "center", lineHeight: 1.5,
                }}>
                  Jumlah file ({fileRepoFiles.length}) kurang dari target ({fileRepoTarget}).
                  Mohon untuk memenuhi target melalui{" "}
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

              {/* Nama Target */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Nama Target</label>
                <div
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid #d1d5db", fontSize: 13, color: "#374151",
                    backgroundColor: "#f9fafb", boxSizing: "border-box",
                  }}
                >
                  {fileRepoNama}
                </div>
              </div>

              {/* Jumlah File Ditemukan */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Jumlah File Ditemukan</label>
                <div
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid #d1d5db", fontSize: 13, color: "#374151",
                    backgroundColor: "#f9fafb", boxSizing: "border-box",
                  }}
                >
                  {fileRepoLoading ? "Mencari..." : fileRepoFiles.length > 0 ? `${fileRepoFiles.length} File` : "-"}
                </div>
              </div>

              {/* File Table */}
              {fileRepoLoading ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 13 }}>Memuat data file...</div>
              ) : fileRepoFiles.length > 0 ? (
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
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>Tidak ada file ditemukan</div>
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
                  Kembali
                </button>
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
                  {fileRepoSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Indikator Kinerja Utama & Perjanjian Kerja
          </h3>

          {(role === 'admin' || role === 'dekan') ? (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target</label>
                  <select
                    value={jenis}
                    onChange={(e) => setJenis(e.target.value)}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
                  >
                    <option value="IKU">Indikator Kinerja Utama</option>
                    <option value="PK">Perjanjian Kerja</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Tahun</label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
                  >
                    {["2024", "2025", "2026", "2027"].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Nomor</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sasaran Strategis</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sub Indikator Kinerja Utama</th>
                        <th colSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Target Universitas</th>
                        <th colSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Target Fakultas</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>Disposisi</th>
                      </tr>
                      <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 80 }}>Kualitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Waktu</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 80 }}>Kualitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Kuantitas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedData.map((group, groupIdx) => {
                        const flatRows: { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; isSubFirst: boolean; subChildCount: number; baselineJumlah: number | null; targetFakultas: number | null }[] = [];
                        for (const sub of group.subIndikators) {
                          const childCount = 1 + sub.children.length;
                          flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subChildCount: childCount, baselineJumlah: sub.baselineJumlah, targetFakultas: sub.targetFakultas });
                          for (const child of sub.children) {
                            flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subChildCount: childCount, baselineJumlah: child.baselineJumlah, targetFakultas: child.targetFakultas });
                          }
                        }
                        const totalRowSpan = flatRows.length;

                        return flatRows.map((row, rowIdx) => {
                          // Target Universitas kualitas%
                          const univPct = (() => {
                            if (row.sub.targetUniversitas !== null && row.sub.baselineJumlah && Number(row.sub.baselineJumlah) > 0) {
                              const pct = (Number(row.sub.targetUniversitas) / Number(row.sub.baselineJumlah)) * 100;
                              return `${Math.round(pct * 100) / 100}%`;
                            }
                            return "-";
                          })();

                          // Target Fakultas per level 2 row
                          const childFakKualitas = (() => {
                            if (row.level === 2 && row.targetFakultas !== null && row.baselineJumlah && Number(row.baselineJumlah) > 0) {
                              const pct = (Number(row.targetFakultas) / Number(row.baselineJumlah)) * 100;
                              return `${Math.round(pct * 100) / 100}%`;
                            }
                            return "-";
                          })();
                          const childFakKuantitas = row.level === 2 && row.targetFakultas !== null ? Number(row.targetFakultas) : null;

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
                              {/* Target Universitas — per level 1 sub */}
                              {row.isSubFirst && (
                                <>
                                  <td rowSpan={row.subChildCount} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {univPct}
                                  </td>
                                  <td rowSpan={row.subChildCount} style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151" }}>
                                    Triwulan I
                                  </td>
                                </>
                              )}
                              {/* Target Fakultas — per level 2 row */}
                              {row.level === 2 ? (
                                <>
                                  <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {childFakKualitas}
                                  </td>
                                  <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {childFakKuantitas !== null ? `${childFakKuantitas} Lulusan` : "-"}
                                  </td>
                                </>
                              ) : row.isSubFirst ? (
                                <>
                                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                                </>
                              ) : null}
                              {/* Disposisi — only level 2 */}
                              {row.level === 2 ? (
                                <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top" }}>
                                  <button
                                    onClick={() => handleGroupedDisposisiClick(row.id, Number(row.targetFakultas || 0), null)}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 4,
                                      border: "1px solid #86efac",
                                      backgroundColor: "#ecfdf5",
                                      color: "#16a34a",
                                      fontWeight: 700,
                                      fontSize: 11,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Disposisi
                                  </button>
                                </td>
                              ) : row.isSubFirst ? (
                                <td style={{ padding: "10px 12px" }} />
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
              <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Target</label>
                  <select
                    value={jenis}
                    onChange={(e) => setJenis(e.target.value)}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
                  >
                    <option value="IKU">Indikator Kinerja Utama</option>
                    <option value="PK">Perjanjian Kerja</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "#374151", fontWeight: 700 }}>Tahun</label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#374151" }}
                  >
                    {["2024", "2025", "2026", "2027"].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && <p style={{ color: "#9ca3af", padding: 12 }}>Loading...</p>}

              {!loading && groupedData.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e5e7eb" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Nomor</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sasaran Strategis</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Sub Indikator Kinerja Utama</th>
                        <th colSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Target Fakultas</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Target Dosen</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Capaian</th>
                        <th rowSpan={2} style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>Aksi</th>
                      </tr>
                      <tr style={{ backgroundColor: "#e97a1f", color: "white" }}>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 80 }}>Kualitas</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", textAlign: "center", minWidth: 100 }}>Kuantitas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedData.map((group, groupIdx) => {
                        const flatRows: { id: number; kode: string; nama: string; level: number; sub: IndikatorGroupedSub; isSubFirst: boolean; subChildCount: number; baselineJumlah: number | null; targetFakultas: number | null; disposisiJumlah?: number | null }[] = [];
                        for (const sub of group.subIndikators) {
                          const childCount = 1 + sub.children.length;
                          flatRows.push({ id: sub.id, kode: sub.kode, nama: sub.nama, level: 1, sub, isSubFirst: true, subChildCount: childCount, baselineJumlah: sub.baselineJumlah, targetFakultas: sub.targetFakultas });
                          for (const child of sub.children) {
                            flatRows.push({ id: child.id, kode: child.kode, nama: child.nama, level: 2, sub, isSubFirst: false, subChildCount: childCount, baselineJumlah: child.baselineJumlah, targetFakultas: child.targetFakultas, disposisiJumlah: (child as IndikatorGroupedChild & { disposisiJumlah?: number | null }).disposisiJumlah ?? null });
                          }
                        }
                        const totalRowSpan = flatRows.length;

                        return flatRows.map((row, rowIdx) => {
                          const childFakKualitas = (() => {
                            if (row.level === 2 && row.targetFakultas !== null && row.baselineJumlah && Number(row.baselineJumlah) > 0) {
                              const pct = (Number(row.targetFakultas) / Number(row.baselineJumlah)) * 100;
                              return `${Math.round(pct * 100) / 100}%`;
                            }
                            return "-";
                          })();
                          const childFakKuantitas = row.level === 2 && row.targetFakultas !== null ? Number(row.targetFakultas) : null;

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
                              {/* Target Fakultas — per level 2 row */}
                              {row.level === 2 ? (
                                <>
                                  <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {childFakKualitas}
                                  </td>
                                  <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {childFakKuantitas !== null ? `${childFakKuantitas} Lulusan` : "-"}
                                  </td>
                                </>
                              ) : row.isSubFirst ? (
                                <>
                                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                                </>
                              ) : null}
                              {/* Target Dosen — only level 2 */}
                              {row.level === 2 ? (
                                <>
                                  <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>
                                    {row.disposisiJumlah !== null && row.disposisiJumlah !== undefined ? row.disposisiJumlah : "-"}
                                  </td>
                                  {/* Kolom Capaian */}
                                  <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e5e7eb", color: row.realisasiJumlah !== undefined && row.disposisiJumlah ? (row.realisasiJumlah >= row.disposisiJumlah ? '#16a34a' : '#eab308') : '#374151', fontWeight: 700 }}>
                                    {row.realisasiJumlah !== undefined && row.disposisiJumlah && row.disposisiJumlah > 0
                                      ? (row.realisasiJumlah >= row.disposisiJumlah
                                          ? '100%'
                                          : `${Math.round((row.realisasiJumlah / row.disposisiJumlah) * 100)}%`)
                                      : '-'}
                                  </td>
                                  {/* Kolom Aksi */}
                                  <td style={{ padding: "10px 8px", textAlign: "center", verticalAlign: "top" }}>
                                    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                                      <button
                                        onClick={() => handleGroupedDisposisiClick(row.id, Number((row as any).disposisiJumlah || 0), authUser?.id)}
                                        style={{
                                          padding: "4px 10px", borderRadius: 4,
                                          border: "1px solid #86efac", backgroundColor: "#ecfdf5",
                                          color: "#16a34a", fontWeight: 700, fontSize: 11, cursor: "pointer",
                                        }}
                                      >
                                        Disposisi
                                      </button>
                                      {row.realisasiJumlah !== undefined && row.disposisiJumlah && row.realisasiJumlah >= row.disposisiJumlah ? (
                                        <button
                                          onClick={() => handleInputFileClick(row.id, row.nama, Number((row as any).disposisiJumlah || 0))}
                                          style={{
                                            padding: "4px 10px", borderRadius: 4,
                                            border: "1px solid #60a5fa", backgroundColor: "#f0f9ff",
                                            color: "#2563eb", fontWeight: 700, fontSize: 11, cursor: "pointer",
                                          }}
                                        >
                                          Lihat Detail
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleInputFileClick(row.id, row.nama, Number((row as any).disposisiJumlah || 0))}
                                          style={{
                                            padding: "4px 10px", borderRadius: 4,
                                            border: "1px solid #93c5fd", backgroundColor: "#eff6ff",
                                            color: "#2563eb", fontWeight: 700, fontSize: 11, cursor: "pointer",
                                          }}
                                        >
                                          Input File
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </>
                              ) : row.isSubFirst ? (
                                <>
                                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                                  <td style={{ padding: "10px 12px", borderRight: "1px solid #e5e7eb" }} />
                                  <td style={{ padding: "10px 12px" }} />
                                </>
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
                <p style={{ color: "#9ca3af", padding: 12, textAlign: "center" }}>Tidak ada data target yang didisposisikan kepada Anda</p>
              )}
            </>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
