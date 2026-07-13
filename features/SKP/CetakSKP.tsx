"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "next/navigation";
import {
  getIndikatorGroupedForUser,
  getMySkpStatus,
  getAvailableYears,
  getSkpRencanaStatus,
  signRencanaSKPPegawai,
  checkRencanaSKPChecker,
  signRencanaSKPPihakKedua,
  getUserRoles,
  getUserSkpInfo,
  returnRencanaSKPForRevision,
  getRencanaSKPRevisionLogs,
  type IndikatorGrouped,
  type SkpRencanaStatusData,
  type SkpRevisionLog,
  type UserSkpInfo,
} from "@/lib/api";
import { toast } from "sonner";

const INSTITUSI = 'Universitas Pembangunan Nasional "Veteran" Jakarta';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocRow =
  | { kind: "sub-header"; groupIdx: number; groupKode: string; sasaran: string; ikuLabel: string }
  | { kind: "entry";      groupIdx: number; groupKode: string; sasaran: string; ikuLabel: string; target: string; satuan: string }
  | { kind: "leaf";       groupIdx: number; groupKode: string; sasaran: string; ikuLabel: string; target: string; satuan: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIkuLabel(kode: string): string {
  const trimmed = (kode ?? '').trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) return `IKU ${trimmed}`;
  const upper = trimmed.toUpperCase();
  if (upper.startsWith('IKU')) return upper.replace(/^IKU\s*/, 'IKU ');
  return trimmed;
}


function mergeGroupedData(primary: IndikatorGrouped[], secondary: IndikatorGrouped[]): IndikatorGrouped[] {
  const primaryIds = new Set(primary.map(g => g.id));
  return [
    ...primary,
    ...secondary.filter(g => {
      if (primaryIds.has(g.id)) return false;
      return g.subIndikators.some(sub =>
        (sub.disposisiJumlah ?? 0) > 0 ||
        sub.children.some(c =>
          (c.disposisiJumlah ?? 0) > 0 ||
          c.children.some(gc => (gc.disposisiJumlah ?? 0) > 0)
        )
      );
    }),
  ];
}

function resolveTarget(item: any): string {
  const v = item.disposisiJumlah ?? item.nilaiTarget;
  return v !== null && v !== undefined ? String(v) : "-";
}

function ikuLabel(kode: string, nama: string, fmt = false): string {
  const k = fmt ? formatIkuLabel(kode) : (kode?.trim() ?? "");
  return k ? `${k}  ${nama}` : nama;
}

function buildDocRows(data: IndikatorGrouped[]): DocRow[] {
  const rows: DocRow[] = [];
  for (const [groupIdx, group] of data.entries()) {
    const sasaran = group.nama;
    const groupKode = group.kode?.trim() || String(groupIdx + 1);
    for (const sub of group.subIndikators) {
      const children = sub.children ?? [];
      const subLabel = ikuLabel(sub.kode, sub.nama, true);
      if (children.length === 0) {
        rows.push({ kind: "entry", groupIdx, groupKode, sasaran, ikuLabel: subLabel, target: resolveTarget(sub), satuan: (sub as any).satuan ?? "" });
      } else {
        rows.push({ kind: "sub-header", groupIdx, groupKode, sasaran, ikuLabel: subLabel });
        for (const child of children) {
          const l3s = child.children ?? [];
          rows.push({ kind: "entry", groupIdx, groupKode, sasaran, ikuLabel: ikuLabel(child.kode, child.nama), target: l3s.length > 0 ? "" : resolveTarget(child), satuan: l3s.length > 0 ? "" : (child.satuan ?? "") });
          for (const l3 of l3s) {
            rows.push({ kind: "leaf", groupIdx, groupKode, sasaran, ikuLabel: ikuLabel(l3.kode, l3.nama), target: resolveTarget(l3), satuan: l3.satuan ?? "" });
          }
        }
      }
    }
  }
  return rows;
}

// ─── Shared cell styles ───────────────────────────────────────────────────────

const cell: React.CSSProperties = {
  border: "1px solid #000",
  padding: "4px 5px",
  fontSize: 9.5,
  verticalAlign: "top",
  lineHeight: 1.35,
};
const cellC: React.CSSProperties = { ...cell, textAlign: "center", verticalAlign: "middle" };
const th: React.CSSProperties = { ...cellC, fontWeight: "bold", background: "#f5f5f5" };

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({ lampiran, title, jabatan, atasanJabatan, tahun, spDipa }: {
  lampiran?: string; title: string; jabatan: string; atasanJabatan: string; tahun: string; spDipa: string;
}) {
  return (
    <>
      {lampiran && (
        <div style={{ textAlign: "right", fontSize: 9, marginBottom: 6 }}>{lampiran}</div>
      )}
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 10.5, marginBottom: 14, lineHeight: 1.65, textTransform: "uppercase" }}>
        <div>{title}</div>
        <div>{jabatan}</div>
        <div>DENGAN</div>
        <div>{atasanJabatan}</div>
        <div>{INSTITUSI.toUpperCase()}</div>
        <div>TAHUN ANGGARAN {tahun}</div>
        <div>BERDASARKAN {spDipa}</div>
      </div>
    </>
  );
}

