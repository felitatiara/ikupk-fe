"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  getIndikatorGroupedForUser,
  getSkpHasilStatus,
  getMySkpStatus,
  getUserSkpInfo,
  submitHasilSKPPegawai,
  checkHasilSKPChecker,
  signHasilSKPPenilai,
  returnHasilSKPForRevision,
  resubmitHasilSKP,
  getHasilSKPRevisionLogs,
  type SkpHasilStatusData,
  type SkpRevisionLog,
  type UserSkpInfo,
} from "@/lib/api";

interface SKPRow {
  kodeIndikator: string;
  namaIndikator: string;
  targetKuantitas: number | null;
  realisasiKuantitas: number | null;
  capaianPersen: number | null;
}

const PERILAKU_ITEMS = [
  { nama: "Berorientasi pelayanan", bullets: ["Memahami dan memenuhi kebutuhan masyarakat", "Ramah, cekatan, solutif, dan dapat diandalkan", "Melakukan perbaikan tiada henti"] },
  { nama: "Akuntabel", bullets: ["Melaksanakan tugas dengan jujur, bertanggungjawab, cermat, disiplin dan berintegritas tinggi", "Menggunakan kekayaan dan barang milik negara secara bertanggungjawab, efektif, dan efisien", "Tidak menyalahgunakan kewenangan jabatan"] },
  { nama: "Kompeten", bullets: ["Meningkatkan kompetensi diri untuk menjawab tantangan yang selalu berubah", "Membantu orang lain belajar", "Melaksanakan tugas dengan kualitas terbaik"] },
  { nama: "Harmonis", bullets: ["Menghargai setiap orang apapun latar belakangnya", "Suka menolong orang lain", "Membangun lingkungan kerja yang kondusif"] },
  { nama: "Loyal", bullets: ["Memegang teguh ideologi Pancasila, Undang-Undang Dasar Negara Republik Indonesia Tahun 1945, setia kepada Negara Kesatuan Republik Indonesia serta pemerintahan yang sah", "Menjaga nama baik sesama ASN, Pimpinan, Instansi, dan Negara", "Menjaga rahasia jabatan dan negara"] },
  { nama: "Adaptif", bullets: ["Cepat menyesuaikan diri menghadapi perubahan", "Terus berinovasi dan mengembangkan kreativitas", "Bertindak proaktif"] },
  { nama: "Kolaboratif", bullets: ["Memberi kesempatan kepada berbagai pihak untuk berkontribusi", "Terbuka dalam bekerja sama untuk menghasilkan nilai tambah", "Menggerakkan pemanfaatan berbagai sumberdaya untuk tujuan bersama"] },
];

function makeDrawHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isDrawingRef: React.MutableRefObject<boolean>,
  setHasDrawn: (v: boolean) => void,
) {
  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (e.currentTarget.width / r.width), y: (e.clientY - r.top) * (e.currentTarget.height / r.height) };
  }
  function getTouchPos(e: React.TouchEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    return { x: (t.clientX - r.left) * (e.currentTarget.width / r.width), y: (t.clientY - r.top) * (e.currentTarget.height / r.height) };
  }
  return {
    onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
      isDrawingRef.current = true;
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y);
    },
    onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      const { x, y } = getPos(e); ctx.lineTo(x, y); ctx.stroke(); setHasDrawn(true);
    },
    onMouseUp() { isDrawingRef.current = false; },
    onMouseLeave() { isDrawingRef.current = false; },
    onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
      e.preventDefault(); isDrawingRef.current = true;
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      const { x, y } = getTouchPos(e); ctx.beginPath(); ctx.moveTo(x, y);
    },
    onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
      e.preventDefault(); if (!isDrawingRef.current) return;
      const c = canvasRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      const { x, y } = getTouchPos(e); ctx.lineTo(x, y); ctx.stroke(); setHasDrawn(true);
    },
    onTouchEnd() { isDrawingRef.current = false; },
  };
}

const td: React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", fontSize: 9, verticalAlign: "top" };
const tdC: React.CSSProperties = { ...td, textAlign: "center", verticalAlign: "middle" };
const tdH: React.CSSProperties = { ...tdC, fontWeight: "bold", background: "#e8e8e8" };
const tdB: React.CSSProperties = { ...tdH, background: "#e8e8e8" };