function SignatureRow({ leftLabel, leftName, leftSig, rightDate, rightLabel, rightName, rightSig }: {
  leftLabel: string; leftName: string; leftSig?: string | null;
  rightDate: string; rightLabel?: string; rightName: string; rightSig?: string | null;
}) {
  const sigStyle: React.CSSProperties = { fontSize: 10.5, lineHeight: 1.6 };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, ...sigStyle }}>
      <div style={{ width: "42%" }}>
        <div>{leftLabel},</div>
        {leftSig
          ? <img src={leftSig} alt="TTD" style={{ height: 70, maxWidth: 200, objectFit: "contain" }} />
          : <div style={{ height: 70 }} />}
        <div style={{ borderTop: "1px solid #000", paddingTop: 4, display: "inline-block", minWidth: 200 }}>{leftName}</div>
      </div>
      <div style={{ width: "42%", textAlign: "center" }}>
        <div>{rightDate}</div>
        {rightLabel && <div>{rightLabel},</div>}
        {rightSig
          ? <img src={rightSig} alt="TTD" style={{ height: 70, maxWidth: 200, objectFit: "contain" }} />
          : <div style={{ height: 70 }} />}
        <div style={{ borderTop: "1px solid #000", paddingTop: 4, display: "inline-block", minWidth: 200 }}>{rightName}</div>
      </div>
    </div>
  );
}

// ─── Canvas draw handler factory ──────────────────────────────────────────────