export default function CetakHasilSKP() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tahun = searchParams.get("tahun") ?? String(new Date().getFullYear());
  const reviewUserIdParam = searchParams.get("reviewUserId");
  const reviewUserId = reviewUserIdParam ? Number(reviewUserIdParam) : null;
  const isReviewMode = reviewUserId !== null;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SKPRow[]>([]);
  const [hasilStatus, setHasilStatus] = useState<SkpHasilStatusData | null>(null);
  const [dekan, setDekan] = useState<{ nama: string; nip: string | null; jabatan: string } | null>(null);
  const [targetUser, setTargetUser] = useState<UserSkpInfo | null>(null);
  const [revisionLogs, setRevisionLogs] = useState<SkpRevisionLog[]>([]);

  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signHasDrawn, setSignHasDrawn] = useState(false);
  const [signSaving, setSignSaving] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signIsDrawing = useRef(false);

  const [approverSignOpen, setApproverSignOpen] = useState(false);
  const [approverSignHasDrawn, setApproverSignHasDrawn] = useState(false);
  const [approverSignSaving, setApproverSignSaving] = useState(false);
  const approverSignCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const approverSignIsDrawing = useRef(false);

  const [returnRevisionOpen, setReturnRevisionOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [resubmitSaving, setResubmitSaving] = useState(false);

  const primaryRoleLevel = (user as any)?.roleLevel ?? (user?.roles as any[])?.find((r: any) => r.isPrimary)?.level ?? 4;
  const isCheckerRole = primaryRoleLevel >= 2 && primaryRoleLevel < 4;
  const isPenilaiRole = primaryRoleLevel < 2;

  const signHandlers = makeDrawHandlers(signCanvasRef, signIsDrawing, setSignHasDrawn);
  const approverHandlers = makeDrawHandlers(approverSignCanvasRef, approverSignIsDrawing, setApproverSignHasDrawn);

  useEffect(() => {
    if (!signModalOpen) return;
    const c = signCanvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    setSignHasDrawn(false);
  }, [signModalOpen]);

  useEffect(() => {
    if (!approverSignOpen) return;
    const c = approverSignCanvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    setApproverSignHasDrawn(false);
  }, [approverSignOpen]);

  useEffect(() => {
    if (!user || !token) return;
    setLoading(true);
    (async () => {
      try {
        const effectiveUserId = isReviewMode ? reviewUserId! : user.id;
        const allUserRoles = (user?.roles as any[]) ?? [];
        const primaryRole = allUserRoles.find((r: any) => r.isPrimary) ?? allUserRoles[0] ?? null;
        let effectiveRoleId: number = primaryRole?.id ?? (user as any)?.roleId ?? allUserRoles[0]?.id ?? 0;

        if (isReviewMode) {
          const tu = await getUserSkpInfo(reviewUserId!, token);
          setTargetUser(tu);
          const primaryUR = (tu.userRoles as any[])?.find((r: any) => r.isPrimary) ?? (tu.userRoles as any[])?.[0];
          effectiveRoleId = primaryUR?.role?.id ?? primaryUR?.id ?? effectiveRoleId;
          const logs = await getHasilSKPRevisionLogs(reviewUserId!, tahun, token);
          setRevisionLogs(logs);
        }

        const [ikuData, pkData, hasilSt, mySkp] = await Promise.all([
          getIndikatorGroupedForUser("IKU", tahun, effectiveUserId, effectiveRoleId),
          getIndikatorGroupedForUser("PK", tahun, effectiveUserId, effectiveRoleId),
          getSkpHasilStatus(effectiveUserId, tahun),
          getMySkpStatus(effectiveUserId, tahun),
        ]);

        setHasilStatus(hasilSt);

        // Pejabat Penilai diambil dari konfigurasi (atasanPenilai dari my-skp)
        const penilai = mySkp.atasanPenilai ?? mySkp.atasan;
        if (penilai) {
          setDekan({ nama: penilai.nama, nip: penilai.nip ?? null, jabatan: penilai.jabatan ?? "Pejabat Penilai" });
        }

        const allData = [...(ikuData as any[]), ...(pkData as any[])];
        const newRows: SKPRow[] = [];
        function pushRow(item: any) {
          const target = item.disposisiJumlah ?? null;
          const realisasi = item.finalValidRealisasiJumlah ?? null;
          const capaian = target !== null && target > 0 && realisasi !== null ? (realisasi / target) * 100 : null;
          newRows.push({ kodeIndikator: item.kode, namaIndikator: item.nama, targetKuantitas: target, realisasiKuantitas: realisasi, capaianPersen: capaian });
        }
        for (const group of allData) {
          for (const sub of group.subIndikators ?? []) {
            const children = sub.children ?? [];
            if (children.length === 0) { pushRow(sub); }
            else {
              for (const child of children) {
                const gc = child.children ?? [];
                if (gc.length === 0) { pushRow(child); } else { for (const g of gc) pushRow(g); }
              }
            }
          }
        }
        setRows(newRows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, tahun, reviewUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { ratingHK, predikat } = useMemo(() => {
    const validRows = rows.filter(r => r.realisasiKuantitas !== null && r.targetKuantitas !== null);
    const allAbove = validRows.length > 0 && validRows.every(r => r.realisasiKuantitas! >= r.targetKuantitas!);
    const anyBelow = validRows.some(r => r.realisasiKuantitas! < r.targetKuantitas!);
    const ratingHK = validRows.length === 0
      ? { label: "SESUAI EKSPEKTASI", angka: 2 }
      : allAbove ? { label: "DI ATAS EKSPEKTASI", angka: 3 }
      : anyBelow && validRows.every(r => r.realisasiKuantitas! < r.targetKuantitas!)
        ? { label: "DI BAWAH EKSPEKTASI", angka: 1 }
        : { label: "SESUAI EKSPEKTASI", angka: 2 };
    const avgCapaian = validRows.length > 0 ? validRows.reduce((s, r) => s + r.capaianPersen!, 0) / validRows.length : null;
    const predikat = !avgCapaian ? "BAIK" : avgCapaian >= 90 ? "SANGAT BAIK" : avgCapaian >= 76 ? "BAIK" : "CUKUP";
    return { ratingHK, predikat };
  }, [rows]);

  function hasilKerja(realisasi: number | null, target: number | null) {
    if (realisasi === null || target === null) return { label: "SESUAI EKSPEKTASI", angka: 2 };
    if (realisasi > target) return { label: "DI ATAS EKSPEKTASI", angka: 3 };
    if (realisasi === target) return { label: "SESUAI EKSPEKTASI", angka: 2 };
    return { label: "DI BAWAH EKSPEKTASI", angka: 1 };
  }

  // Derived display info
  const displayNama = isReviewMode ? (targetUser?.nama ?? "…") : (user?.nama ?? "…");
  const displayNip = isReviewMode ? ((targetUser as any)?.nip ?? "—") : ((user as any)?.nip ?? "—");
  const displayJabatan = isReviewMode
    ? ((targetUser?.userRoles as any[])?.find((r: any) => r.isPrimary)?.role?.name ?? (targetUser?.userRoles as any[])?.[0]?.role?.name ?? "—")
    : ([...(user?.roles ?? [])].sort((a: any, b: any) => a.level - b.level)[0]?.name ?? (user as any)?.role ?? "—");
  const displayUnitKerja = isReviewMode ? ((targetUser as any)?.unitNama ?? "Fakultas Ilmu Komputer") : ((user as any)?.unitNama ?? "Fakultas Ilmu Komputer");
  const atasanNama = dekan?.nama ?? "—";
  const atasanNip = dekan?.nip ?? "—";
  const atasanJabatan = dekan?.jabatan ?? "Dekan";
  const periodePenilaian = `02 JANUARI S.D. 31 DESEMBER TAHUN ${tahun}`;
  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const hs = hasilStatus?.status ?? "pending";

  async function handleEmployeeSign() {
    if (!user?.id || !token) return;
    setSignSaving(true);
    try {
      const sig = signHasDrawn && signCanvasRef.current ? signCanvasRef.current.toDataURL("image/png") : null;
      const result = await submitHasilSKPPegawai(user.id, tahun, sig);
      setHasilStatus(result);
      setSignModalOpen(false);
      toast.success("Hasil SKP berhasil diajukan. Menunggu pengecekan checker.");
    } catch { toast.error("Gagal mengajukan Hasil SKP."); }
    finally { setSignSaving(false); }
  }

  async function handleApproverSign() {
    if (!reviewUserId) return;
    setApproverSignSaving(true);
    try {
      if (hs === "signed_pegawai") {
        const result = await checkHasilSKPChecker(reviewUserId, tahun);
        setHasilStatus(result);
        setApproverSignOpen(false);
        toast.success("Hasil SKP berhasil divalidasi.");
      } else {
        const sig = approverSignHasDrawn && approverSignCanvasRef.current ? approverSignCanvasRef.current.toDataURL("image/png") : null;
        const result = await signHasilSKPPenilai(reviewUserId, tahun, sig);
        setHasilStatus(result);
        setApproverSignOpen(false);
        toast.success("Hasil SKP berhasil ditandatangani.");
      }
    } catch { toast.error("Gagal menyimpan."); }
    finally { setApproverSignSaving(false); }
  }

  async function handleReturnRevision() {
    if (!reviewUserId || !token) return;
    setReturnSaving(true);
    try {
      const result = await returnHasilSKPForRevision(reviewUserId, tahun, returnReason, returnNote || null, token);
      setHasilStatus(result);
      const logs = await getHasilSKPRevisionLogs(reviewUserId, tahun, token);
      setRevisionLogs(logs);
      setReturnRevisionOpen(false);
      setReturnReason(""); setReturnNote("");
      toast.success("Dokumen dikembalikan untuk revisi.");
    } catch { toast.error("Gagal mengembalikan dokumen."); }
    finally { setReturnSaving(false); }
  }

  async function handleResubmit() {
    if (!token) return;
    setResubmitSaving(true);
    try {
      const result = await resubmitHasilSKP(tahun, token);
      setHasilStatus(result);
      toast.success("Hasil SKP berhasil diajukan kembali.");
    } catch { toast.error("Gagal mengajukan kembali."); }
    finally { setResubmitSaving(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Times New Roman', serif", color: "#000", minHeight: "100vh", background: "#f5f7fb" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff !important; }
          .cetak-page { width: 100% !important; margin: 0 !important; padding: 15mm 12mm 15mm 15mm !important; border: none !important; box-shadow: none !important; page-break-after: always; }
          .cetak-page:last-child { page-break-after: avoid; }
        }
        @media screen {
          .cetak-page { width: 210mm; margin: 0 auto 32px; padding: 15mm 12mm; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.07), 0 6px 20px rgba(0,0,0,.08), 0 20px 40px rgba(0,0,0,.06); box-sizing: border-box; }
          .doc-canvas { padding: 24px 0 48px; }
          .ev-table { width: 100%; border-collapse: collapse; }
          .ev-table td, .ev-table th { border: 1px solid #000; padding: 3px 5px; font-size: 9pt; vertical-align: top; }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div
        className="no-print"
        style={{ padding: "0 28px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", height: 60, gap: 10, position: "sticky", top: 0, zIndex: 100, fontFamily: "sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,.07)" }}
      >
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", color: "#374151", fontSize: 13, fontWeight: 500, flexShrink: 0, background: "none", border: "none", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Kembali
        </button>
        <div style={{ width: 1, height: 24, background: "#e5e7eb", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Hasil SKP</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>{tahun}</span>
        </div>
        {isReviewMode && displayNama && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "5px 12px" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
              {displayNama.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5b21b6", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayNama}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />

        {/* Review mode actions */}
        {isReviewMode ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {((isCheckerRole && hs === "signed_pegawai") || (isPenilaiRole && hs === "checked")) && (
              <button
                onClick={() => setReturnRevisionOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "1.5px solid #fca5a5", borderRadius: 9, background: "#fff5f5", color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" /></svg>
                Ajukan Revisi
              </button>
            )}
            {isCheckerRole && hs === "signed_pegawai" && (
              <button
                onClick={() => setApproverSignOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(217,119,6,.35)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Validasi
              </button>
            )}
            {isCheckerRole && hs === "checked" && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Sudah Divalidasi
              </span>
            )}
            {isPenilaiRole && hs === "checked" && (
              <button
                onClick={() => setApproverSignOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(5,150,105,.35)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg>
                Setujui
              </button>
            )}
            {hs === "needs_revision" && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Menunggu Revisi dari Pegawai
              </span>
            )}
            {hs === "signed_penilai" && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Hasil SKP Disetujui
              </span>
            )}
          </div>
        ) : (
          /* Employee actions */
          <>
            {hs === "pending" && (
              <button
                onClick={() => rows.length > 0 ? setSignModalOpen(true) : toast.warning("Pastikan ada data realisasi terlebih dahulu.")}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: rows.length > 0 ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "#9ca3af", color: "#fff", fontWeight: 700, fontSize: 13, cursor: rows.length > 0 ? "pointer" : "not-allowed", boxShadow: rows.length > 0 ? "0 3px 10px rgba(217,119,6,.35)" : "none" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg>
                Tanda Tangan &amp; Ajukan
              </button>
            )}
            {hs === "needs_revision" && (
              <button
                disabled={resubmitSaving}
                onClick={handleResubmit}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: resubmitSaving ? "#9ca3af" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: resubmitSaving ? "not-allowed" : "pointer" }}
              >
                {resubmitSaving ? "Menyimpan…" : "↩ Ajukan Kembali"}
              </button>
            )}
            {hs === "signed_pegawai" && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Menunggu Pengecekan
              </span>
            )}
            {hs === "needs_revision" && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Perlu Revisi
              </span>
            )}
            {hs === "checked" && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Menunggu TTD Pejabat Penilai
              </span>
            )}
            {hs === "signed_penilai" && (
              <button
                onClick={() => window.print()}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(5,150,105,.35)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                Cetak Hasil SKP
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Review Mode: Timeline + Revision History ── */}
      {isReviewMode && hasilStatus && (() => {
        const steps = [
          { label: "Diajukan Pegawai", sub: "Tanda tangan pegawai", ts: hasilStatus.signedAtPegawai, done: !!hasilStatus.signedAtPegawai },
          { label: "Dicek Checker", sub: "Validasi checker", ts: hasilStatus.checkedAt, done: !!hasilStatus.checkedAt },
          { label: "TTD Pejabat Penilai", sub: "Persetujuan final", ts: hasilStatus.signedAtPenilai, done: !!hasilStatus.signedAtPenilai },
        ];
        const doneCount = steps.filter(s => s.done).length;
        const isNeedsRevision = hs === "needs_revision";
        return (
          <div className="no-print" style={{ fontFamily: "sans-serif" }}>
            <div style={{ background: "#fff", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                {steps.map((step, i) => {
                  const isActive = !step.done && doneCount === i;
                  const isRevisionStep = isNeedsRevision && doneCount === i;
                  const circleColor = step.done ? "#059669" : isRevisionStep ? "#dc2626" : isActive ? "#6d28d9" : "#d1d5db";
                  const circleBg = step.done ? "#059669" : isRevisionStep ? "#fef2f2" : isActive ? "#ede9fe" : "#f9fafb";
                  const lineColor = step.done ? "#059669" : "#e5e7eb";
                  const labelColor = step.done ? "#065f46" : isRevisionStep ? "#b91c1c" : isActive ? "#5b21b6" : "#9ca3af";
                  return (
                    <React.Fragment key={step.label}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: circleBg, border: `2px solid ${circleColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {step.done ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : isRevisionStep ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" /></svg>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: circleColor }}>{i + 1}</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, lineHeight: 1.2 }}>{step.label}</div>
                          {step.ts ? (
                            <div style={{ fontSize: 10, color: "#059669", fontWeight: 600, marginTop: 1 }}>
                              {new Date(step.ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: "#d1d5db", marginTop: 1 }}>Menunggu</div>
                          )}
                        </div>
                      </div>
                      {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: lineColor, borderRadius: 2, margin: "0 8px" }} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            {revisionLogs.length > 0 && (
              <div style={{ background: "#fff8f8", borderTop: "1px solid #fecaca", padding: "16px 32px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, maxWidth: 680, margin: "0 auto 14px" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" /></svg>
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#991b1b" }}>Riwayat Revisi</h4>
                    <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{revisionLogs.length} kali dikembalikan</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 680, margin: "0 auto" }}>
                  {revisionLogs.map((log, idx) => (
                    <div key={log.id} style={{ display: "flex", gap: 14 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: log.resubmittedAt ? "#dcfce7" : "#fee2e2", border: `2px solid ${log.resubmittedAt ? "#86efac" : "#fca5a5"}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={log.resubmittedAt ? "#16a34a" : "#dc2626"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {log.resubmittedAt ? <polyline points="20 6 9 17 4 12" /> : <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" /></>}
                          </svg>
                        </div>
                        {idx < revisionLogs.length - 1 && <div style={{ width: 2, flex: 1, background: "#f3f4f6", minHeight: 16, margin: "4px 0" }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: idx < revisionLogs.length - 1 ? 20 : 0 }}>
                        <div style={{ background: log.resubmittedAt ? "#f0fdf4" : "#fff5f5", border: `1px solid ${log.resubmittedAt ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: log.reason ? 8 : 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: log.resubmittedAt ? "#15803d" : "#dc2626" }}>{log.resubmittedAt ? "Sudah Diajukan Kembali" : "Dikembalikan untuk Revisi"}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{new Date(log.revisedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                          {log.reason && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: log.note ? 6 : 0 }}>
                              <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>Alasan:</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", background: "#fee2e2", borderRadius: 6, padding: "1px 8px" }}>{log.reason}</span>
                            </div>
                          )}
                          {log.note && <p style={{ margin: 0, fontSize: 12, color: "#4b5563", borderLeft: "3px solid #fca5a5", paddingLeft: 8, fontStyle: "italic" }}>&ldquo;{log.note}&rdquo;</p>}
                          {log.resubmittedAt && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bbf7d0", fontSize: 11, color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              Diajukan kembali {new Date(log.resubmittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Employee: revision banner ── */}
      {!isReviewMode && hs === "needs_revision" && (
        <div className="no-print" style={{ background: "#fff5f5", borderBottom: "1px solid #fecaca", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, fontFamily: "sans-serif" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>Hasil SKP Perlu Direvisi</span>
            <span style={{ fontSize: 12, color: "#b91c1c", marginLeft: 8 }}>Dokumen dikembalikan oleh atasan. Perbaiki data realisasi lalu ajukan kembali.</span>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="no-print" style={{ textAlign: "center", padding: 80, color: "#6b7280", fontSize: 15, fontFamily: "sans-serif" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          Memuat data Hasil SKP...
        </div>
      ) : (
        <div className="doc-canvas">

          {/* ══════════════════════════════════════════
              HALAMAN 1 — COVER EVALUASI KINERJA
          ══════════════════════════════════════════ */}
          <div className="cetak-page">
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-upnvj.webp" alt="Logo UPNVJ" style={{ height: 72, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <p style={{ textAlign: "center", fontSize: "11pt", fontWeight: "bold", margin: "0 0 2px" }}>DOKUMEN EVALUASI KINERJA PEGAWAI</p>
            <p style={{ textAlign: "center", fontSize: "10pt", margin: "0 0 10px" }}>
              PERIODE*: <span style={{ textDecoration: "line-through" }}>TRIWULAN I/II/III/IV-</span>AKHIR**
            </p>
            <table className="ev-table">
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", width: "50%", verticalAlign: "top", borderBottom: "none" }}>
                    KEMENTERIAN PENDIDIKAN, KEBUDAYAAN,<br />RISET, DAN TEKNOLOGI
                  </td>
                  <td style={{ padding: "4px 8px", width: "50%", verticalAlign: "top", borderBottom: "none" }}>
                    PERIODE PENILAIAN:<br />{periodePenilaian}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: 0, border: "none" }}>
                    <table className="ev-table">
                      <tbody>
                        <tr>
                          <td rowSpan={6} style={{ textAlign: "center", width: 28, fontWeight: "bold", verticalAlign: "top", padding: 4 }}>1</td>
                          <td colSpan={3} style={{ fontWeight: "bold", padding: "4px 6px" }}>PEGAWAI YANG DINILAI</td>
                        </tr>
                        {[["NAMA", displayNama], ["NIP", displayNip], ["PANGKAT/GOL. RUANG", "—"], ["JABATAN", displayJabatan], ["UNIT KERJA", displayUnitKerja]].map(([l, v]) => (
                          <tr key={l}><td style={{ padding: "2px 6px", width: 160 }}>{l}</td><td style={{ padding: "2px 4px", width: 8 }}>:</td><td style={{ padding: "2px 6px" }}>{v}</td></tr>
                        ))}
                        <tr>
                          <td rowSpan={6} style={{ textAlign: "center", width: 28, fontWeight: "bold", verticalAlign: "top", padding: 4 }}>2</td>
                          <td colSpan={3} style={{ fontWeight: "bold", padding: "4px 6px" }}>PEJABAT PENILAI SKP</td>
                        </tr>
                        {[["NAMA", atasanNama], ["NIP", atasanNip], ["PANGKAT/GOL. RUANG", "—"], ["JABATAN", atasanJabatan], ["UNIT KERJA", displayUnitKerja]].map(([l, v]) => (
                          <tr key={l}><td style={{ padding: "2px 6px", width: 160 }}>{l}</td><td style={{ padding: "2px 4px", width: 8 }}>:</td><td style={{ padding: "2px 6px" }}>{v}</td></tr>
                        ))}
                        <tr>
                          <td rowSpan={6} style={{ textAlign: "center", width: 28, fontWeight: "bold", verticalAlign: "top", padding: 4 }}>3</td>
                          <td colSpan={3} style={{ fontWeight: "bold", padding: "4px 6px" }}>ATASAN PEJABAT PENILAI KINERJA</td>
                        </tr>
                        {[["NAMA", "—"], ["NIP", "—"], ["PANGKAT/GOL. RUANG", "—"], ["JABATAN", "—"], ["UNIT KERJA", displayUnitKerja]].map(([l, v]) => (
                          <tr key={l}><td style={{ padding: "2px 6px", width: 160 }}>{l}</td><td style={{ padding: "2px 4px", width: 8 }}>:</td><td style={{ padding: "2px 6px" }}>{v}</td></tr>
                        ))}
                        <tr>
                          <td rowSpan={2} style={{ textAlign: "center", width: 28, fontWeight: "bold", verticalAlign: "top", padding: 4 }}>4</td>
                          <td colSpan={3} style={{ fontWeight: "bold", padding: "4px 6px" }}>EVALUASI KINERJA</td>
                        </tr>
                        <tr>
                          <td colSpan={3} style={{ padding: "3px 6px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <tbody>
                                <tr><td style={{ padding: "1px 6px" }}>CAPAIAN KINERJA ORGANISASI</td><td style={{ padding: "1px 4px" }}>:</td><td style={{ padding: "1px 6px", fontWeight: "bold" }}>BAIK</td></tr>
                                <tr><td style={{ padding: "1px 6px" }}>PREDIKAT KINERJA PEGAWAI</td><td style={{ padding: "1px 4px" }}>:</td><td style={{ padding: "1px 6px", fontWeight: "bold" }}>{predikat}</td></tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ textAlign: "center", width: 28, fontWeight: "bold", verticalAlign: "top", padding: 4 }}>5</td>
                          <td colSpan={3} style={{ fontWeight: "bold", padding: "4px 6px" }}>CATATAN/ REKOMENDASI</td>
                        </tr>
                        <tr><td /><td colSpan={3} style={{ padding: "40px 6px" }} /></tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
              <tbody>
                <tr>
                  <td style={{ width: "50%", textAlign: "center", verticalAlign: "top", border: "none", padding: 0 }}>
                    <p style={{ margin: 0 }}>7. Jakarta, {tanggalCetak}</p>
                    <p style={{ margin: 0 }}>Pegawai yang dinilai</p>
                    {hasilStatus?.signaturePegawai
                      ? <img src={hasilStatus.signaturePegawai} alt="TTD" style={{ height: 60, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto" }} />
                      : <div style={{ height: 60 }} />}
                    <p style={{ margin: 0, fontWeight: "bold" }}>{displayNama}</p>
                    <p style={{ margin: 0, fontSize: "8.5pt" }}>NIP {displayNip}</p>
                  </td>
                  <td style={{ width: "50%", textAlign: "center", verticalAlign: "top", border: "none", padding: 0 }}>
                    <p style={{ margin: 0 }}>6. Jakarta, {tanggalCetak}</p>
                    <p style={{ margin: 0 }}>Pejabat Penilai SKP,</p>
                    {hasilStatus?.signaturePenilai
                      ? <img src={hasilStatus.signaturePenilai} alt="TTD" style={{ height: 60, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto" }} />
                      : <div style={{ height: 60 }} />}
                    <p style={{ margin: 0, fontWeight: "bold" }}>{atasanNama}</p>
                    <p style={{ margin: 0, fontSize: "8.5pt" }}>NIP {atasanNip}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══════════════════════════════════════════
              HALAMAN 2 — EVALUASI HASIL KERJA KUANTITATIF
          ══════════════════════════════════════════ */}
          <div className="cetak-page">
            <p style={{ textAlign: "center", fontSize: "10pt", fontWeight: "bold", margin: 0 }}>EVALUASI KINERJA PEGAWAI</p>
            <p style={{ textAlign: "center", fontSize: "10pt", fontWeight: "bold", margin: 0 }}>PENDEKATAN HASIL KERJA KUANTITATIF</p>
            <p style={{ textAlign: "center", fontSize: "9pt", fontWeight: "bold", margin: "0 0 6px" }}>BAGI PEJABAT ADMINISTRASI DAN PEJABAT FUNGSIONAL</p>
            <p style={{ textAlign: "center", fontSize: "9pt", margin: "0 0 6px" }}>
              PERIODE: <span style={{ textDecoration: "line-through" }}>TRIWULAN I/II/III/IV-</span>AKHIR*
            </p>
            <table className="ev-table" style={{ marginBottom: 4 }}>
              <tbody>
                <tr>
                  <td colSpan={3} style={{ padding: "3px 6px", borderBottom: "none" }}>UPN &quot;VETERAN&quot; JAKARTA</td>
                  <td colSpan={3} style={{ padding: "3px 6px", borderBottom: "none" }}>PERIODE PENILAIAN: {periodePenilaian}</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 4px", width: 20, fontSize: "8pt" }}>NO.</td>
                  <td colSpan={2} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>PEGAWAI YANG DINILAI</td>
                  <td style={{ padding: "2px 4px", width: 20, fontSize: "8pt" }}>NO.</td>
                  <td colSpan={2} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>PEJABAT PENILAI SKP</td>
                </tr>
                {[
                  [["1", "NAMA", displayNama], ["1", "NAMA", atasanNama]],
                  [["2", "NIP", displayNip], ["2", "NIP", atasanNip]],
                  [["3", "PANGKAT/GOL. RUANG", "—"], ["3", "PANGKAT/GOL. RUANG", "—"]],
                  [["4", "JABATAN", displayJabatan], ["4", "JABATAN", "—"]],
                  [["5", "UNIT KERJA", displayUnitKerja], ["5", "INSTANSI", displayUnitKerja]],
                ].map((row, ri) => (
                  <tr key={ri}>
                    {row.map(([no, label, val], ci) => (
                      <React.Fragment key={ci}>
                        <td style={{ padding: "2px 4px", textAlign: "center", fontSize: "8pt" }}>{no}</td>
                        <td style={{ padding: "2px 5px", fontSize: "8pt" }}>{label}</td>
                        <td style={{ padding: "2px 5px", fontSize: "8pt" }}>{val}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
                <tr><td colSpan={6} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>CAPAIAN KINERJA ORGANISASI*</td></tr>
                <tr><td colSpan={6} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>BAIK</td></tr>
                <tr><td colSpan={6} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>POLA DISTRIBUSI:</td></tr>
                <tr>
                  <td colSpan={6} style={{ padding: 4, textAlign: "center" }}>
                    <svg width="300" height="110" viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", margin: "4px auto" }}>
                      <line x1="28" y1="90" x2="290" y2="90" stroke="#333" strokeWidth="0.8" />
                      <line x1="28" y1="5" x2="28" y2="90" stroke="#333" strokeWidth="0.8" />
                      <text x="18" y="93" fontSize="7" textAnchor="middle" fontFamily="serif">0</text>
                      <text x="18" y="73" fontSize="7" textAnchor="middle" fontFamily="serif">20</text>
                      <text x="18" y="52" fontSize="7" textAnchor="middle" fontFamily="serif">40</text>
                      <text x="18" y="30" fontSize="7" textAnchor="middle" fontFamily="serif">60</text>
                      <text x="7" y="55" fontSize="6" textAnchor="middle" fontFamily="serif" transform="rotate(-90,7,55)">FREKUENSI PEGAWAI</text>
                      <path d="M28,89 C50,89 70,89 95,75 C115,60 130,25 155,8 C180,25 195,60 215,75 C240,89 260,89 290,89" fill="none" stroke="#333" strokeWidth="1.2" />
                      <text x="40" y="102" fontSize="6.5" textAnchor="middle" fontFamily="serif">Sangat</text>
                      <text x="40" y="109" fontSize="6.5" textAnchor="middle" fontFamily="serif">Kurang</text>
                      <text x="95" y="102" fontSize="6.5" textAnchor="middle" fontFamily="serif">Kurang/</text>
                      <text x="95" y="109" fontSize="6.5" textAnchor="middle" fontFamily="serif">Misconduct</text>
                      <text x="155" y="102" fontSize="6.5" textAnchor="middle" fontFamily="serif">Butuh</text>
                      <text x="155" y="109" fontSize="6.5" textAnchor="middle" fontFamily="serif">Perbaikan</text>
                      <text x="215" y="102" fontSize="6.5" textAnchor="middle" fontFamily="serif">Baik</text>
                      <text x="275" y="102" fontSize="6.5" textAnchor="middle" fontFamily="serif">Sangat</text>
                      <text x="275" y="109" fontSize="6.5" textAnchor="middle" fontFamily="serif">Baik</text>
                    </svg>
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="ev-table">
              <tbody>
                <tr style={{ background: "#e8e8e8" }}>
                  <td rowSpan={2} style={{ ...tdH, width: "36%" }}>HASIL KERJA</td>
                  <td rowSpan={2} style={{ ...tdH, width: "13%" }}>REALISASI BERDASARKAN BUKTI DUKUNG</td>
                  <td rowSpan={2} style={{ ...tdH, width: "18%" }}>UMPAN BALIK BERKELANJUTAN BERDASARKAN BUKTI DUKUNG</td>
                  <td colSpan={2} style={tdH}>HASIL KERJA</td>
                </tr>
                <tr style={{ background: "#e8e8e8" }}>
                  <td style={{ ...td, textAlign: "center", fontSize: "7.5pt" }}>1-Dibawah Ekspektasi<br />2-Sesuai Ekspektasi<br />3-diatas Ekspektasi</td>
                  <td style={tdH}>Angka</td>
                </tr>
                <tr><td colSpan={5} style={{ ...tdB, textAlign: "left" }}>A. UTAMA</td></tr>
                {rows.map((row, i) => {
                  const hk = hasilKerja(row.realisasiKuantitas, row.targetKuantitas);
                  return (
                    <tr key={i}>
                      <td style={{ ...td, verticalAlign: "top" }}>
                        <div style={{ fontWeight: "bold", marginBottom: 4 }}>{row.kodeIndikator ? `${row.kodeIndikator} ` : ""}{row.namaIndikator}</div>
                        <div style={{ fontSize: "8pt" }}>Ukuran keberhasilan/Indikator Kinerja Individu, Target:</div>
                        <div style={{ fontSize: "8pt" }}>• Tersedianya {row.targetKuantitas ?? "—"} yang memenuhi {row.namaIndikator.toLowerCase()}</div>
                      </td>
                      <td style={{ ...tdC, fontSize: "8pt" }}>{row.realisasiKuantitas != null ? String(row.realisasiKuantitas) : "—"}</td>
                      <td style={{ ...td, fontSize: "8pt" }} />
                      <td style={{ ...td, fontSize: "8pt" }}>{hk.label}</td>
                      <td style={{ ...tdC, fontWeight: "bold" }}>{hk.angka}</td>
                    </tr>
                  );
                })}
                <tr><td colSpan={5} style={{ ...tdB, textAlign: "left" }}>B. TAMBAHAN</td></tr>
                <tr><td colSpan={5} style={{ padding: "20px 6px" }} /></tr>
                <tr style={{ background: "#e8e8e8" }}>
                  <td colSpan={2} style={tdB}>RATING HASIL KERJA*</td>
                  <td style={td} />
                  <td style={tdB}>{ratingHK.label}</td>
                  <td style={{ ...tdC, fontWeight: "bold" }}>{ratingHK.angka}</td>
                </tr>
                <tr style={{ background: "#e8e8e8" }}><td colSpan={4} style={tdB}>PERILAKU KERJA</td><td /></tr>
                {PERILAKU_ITEMS.map((p, i) => (
                  <tr key={i}>
                    <td style={td}>
                      <div style={{ fontWeight: "bold", marginBottom: 3 }}>{i + 1} {p.nama}</div>
                      {p.bullets.map((b, bi) => <div key={bi} style={{ fontSize: "8pt" }}>- {b}</div>)}
                    </td>
                    <td style={{ ...td, fontSize: "8pt", fontStyle: "italic" }}>Ekspektasi Khusus Pimpinan:</td>
                    <td style={{ ...td, fontSize: "8pt" }}>sudah sesuai</td>
                    <td style={{ ...td, fontSize: "8pt" }}>SESUAI EKSPEKTASI</td>
                    <td style={{ ...tdC, fontWeight: "bold" }}>2</td>
                  </tr>
                ))}
                <tr style={{ background: "#e8e8e8" }}>
                  <td colSpan={2} style={tdB}>RATING PERILAKU KERJA*</td>
                  <td style={td} />
                  <td style={tdB}>DI ATAS EKSPEKTASI</td>
                  <td style={{ ...tdC, fontWeight: "bold" }}>2</td>
                </tr>
                <tr style={{ background: "#e8e8e8" }}><td colSpan={4} style={tdB}>PREDIKAT KINERJA PEGAWAI*</td><td /></tr>
                <tr style={{ background: "#e8e8e8" }}><td colSpan={4} style={tdB}>{predikat}</td><td /></tr>
              </tbody>
            </table>
            <div style={{ textAlign: "right", marginTop: 20 }}>
              <p style={{ margin: 0 }}>Jakarta, {tanggalCetak}</p>
              <p style={{ margin: 0 }}>Pejabat Penilai SKP</p>
              {hasilStatus?.signaturePenilai
                ? <img src={hasilStatus.signaturePenilai} alt="TTD" style={{ height: 60, maxWidth: 200, objectFit: "contain", display: "block", marginLeft: "auto" }} />
                : <div style={{ height: 60 }} />}
              <p style={{ margin: 0, fontWeight: "bold" }}>{atasanNama}</p>
              <p style={{ margin: 0, fontSize: "8.5pt" }}>NIP {atasanNip}</p>
            </div>
          </div>

          {/* ══════════════════════════════════════════
              HALAMAN 3 — EVALUASI HASIL KERJA KUALITATIF
          ══════════════════════════════════════════ */}
          <div className="cetak-page">
            <p style={{ textAlign: "center", fontSize: "10pt", fontWeight: "bold", margin: 0 }}>SASARAN KINERJA PEGAWAI</p>
            <p style={{ textAlign: "center", fontSize: "10pt", fontWeight: "bold", margin: 0 }}>PENDEKATAN HASIL KERJA KUALITATIF</p>
            <p style={{ textAlign: "center", fontSize: "9pt", fontWeight: "bold", margin: "0 0 6px" }}>BAGI PEJABAT ADMINISTRASI / FUNGSIONAL</p>
            <table className="ev-table" style={{ marginBottom: 4 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "2px 4px", width: 20, fontSize: "8pt" }}>NO</td>
                  <td colSpan={2} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>PEGAWAI YANG DINILAI</td>
                  <td style={{ padding: "2px 4px", width: 20, fontSize: "8pt" }}>NO</td>
                  <td colSpan={2} style={{ padding: "2px 6px", fontWeight: "bold", fontSize: "8pt" }}>PEJABAT PENILAI KINERJA</td>
                </tr>
                {[
                  [["1", "NAMA", displayNama], ["1", "NAMA", atasanNama]],
                  [["2", "NIP.", displayNip], ["2", "NIP.", atasanNip]],
                  [["3", "PANGKAT/ GOL. RUANG", "—"], ["3", "PANGKAT/ GOL. RUANG", "—"]],
                  [["4", "JABATAN", displayJabatan], ["4", "JABATAN", "—"]],
                  [["5", "UNIT KERJA", displayUnitKerja], ["5", "UNIT KERJA", displayUnitKerja]],
                ].map((row, ri) => (
                  <tr key={ri}>
                    {row.map(([no, label, val], ci) => (
                      <React.Fragment key={ci}>
                        <td style={{ padding: "2px 4px", textAlign: "center", fontSize: "8pt" }}>{no}</td>
                        <td style={{ padding: "2px 5px", fontSize: "8pt" }}>{label}</td>
                        <td style={{ padding: "2px 5px", fontSize: "8pt" }}>{val}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
                <tr><td colSpan={6} style={{ padding: "2px 6px", fontSize: "8pt" }}>PERIODE PENILAIAN: SAMPAI DENGAN 31 DESEMBER TAHUN {tahun}</td></tr>
              </tbody>
            </table>
            <table className="ev-table">
              <tbody>
                <tr style={{ background: "#e8e8e8" }}><td colSpan={3} style={{ ...tdB, textAlign: "left" }}>HASIL KERJA</td></tr>
                <tr><td colSpan={3} style={{ ...td, fontWeight: "bold" }}>A. UTAMA</td></tr>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...td, verticalAlign: "top", width: 40 }}>{i + 1}</td>
                    <td style={td}>
                      <div style={{ fontWeight: "bold", fontStyle: "italic", marginBottom: 4 }}>{row.kodeIndikator ? `${row.kodeIndikator} ` : ""}{row.namaIndikator}</div>
                      <div style={{ fontSize: "8.5pt" }}>Ukuran keberhasilan/Indikator Kinerja Individu, Target:</div>
                      <div style={{ fontSize: "8.5pt" }}>• Tersedianya {row.targetKuantitas ?? "—"} yang memenuhi {row.namaIndikator.toLowerCase()}</div>
                    </td>
                    <td style={{ ...td, fontSize: "8.5pt", fontStyle: "italic" }}>Ekspektasi Khusus Pimpinan:</td>
                  </tr>
                ))}
                <tr style={{ background: "#e8e8e8" }}><td colSpan={3} style={{ ...tdB, textAlign: "left" }}>PERILAKU KERJA*</td></tr>
                <tr style={{ background: "#e8e8e8" }}><td colSpan={2} style={{ ...tdB, textAlign: "left", fontSize: "8pt" }}>Berorientasi pelayanan</td><td /></tr>
                {PERILAKU_ITEMS.map((p, i) => (
                  <tr key={i}>
                    <td style={td}>
                      <div style={{ fontWeight: "bold", marginBottom: 3 }}>{p.nama}</div>
                      {p.bullets.map((b, bi) => <div key={bi} style={{ fontSize: "8pt" }}>- {b}</div>)}
                    </td>
                    <td style={{ ...td, fontSize: "8pt", fontStyle: "italic" }}>Ekspektasi Khusus Pimpinan:</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
              <tbody>
                <tr>
                  <td style={{ width: "50%", textAlign: "center", verticalAlign: "top", border: "none", padding: 0 }}>
                    <p style={{ margin: 0 }}>Pegawai yang Dinilai</p>
                    {hasilStatus?.signaturePegawai
                      ? <img src={hasilStatus.signaturePegawai} alt="TTD" style={{ height: 60, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto" }} />
                      : <div style={{ height: 60 }} />}
                    <p style={{ margin: 0, fontWeight: "bold" }}>{displayNama}</p>
                    <p style={{ margin: 0, fontSize: "8.5pt" }}>NIP. {displayNip}</p>
                  </td>
                  <td style={{ width: "50%", textAlign: "center", verticalAlign: "top", border: "none", padding: 0 }}>
                    <p style={{ margin: 0 }}>Jakarta, {tanggalCetak}</p>
                    <p style={{ margin: 0 }}>Pejabat Penilai Kinerja</p>
                    {hasilStatus?.signaturePenilai
                      ? <img src={hasilStatus.signaturePenilai} alt="TTD" style={{ height: 60, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto" }} />
                      : <div style={{ height: 60 }} />}
                    <p style={{ margin: 0, fontWeight: "bold" }}>{atasanNama}</p>
                    <p style={{ margin: 0, fontSize: "8.5pt" }}>NIP. {atasanNip}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Employee Sign ── */}
      {signModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}
          onClick={e => { if (e.target === e.currentTarget) setSignModalOpen(false); }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 500, maxWidth: "95vw", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>Tanda Tangan &amp; Ajukan Hasil SKP</h3>
              <button onClick={() => setSignModalOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#374151" }}>
              Tanda tangan di bawah untuk mengajukan Hasil SKP Anda ke checker. Tanda tangan bersifat opsional.
            </p>
            <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff", cursor: "crosshair" }}>
              <canvas
                ref={signCanvasRef}
                width={440} height={160}
                style={{ width: "100%", height: 160, display: "block", touchAction: "none" }}
                {...signHandlers}
              />
              {!signHasDrawn && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>Tanda tangan di sini (opsional)</span>
                </div>
              )}
            </div>
            {signHasDrawn && (
              <button onClick={() => { const c = signCanvasRef.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setSignHasDrawn(false); }}
                style={{ marginTop: 6, fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Hapus tanda tangan
              </button>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setSignModalOpen(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Batal</button>
              <button
                disabled={signSaving}
                onClick={handleEmployeeSign}
                style={{ flex: 2, padding: "10px 0", borderRadius: 9, border: "none", background: signSaving ? "#9ca3af" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: signSaving ? "not-allowed" : "pointer" }}
              >
                {signSaving ? "Menyimpan…" : "✓ Ajukan Hasil SKP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Approver Sign (Checker/Penilai) ── */}
      {approverSignOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}
          onClick={e => { if (e.target === e.currentTarget) setApproverSignOpen(false); }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 500, maxWidth: "95vw", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>
                {hs === "signed_pegawai" ? "Validasi Hasil SKP" : "TTD Pejabat Penilai — Hasil SKP"}
              </h3>
              <button onClick={() => setApproverSignOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#374151" }}>
              {hs === "signed_pegawai"
                ? `Konfirmasi validasi Hasil SKP ${displayNama}. Dokumen akan diteruskan ke Pejabat Penilai Kinerja.`
                : `Tanda tangan sebagai Pejabat Penilai Kinerja untuk menyetujui Hasil SKP ${displayNama}.`}
            </p>
            {hs === "checked" && (
              <>
                <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff", cursor: "crosshair" }}>
                  <canvas
                    ref={approverSignCanvasRef}
                    width={440} height={160}
                    style={{ width: "100%", height: 160, display: "block", touchAction: "none" }}
                    {...approverHandlers}
                  />
                  {!approverSignHasDrawn && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>Tanda tangan di sini (opsional)</span>
                    </div>
                  )}
                </div>
                {approverSignHasDrawn && (
                  <button onClick={() => { const c = approverSignCanvasRef.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setApproverSignHasDrawn(false); }}
                    style={{ marginTop: 6, fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Hapus tanda tangan
                  </button>
                )}
              </>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setApproverSignOpen(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Batal</button>
              <button
                disabled={approverSignSaving}
                onClick={handleApproverSign}
                style={{ flex: 2, padding: "10px 0", borderRadius: 9, border: "none", background: approverSignSaving ? "#9ca3af" : hs === "signed_pegawai" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: approverSignSaving ? "not-allowed" : "pointer" }}
              >
                {approverSignSaving ? "Menyimpan…" : hs === "signed_pegawai" ? "✓ Validasi" : "✍️ Setujui & TTD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Return Revision ── */}
      {returnRevisionOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}
          onClick={e => { if (e.target === e.currentTarget) setReturnRevisionOpen(false); }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 480, maxWidth: "95vw", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>Kembalikan untuk Revisi</h3>
              <button onClick={() => setReturnRevisionOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Alasan Pengembalian</label>
              <select
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 13, color: "#1f2937" }}
              >
                <option value="">— Pilih alasan —</option>
                <option>Data realisasi tidak akurat</option>
                <option>Indikator kurang jelas</option>
                <option>Target tidak realistis</option>
                <option>Bukti dukung tidak memadai</option>
                <option>Dokumen tidak lengkap</option>
                <option>Lainnya</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Catatan Tambahan (opsional)</label>
              <textarea
                value={returnNote}
                onChange={e => setReturnNote(e.target.value)}
                rows={4}
                placeholder="Tulis catatan revisi untuk pegawai..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setReturnRevisionOpen(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Batal</button>
              <button
                disabled={!returnReason || returnSaving}
                onClick={handleReturnRevision}
                style={{ flex: 2, padding: "10px 0", borderRadius: 9, border: "none", background: !returnReason || returnSaving ? "#9ca3af" : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !returnReason || returnSaving ? "not-allowed" : "pointer" }}
              >
                {returnSaving ? "Menyimpan…" : "↩ Kembalikan untuk Revisi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