function makeDrawHandlers(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isDrawingRef: React.MutableRefObject<boolean>,
  setHasDrawn: (v: boolean) => void,
) {
  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const scaleX = e.currentTarget.width / r.width;
    const scaleY = e.currentTarget.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }
  function getTouchPos(e: React.TouchEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    const scaleX = e.currentTarget.width / r.width;
    const scaleY = e.currentTarget.height / r.height;
    return { x: (t.clientX - r.left) * scaleX, y: (t.clientY - r.top) * scaleY };
  }
  return {
    onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
      isDrawingRef.current = true;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.beginPath(); ctx.moveTo(x, y);
    },
    onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y); ctx.stroke();
      setHasDrawn(true);
    },
    onMouseUp() { isDrawingRef.current = false; },
    onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
      e.preventDefault();
      isDrawingRef.current = true;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getTouchPos(e);
      ctx.beginPath(); ctx.moveTo(x, y);
    },
    onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getTouchPos(e);
      ctx.lineTo(x, y); ctx.stroke();
      setHasDrawn(true);
    },
    onTouchEnd() { isDrawingRef.current = false; },
    clear() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    },
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CetakSKP() {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewUserIdParam = searchParams.get('reviewUserId');
  const reviewUserId = reviewUserIdParam ? Number(reviewUserIdParam) : null;
  const isReviewMode = reviewUserId !== null && reviewUserId !== user?.id;

  const [tahun, setTahun] = useState("2026");
  const [years, setYears] = useState<string[]>(["2025", "2026", "2027"]);
  const [ikuRows, setIkuRows] = useState<DocRow[]>([]);
  const [pkRows, setPkRows] = useState<DocRow[]>([]);
  const [dekan, setDekan] = useState<{ nama: string; nip: string | null; jabatan?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rencanaStatus, setRencanaStatus] = useState<SkpRencanaStatusData | null>(null);
  const [setujuSaving, setSetujuSaving] = useState(false);

  // Review mode (approver melihat dokumen bawahan)
  const [targetUser, setTargetUser] = useState<UserSkpInfo | null>(null);
  const [revisionLogs, setRevisionLogs] = useState<SkpRevisionLog[]>([]);
  const [returnRevisionOpen, setReturnRevisionOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  // Signature modal approver (checker / pihak kedua)
  const [approverSignOpen, setApproverSignOpen] = useState(false);
  const [approverSignHasDrawn, setApproverSignHasDrawn] = useState(false);
  const [approverSignSaving, setApproverSignSaving] = useState(false);
  const approverSignCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const approverSignIsDrawing = useRef(false);

  // Signature modal (pegawai)
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signHasDrawn, setSignHasDrawn] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signIsDrawing = useRef(false);

  const roleId: number =
    user?.roleId ??
    (user?.roles as any[])?.find((r: any) => r.isPrimary)?.id ??
    (user?.roles as any[])?.[0]?.id ??
    0;

  useEffect(() => {
    const cy = new Date().getFullYear();
    getAvailableYears()
      .then((y) => {
        const merged = [...new Set([...y, String(cy - 1), String(cy), String(cy + 1)])].sort();
        setYears(merged);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        let effectiveUserId = user.id;
        let effectiveRoleId = roleId;

        if (isReviewMode && reviewUserId && token) {
          const tu = await getUserSkpInfo(reviewUserId, token);
          setTargetUser(tu);
          const primaryUR = (tu.userRoles as any[])?.find((r: any) => r.isPrimary) ?? (tu.userRoles as any[])?.[0];
          effectiveRoleId = primaryUR?.role?.id ?? primaryUR?.id ?? roleId;
          effectiveUserId = reviewUserId;
          const logs = await getRencanaSKPRevisionLogs(reviewUserId, tahun, token);
          setRevisionLogs(logs);
        }

        const allUserRoles = (user?.roles as any[]) ?? [];
        const primaryRoleLevel = (user as any)?.roleLevel ?? allUserRoles.find((r: any) => r.isPrimary)?.level ?? 4;
        const secondaryDosenRole = !isReviewMode && primaryRoleLevel < 4
          ? allUserRoles.find((r: any) => r.level >= 4 && !r.isPrimary)
          : undefined;

        const [iku, pk, skpStatus, rStatus] = await Promise.all([
          getIndikatorGroupedForUser("IKU", tahun, effectiveUserId, effectiveRoleId),
          getIndikatorGroupedForUser("PK", tahun, effectiveUserId, effectiveRoleId),
          getMySkpStatus(effectiveUserId, tahun),
          getSkpRencanaStatus(effectiveUserId, tahun),
        ]);

        let mergedIku = iku;
        let mergedPk = pk;

        if (secondaryDosenRole) {
          const [secIku, secPk] = await Promise.all([
            getIndikatorGroupedForUser("IKU", tahun, user.id, secondaryDosenRole.id),
            getIndikatorGroupedForUser("PK", tahun, user.id, secondaryDosenRole.id),
          ]);
          mergedIku = mergeGroupedData(mergedIku, secIku);
          mergedPk = mergeGroupedData(mergedPk, secPk);
        }

        setIkuRows(buildDocRows(mergedIku));
        setPkRows(buildDocRows(mergedPk));
        setDekan(skpStatus.atasanPenilai ?? skpStatus.atasan ?? null);
        setRencanaStatus(rStatus);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, tahun, roleId, reviewUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize canvas when signature modal opens
  useEffect(() => {
    if (!signModalOpen) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setSignHasDrawn(false);
  }, [signModalOpen]);

  const signHandlers = makeDrawHandlers(signCanvasRef, signIsDrawing, setSignHasDrawn);
  const approverSignHandlers = makeDrawHandlers(approverSignCanvasRef, approverSignIsDrawing, setApproverSignHasDrawn);

  // Init approver canvas saat modal terbuka
  useEffect(() => {
    if (!approverSignOpen) return;
    const canvas = approverSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setApproverSignHasDrawn(false);
  }, [approverSignOpen]);

  async function handleApproverSignConfirm() {
    if (!reviewUserId) return;
    setApproverSignSaving(true);
    try {
      const sig = approverSignHasDrawn && approverSignCanvasRef.current
        ? approverSignCanvasRef.current.toDataURL('image/png')
        : null;
      let result: SkpRencanaStatusData;
      if (rencanaStatus?.status === 'signed_pegawai') {
        result = await checkRencanaSKPChecker(reviewUserId, tahun, sig);
        toast.success('Rencana SKP berhasil divalidasi.');
      } else {
        result = await signRencanaSKPPihakKedua(reviewUserId, tahun, sig);
        toast.success('Rencana SKP berhasil ditandatangani.');
      }
      setRencanaStatus(result);
      setApproverSignOpen(false);
    } catch {
      toast.error('Gagal menyimpan tanda tangan.');
    } finally {
      setApproverSignSaving(false);
    }
  }

  async function handleSignConfirm() {
    if (!user?.id) return;
    setSetujuSaving(true);
    try {
      const sig = signHasDrawn && signCanvasRef.current
        ? signCanvasRef.current.toDataURL('image/png')
        : null;
      const result = await signRencanaSKPPegawai(user.id, tahun, sig);
      setRencanaStatus(result);
      setSignModalOpen(false);
      toast.success('Rencana SKP berhasil ditandatangani. Menunggu validasi atasan.');
    } catch {
      toast.error('Gagal menyimpan tanda tangan.');
    } finally {
      setSetujuSaving(false);
    }
  }

  const primaryRoleName = [...(user?.roles ?? [])].sort((a, b) => a.level - b.level)[0]?.name ?? user?.role ?? '';
  const jabatan = primaryRoleName;
  const spDipa = `SP DIPA-139.03.2.693372/${tahun}`;
  const tanggalTtd = `Jakarta, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  const atasanNama = dekan?.nama ?? "...";
  const atasanJabatanUpper = (dekan?.jabatan ?? 'Dekan').toUpperCase();

  // Dalam review mode, dokumen menampilkan data target user (bawahan), bukan logged-in user
  const displayNama = isReviewMode
    ? (targetUser?.nama ?? '...')
    : (user?.nama ?? '...');
  const displayNip = isReviewMode
    ? (targetUser?.nip ?? null)
    : (user?.nip ?? null);
  const displayJabatan = isReviewMode
    ? ((targetUser?.userRoles as any[])?.find((r: any) => r.isPrimary)?.role?.name
       ?? (targetUser?.userRoles as any[])?.[0]?.role?.name
       ?? jabatan)
    : jabatan;

  return (
    <div style={{ fontFamily: "'Times New Roman', serif", color: "#000", minHeight: "100vh", background: "#f5f7fb" }}>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff !important; }
          .cetak-page {
            width: 100% !important;
            margin: 0 !important;
            padding: 18mm 22mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always;
          }
          .cetak-page:last-child { page-break-after: avoid; }
        }
        @media screen {
          .cetak-page {
            width: 210mm;
            margin: 0 auto 32px;
            padding: 20mm 25mm;
            background: #fff;
            border-radius: 8px;
            box-shadow:
              0 1px 3px rgba(0,0,0,.07),
              0 6px 20px rgba(0,0,0,.08),
              0 20px 40px rgba(0,0,0,.06);
            box-sizing: border-box;
          }
          .doc-canvas {
            padding: 24px 0 48px;
          }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div
        className="no-print"
        style={{
          padding: "0 28px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          height: 60,
          gap: 10,
          position: "sticky",
          top: 0,
          zIndex: 100,
          fontFamily: "sans-serif",
          boxShadow: "0 2px 8px rgba(0,0,0,.07)",
        }}
      >
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", border: "1px solid #e5e7eb",
            borderRadius: 8, cursor: "pointer",
            background: "#f9fafb", color: "#374151",
            fontSize: 13, fontWeight: 500, transition: "all .15s",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Kembali
        </button>

        <div style={{ width: 1, height: 24, background: "#e5e7eb", flexShrink: 0 }} />

        {/* Title + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Rencana SKP</span>
          {isReviewMode && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6d28d9", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20, padding: "2px 10px" }}>
              Mode Review
            </span>
          )}
        </div>

        {/* Year picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px 5px 12px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Tahun</span>
          <select
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
            style={{
              border: "none", borderRadius: 4,
              background: "transparent", color: "#111827",
              fontSize: 13, fontWeight: 700, padding: "0 2px",
              cursor: "pointer", outline: "none",
            }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Review mode: employee name chip */}
        {isReviewMode && displayNama && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8, padding: "5px 12px" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
              {displayNama.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5b21b6", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayNama}</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {isReviewMode ? (
          /* ── Toolbar: Review Mode (Approver) ── */
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(rencanaStatus?.status === 'signed_pegawai' || rencanaStatus?.status === 'checked') && (
              <button
                onClick={() => setReturnRevisionOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", border: "1.5px solid #fca5a5",
                  borderRadius: 9, background: "#fff5f5", color: "#dc2626",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
                Kembalikan untuk Revisi
              </button>
            )}
            {rencanaStatus?.status === 'signed_pegawai' && (
              <button
                onClick={() => setApproverSignOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 20px", border: "none", borderRadius: 9,
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(217,119,6,.35)",
                  transition: "all .15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Validasi Rencana SKP
              </button>
            )}
            {rencanaStatus?.status === 'checked' && (
              <button
                onClick={() => setApproverSignOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 20px", border: "none", borderRadius: 9,
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(5,150,105,.35)",
                  transition: "all .15s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                Setuju &amp; TTD Rencana SKP
              </button>
            )}
            {rencanaStatus?.status === 'needs_revision' && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Menunggu Revisi dari Pegawai
              </span>
            )}
            {rencanaStatus?.status === 'signed_pihak_kedua' && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Rencana SKP Disetujui
              </span>
            )}
          </div>
        ) : (
          /* ── Toolbar: Normal Mode (Pegawai) ── */
          <>
            {(!rencanaStatus || rencanaStatus.status === 'draft') && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => toast.info("Fitur Banding akan segera tersedia.")}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "1.5px solid #fca5a5", borderRadius: 9, background: "#fff5f5", color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  ⚖️ Ajukan Banding
                </button>
                <button
                  onClick={() => setSignModalOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(217,119,6,.35)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Setuju &amp; Tandatangani
                </button>
              </div>
            )}
            {rencanaStatus?.status === 'signed_pegawai' && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fef9c3", color: "#92400e", border: "1px solid #fde68a" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Menunggu Pengecekan Checker
              </span>
            )}
            {rencanaStatus?.status === 'needs_revision' && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Perlu Revisi
              </span>
            )}
            {rencanaStatus?.status === 'checked' && (
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Menunggu Persetujuan Pejabat
              </span>
            )}
            {rencanaStatus?.status === 'signed_pihak_kedua' && (
              <button
                onClick={() => window.print()}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", border: "none", borderRadius: 9, background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: "0 3px 10px rgba(5,150,105,.35)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                </svg>
                Cetak Rencana SKP
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Review Mode: Approval Timeline + Revision History ── */}
      {isReviewMode && rencanaStatus && (() => {
        const steps = [
          { label: "Diajukan Pegawai", sub: "Tanda tangan pegawai", ts: rencanaStatus.signedAtPegawai, done: !!rencanaStatus.signedAtPegawai, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
          { label: "Dicek Checker", sub: "Validasi atasan langsung", ts: rencanaStatus.checkedAt, done: !!rencanaStatus.checkedAt, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
          { label: "TTD Pihak Kedua", sub: "Persetujuan final", ts: rencanaStatus.signedAtPihakKedua, done: !!rencanaStatus.signedAtPihakKedua, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg> },
        ];
        const doneCount = steps.filter(s => s.done).length;
        const isNeedsRevision = rencanaStatus.status === 'needs_revision';
        const isFinal = rencanaStatus.status === 'signed_pihak_kedua';

        return (
          <div className="no-print" style={{ fontFamily: "sans-serif" }}>

            {/* ── Timeline: satu baris kompak ── */}
            <div style={{ background: "#fff", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 14 }}>

              {/* Kiri: label + badge */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Timeline</div>
                {isFinal && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 20, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, border: "1px solid #bbf7d0" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Selesai
                  </span>
                )}
                {isNeedsRevision && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 20, background: "#fef9c3", color: "#b45309", fontSize: 11, fontWeight: 700, border: "1px solid #fde68a" }}>
                    ⏳ Menunggu Revisi
                  </span>
                )}
                {!isFinal && !isNeedsRevision && (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{doneCount}/{steps.length}</span>
                )}
              </div>

              <div style={{ width: 1, height: 32, background: "#e5e7eb", flexShrink: 0 }} />

              {/* Stepper inline */}
              <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                {steps.map((step, i) => {
                  const isActive = !step.done && doneCount === i;
                  const isRevisionStep = isNeedsRevision && doneCount === i;
                  const circleColor = step.done ? "#059669" : isRevisionStep ? "#dc2626" : isActive ? "#6d28d9" : "#d1d5db";
                  const circleBg   = step.done ? "#059669" : isRevisionStep ? "#fef2f2" : isActive ? "#ede9fe" : "#f9fafb";
                  const lineColor  = step.done ? "#059669" : "#e5e7eb";
                  const labelColor = step.done ? "#065f46" : isRevisionStep ? "#b91c1c" : isActive ? "#5b21b6" : "#9ca3af";

                  return (
                    <React.Fragment key={step.label}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: circleBg, border: `2px solid ${circleColor}`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          boxShadow: step.done ? "0 0 0 3px rgba(5,150,105,.1)" : isRevisionStep ? "0 0 0 3px rgba(220,38,38,.1)" : "none",
                        }}>
                          {step.done ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : isRevisionStep ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
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
                      {i < steps.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: lineColor, borderRadius: 2, margin: "0 8px" }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* ── Revision History ── */}
            {revisionLogs.length > 0 && (
              <div style={{ background: "#fff8f8", borderTop: "1px solid #fecaca", padding: "16px 32px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, maxWidth: 680, margin: "0 auto 14px" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#991b1b" }}>Riwayat Revisi</h4>
                    <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{revisionLogs.length} kali dikembalikan</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 680, margin: "0 auto" }}>
                  {revisionLogs.map((log, idx) => (
                    <div key={log.id} style={{ display: "flex", gap: 14, position: "relative" }}>
                      {/* Timeline dot */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: log.resubmittedAt ? "#dcfce7" : "#fee2e2", border: `2px solid ${log.resubmittedAt ? "#86efac" : "#fca5a5"}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={log.resubmittedAt ? "#16a34a" : "#dc2626"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {log.resubmittedAt
                              ? <polyline points="20 6 9 17 4 12"/>
                              : <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></>}
                          </svg>
                        </div>
                        {idx < revisionLogs.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: "#f3f4f6", minHeight: 16, margin: "4px 0" }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, paddingBottom: idx < revisionLogs.length - 1 ? 20 : 0 }}>
                        <div style={{ background: log.resubmittedAt ? "#f0fdf4" : "#fff5f5", border: `1px solid ${log.resubmittedAt ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: log.reason ? 8 : 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: log.resubmittedAt ? "#15803d" : "#dc2626" }}>
                              {log.resubmittedAt ? "Sudah Diajukan Kembali" : "Dikembalikan untuk Revisi"}
                            </span>
                            <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                              {new Date(log.revisedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          {log.reason && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: log.note ? 6 : 0 }}>
                              <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>Alasan:</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", background: "#fee2e2", borderRadius: 6, padding: "1px 8px" }}>{log.reason}</span>
                            </div>
                          )}
                          {log.note && (
                            <p style={{ margin: 0, fontSize: 12, color: "#4b5563", borderLeft: "3px solid #fca5a5", paddingLeft: 8, fontStyle: "italic" }}>"{log.note}"</p>
                          )}
                          {log.resubmittedAt && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #bbf7d0", fontSize: 11, color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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

      {loading ? (
        <div className="no-print" style={{ textAlign: "center", padding: 80, color: "#6b7280", fontSize: 15, fontFamily: "sans-serif" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          Memuat data rencana SKP...
        </div>
      ) : (
        <div className="doc-canvas">
          {/* ════════════════════════════════════════════════
              HALAMAN 1 — COVER / SURAT PERJANJIAN KINERJA
          ════════════════════════════════════════════════ */}
          <div className="cetak-page" style={{ textAlign: "center" }}>
            {/* Logo */}
            <div style={{ marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-upnvj.png"
                alt="Logo UPNVJ"
                style={{ height: 80, objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>

            {/* Judul */}
            <div style={{ fontWeight: "bold", fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>
              <div>Perjanjian Kinerja Tahun {tahun}</div>
              <div>{displayJabatan}</div>
              <div>dengan</div>
              <div>{dekan?.jabatan ?? 'Dekan'}</div>
              <div>{INSTITUSI}</div>
            </div>

            {/* Body */}
            <div style={{ textAlign: "justify", fontSize: 12, lineHeight: 1.9, marginBottom: 22 }}>
              Dalam rangka mewujudkan manajemen pemerintahan yang efektif, transparan dan
              akuntabel serta berorientasi pada hasil, kami yang bertanda tangan di bawah ini:
            </div>

            {/* Pihak Pertama */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, textAlign: "left" }}>
              <tbody>
                <tr>
                  <td style={{ width: 90, fontSize: 12, paddingBottom: 3, verticalAlign: "top" }}>Nama</td>
                  <td style={{ width: 14, fontSize: 12, paddingBottom: 3, verticalAlign: "top" }}>:</td>
                  <td style={{ fontSize: 12, paddingBottom: 3 }}>{displayNama}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, verticalAlign: "top" }}>Jabatan</td>
                  <td style={{ fontSize: 12, verticalAlign: "top" }}>:</td>
                  <td style={{ fontSize: 12, verticalAlign: "top", lineHeight: 1.5 }}>{displayJabatan}<br />{INSTITUSI}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ textAlign: "left", fontSize: 12, marginBottom: 20 }}>
              selanjutnya disebut <strong>PIHAK PERTAMA</strong>
            </div>

            {/* Pihak Kedua */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, textAlign: "left" }}>
              <tbody>
                <tr>
                  <td style={{ width: 90, fontSize: 12, paddingBottom: 3, verticalAlign: "top" }}>Nama</td>
                  <td style={{ width: 14, fontSize: 12, paddingBottom: 3, verticalAlign: "top" }}>:</td>
                  <td style={{ fontSize: 12, paddingBottom: 3 }}>{atasanNama}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, verticalAlign: "top" }}>Jabatan</td>
                  <td style={{ fontSize: 12, verticalAlign: "top" }}>:</td>
                  <td style={{ fontSize: 12, verticalAlign: "top", lineHeight: 1.5 }}>
                    {dekan?.jabatan ?? 'Dekan'}<br />{INSTITUSI}
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ textAlign: "left", fontSize: 12, marginBottom: 22 }}>
              selaku atasan pihak pertama, selanjutnya disebut <strong>PIHAK KEDUA</strong>
            </div>

            {/* Paragraf */}
            <div style={{ textAlign: "justify", fontSize: 12, lineHeight: 1.9, marginBottom: 14 }}>
              PIHAK PERTAMA berjanji akan mewujudkan target kinerja sesuai lampiran yang
              merupakan bagian tidak terpisahkan perjanjian ini, dalam rangka mencapai target
              kinerja jangka pendek seperti yang telah ditetapkan dalam dokumen perencanaan.
              Keberhasilan dan kegagalan pencapaian target kinerja tersebut menjadi tanggung
              jawab pihak pertama.
            </div>
            <div style={{ textAlign: "justify", fontSize: 12, lineHeight: 1.9, marginBottom: 32 }}>
              PIHAK KEDUA akan melakukan supervisi yang diperlukan serta melakukan evaluasi
              terhadap capaian kinerja dari perjanjian ini dan mengambil tindakan yang diperlukan
              dalam rangka pemberian penghargaan dan sanksi.
            </div>

            <SignatureRow
              leftLabel="Pihak Kedua"
              leftName={atasanNama}
              leftSig={rencanaStatus?.signaturePihakKedua}
              rightDate={tanggalTtd}
              rightLabel="Pihak Pertama"
              rightName={displayNama}
              rightSig={rencanaStatus?.signaturePegawai}
            />
          </div>

          {/* ════════════════════════════════════════════════
              LAMPIRAN 1 — IKU PTN
          ════════════════════════════════════════════════ */}
          {ikuRows.length > 0 && (
            <div className="cetak-page">
              <PageHeader
                lampiran="Lampiran 1"
                title="PERJANJIAN KINERJA IKU PTN"
                jabatan={displayJabatan}
                atasanJabatan={atasanJabatanUpper}
                tahun={tahun}
                spDipa={spDipa}
              />

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 32 }}>No.</th>
                    <th style={{ ...th, width: "28%" }}>Sasaran Program</th>
                    <th style={th}>Indikator Kinerja Utama</th>
                    <th style={{ ...th, width: 56 }}>Target</th>
                    <th style={{ ...th, width: 70 }}>Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const gCount = new Map<number, number>();
                    const gFirst = new Map<number, number>();
                    ikuRows.forEach((r, i) => {
                      gCount.set(r.groupIdx, (gCount.get(r.groupIdx) ?? 0) + 1);
                      if (!gFirst.has(r.groupIdx)) gFirst.set(r.groupIdx, i);
                    });
                    return ikuRows.map((row, ri) => {
                      const isFirst = gFirst.get(row.groupIdx) === ri;
                      const gSpan = gCount.get(row.groupIdx) ?? 1;
                      const noCell = isFirst ? <td rowSpan={gSpan > 1 ? gSpan : undefined} style={cellC}>{row.groupKode}</td> : null;
                      const sasaranCell = isFirst ? <td rowSpan={gSpan > 1 ? gSpan : undefined} style={cell}>{row.sasaran}</td> : null;
                      if (row.kind === "sub-header") {
                        return (
                          <tr key={ri}>
                            {noCell}{sasaranCell}
                            <td style={{ ...cell, fontWeight: "bold", fontStyle: "italic" }}>{row.ikuLabel}</td>
                            <td style={cellC} /><td style={cellC} />
                          </tr>
                        );
                      }
                      if (row.kind === "entry") {
                        return (
                          <tr key={ri}>
                            {noCell}{sasaranCell}
                            <td style={cell}>{row.ikuLabel}</td>
                            <td style={cellC}>{row.target}</td>
                            <td style={cellC}>{row.satuan}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={ri}>
                          {noCell}{sasaranCell}
                          <td style={{ ...cell, paddingLeft: 14 }}>{row.ikuLabel}</td>
                          <td style={cellC}>{row.target}</td>
                          <td style={cellC}>{row.satuan}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              <SignatureRow
                leftLabel={dekan?.jabatan ?? 'Dekan'}
                leftName={atasanNama}
                leftSig={rencanaStatus?.signaturePihakKedua}
                rightDate={tanggalTtd}
                rightLabel={displayJabatan}
                rightName={displayNama}
                rightSig={rencanaStatus?.signaturePegawai}
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════
              LAMPIRAN 2 — PK (Perjanjian Kinerja Kegiatan)
          ════════════════════════════════════════════════ */}
          {pkRows.length > 0 && (
            <div className="cetak-page">
              <PageHeader
                lampiran="Lampiran 2"
                title="PERJANJIAN KINERJA"
                jabatan={displayJabatan}
                atasanJabatan={atasanJabatanUpper}
                tahun={tahun}
                spDipa={spDipa}
              />

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 28 }}>No.</th>
                    <th style={{ ...th, width: "28%" }}>Sasaran Program</th>
                    <th style={th}>Indikator Kinerja Kegiatan</th>
                    <th style={{ ...th, width: 56 }}>Target</th>
                    <th style={{ ...th, width: 70 }}>Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const gCount = new Map<number, number>();
                    const gFirst = new Map<number, number>();
                    pkRows.forEach((r, i) => {
                      gCount.set(r.groupIdx, (gCount.get(r.groupIdx) ?? 0) + 1);
                      if (!gFirst.has(r.groupIdx)) gFirst.set(r.groupIdx, i);
                    });
                    return pkRows.map((row, ri) => {
                      const isFirst = gFirst.get(row.groupIdx) === ri;
                      const gSpan = gCount.get(row.groupIdx) ?? 1;
                      const noCell = isFirst ? <td rowSpan={gSpan > 1 ? gSpan : undefined} style={cellC}>{row.groupKode}</td> : null;
                      const sasaranCell = isFirst ? <td rowSpan={gSpan > 1 ? gSpan : undefined} style={cell}>{row.sasaran}</td> : null;
                      if (row.kind === "sub-header") {
                        return (
                          <tr key={ri}>
                            {noCell}{sasaranCell}
                            <td style={{ ...cell, fontWeight: "bold", fontStyle: "italic" }}>{row.ikuLabel}</td>
                            <td style={cellC} /><td style={cellC} />
                          </tr>
                        );
                      }
                      if (row.kind === "entry") {
                        return (
                          <tr key={ri}>
                            {noCell}{sasaranCell}
                            <td style={cell}>{row.ikuLabel}</td>
                            <td style={cellC}>{row.target}</td>
                            <td style={cellC}>{row.satuan}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={ri}>
                          {noCell}{sasaranCell}
                          <td style={{ ...cell, paddingLeft: 14 }}>{row.ikuLabel}</td>
                          <td style={cellC}>{row.target}</td>
                          <td style={cellC}>{row.satuan}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              <SignatureRow
                leftLabel={dekan?.jabatan ?? 'Dekan'}
                leftName={atasanNama}
                leftSig={rencanaStatus?.signaturePihakKedua}
                rightDate={tanggalTtd}
                rightLabel={displayJabatan}
                rightName={displayNama}
                rightSig={rencanaStatus?.signaturePegawai}
              />
            </div>
          )}

          {ikuRows.length === 0 && pkRows.length === 0 && (
            <div className="no-print cetak-page" style={{ textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 14 }}>
              Belum ada data target yang didisposisikan kepada Anda untuk tahun {tahun}.
            </div>
          )}
        </div>
      )}

      {/* ── Modal Kembalikan untuk Revisi (Approver) ── */}
      {returnRevisionOpen && (
        <div
          className="no-print"
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setReturnRevisionOpen(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>Kembalikan untuk Revisi</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Rencana SKP {displayNama} — {tahun}</p>
              </div>
              <button onClick={() => setReturnRevisionOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Alasan Pengembalian *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, color: "#1f2937", background: "#fff", outline: "none" }}
                >
                  <option value="">— Pilih alasan —</option>
                  <option value="Indikator kurang jelas">Indikator kurang jelas</option>
                  <option value="Target tidak realistis">Target tidak realistis</option>
                  <option value="Dokumen tidak lengkap">Dokumen tidak lengkap</option>
                  <option value="Data tidak akurat">Data tidak akurat</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Catatan Tambahan (opsional)</label>
                <textarea
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  rows={4}
                  placeholder="Tulis catatan atau instruksi perbaikan..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, color: "#1f2937", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "0 24px 20px" }}>
              <button onClick={() => setReturnRevisionOpen(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
                Batal
              </button>
              <button
                disabled={!returnReason || returnSaving}
                onClick={async () => {
                  if (!reviewUserId || !token) return;
                  setReturnSaving(true);
                  try {
                    const updated = await returnRencanaSKPForRevision(reviewUserId, tahun, returnReason, returnNote || null, token);
                    setRencanaStatus(updated);
                    setReturnRevisionOpen(false);
                    setReturnReason('');
                    setReturnNote('');
                    const logs = await getRencanaSKPRevisionLogs(reviewUserId, tahun, token);
                    setRevisionLogs(logs);
                    toast.success('Rencana SKP dikembalikan untuk revisi.');
                  } catch {
                    toast.error('Gagal mengembalikan dokumen.');
                  } finally {
                    setReturnSaving(false);
                  }
                }}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: returnReason && !returnSaving ? "#dc2626" : "#9ca3af", color: "white", fontWeight: 600, fontSize: 13, cursor: returnReason && !returnSaving ? "pointer" : "not-allowed" }}
              >
                {returnSaving ? "Menyimpan…" : "↩ Kembalikan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Tanda Tangan Approver (Checker / Pihak Kedua) ── */}
      {approverSignOpen && (
        <div
          className="no-print"
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setApproverSignOpen(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>
                  {rencanaStatus?.status === 'signed_pegawai' ? 'Validasi Rencana SKP' : 'TTD Persetujuan Rencana SKP'}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                  {rencanaStatus?.status === 'signed_pegawai' ? 'Validasi sebagai Checker untuk' : 'Tandatangani sebagai Pihak Kedua untuk'} {displayNama} — {tahun}
                </p>
              </div>
              <button onClick={() => setApproverSignOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ padding: "16px 24px" }}>
              <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                Tanda tangan Anda akan disimpan di dokumen Rencana SKP {displayNama}.
              </div>
              <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", cursor: "crosshair" }}>
                <canvas
                  ref={approverSignCanvasRef}
                  width={432}
                  height={140}
                  style={{ display: "block", width: "100%", touchAction: "none" }}
                  onMouseDown={approverSignHandlers.onMouseDown}
                  onMouseMove={approverSignHandlers.onMouseMove}
                  onMouseUp={approverSignHandlers.onMouseUp}
                  onMouseLeave={approverSignHandlers.onMouseUp}
                  onTouchStart={approverSignHandlers.onTouchStart}
                  onTouchMove={approverSignHandlers.onTouchMove}
                  onTouchEnd={approverSignHandlers.onTouchEnd}
                />
                {!approverSignHasDrawn && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 13, pointerEvents: "none" }}>
                    Tanda tangan di sini
                  </div>
                )}
              </div>
              {approverSignHasDrawn && (
                <button onClick={approverSignHandlers.clear} style={{ marginTop: 8, padding: "4px 12px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
                  Ulangi
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "0 24px 20px" }}>
              <button onClick={() => setApproverSignOpen(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
                Batal
              </button>
              <button
                onClick={handleApproverSignConfirm}
                disabled={approverSignSaving}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: rencanaStatus?.status === 'signed_pegawai' ? "#d97706" : "#059669", color: "white", fontWeight: 600, fontSize: 13, cursor: approverSignSaving ? "not-allowed" : "pointer", opacity: approverSignSaving ? 0.7 : 1 }}
              >
                {approverSignSaving ? "Menyimpan…" : rencanaStatus?.status === 'signed_pegawai' ? "Simpan Validasi" : "Simpan TTD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Tanda Tangan Pegawai ── */}
      {signModalOpen && (
        <div
          className="no-print"
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSignModalOpen(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>Tanda Tangan Rencana SKP</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Tanda tangan sebagai Pihak Pertama untuk tahun {tahun}</p>
              </div>
              <button onClick={() => setSignModalOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ padding: "16px 24px" }}>
              <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                Dengan menandatangani, Anda menyetujui Rencana SKP tahun {tahun}. Tanda tangan akan tampil di dokumen cetak setelah divalidasi atasan.
              </div>
              <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", cursor: "crosshair" }}>
                <canvas
                  ref={signCanvasRef}
                  width={432}
                  height={140}
                  style={{ display: "block", width: "100%", touchAction: "none" }}
                  onMouseDown={signHandlers.onMouseDown}
                  onMouseMove={signHandlers.onMouseMove}
                  onMouseUp={signHandlers.onMouseUp}
                  onMouseLeave={signHandlers.onMouseUp}
                  onTouchStart={signHandlers.onTouchStart}
                  onTouchMove={signHandlers.onTouchMove}
                  onTouchEnd={signHandlers.onTouchEnd}
                />
                {!signHasDrawn && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 13, pointerEvents: "none" }}>
                    Tanda tangan di sini
                  </div>
                )}
              </div>
              {signHasDrawn && (
                <button onClick={signHandlers.clear} style={{ marginTop: 8, padding: "4px 12px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
                  Ulangi
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "0 24px 20px" }}>
              <button onClick={() => setSignModalOpen(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
                Batal
              </button>
              <button
                onClick={handleSignConfirm}
                disabled={setujuSaving}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#f59e0b", color: "white", fontWeight: 600, fontSize: 13, cursor: setujuSaving ? "not-allowed" : "pointer", opacity: setujuSaving ? 0.7 : 1 }}
              >
                {setujuSaving ? "Menyimpan…" : "Setujui & Simpan TTD"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
