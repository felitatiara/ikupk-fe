"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import {
  getIndikatorGroupedForUser,
  getSkpBawahan,
  approveBawahanSkp,
  getMySkpStatus,
  getAllRealisasiFiles,
  getAvailableYears,
  getSkpCheckerBawahan,
  checkRencanaSKPChecker,
  signRencanaSKPPihakKedua,
  validasiRencanaSKPAtasan,
  getSkpRencanaStatus,
  getUserRoles,
  type SkpBawahanRow,
  type MySkpStatus,
  type SkpCheckerUser,
} from "@/lib/api";
import { toast } from "sonner";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface IndikatorNode {
  id: number;
  kode: string;
  nama: string;
  satuan?: string;
  disposisiJumlah?: number | null;
  realisasiJumlah?: number | null;
  children?: IndikatorNode[];
}
interface IndikatorGroup {
  id: number;
  nama: string;
  subIndikators: IndikatorNode[];
}

interface SKPRow {
  id: number;
  no: number;
  kodeIndikator: string;
  namaIndikator: string;
  sasaranStrategis: string;
  targetKuantitas: number | null;
  realisasiKuantitas: number | null;
  capaianPersen: number | null;
}

interface FileEntry {
  name: string;
  preview_url: string;
  download_url: string;
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function mergeGroupedData(primary: IndikatorGroup[], secondary: IndikatorGroup[]): IndikatorGroup[] {
  const primaryIds = new Set(primary.map(g => g.id));
  return [
    ...primary,
    ...secondary.filter(g => {
      if (primaryIds.has(g.id)) return false;
      return g.subIndikators.some(sub =>
        (sub.disposisiJumlah ?? 0) > 0 ||
        (sub.children ?? []).some(c =>
          (c.disposisiJumlah ?? 0) > 0 ||
          (c.children ?? []).some(gc => (gc.disposisiJumlah ?? 0) > 0)
        )
      );
    }),
  ];
}

function nilaiCapaian(persen: number | null): { nilai: string; predikat: string; color: string } {
  if (persen === null) return { nilai: "—", predikat: "Belum ada data", color: "#6b7280" };
  if (persen >= 100) return { nilai: persen.toFixed(1), predikat: "Sangat Baik", color: "#16a34a" };
  if (persen >= 76) return { nilai: persen.toFixed(1), predikat: "Baik", color: "#2563eb" };
  if (persen >= 51) return { nilai: persen.toFixed(1), predikat: "Cukup", color: "#d97706" };
  return { nilai: persen.toFixed(1), predikat: "Kurang", color: "#dc2626" };
}

function skpStatusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    pending:           { label: "Menunggu Validasi",      bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
    validated_atasan:  { label: "Divalidasi Atasan",      bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
    validated_wd2:     { label: "Validasi Final WD2",     bg: "#f5f3ff", color: "#6d28d9", border: "#c4b5fd" },
    approved:          { label: "Disetujui Dekan",        bg: "#dcfce7", color: "#166534", border: "#86efac" },
    rejected:          { label: "Ditolak",                bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  };
  const s = map[status] ?? { label: status, bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function SKPContent() {
  const { user, token } = useAuth();
  const router = useRouter();
  const roleLevel = user?.roleLevel ?? 4;
  const isDosen = roleLevel >= 4;
  const isDekan = user?.role?.toLowerCase() === 'dekan' && roleLevel <= 1;
  const [tahun, setTahun] = useState("2026");
  const [availableYears, setAvailableYears] = useState<string[]>(["2025", "2026", "2027"]);

  // Own SKP
  const [rows, setRows] = useState<SKPRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dosen: own SKP approval status
  const [mySkpStatus, setMySkpStatus] = useState<MySkpStatus | null>(null);

  // Dekan: bawahan list
  const [bawahanList, setBawahanList] = useState<SkpBawahanRow[]>([]);
  const [bawahanLoading, setBawahanLoading] = useState(false);

  // Dekan: single approval modal
  const [selectedBawahan, setSelectedBawahan] = useState<SkpBawahanRow | null>(null);
  const [approving, setApproving] = useState(false);

  // Dekan: bulk selection
  const [selectedForBulk, setSelectedForBulk] = useState<Set<number>>(new Set());
  const [bulkSigOpen, setBulkSigOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const bulkSigCanvasRef = useRef<HTMLCanvasElement>(null);
  const bulkSigIsDrawing = useRef(false);
  const [bulkSigHasDrawn, setBulkSigHasDrawn] = useState(false);

  // Atasan checker: bawahan berdasarkan konfigurasi penilai
  const [checkerBawahan, setCheckerBawahan] = useState<{ checkerBawahan: SkpCheckerUser[]; rencanaSKPBawahan: SkpCheckerUser[]; ekpBawahan: SkpCheckerUser[] }>({ checkerBawahan: [], rencanaSKPBawahan: [], ekpBawahan: [] });
  const [checkerLoading, setCheckerLoading] = useState(false);


  // Modal TTD Pihak Kedua — dari checker, untuk menyetujui rencana SKP bawahan
  const [pkSignModal, setPkSignModal] = useState<{ open: boolean; target: SkpCheckerUser | null }>({ open: false, target: null });
  const pkSignCanvasRef = useRef<HTMLCanvasElement>(null);
  const pkSignIsDrawing = useRef(false);
  const [pkSignHasDrawn, setPkSignHasDrawn] = useState(false);
  const [pkSignSaving, setPkSignSaving] = useState(false);

  // Bulk TTD Rencana SKP
  const [rencanaSelected, setRencanaSelected] = useState<Set<number>>(new Set());
  const [bulkRencanaSignModal, setBulkRencanaSignModal] = useState(false);
  const bulkRencanaCanvasRef = useRef<HTMLCanvasElement>(null);
  const bulkRencanaIsDrawing = useRef(false);
  const [bulkRencanaHasDrawn, setBulkRencanaHasDrawn] = useState(false);
  const [bulkRencanaSaving, setBulkRencanaSaving] = useState(false);

  // File view in detail modal
  const [viewingFilesForId, setViewingFilesForId] = useState<number | null>(null);
  const [viewFiles, setViewFiles] = useState<FileEntry[]>([]);
  const [viewFilesLoading, setViewFilesLoading] = useState(false);

  // Signature pad (single approval)
  const [sigStep, setSigStep] = useState<'review' | 'sign'>('review');
  const [sigHasDrawn, setSigHasDrawn] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigIsDrawing = useRef(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cy = new Date().getFullYear();
    getAvailableYears().then(dbYears => {
      const merged = [...new Set([...dbYears, String(cy - 1), String(cy), String(cy + 1)])].sort();
      setAvailableYears(merged);
      if (!merged.includes("2026")) setTahun(merged[merged.length - 1]);
    }).catch(() => {
      setAvailableYears([String(cy - 1), String(cy), String(cy + 1)]);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchOwnSKP();
    if (isDosen) fetchMySkpStatus();
    if (isDekan) fetchBawahanSKP();
    fetchCheckerBawahan();
  }, [user, tahun]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOwnSKP() {
    setLoading(true);
    try {
      const allUserRoles = (user?.roles as Array<{ id: number; level: number; isPrimary: boolean }> | undefined) ?? [];
      const primaryRoleLevel = (user as any)?.roleLevel ?? allUserRoles.find(r => r.isPrimary)?.level ?? 4;
      const roleId: number = user?.roleId
        ?? allUserRoles.find((r: { id: number; isPrimary: boolean }) => r.isPrimary)?.id
        ?? allUserRoles[0]?.id
        ?? 0;
      const secondaryDosenRole = primaryRoleLevel < 4
        ? allUserRoles.find(r => r.level >= 4 && !r.isPrimary)
        : undefined;

      const [ikuData, pkData] = await Promise.all([
        getIndikatorGroupedForUser("IKU", tahun, user!.id, roleId),
        getIndikatorGroupedForUser("PK", tahun, user!.id, roleId),
      ]);

      let allIku = ikuData as unknown as IndikatorGroup[];
      let allPk = pkData as unknown as IndikatorGroup[];

      if (secondaryDosenRole) {
        const [secIku, secPk] = await Promise.all([
          getIndikatorGroupedForUser("IKU", tahun, user!.id, secondaryDosenRole.id),
          getIndikatorGroupedForUser("PK", tahun, user!.id, secondaryDosenRole.id),
        ]);
        allIku = mergeGroupedData(allIku, secIku as unknown as IndikatorGroup[]);
        allPk = mergeGroupedData(allPk, secPk as unknown as IndikatorGroup[]);
      }

      const allData = [...allIku, ...allPk];
      const newRows: SKPRow[] = [];
      let no = 1;

      function pushRow(item: IndikatorNode, sasaran: string) {
        const target = item.disposisiJumlah ?? null;
        const realisasi = item.realisasiJumlah ?? null;
        const capaian =
          target !== null && target > 0 && realisasi !== null
            ? Math.min((realisasi / target) * 100, 100)
            : null;
        newRows.push({
          id: item.id,
          no: no++,
          kodeIndikator: item.kode,
          namaIndikator: item.nama,
          sasaranStrategis: sasaran,
          targetKuantitas: target,
          realisasiKuantitas: realisasi,
          capaianPersen: capaian,
        });
      }

      for (const group of allData as IndikatorGroup[]) {
        for (const sub of group.subIndikators) {
          const children = sub.children ?? [];
          if (children.length === 0) {
            pushRow(sub, group.nama);
          } else {
            for (const child of children) {
              const grandchildren = child.children ?? [];
              if (grandchildren.length === 0) {
                pushRow(child, group.nama);
              } else {
                for (const gc of grandchildren) {
                  pushRow(gc, group.nama);
                }
              }
            }
          }
        }
      }
      setRows(newRows);
    } catch (err) {
      console.error("Failed to fetch SKP:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMySkpStatus() {
    try {
      const data = await getMySkpStatus(user!.id, tahun);
      setMySkpStatus(data);
    } catch (err) {
      console.error("Failed to fetch my SKP status:", err);
    }
  }

  async function fetchBawahanSKP() {
    setBawahanLoading(true);
    try {
      const data = await getSkpBawahan(user!.id, tahun, true);
      setBawahanList(data);
    } catch (err) {
      console.error("Failed to fetch bawahan SKP:", err);
    } finally {
      setBawahanLoading(false);
    }
  }

  async function fetchCheckerBawahan() {
    if (!user?.id) return;
    setCheckerLoading(true);
    try {
      const data = await getSkpCheckerBawahan(user!.id, tahun);
      setCheckerBawahan(data);
    } catch (err) {
      console.error("Failed to fetch checker bawahan:", err);
    } finally {
      setCheckerLoading(false);
    }
  }

  // ── Signature pad helpers (single) ──
  useEffect(() => {
    if (sigStep !== 'sign') return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setSigHasDrawn(false);
  }, [sigStep]);

  // ── Signature pad helpers (bulk) ──
  useEffect(() => {
    if (!bulkSigOpen) return;
    const canvas = bulkSigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setBulkSigHasDrawn(false);
  }, [bulkSigOpen]);

  // ── Bulk rencana sign canvas init ──
  useEffect(() => {
    if (!bulkRencanaSignModal) return;
    const canvas = bulkRencanaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setBulkRencanaHasDrawn(false);
  }, [bulkRencanaSignModal]);

  // ── PK sign canvas init ──
  useEffect(() => {
    if (!pkSignModal.open) return;
    const canvas = pkSignCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setPkSignHasDrawn(false);
  }, [pkSignModal.open]);

  function getSigPos(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  }

  function sigMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    sigIsDrawing.current = true;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigPos(canvas, e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function sigMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!sigIsDrawing.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigPos(canvas, e.clientX, e.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
    setSigHasDrawn(true);
  }

  function sigMouseUp() { sigIsDrawing.current = false; }

  function sigTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const touch = e.touches[0];
    const { x, y } = getSigPos(canvas, touch.clientX, touch.clientY);
    sigIsDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function sigTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!sigIsDrawing.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const touch = e.touches[0];
    const { x, y } = getSigPos(canvas, touch.clientX, touch.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
    setSigHasDrawn(true);
  }

  function clearSig() {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSigHasDrawn(false);
  }

  // Bulk sig draw handlers
  function bulkSigMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    bulkSigIsDrawing.current = true;
    const canvas = bulkSigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigPos(canvas, e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function bulkSigMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!bulkSigIsDrawing.current) return;
    const canvas = bulkSigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigPos(canvas, e.clientX, e.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
    setBulkSigHasDrawn(true);
  }

  function bulkSigMouseUp() { bulkSigIsDrawing.current = false; }

  function bulkSigTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = bulkSigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const touch = e.touches[0];
    const { x, y } = getSigPos(canvas, touch.clientX, touch.clientY);
    bulkSigIsDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function bulkSigTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!bulkSigIsDrawing.current) return;
    const canvas = bulkSigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const touch = e.touches[0];
    const { x, y } = getSigPos(canvas, touch.clientX, touch.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
    setBulkSigHasDrawn(true);
  }

  function clearBulkSig() {
    const canvas = bulkSigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setBulkSigHasDrawn(false);
  }

  function closeModal() {
    setSelectedBawahan(null);
    setSigStep('review');
    setSigHasDrawn(false);
    setViewingFilesForId(null);
    setViewFiles([]);
  }

  function closeBulkSig() {
    setBulkSigOpen(false);
    setBulkSigHasDrawn(false);
  }

  async function confirmApprove() {
    if (!sigCanvasRef.current || !selectedBawahan) return;
    const sigDataUrl = sigHasDrawn ? sigCanvasRef.current.toDataURL('image/png') : undefined;
    await handleApprove("approved", sigDataUrl);
  }

  async function confirmBulkApprove() {
    if (!bulkSigCanvasRef.current) return;
    const sigDataUrl = bulkSigHasDrawn ? bulkSigCanvasRef.current.toDataURL('image/png') : undefined;
    setBulkApproving(true);
    try {
      const targets = bawahanList.filter(b => selectedForBulk.has(b.userId));
      await Promise.all(targets.map(b => approveBawahanSkp(b.userId, 'approved', tahun)));
      toast.success(`${targets.length} SKP berhasil disetujui.`);
      generateBulkSuratSKP(targets, sigDataUrl);
      setSelectedForBulk(new Set());
      closeBulkSig();
      fetchBawahanSKP();
    } catch {
      toast.error("Gagal memproses persetujuan massal.");
    } finally {
      setBulkApproving(false);
    }
  }

  async function loadFilesForIndikator(indikatorId: number, bawahanEmail: string) {
    if (!token) return;
    setViewingFilesForId(indikatorId);
    setViewFilesLoading(true);
    setViewFiles([]);
    try {
      const result = await getAllRealisasiFiles(indikatorId, token);
      const filtered = result.files.filter(f => {
        const email = f.ownerEmail || f.owner?.email || '';
        return email === bawahanEmail;
      });
      setViewFiles(filtered.map(f => ({ name: f.name, preview_url: f.preview_url, download_url: f.download_url })));
    } catch {
      setViewFiles([]);
    } finally {
      setViewFilesLoading(false);
    }
  }

  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  function buildLetterBody(opts: {
    subjekNama: string;
    realisasiItems: { namaIndikator: string; realisasiAngka: number }[];
    signerNama: string;
    signerNip: string | null;
    sigDataUrl?: string;
    isLast?: boolean;
  }): string {
    const indikatorLines = opts.realisasiItems
      .map((r) => `<p style="margin:0 0 6px;line-height:1.8;color:#1a237e;">Dinyatakan bahwa <em>${r.namaIndikator}</em> dengan target <strong>${r.realisasiAngka}</strong> terpenuhi</p>`)
      .join("");
    const sigImg = opts.sigDataUrl
      ? `<img src="${opts.sigDataUrl}" style="max-height:56pt;max-width:180pt;display:block;margin:4pt auto;" />`
      : `<div style="height:56pt;"></div>`;
    const pageBreak = opts.isLast ? "" : `<div style="page-break-after:always;"></div>`;
    return `
  <div class="wrap">
    <p style="margin:0 0 8pt;font-size:11pt;color:#555;font-style:italic;">SKP — ${opts.subjekNama}</p>
    <div class="recipient">
      <p>Yth. Dekan</p>
      <p>Fakultas Ilmu Komputer</p>
      <p>Universitas Pembangunan Nasional &ldquo;Veteran&rdquo; Jakarta</p>
    </div>
    <div class="body">
      ${indikatorLines}
      <p class="closing" style="margin-top:12pt;">Demikian permohonan ini disampaikan, atas perhatian dan kerja samanya diucapkan terima kasih.</p>
    </div>
    <div class="signature-area">
      <div class="sig-box">
        <p class="sig-date">Jakarta, ${tanggalCetak}</p>
        ${sigImg}
        <p class="sig-name">${opts.signerNama}</p>
        <p class="sig-nip">NIP. ${opts.signerNip ?? "—"}</p>
      </div>
    </div>
  </div>
  ${pageBreak}`;
  }

  function downloadHtml(html: string, filename: string) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function wrapLetters(bodies: string[], title: string): string {
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 40mm 30mm 30mm 30mm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; margin: 0; }
    .wrap { padding: 0 0 32pt; }
    .recipient { margin-bottom: 36pt; }
    .recipient p { margin: 0; line-height: 1.7; color: #1a237e; font-weight: bold; }
    .body { margin-bottom: 36pt; }
    .body p { margin: 0 0 8pt; line-height: 1.8; text-align: justify; }
    .signature-area { display: flex; justify-content: flex-end; margin-top: 48pt; }
    .sig-box { text-align: center; min-width: 200pt; }
    .sig-date { margin: 0 0 4pt; font-style: italic; color: #555; }
    .sig-name { margin: 0; font-weight: bold; }
    .sig-nip { margin: 0; font-size: 11pt; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${bodies.join("")}</body>
</html>`;
  }

  function generateSuratSKP(bawahan: SkpBawahanRow, sigDataUrl?: string) {
    const body = buildLetterBody({
      subjekNama: bawahan.nama,
      realisasiItems: bawahan.realisasi,
      signerNama: user?.nama ?? "—",
      signerNip: user?.nip ?? null,
      sigDataUrl,
      isLast: true,
    });
    const html = wrapLetters([body], `SKP — ${bawahan.nama}`);
    const safeName = bawahan.nama.replace(/[^a-zA-Z0-9]/g, "_");
    downloadHtml(html, `SKP_${safeName}_${tahun}.html`);
  }

  function generateSuratSKPDosen() {
    if (!mySkpStatus) return;
    const nama = user?.nama ?? "—";
    const body = buildLetterBody({
      subjekNama: nama,
      realisasiItems: mySkpStatus.realisasi,
      signerNama: mySkpStatus.atasan?.nama ?? "—",
      signerNip: mySkpStatus.atasan?.nip ?? null,
      isLast: true,
    });
    const html = wrapLetters([body], `SKP — ${nama}`);
    const safeName = nama.replace(/[^a-zA-Z0-9]/g, "_");
    downloadHtml(html, `SKP_${safeName}_${tahun}.html`);
  }

  function generateBulkSuratSKP(targets: SkpBawahanRow[], sigDataUrl?: string) {
    const bodies = targets.map((b, i) =>
      buildLetterBody({
        subjekNama: b.nama,
        realisasiItems: b.realisasi,
        signerNama: user?.nama ?? "—",
        signerNip: user?.nip ?? null,
        sigDataUrl,
        isLast: i === targets.length - 1,
      })
    );
    const html = wrapLetters(bodies, `SKP Massal — ${tahun}`);
    downloadHtml(html, `SKP_Massal_${tahun}.html`);
  }

  function generateRencanaSKP() {
    const nama = user?.nama ?? "—";
    const nip = user?.nip ?? "—";
    const jabatan = [...(user?.roles ?? [])].sort((a, b) => a.level - b.level)[0]?.name ?? user?.role ?? "—";
    const unitKerja = user?.unitNama ?? "—";
    const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const tableRows = rows.map((row, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${row.sasaranStrategis}</td>
        <td style="font-family:monospace;font-size:10pt;text-align:center">${row.kodeIndikator}</td>
        <td>${row.namaIndikator}</td>
        <td style="text-align:center">${row.targetKuantitas !== null ? row.targetKuantitas : "—"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Rencana SKP – ${nama}</title>
  <style>
    @page { size: A4; margin: 25mm 20mm 20mm 30mm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; margin: 0; }
    h1 { text-align: center; font-size: 14pt; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; }
    .sub { text-align: center; font-size: 11pt; margin-bottom: 20px; }
    .identitas table { border-collapse: collapse; margin-bottom: 16px; }
    .identitas td { padding: 2px 8px 2px 0; font-size: 12pt; vertical-align: top; }
    table.main { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.main th, table.main td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; }
    table.main th { background: #f3f3f3; text-align: center; font-weight: bold; }
    .signature { display: flex; justify-content: flex-end; margin-top: 48px; }
    .sig-box { text-align: center; width: 220px; }
    .sig-line { border-bottom: 1px solid #000; margin: 60px 0 4px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>Rencana Sasaran Kinerja Pegawai</h1>
  <p class="sub">Periode Penilaian: 1 Januari ${tahun} s/d 31 Desember ${tahun}</p>
  <div class="identitas">
    <table>
      <tr><td style="width:160px;font-weight:600">NIP</td><td style="width:12px">:</td><td>${nip}</td></tr>
      <tr><td style="font-weight:600">Nama</td><td>:</td><td>${nama}</td></tr>
      <tr><td style="font-weight:600">Jabatan</td><td>:</td><td>${jabatan}</td></tr>
      <tr><td style="font-weight:600">Unit Kerja</td><td>:</td><td>${unitKerja}</td></tr>
    </table>
  </div>
  <table class="main">
    <thead>
      <tr>
        <th style="width:36px">No</th>
        <th>Sasaran Program</th>
        <th style="width:100px">Kode Indikator</th>
        <th>Nama Indikator</th>
        <th style="width:80px">Target</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="signature">
    <div class="sig-box">
      <p style="margin:0">Jakarta, ${tanggal}</p>
      <p style="margin:4px 0 0">Yang Membuat,</p>
      <div class="sig-line"></div>
      <p style="margin:0;font-weight:bold">${nama}</p>
      <p style="margin:0;font-size:10pt">NIP. ${nip}</p>
    </div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  function generateEvaluasiKinerjaPegawai() {
    const nama = user?.nama ?? "—";
    const nip = user?.nip ?? "—";
    const jabatan = [...(user?.roles ?? [])].sort((a, b) => a.level - b.level)[0]?.name ?? user?.role ?? "—";
    const unitKerja = user?.unitNama ?? "Fakultas Ilmu Komputer";
    const atasanNama = mySkpStatus?.atasan?.nama ?? "—";
    const atasanNip = mySkpStatus?.atasan?.nip ?? "—";
    const atasanJabatan = mySkpStatus?.atasan?.jabatan ?? "—";
    const periodePenilaian = `02 JANUARI S.D. 31 DESEMBER TAHUN ${tahun}`;

    function hasilKerja(capaian: number | null) {
      if (capaian === null) return { label: "SESUAI EKSPEKTASI", angka: 2 };
      if (capaian >= 100) return { label: "DI ATAS EKSPEKTASI", angka: 3 };
      if (capaian >= 76) return { label: "SESUAI EKSPEKTASI", angka: 2 };
      return { label: "DI BAWAH EKSPEKTASI", angka: 1 };
    }

    const validRows = rows.filter(r => r.capaianPersen !== null);
    const avgCapaian = validRows.length > 0
      ? validRows.reduce((s, r) => s + r.capaianPersen!, 0) / validRows.length : null;
    const ratingHK = hasilKerja(avgCapaian);
    const predikat = !avgCapaian ? "BAIK"
      : avgCapaian >= 90 ? "SANGAT BAIK"
      : avgCapaian >= 76 ? "BAIK" : "CUKUP";

    const perilakuItems = [
      { nama: "Berorientasi pelayanan", bullets: ["Memahami dan memenuhi kebutuhan masyarakat", "Ramah, cekatan, solutif, dan dapat diandalkan", "Melakukan perbaikan tiada henti"] },
      { nama: "Akuntabel", bullets: ["Melaksanakan tugas dengan jujur, bertanggungjawab, cermat, disiplin dan berintegritas tinggi", "Menggunakan kekayaan dan barang milik negara secara bertanggungjawab, efektif, dan efisien", "Tidak menyalahgunakan kewenangan jabatan"] },
      { nama: "Kompeten", bullets: ["Meningkatkan kompetensi diri untuk menjawab tantangan yang selalu berubah", "Membantu orang lain belajar", "Melaksanakan tugas dengan kualitas terbaik"] },
      { nama: "Harmonis", bullets: ["Menghargai setiap orang apapun latar belakangnya", "Suka menolong orang lain", "Membangun lingkungan kerja yang kondusif"] },
      { nama: "Loyal", bullets: ["Memegang teguh ideologi Pancasila, Undang-Undang Dasar Negara Republik Indonesia Tahun 1945, setia kepada Negara Kesatuan Republik Indonesia serta pemerintahan yang sah", "Menjaga nama baik sesama ASN, Pimpinan, Instansi, dan Negara", "Menjaga rahasia jabatan dan negara"] },
      { nama: "Adaptif", bullets: ["Cepat menyesuaikan diri menghadapi perubahan", "Terus berinovasi dan mengembangkan kreativitas", "Bertindak proaktif"] },
      { nama: "Kolaboratif", bullets: ["Memberi kesempatan kepada berbagai pihak untuk berkontribusi", "Terbuka dalam bekerja sama untuk menghasilkan nilai tambah", "Menggerakkan pemanfaatan berbagai sumberdaya untuk tujuan bersama"] },
    ];

    const bellSvg = `<svg width="300" height="110" viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:4px auto">
      <line x1="28" y1="90" x2="290" y2="90" stroke="#333" stroke-width="0.8"/>
      <line x1="28" y1="5" x2="28" y2="90" stroke="#333" stroke-width="0.8"/>
      <text x="18" y="93" font-size="7" text-anchor="middle" font-family="serif">0</text>
      <text x="18" y="73" font-size="7" text-anchor="middle" font-family="serif">20</text>
      <text x="18" y="52" font-size="7" text-anchor="middle" font-family="serif">40</text>
      <text x="18" y="30" font-size="7" text-anchor="middle" font-family="serif">60</text>
      <text x="7" y="55" font-size="6" text-anchor="middle" font-family="serif" transform="rotate(-90,7,55)">FREKUENSI PEGAWAI</text>
      <path d="M28,89 C50,89 70,89 95,75 C115,60 130,25 155,8 C180,25 195,60 215,75 C240,89 260,89 290,89" fill="none" stroke="#333" stroke-width="1.2"/>
      <text x="40" y="102" font-size="6.5" text-anchor="middle" font-family="serif">Sangat</text>
      <text x="40" y="109" font-size="6.5" text-anchor="middle" font-family="serif">Kurang</text>
      <text x="95" y="102" font-size="6.5" text-anchor="middle" font-family="serif">Kurang/</text>
      <text x="95" y="109" font-size="6.5" text-anchor="middle" font-family="serif">Misconduct</text>
      <text x="155" y="102" font-size="6.5" text-anchor="middle" font-family="serif">Butuh</text>
      <text x="155" y="109" font-size="6.5" text-anchor="middle" font-family="serif">Perbaikan</text>
      <text x="215" y="102" font-size="6.5" text-anchor="middle" font-family="serif">Baik</text>
      <text x="275" y="102" font-size="6.5" text-anchor="middle" font-family="serif">Sangat</text>
      <text x="275" y="109" font-size="6.5" text-anchor="middle" font-family="serif">Baik</text>
    </svg>`;

    const infoRow = (label: string, val: string) =>
      `<tr><td style="padding:2px 6px;width:160px">${label}</td><td style="padding:2px 4px;width:8px">:</td><td style="padding:2px 6px">${val}</td></tr>`;

    const hasilKerjaRows = rows.map((row, i) => {
      const hk = hasilKerja(row.capaianPersen);
      return `<tr>
        <td style="text-align:center;vertical-align:top;padding:4px 5px">${i + 1}</td>
        <td style="vertical-align:top;padding:4px 6px">
          <div style="font-weight:bold;margin-bottom:4px">${row.kodeIndikator ? `${row.kodeIndikator} ` : ""}${row.namaIndikator}</div>
          <div style="font-size:8pt">Ukuran keberhasilan/Indikator Kinerja Individu, Target:</div>
          <div style="font-size:8pt">• Tersedianya ${row.targetKuantitas ?? "—"} yang memenuhi ${row.namaIndikator.toLowerCase()}</div>
        </td>
        <td style="text-align:center;vertical-align:middle;padding:4px 5px;font-size:8pt">${row.realisasiKuantitas != null ? `${row.realisasiKuantitas}` : "—"}</td>
        <td style="vertical-align:middle;padding:4px 5px;font-size:8pt"></td>
        <td style="vertical-align:middle;padding:4px 5px;font-size:8pt">${hk.label}</td>
        <td style="text-align:center;vertical-align:middle;padding:4px 5px;font-weight:bold">${hk.angka}</td>
      </tr>`;
    }).join("");

    const perilakuKerjaRowsKuantitatif = perilakuItems.map((p, i) => `<tr>
      <td style="vertical-align:top;padding:4px 6px">
        <div style="font-weight:bold;margin-bottom:3px">${i + 1} ${p.nama}</div>
        ${p.bullets.map(b => `<div style="font-size:8pt">- ${b}</div>`).join("")}
      </td>
      <td style="vertical-align:middle;padding:4px 6px;font-size:8pt;font-style:italic">Ekspektasi Khusus Pimpinan:</td>
      <td style="vertical-align:middle;padding:4px 6px;font-size:8pt">sudah sesuai</td>
      <td style="vertical-align:middle;padding:4px 5px;font-size:8pt">SESUAI EKSPEKTASI</td>
      <td style="text-align:center;vertical-align:middle;padding:4px 5px;font-weight:bold">2</td>
    </tr>`).join("");

    const kualitatifHasilKerjaRows = rows.map((row, i) => `<tr>
      <td style="vertical-align:top;padding:5px 6px;width:40px">${i + 1}</td>
      <td style="vertical-align:top;padding:5px 6px">
        <div style="font-weight:bold;font-style:italic;margin-bottom:4px">${row.kodeIndikator ? `${row.kodeIndikator} ` : ""}${row.namaIndikator}</div>
        <div style="font-size:8.5pt">Ukuran keberhasilan/Indikator Kinerja Individu, Target:</div>
        <div style="font-size:8.5pt">• Tersedianya ${row.targetKuantitas ?? "—"} yang memenuhi ${row.namaIndikator.toLowerCase()}</div>
      </td>
      <td style="vertical-align:middle;padding:5px 6px;font-size:8.5pt;font-style:italic">Ekspektasi Khusus Pimpinan:</td>
    </tr>`).join("");

    const perilakuKerjaRowsKualitatif = perilakuItems.map((p, i) => `<tr>
      <td style="vertical-align:top;padding:4px 6px">
        <div style="font-weight:bold;margin-bottom:3px">${p.nama}</div>
        ${p.bullets.map(b => `<div style="font-size:8pt">- ${b}</div>`).join("")}
      </td>
      <td style="vertical-align:top;padding:4px 6px;font-size:8pt;font-style:italic">Ekspektasi Khusus Pimpinan:</td>
    </tr>`).join("");

    const logoUrl = `${window.location.origin}/logo-upnvj.webp`;
    const garuda = `<div style="text-align:center;margin-bottom:6px"><img src="${logoUrl}" style="height:72px;width:auto;object-fit:contain" /></div>`;

    const coverPage = `<div class="page">
  ${garuda}
  <p style="text-align:center;font-size:11pt;font-weight:bold;margin:0 0 2px">DOKUMEN EVALUASI KINERJA PEGAWAI</p>
  <p style="text-align:center;font-size:10pt;margin:0 0 10px">PERIODE*: <span style="text-decoration:line-through">TRIWULAN I/II/III/IV-</span>AKHIR**</p>
  <table class="main-table">
    <tr>
      <td style="padding:4px 8px;width:50%;vertical-align:top;border-bottom:none">KEMENTERIAN PENDIDIKAN, KEBUDAYAAN,<br>RISET, DAN TEKNOLOGI</td>
      <td style="padding:4px 8px;width:50%;vertical-align:top;border-bottom:none">PERIODE PENILAIAN:<br>${periodePenilaian}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0;border:none">
        <table class="main-table">
          <tr><td rowspan="5" style="text-align:center;width:28px;font-weight:bold;vertical-align:top;padding:4px">1</td>
              <td colspan="3" style="font-weight:bold;padding:4px 6px">PEGAWAI YANG DINILAI</td></tr>
          ${infoRow("NAMA", nama)}${infoRow("NIP", nip)}${infoRow("PANGKAT/GOL. RUANG", "—")}${infoRow("JABATAN", jabatan)}${infoRow("UNIT KERJA", unitKerja)}
          <tr><td rowspan="5" style="text-align:center;width:28px;font-weight:bold;vertical-align:top;padding:4px">2</td>
              <td colspan="3" style="font-weight:bold;padding:4px 6px">PEJABAT PENILAI KINERJA</td></tr>
          ${infoRow("NAMA", atasanNama)}${infoRow("NIP", atasanNip)}${infoRow("PANGKAT/GOL. RUANG", "—")}${infoRow("JABATAN", atasanJabatan)}${infoRow("UNIT KERJA", unitKerja)}
          <tr><td rowspan="5" style="text-align:center;width:28px;font-weight:bold;vertical-align:top;padding:4px">3</td>
              <td colspan="3" style="font-weight:bold;padding:4px 6px">ATASAN PEJABAT PENILAI KINERJA</td></tr>
          ${infoRow("NAMA", "—")}${infoRow("NIP", "—")}${infoRow("PANGKAT/GOL. RUANG", "—")}${infoRow("JABATAN", "—")}${infoRow("UNIT KERJA", unitKerja)}
          <tr><td rowspan="2" style="text-align:center;width:28px;font-weight:bold;vertical-align:top;padding:4px">4</td>
              <td colspan="3" style="font-weight:bold;padding:4px 6px">EVALUASI KINERJA</td></tr>
          <tr><td colspan="3" style="padding:3px 6px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:1px 6px">CAPAIAN KINERJA ORGANISASI</td><td style="padding:1px 4px">:</td><td style="padding:1px 6px;font-weight:bold">BAIK</td></tr>
              <tr><td style="padding:1px 6px">PREDIKAT KINERJA PEGAWAI</td><td style="padding:1px 4px">:</td><td style="padding:1px 6px;font-weight:bold">${predikat}</td></tr>
            </table>
          </td></tr>
          <tr><td style="text-align:center;width:28px;font-weight:bold;vertical-align:top;padding:4px">5</td>
              <td colspan="3" style="font-weight:bold;padding:4px 6px">CATATAN/ REKOMENDASI</td></tr>
          <tr><td></td><td colspan="3" style="padding:40px 6px"></td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:24px">
    <tr>
      <td style="width:50%;text-align:center;vertical-align:top;border:none;padding:0">
        <p style="margin:0">7. Jakarta, ${tanggalCetak}</p>
        <p style="margin:0">Pegawai yang dinilai</p>
        <div style="height:56px"></div>
        <p style="margin:0;font-weight:bold">${nama}</p>
        <p style="margin:0;font-size:8.5pt">NIP ${nip}</p>
      </td>
      <td style="width:50%;text-align:center;vertical-align:top;border:none;padding:0">
        <p style="margin:0">6. Jakarta, ${tanggalCetak}</p>
        <p style="margin:0">Pejabat Penilai Kinerja,</p>
        <div style="height:56px"></div>
        <p style="margin:0;font-weight:bold">${atasanNama}</p>
        <p style="margin:0;font-size:8.5pt">NIP ${atasanNip}</p>
      </td>
    </tr>
  </table>
</div>`;

    const kuantitatifPage = `<div class="page">
  <p style="text-align:center;font-size:10pt;font-weight:bold;margin:0">EVALUASI KINERJA PEGAWAI</p>
  <p style="text-align:center;font-size:10pt;font-weight:bold;margin:0">PENDEKATAN HASIL KERJA KUANTITATIF</p>
  <p style="text-align:center;font-size:9pt;font-weight:bold;margin:0 0 6px">BAGI PEJABAT ADMINISTRASI DAN PEJABAT FUNGSIONAL</p>
  <p style="text-align:center;font-size:9pt;margin:0 0 6px">PERIODE: <span style="text-decoration:line-through">TRIWULAN I/II/III/IV-</span>AKHIR*</p>
  <table class="main-table" style="margin-bottom:4px">
    <tr>
      <td colspan="3" style="padding:3px 6px;border-bottom:none">UPN "VETERAN" JAKARTA</td>
      <td colspan="3" style="padding:3px 6px;border-bottom:none">PERIODE PENILAIAN: ${periodePenilaian}</td>
    </tr>
    <tr>
      <td style="padding:2px 4px;width:20px;font-size:8pt">NO.</td>
      <td colspan="2" style="padding:2px 6px;font-weight:bold;font-size:8pt">PEGAWAI YANG DINILAI</td>
      <td style="padding:2px 4px;width:20px;font-size:8pt">NO.</td>
      <td colspan="2" style="padding:2px 6px;font-weight:bold;font-size:8pt">PEJABAT PENILAI KINERJA</td>
    </tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">1</td><td style="padding:2px 5px;font-size:8pt">NAMA</td><td style="padding:2px 5px;font-size:8pt">${nama}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">1</td><td style="padding:2px 5px;font-size:8pt">NAMA</td><td style="padding:2px 5px;font-size:8pt">${atasanNama}</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">2</td><td style="padding:2px 5px;font-size:8pt">NIP</td><td style="padding:2px 5px;font-size:8pt">${nip}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">2</td><td style="padding:2px 5px;font-size:8pt">NIP</td><td style="padding:2px 5px;font-size:8pt">${atasanNip}</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">3</td><td style="padding:2px 5px;font-size:8pt">PANGKAT/GOL. RUANG</td><td style="padding:2px 5px;font-size:8pt">—</td><td style="padding:2px 4px;text-align:center;font-size:8pt">3</td><td style="padding:2px 5px;font-size:8pt">PANGKAT/GOL. RUANG</td><td style="padding:2px 5px;font-size:8pt">—</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">4</td><td style="padding:2px 5px;font-size:8pt">JABATAN</td><td style="padding:2px 5px;font-size:8pt">${jabatan}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">4</td><td style="padding:2px 5px;font-size:8pt">JABATAN</td><td style="padding:2px 5px;font-size:8pt">—</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">5</td><td style="padding:2px 5px;font-size:8pt">UNIT KERJA</td><td style="padding:2px 5px;font-size:8pt">${unitKerja}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">5</td><td style="padding:2px 5px;font-size:8pt">INSTANSI</td><td style="padding:2px 5px;font-size:8pt">${unitKerja}</td></tr>
    <tr><td colspan="6" style="padding:2px 6px;font-weight:bold;font-size:8pt">CAPAIAN KINERJA ORGANISASI*</td></tr>
    <tr><td colspan="6" style="padding:2px 6px;font-weight:bold;font-size:8pt">BAIK</td></tr>
    <tr><td colspan="6" style="padding:2px 6px;font-weight:bold;font-size:8pt">POLA DISTRIBUSI:</td></tr>
    <tr><td colspan="6" style="padding:4px;text-align:center">${bellSvg}</td></tr>
  </table>
  <table class="main-table">
    <tr style="background:#e8e8e8">
      <td rowspan="2" style="text-align:center;font-weight:bold;font-size:8pt;padding:4px 5px;width:36%">HASIL KERJA</td>
      <td rowspan="2" style="text-align:center;font-weight:bold;font-size:8pt;padding:4px 5px;width:13%">REALISASI BERDASARKAN BUKTI DUKUNG</td>
      <td rowspan="2" style="text-align:center;font-weight:bold;font-size:8pt;padding:4px 5px;width:18%">UMPAN BALIK BERKELANJUTAN BERDASARKAN BUKTI DUKUNG</td>
      <td colspan="2" style="text-align:center;font-weight:bold;font-size:8pt;padding:4px 5px">HASIL KERJA</td>
    </tr>
    <tr style="background:#e8e8e8">
      <td style="text-align:center;font-size:7.5pt;padding:3px 5px">1-Dibawah Ekspektasi<br>2-Sesuai Ekspektasi<br>3-diatas Ekspektasi</td>
      <td style="text-align:center;font-weight:bold;font-size:8pt;padding:4px 5px">Angka</td>
    </tr>
    <tr><td colspan="5" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">A. UTAMA</td></tr>
    ${hasilKerjaRows}
    <tr><td colspan="5" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">B. TAMBAHAN</td></tr>
    <tr><td colspan="5" style="padding:20px 6px"></td></tr>
    <tr style="background:#e8e8e8">
      <td colspan="2" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">RATING HASIL KERJA*</td>
      <td style="padding:3px 6px"></td>
      <td style="font-weight:bold;padding:3px 6px;font-size:8.5pt">${ratingHK.label}</td>
      <td style="text-align:center;font-weight:bold;padding:3px 6px">${ratingHK.angka}</td>
    </tr>
    <tr style="background:#e8e8e8"><td colspan="4" style="font-weight:bold;padding:2px 6px;font-size:8pt">PERILAKU KERJA</td><td></td></tr>
    ${perilakuKerjaRowsKuantitatif}
    <tr style="background:#e8e8e8">
      <td colspan="2" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">RATING PERILAKU KERJA*</td>
      <td style="padding:3px 6px"></td>
      <td style="font-weight:bold;padding:3px 6px;font-size:8.5pt">DI ATAS EKSPEKTASI</td>
      <td style="text-align:center;font-weight:bold;padding:3px 6px">2</td>
    </tr>
    <tr style="background:#e8e8e8"><td colspan="4" style="font-weight:bold;padding:2px 6px;font-size:8.5pt">PREDIKAT KINERJA PEGAWAI*</td><td></td></tr>
    <tr style="background:#e8e8e8"><td colspan="4" style="font-weight:bold;padding:2px 6px;font-size:8.5pt">${predikat}</td><td></td></tr>
  </table>
  <div style="text-align:right;margin-top:20px">
    <p style="margin:0">Jakarta, ${tanggalCetak}</p>
    <p style="margin:0">Pejabat Penilai Kinerja</p>
    <div style="height:52px"></div>
    <p style="margin:0;font-weight:bold">${atasanNama}</p>
    <p style="margin:0;font-size:8.5pt">NIP ${atasanNip}</p>
  </div>
</div>`;

    const kualitatifPage = `<div class="page">
  <p style="text-align:center;font-size:10pt;font-weight:bold;margin:0">SASARAN KINERJA PEGAWAI</p>
  <p style="text-align:center;font-size:10pt;font-weight:bold;margin:0">PENDEKATAN HASIL KERJA KUALITATIF</p>
  <p style="text-align:center;font-size:9pt;font-weight:bold;margin:0 0 6px">BAGI PEJABAT ADMINISTRASI / FUNGSIONAL</p>
  <table class="main-table" style="margin-bottom:4px">
    <tr>
      <td style="padding:2px 4px;width:20px;font-size:8pt">NO</td>
      <td colspan="2" style="padding:2px 6px;font-weight:bold;font-size:8pt">PEGAWAI YANG DINILAI</td>
      <td style="padding:2px 4px;width:20px;font-size:8pt">NO</td>
      <td colspan="2" style="padding:2px 6px;font-weight:bold;font-size:8pt">PEJABAT PENILAI KINERJA</td>
    </tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">1</td><td style="padding:2px 5px;font-size:8pt">NAMA</td><td style="padding:2px 5px;font-size:8pt">${nama}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">1</td><td style="padding:2px 5px;font-size:8pt">NAMA</td><td style="padding:2px 5px;font-size:8pt">${atasanNama}</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">2</td><td style="padding:2px 5px;font-size:8pt">NIP.</td><td style="padding:2px 5px;font-size:8pt">${nip}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">2</td><td style="padding:2px 5px;font-size:8pt">NIP.</td><td style="padding:2px 5px;font-size:8pt">${atasanNip}</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">3</td><td style="padding:2px 5px;font-size:8pt">PANGKAT/ GOL. RUANG</td><td style="padding:2px 5px;font-size:8pt">—</td><td style="padding:2px 4px;text-align:center;font-size:8pt">3</td><td style="padding:2px 5px;font-size:8pt">PANGKAT/ GOL. RUANG</td><td style="padding:2px 5px;font-size:8pt">—</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">4</td><td style="padding:2px 5px;font-size:8pt">JABATAN</td><td style="padding:2px 5px;font-size:8pt">${jabatan}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">4</td><td style="padding:2px 5px;font-size:8pt">JABATAN</td><td style="padding:2px 5px;font-size:8pt">—</td></tr>
    <tr><td style="padding:2px 4px;text-align:center;font-size:8pt">5</td><td style="padding:2px 5px;font-size:8pt">UNIT KERJA</td><td style="padding:2px 5px;font-size:8pt">${unitKerja}</td><td style="padding:2px 4px;text-align:center;font-size:8pt">5</td><td style="padding:2px 5px;font-size:8pt">UNIT KERJA</td><td style="padding:2px 5px;font-size:8pt">${unitKerja}</td></tr>
    <tr><td colspan="6" style="padding:2px 6px;font-size:8pt">PERIODE PENILAIAN: SAMPAI DENGAN 31 DESEMBER TAHUN ${tahun}</td></tr>
  </table>
  <table class="main-table">
    <tr style="background:#e8e8e8"><td colspan="3" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">HASIL KERJA</td></tr>
    <tr><td colspan="3" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">A. UTAMA</td></tr>
    ${kualitatifHasilKerjaRows}
    <tr style="background:#e8e8e8"><td colspan="3" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">PERILAKU KERJA*</td></tr>
    <tr style="background:#e8e8e8">
      <td style="font-weight:bold;padding:3px 6px;font-size:8pt">Berorientasi pelayanan</td>
      <td colspan="2" style="font-size:8pt;padding:3px 6px"></td>
    </tr>
    ${perilakuKerjaRowsKualitatif}
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:20px">
    <tr>
      <td style="width:50%;text-align:center;vertical-align:top;border:none;padding:0">
        <p style="margin:0">Pegawai yang Dinilai</p>
        <div style="height:56px"></div>
        <p style="margin:0;font-weight:bold">${nama}</p>
        <p style="margin:0;font-size:8.5pt">NIP. ${nip}</p>
      </td>
      <td style="width:50%;text-align:center;vertical-align:top;border:none;padding:0">
        <p style="margin:0">Jakarta, ${tanggalCetak}</p>
        <p style="margin:0">Pejabat Penilai Kinerja</p>
        <div style="height:56px"></div>
        <p style="margin:0;font-weight:bold">${atasanNama}</p>
        <p style="margin:0;font-size:8.5pt">NIP. ${atasanNip}</p>
      </td>
    </tr>
  </table>
</div>`;

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Evaluasi Kinerja Pegawai – ${nama} – ${tahun}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm 15mm 15mm; }
    body { font-family: 'Times New Roman', serif; font-size: 9pt; color: #000; margin: 0; padding: 0; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .main-table { width: 100%; border-collapse: collapse; }
    .main-table td, .main-table th { border: 1px solid #000; padding: 3px 5px; font-size: 9pt; vertical-align: top; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
${coverPage}
${kuantitatifPage}
${kualitatifPage}
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  // ── Rencana sign draw helpers ──
  function makeDrawHandlers(
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    isDrawingRef: React.MutableRefObject<boolean>,
    setHasDrawn: (v: boolean) => void,
  ) {
    return {
      onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
        isDrawingRef.current = true;
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        const { x, y } = getSigPos(c, e.clientX, e.clientY);
        ctx.beginPath(); ctx.moveTo(x, y);
      },
      onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
        if (!isDrawingRef.current) return;
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        const { x, y } = getSigPos(c, e.clientX, e.clientY);
        ctx.lineTo(x, y); ctx.stroke(); setHasDrawn(true);
      },
      onMouseUp() { isDrawingRef.current = false; },
      onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
        e.preventDefault();
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        const t = e.touches[0];
        const { x, y } = getSigPos(c, t.clientX, t.clientY);
        isDrawingRef.current = true; ctx.beginPath(); ctx.moveTo(x, y);
      },
      onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
        e.preventDefault();
        if (!isDrawingRef.current) return;
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        const t = e.touches[0];
        const { x, y } = getSigPos(c, t.clientX, t.clientY);
        ctx.lineTo(x, y); ctx.stroke(); setHasDrawn(true);
      },
      onTouchEnd() { isDrawingRef.current = false; },
      clear() {
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d'); if (!ctx) return;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); setHasDrawn(false);
      },
    };
  }

  const pkHandlers = makeDrawHandlers(pkSignCanvasRef, pkSignIsDrawing, setPkSignHasDrawn);

  async function handlePkSignConfirm() {
    if (!pkSignModal.target) return;
    setPkSignSaving(true);
    try {
      const sig = pkSignHasDrawn && pkSignCanvasRef.current
        ? pkSignCanvasRef.current.toDataURL('image/png')
        : null;
      await signRencanaSKPPihakKedua(pkSignModal.target.userId, tahun, sig);
      setPkSignModal({ open: false, target: null });
      toast.success(`Rencana SKP ${pkSignModal.target.nama} berhasil disetujui.`);
      fetchCheckerBawahan();
    } catch {
      toast.error('Gagal menyimpan tanda tangan.');
    } finally {
      setPkSignSaving(false);
    }
  }

  const bulkRencanaHandlers = makeDrawHandlers(bulkRencanaCanvasRef, bulkRencanaIsDrawing, setBulkRencanaHasDrawn);

  function toggleRencanaSelect(userId: number) {
    setRencanaSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  function toggleRencanaSelectAll() {
    const eligible = checkerBawahan.rencanaSKPBawahan.filter(b => b.rencanaStatus === 'checked' || b.rencanaStatus === 'signed_pegawai');
    if (rencanaSelected.size === eligible.length) {
      setRencanaSelected(new Set());
    } else {
      setRencanaSelected(new Set(eligible.map(b => b.userId)));
    }
  }

  async function handleBulkRencanaSignConfirm() {
    setBulkRencanaSaving(true);
    try {
      const sig = bulkRencanaHasDrawn && bulkRencanaCanvasRef.current
        ? bulkRencanaCanvasRef.current.toDataURL('image/png')
        : null;
      const targets = checkerBawahan.rencanaSKPBawahan.filter(b => rencanaSelected.has(b.userId));
      await Promise.all(targets.map(b => signRencanaSKPPihakKedua(b.userId, tahun, sig)));
      setBulkRencanaSignModal(false);
      setRencanaSelected(new Set());
      toast.success(`${targets.length} Rencana SKP berhasil disetujui.`);
      fetchCheckerBawahan();
    } catch {
      toast.error('Gagal menyimpan tanda tangan massal.');
    } finally {
      setBulkRencanaSaving(false);
    }
  }

  async function generateCheckerDoc(b: SkpCheckerUser, docType: 'rencana' | 'ekp') {
    toast.info(`Memuat data SKP ${b.nama}…`);
    try {
      const [ikuData, pkData, bawahanSkpStatus, bawahanRoles] = await Promise.all([
        getIndikatorGroupedForUser("IKU", tahun, b.userId, b.roleId),
        getIndikatorGroupedForUser("PK", tahun, b.userId, b.roleId),
        getMySkpStatus(b.userId, tahun),
        getUserRoles(b.userId),
      ]);

      const bawahanPrimaryLevel = bawahanRoles.find(r => r.isPrimary)?.level ?? 4;
      const bawahanSecondaryDosen = bawahanPrimaryLevel < 4
        ? bawahanRoles.find(r => r.level >= 4 && !r.isPrimary)
        : undefined;

      let allIku = ikuData as unknown as IndikatorGroup[];
      let allPk = pkData as unknown as IndikatorGroup[];

      if (bawahanSecondaryDosen) {
        const [secIku, secPk] = await Promise.all([
          getIndikatorGroupedForUser("IKU", tahun, b.userId, bawahanSecondaryDosen.id),
          getIndikatorGroupedForUser("PK", tahun, b.userId, bawahanSecondaryDosen.id),
        ]);
        allIku = mergeGroupedData(allIku, secIku as unknown as IndikatorGroup[]);
        allPk = mergeGroupedData(allPk, secPk as unknown as IndikatorGroup[]);
      }

      const bawahanRows: SKPRow[] = [];
      let no = 1;
      function pushCheckerRow(item: IndikatorNode, sasaran: string) {
        const target = item.disposisiJumlah ?? null;
        const realisasi = item.realisasiJumlah ?? null;
        const capaian = target !== null && target > 0 && realisasi !== null
          ? Math.min((realisasi / target) * 100, 100) : null;
        bawahanRows.push({ id: item.id, no: no++, kodeIndikator: item.kode, namaIndikator: item.nama, sasaranStrategis: sasaran, targetKuantitas: target, realisasiKuantitas: realisasi, capaianPersen: capaian });
      }
      for (const group of [...allIku, ...allPk] as IndikatorGroup[]) {
        for (const sub of group.subIndikators) {
          const children = sub.children ?? [];
          if (children.length === 0) { pushCheckerRow(sub, group.nama); }
          else {
            for (const child of children) {
              const gc = child.children ?? [];
              if (gc.length === 0) pushCheckerRow(child, group.nama);
              else for (const g of gc) pushCheckerRow(g, group.nama);
            }
          }
        }
      }

      const nama = b.nama;
      const nip = b.nip ?? "—";
      const jabatan = b.jabatan;
      const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      if (docType === 'rencana') {
        const rencanaStatus = await getSkpRencanaStatus(b.userId, tahun).catch(() => null);
        const pihakKeduaNama = bawahanSkpStatus?.atasanPenilai?.nama ?? bawahanSkpStatus?.atasan?.nama ?? "—";
        const pihakKeduaNip = bawahanSkpStatus?.atasanPenilai?.nip ?? bawahanSkpStatus?.atasan?.nip ?? "—";
        const sigPeg = (rencanaStatus as any)?.signaturePegawai ?? null;
        const sigPK = (rencanaStatus as any)?.signaturePihakKedua ?? null;
        const INSTITUSI = 'Universitas Pembangunan Nasional "Veteran" Jakarta';
        const spDipa = `SP DIPA-139.03.2.693372/${tahun}`;
        const logoUrl = `${window.location.origin}/logo-upnvj.png`;

        // derive unit name from jabatan: "dosen S1 Sistem Informasi" → "S1 Sistem Informasi"
        const unitNama = jabatan.replace(/^(dosen|kaprodi|kajur|wakil dekan|wd|dekan|kepala jurusan|kepala program studi)\s+/i, "").trim();
        const pihakKeduaJabatan = unitNama ? `Dekan ${unitNama}` : "Dekan";

        const resolveTarget = (item: any): string => {
          const v = item.disposisiJumlah ?? item.nilaiTarget;
          return v !== null && v !== undefined ? String(v) : "-";
        };

        // ── Shared helpers ──
        const fmtIkuL = (kode: string) => {
          const t = (kode ?? '').trim();
          if (!t) return '';
          if (/^\d+$/.test(t)) return `IKU ${t}`;
          const u = t.toUpperCase();
          return u.startsWith('IKU') ? u.replace(/^IKU\s*/, 'IKU ') : t;
        };

        type DocRowL =
          | { kind: 'sub-header'; groupIdx: number; groupKode: string; sasaran: string; ikuLabel: string }
          | { kind: 'entry';      groupIdx: number; groupKode: string; sasaran: string; ikuLabel: string; target: string; satuan: string }
          | { kind: 'leaf';       groupIdx: number; groupKode: string; sasaran: string; ikuLabel: string; target: string; satuan: string };
        const lbl = (kode: string, nama: string, fmt = false) => { const k = fmt ? fmtIkuL(kode) : (kode?.trim() ?? ''); return k ? `${k}  ${nama}` : nama; };
        const buildDocRowsL = (data: IndikatorGroup[]): DocRowL[] => {
          const rows: DocRowL[] = [];
          for (const [groupIdx, group] of data.entries()) {
            const sasaran = group.nama;
            const groupKode = (group as any).kode?.trim() || String(groupIdx + 1);
            for (const sub of group.subIndikators) {
              const children = sub.children ?? [];
              const subLabel = lbl(sub.kode ?? '', sub.nama, true);
              if (children.length === 0) {
                rows.push({ kind: 'entry', groupIdx, groupKode, sasaran, ikuLabel: subLabel, target: resolveTarget(sub), satuan: sub.satuan ?? '' });
              } else {
                rows.push({ kind: 'sub-header', groupIdx, groupKode, sasaran, ikuLabel: subLabel });
                for (const child of children) {
                  const l3s = child.children ?? [];
                  rows.push({ kind: 'entry', groupIdx, groupKode, sasaran, ikuLabel: lbl(child.kode ?? '', child.nama), target: l3s.length > 0 ? '' : resolveTarget(child), satuan: l3s.length > 0 ? '' : (child.satuan ?? '') });
                  for (const l3 of l3s) {
                    rows.push({ kind: 'leaf', groupIdx, groupKode, sasaran, ikuLabel: lbl(l3.kode ?? '', l3.nama), target: resolveTarget(l3), satuan: l3.satuan ?? '' });
                  }
                }
              }
            }
          }
          return rows;
        };

        // ── Shared cell style strings ──
        const tdS = `border:1px solid #000;padding:4px 5px;font-size:9.5pt;vertical-align:top;line-height:1.35`;
        const tdC = `${tdS};text-align:center;vertical-align:middle`;
        const thS = `${tdC};font-weight:bold;background:#f5f5f5`;

        // ── Signature block helper ──
        const makeSig = (
          leftLabel: string, leftName: string, leftNip: string | null, leftSig: string | null,
          rightLabel: string, rightName: string, rightNip: string | null, rightSig: string | null,
        ) => `<div style="display:flex;justify-content:space-between;margin-top:36px;font-size:11pt">
<div style="width:44%"><div>${leftLabel},</div>
${leftSig ? `<img src="${leftSig}" style="height:70px;max-width:200px;object-fit:contain;display:block;margin:4px 0"/>` : `<div style="height:70px"></div>`}
<div style="border-top:1px solid #000;padding-top:4px;display:inline-block;min-width:180px;font-weight:bold">${leftName}</div>
${leftNip ? `<div style="font-size:10pt">NIP. ${leftNip}</div>` : ''}</div>
<div style="width:44%;text-align:center"><div>Jakarta, ${tanggal}</div><div>${rightLabel},</div>
${rightSig ? `<img src="${rightSig}" style="height:70px;max-width:200px;object-fit:contain;display:block;margin:4px auto"/>` : `<div style="height:70px"></div>`}
<div style="border-top:1px solid #000;padding-top:4px;display:inline-block;min-width:180px;font-weight:bold">${rightName}</div>
${rightNip ? `<div style="font-size:10pt">NIP. ${rightNip}</div>` : ''}</div></div>`;

        // ── Lampiran page header ──
        const pageHeader = (lampiran: string) =>
          `<div style="text-align:right;font-size:9pt;margin-bottom:6px">${lampiran}</div>
<div style="text-align:center;font-weight:bold;font-size:10.5pt;text-transform:uppercase;line-height:1.7;margin-bottom:16px">
<div>PERJANJIAN KINERJA TAHUN ${tahun}</div>
<div>${jabatan.toUpperCase()}</div><div>DENGAN</div>
<div>${pihakKeduaJabatan.toUpperCase()}</div>
<div>${INSTITUSI.toUpperCase()}</div>
<div>TAHUN ANGGARAN ${tahun}</div>
<div>BERDASARKAN ${spDipa}</div></div>`;

        // ── DocRow → HTML ──
        const renderDocHtml = (rows: DocRowL[]): string => {
          const gCount = new Map<number, number>();
          const gFirst = new Map<number, number>();
          rows.forEach((r, i) => {
            gCount.set(r.groupIdx, (gCount.get(r.groupIdx) ?? 0) + 1);
            if (!gFirst.has(r.groupIdx)) gFirst.set(r.groupIdx, i);
          });
          return rows.map((row, ri) => {
            const isFirst = gFirst.get(row.groupIdx) === ri;
            const gSpan = gCount.get(row.groupIdx) ?? 1;
            const noCell = isFirst ? `<td${gSpan > 1 ? ` rowspan="${gSpan}"` : ''} style="${tdC}">${row.groupKode}</td>` : '';
            const sasaranCell = isFirst ? `<td${gSpan > 1 ? ` rowspan="${gSpan}"` : ''} style="${tdS}">${row.sasaran}</td>` : '';
            if (row.kind === 'sub-header') {
              return `<tr>${noCell}${sasaranCell}<td style="${tdS};font-weight:bold;font-style:italic">${row.ikuLabel}</td><td style="${tdC}"></td><td style="${tdC}"></td></tr>`;
            }
            if (row.kind === 'entry') {
              return `<tr>${noCell}${sasaranCell}<td style="${tdS}">${row.ikuLabel}</td><td style="${tdC}">${row.target}</td><td style="${tdC}">${row.satuan}</td></tr>`;
            }
            return `<tr>${noCell}${sasaranCell}<td style="${tdS};padding-left:14px">${row.ikuLabel}</td><td style="${tdC}">${row.target}</td><td style="${tdC}">${row.satuan}</td></tr>`;
          }).join('');
        };

        // ── Lampiran 1 — IKU ──
        const ikuDocRows = buildDocRowsL(allIku as unknown as IndikatorGroup[]);
        const ikuTableHtml = ikuDocRows.length === 0 ? '' :
          `<div style="page-break-before:always">${pageHeader('Lampiran 1')}
<table style="width:100%;border-collapse:collapse"><thead><tr>
<th style="${thS};width:28px">No.</th>
<th style="${thS};width:28%">Sasaran Program</th>
<th style="${thS}">Indikator Kinerja Utama</th>
<th style="${thS};width:56px">Target</th>
<th style="${thS};width:65px">Satuan</th>
</tr></thead><tbody>${renderDocHtml(ikuDocRows)}</tbody></table>
${makeSig(pihakKeduaJabatan, pihakKeduaNama, pihakKeduaNip, sigPK, jabatan, nama, nip, sigPeg)}</div>`;

        // ── Lampiran 2 — PK ──
        const pkDocRows = buildDocRowsL(allPk as unknown as IndikatorGroup[]);
        const pkTableHtml = pkDocRows.length === 0 ? '' :
          `<div style="page-break-before:always">${pageHeader('Lampiran 2')}
<table style="width:100%;border-collapse:collapse"><thead><tr>
<th style="${thS};width:28px">No.</th>
<th style="${thS};width:28%">Sasaran Program</th>
<th style="${thS}">Indikator Kinerja Kegiatan</th>
<th style="${thS};width:56px">Target</th>
<th style="${thS};width:65px">Satuan</th>
</tr></thead><tbody>${renderDocHtml(pkDocRows)}</tbody></table>
${makeSig(pihakKeduaJabatan, pihakKeduaNama, pihakKeduaNip, sigPK, jabatan, nama, nip, sigPeg)}</div>`;

        // ── Cover page ──
        const coverHtml =
          `<div style="text-align:center;margin-bottom:14px"><img src="${logoUrl}" style="height:80px;object-fit:contain" onerror="this.style.display='none'"/></div>
<div style="font-weight:bold;font-size:13pt;line-height:1.7;margin-bottom:28px;text-align:center">
<div>Perjanjian Kinerja Tahun ${tahun}</div>
<div>${jabatan}</div><div>dengan</div>
<div>${pihakKeduaJabatan}</div><div>${INSTITUSI}</div></div>
<div style="text-align:justify;font-size:12pt;line-height:1.9;margin-bottom:20px">Dalam rangka mewujudkan manajemen pemerintahan yang efektif, transparan dan akuntabel serta berorientasi pada hasil, kami yang bertanda tangan di bawah ini:</div>
<table style="border-collapse:collapse;margin-bottom:10px"><tbody>
<tr><td style="width:95px;font-size:12pt;padding-bottom:3px;vertical-align:top">Nama</td><td style="width:14px;font-size:12pt;vertical-align:top">:</td><td style="font-size:12pt">${nama}</td></tr>
<tr><td style="font-size:12pt;vertical-align:top">Jabatan</td><td style="font-size:12pt;vertical-align:top">:</td><td style="font-size:12pt;line-height:1.5">${jabatan}<br/>${INSTITUSI}</td></tr>
</tbody></table>
<div style="font-size:12pt;margin-bottom:22px">selanjutnya disebut <strong>PIHAK PERTAMA</strong></div>
<table style="border-collapse:collapse;margin-bottom:10px"><tbody>
<tr><td style="width:95px;font-size:12pt;padding-bottom:3px;vertical-align:top">Nama</td><td style="width:14px;font-size:12pt;vertical-align:top">:</td><td style="font-size:12pt">${pihakKeduaNama}</td></tr>
<tr><td style="font-size:12pt;vertical-align:top">Jabatan</td><td style="font-size:12pt;vertical-align:top">:</td><td style="font-size:12pt;line-height:1.5">${pihakKeduaJabatan}<br/>${INSTITUSI}</td></tr>
</tbody></table>
<div style="font-size:12pt;margin-bottom:22px">selaku atasan pihak pertama, selanjutnya disebut <strong>PIHAK KEDUA</strong></div>
<div style="text-align:justify;font-size:12pt;line-height:1.9;margin-bottom:14px">PIHAK PERTAMA berjanji akan mewujudkan target kinerja sesuai lampiran yang merupakan bagian tidak terpisahkan perjanjian ini, dalam rangka mencapai target kinerja jangka pendek seperti yang telah ditetapkan dalam dokumen perencanaan. Keberhasilan dan kegagalan pencapaian target kinerja tersebut menjadi tanggung jawab pihak pertama.</div>
<div style="text-align:justify;font-size:12pt;line-height:1.9;margin-bottom:34px">PIHAK KEDUA akan melakukan supervisi yang diperlukan serta melakukan evaluasi terhadap capaian kinerja dari perjanjian ini dan mengambil tindakan yang diperlukan dalam rangka pemberian penghargaan dan sanksi.</div>
${makeSig('Pihak Kedua', pihakKeduaNama, pihakKeduaNip, sigPK, 'Pihak Pertama', nama, nip, sigPeg)}`;

        const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<title>Rencana SKP – ${nama} – ${tahun}</title>
<style>@page{size:A4;margin:25mm 20mm 20mm 30mm}body{font-family:'Times New Roman',serif;font-size:12pt;color:#000;margin:0;padding:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body>${coverHtml}${ikuTableHtml}${pkTableHtml}</body></html>`;

        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();

      } else {
        // EKP doc
        const penilaiNama = bawahanSkpStatus?.atasan?.nama ?? "—";
        const penilaiNip = bawahanSkpStatus?.atasan?.nip ?? "—";
        function hasilKerja(capaian: number | null) {
          if (capaian === null) return { label: "SESUAI EKSPEKTASI", angka: 2 };
          if (capaian >= 100) return { label: "DI ATAS EKSPEKTASI", angka: 3 };
          if (capaian >= 76) return { label: "SESUAI EKSPEKTASI", angka: 2 };
          return { label: "DI BAWAH EKSPEKTASI", angka: 1 };
        }
        const validRows = bawahanRows.filter(r => r.capaianPersen !== null);
        const avgCapaian = validRows.length > 0 ? validRows.reduce((s, r) => s + r.capaianPersen!, 0) / validRows.length : null;
        const predikat = !avgCapaian ? "BAIK" : avgCapaian >= 90 ? "SANGAT BAIK" : avgCapaian >= 76 ? "BAIK" : "CUKUP";
        const periodePenilaian = `02 JANUARI S.D. 31 DESEMBER TAHUN ${tahun}`;
        const hasilKerjaRows = bawahanRows.map((row, i) => {
          const hk = hasilKerja(row.capaianPersen);
          return `<tr><td style="text-align:center;vertical-align:top;padding:4px 5px">${i + 1}</td>
<td style="vertical-align:top;padding:4px 6px"><div style="font-weight:bold;margin-bottom:4px">${row.kodeIndikator ? `${row.kodeIndikator} ` : ""}${row.namaIndikator}</div>
<div style="font-size:8pt">Target: ${row.targetKuantitas ?? "—"}</div></td>
<td style="text-align:center;vertical-align:middle;padding:4px 5px;font-size:8pt">${row.realisasiKuantitas != null ? row.realisasiKuantitas : "—"}</td>
<td style="vertical-align:middle;padding:4px 5px;font-size:8pt"></td>
<td style="vertical-align:middle;padding:4px 5px;font-size:8pt">${hk.label}</td>
<td style="text-align:center;vertical-align:middle;padding:4px 5px;font-weight:bold">${hk.angka}</td></tr>`;
        }).join("");
        const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<title>Hasil SKP – ${nama} – ${tahun}</title>
<style>@page{size:A4 portrait;margin:15mm 12mm 15mm 15mm}body{font-family:'Times New Roman',serif;font-size:9pt;color:#000;margin:0;padding:0}
.main-table{width:100%;border-collapse:collapse}.main-table td,.main-table th{border:1px solid #000;padding:3px 5px;font-size:9pt;vertical-align:top}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body>
<p style="text-align:center;font-size:11pt;font-weight:bold;margin:0 0 2px">DOKUMEN EVALUASI KINERJA PEGAWAI</p>
<p style="text-align:center;font-size:10pt;margin:0 0 10px">PERIODE AKHIR TAHUN ${tahun}</p>
<table class="main-table"><tr><td style="padding:4px 8px">NAMA: <strong>${nama}</strong></td><td style="padding:4px 8px">NIP: ${nip}</td></tr>
<tr><td style="padding:4px 8px">JABATAN: ${jabatan}</td><td style="padding:4px 8px">PERIODE: ${periodePenilaian}</td></tr>
<tr><td style="padding:4px 8px">PEJABAT PENILAI: <strong>${penilaiNama}</strong></td><td style="padding:4px 8px">NIP: ${penilaiNip}</td></tr></table>
<br/>
<p style="text-align:center;font-size:10pt;font-weight:bold;margin:0">EVALUASI KINERJA PEGAWAI — PENDEKATAN HASIL KERJA KUANTITATIF</p>
<table class="main-table" style="margin-top:8px">
<tr style="background:#e8e8e8"><td style="font-weight:bold;font-size:8pt;padding:3px 5px;width:36%">HASIL KERJA</td>
<td style="text-align:center;font-weight:bold;font-size:8pt;padding:3px 5px;width:13%">REALISASI</td>
<td style="text-align:center;font-weight:bold;font-size:8pt;padding:3px 5px;width:18%">UMPAN BALIK</td>
<td colspan="2" style="text-align:center;font-weight:bold;font-size:8pt;padding:3px 5px">HASIL KERJA</td></tr>
${hasilKerjaRows}
<tr style="background:#e8e8e8"><td colspan="3" style="font-weight:bold;padding:3px 6px;font-size:8.5pt">PREDIKAT KINERJA</td><td colspan="2" style="font-weight:bold;padding:3px 6px">${predikat}</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin-top:24px">
<tr>
<td style="width:50%;text-align:center;vertical-align:top;border:none;padding:0">
<p style="margin:0">Pegawai yang Dinilai</p><div style="height:56px"></div>
<p style="margin:0;font-weight:bold">${nama}</p><p style="margin:0;font-size:8.5pt">NIP ${nip}</p></td>
<td style="width:50%;text-align:center;vertical-align:top;border:none;padding:0">
<p style="margin:0">Jakarta, ${tanggal}</p><p style="margin:0">Pejabat Penilai Kinerja</p><div style="height:56px"></div>
<p style="margin:0;font-weight:bold">${penilaiNama}</p><p style="margin:0;font-size:8.5pt">NIP ${penilaiNip}</p></td>
</tr></table>
</body></html>`;
        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();
      }
    } catch {
      toast.error("Gagal memuat data SKP bawahan.");
    }
  }

  async function handleApprove(action: "approved" | "rejected", sigDataUrl?: string) {
    if (!selectedBawahan) return;
    setApproving(true);
    const bawahan = selectedBawahan;
    try {
      await approveBawahanSkp(bawahan.userId, action, tahun);
      toast.success(action === "approved" ? "SKP berhasil disetujui." : "SKP berhasil ditolak.");
      closeModal();
      fetchBawahanSKP();
      if (action === "approved") generateSuratSKP(bawahan, sigDataUrl);
    } catch {
      toast.error("Gagal memproses persetujuan.");
    } finally {
      setApproving(false);
    }
  }

  function toggleBulkSelect(userId: number) {
    setSelectedForBulk(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll() {
    const approvable = bawahanList.filter(b => b.validatedCount >= b.totalIndikator && b.totalIndikator > 0);
    if (selectedForBulk.size === approvable.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(approvable.map(b => b.userId)));
    }
  }

  const allValidated =
    rows.length > 0 && rows.every((r) => r.realisasiKuantitas !== null && r.realisasiKuantitas > 0);

  const handleCetak = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
      <title>SKP – ${user?.nama}</title>
      <style>
        body{font-family:'Times New Roman',serif;font-size:12px;margin:0;color:#000}
        .wrap{padding:32px 48px}
        h1{text-align:center;font-size:14px;text-transform:uppercase;margin-bottom:4px}
        .sub{text-align:center;font-size:11px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #000;padding:6px 8px}
        th{background:#f3f3f3;text-align:center;font-size:11px}
        td{font-size:11px}
        .signature{display:flex;justify-content:flex-end;margin-top:40px}
        .sig-box{text-align:center;width:200px}
        .sig-line{border-bottom:1px solid #000;margin:48px 0 4px}
      </style>
    </head><body>${printRef.current.innerHTML}</body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  // ─────────────── Styles ───────────────
  const thStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontWeight: 700,
    fontSize: 11,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "2px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    textAlign: "left",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 13,
    color: "#374151",
    borderBottom: "1px solid #f8f8f8",
    verticalAlign: "top",
  };

  const canApprove =
    selectedBawahan !== null &&
    selectedBawahan.validatedCount >= selectedBawahan.totalIndikator &&
    selectedBawahan.totalIndikator > 0;

  const approvableCount = bawahanList.filter(b => b.validatedCount >= b.totalIndikator && b.totalIndikator > 0).length;

  // ─────────────── Render ───────────────
  return (
    <div>
      <PageTransition>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, margin: 0 }}>
            Sasaran Kinerja Pegawai (SKP)
          </p>
          
        </div>

        {/* ── Card identitas pegawai ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 16 }}>
                Identitas Pegawai
              </h3>
              {[
                ["NIP", user?.nip ?? "—"],
                ["Nama", user?.nama ?? "—"],
                ["Jabatan", user?.role ?? "—"],
                ["Unit Kerja", user?.unitNama ?? "—"],
                ["Tahun Penilaian", tahun],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 0, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ width: 140, color: "#6b7280", flexShrink: 0 }}>{label}</span>
                  <span style={{ width: 12, color: "#6b7280", flexShrink: 0 }}>:</span>
                  <span style={{ color: "#1f2937", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
             <button
            onClick={() => {
              const basePath = roleLevel <= 1 ? "/pimpinan" : "/user";
              router.push(`${basePath}/skp/cetak`);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "#1d4ed8",
              color: "#fff",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            🖨️ Cetak Rencana SKP
          </button>
          <button
            onClick={generateEvaluasiKinerjaPegawai}
            disabled={rows.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: rows.length === 0 ? "#9ca3af" : "#7c3aed",
              color: "#fff",
              fontWeight: 600,
              fontSize: 12,
              cursor: rows.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            📄 Cetak Hasil SKP
          </button>

              {rows.length === 0 && (
                <span style={{ fontSize: 11, color: "#6b7280", textAlign: "right" }}>
                  Tersedia setelah target didisposisikan
                </span>
              )}
              {isDosen && mySkpStatus?.status === "approved" && (
                <button
                  onClick={generateSuratSKPDosen}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "#16a34a",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ⬇️ Unduh Surat SKP
                </button>
              )}
              {isDosen && mySkpStatus?.status === "approved" && (
                <span style={{ fontSize: 11, color: "#16a34a", textAlign: "right", fontWeight: 600 }}>
                  ✓ SKP Anda telah disetujui
                </span>
              )}
              {isDosen && mySkpStatus?.status === "rejected" && (
                <span style={{ fontSize: 11, color: "#dc2626", textAlign: "right", fontWeight: 600 }}>
                  ✗ SKP ditolak — hubungi atasan Anda
                </span>
              )}
              {isDosen && (mySkpStatus?.status === "pending" || mySkpStatus === null) && (
                <span style={{ fontSize: 11, color: "#6b7280", textAlign: "right" }}>
                  Menunggu persetujuan atasan
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabel SKP Sendiri ── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 20 }}>
            Rincian Sasaran Kinerja
          </h3>

          {loading ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>Memuat data SKP…</p>
          ) : rows.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
              Belum ada indikator yang didisposisikan untuk tahun {tahun}.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead>
                  <tr>
                    {["No", "Kode", "Indikator / Sasaran Program", "Target", "Realisasi", "Capaian (%)", "Predikat"].map(
                      (h) => <th key={h} style={thStyle}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cap = nilaiCapaian(row.capaianPersen);
                    return (
                      <tr key={row.id}>
                        <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{row.no}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, width: 80 }}>
                          {row.kodeIndikator}
                        </td>
                        <td style={tdStyle}>
                          <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{row.namaIndikator}</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {row.sasaranStrategis}
                          </p>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", width: 90 }}>
                          {row.targetKuantitas !== null ? row.targetKuantitas : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", width: 90 }}>
                          {row.realisasiKuantitas !== null ? row.realisasiKuantitas : <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", width: 90, fontWeight: 700, color: cap.color }}>
                          {cap.nilai}
                        </td>
                        <td style={{ ...tdStyle, width: 110, color: cap.color, fontWeight: 600, fontSize: 11 }}>
                          {cap.predikat}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Seksi Persetujuan SKP Bawahan (hanya untuk dekan) ── */}
        {isDekan && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 0 }}>
                  Persetujuan SKP
                </h3>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>
                  Tinjau dan tanda tangani SKP seluruh pegawai. Hanya tersedia setelah realisasi divalidasi oleh atasan masing-masing.
                </p>
              </div>
              {selectedForBulk.size > 0 && (
                <button
                  onClick={() => setBulkSigOpen(true)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "#FF7900",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  ✍️ Tanda Tangani Terpilih ({selectedForBulk.size})
                </button>
              )}
            </div>

            <div style={{ marginBottom: 16, marginTop: 16 }}>
              {approvableCount > 0 && (
                <button
                  onClick={toggleSelectAll}
                  style={{
                    fontSize: 12,
                    color: "#FF7900",
                    background: "none",
                    border: "1px solid #FF7900",
                    borderRadius: 6,
                    padding: "4px 12px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {selectedForBulk.size === approvableCount ? "Batal Pilih Semua" : `Pilih Semua yang Siap (${approvableCount})`}
                </button>
              )}
            </div>

            {bawahanLoading ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>Memuat data…</p>
            ) : bawahanList.length === 0 ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>
                Belum ada pegawai yang mengajukan realisasi untuk tahun {tahun}.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 40, textAlign: "center" }}>✓</th>
                      {["No", "Nama", "Total Indikator", "Tervalidasi", "Rata-rata Capaian", "Status SKP", "Aksi"].map(
                        (h) => <th key={h} style={thStyle}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {bawahanList.map((b, i) => {
                      const cap = nilaiCapaian(b.avgCapaian);
                      const isReady = b.validatedCount >= b.totalIndikator && b.totalIndikator > 0;
                      const isChecked = selectedForBulk.has(b.userId);
                      return (
                        <tr key={b.userId} style={{ backgroundColor: isChecked ? "#fff7ed" : undefined }}>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {isReady && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleBulkSelect(b.userId)}
                                style={{ cursor: "pointer", width: 16, height: 16 }}
                              />
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{i + 1}</td>
                          <td style={tdStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{b.nama}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{b.email}</p>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>{b.totalIndikator}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ color: isReady ? "#16a34a" : "#d97706", fontWeight: 600 }}>
                              {b.validatedCount} / {b.totalIndikator}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: cap.color }}>
                            {cap.nilai}{b.avgCapaian !== null ? "%" : ""}
                          </td>
                          <td style={tdStyle}>{skpStatusBadge(b.skpStatus)}</td>
                          <td style={{ ...tdStyle, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => setSelectedBawahan(b)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 6,
                                border: "1px solid #FF7900",
                                backgroundColor: "white",
                                color: "#FF7900",
                                fontWeight: 600,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              Periksa &amp; Setujui
                            </button>
                            {b.skpStatus === "approved" && (
                              <button
                                onClick={() => generateSuratSKP(b)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "1px solid #16a34a",
                                  backgroundColor: "white",
                                  color: "#16a34a",
                                  fontWeight: 600,
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                ⬇️ Unduh Surat
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Checker: Pemeriksaan Dokumen SKP Bawahan ── */}
        {(checkerBawahan.checkerBawahan.length > 0 || checkerBawahan.rencanaSKPBawahan.length > 0 || checkerBawahan.ekpBawahan.length > 0) && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
              Pemeriksaan Dokumen SKP
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px" }}>
              Daftar pegawai yang dokumen SKP-nya memerlukan persetujuan atau paraf Anda berdasarkan konfigurasi penilai.
            </p>

            {/* Rencana SKP — Checker: Validasi sebelum Pihak Kedua TTD */}
            {checkerBawahan.checkerBawahan.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706", backgroundColor: "#fef9c3", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: 20 }}>
                    Rencana SKP — Pengecekan Checker
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Pegawai sudah mengajukan — perlu validasi Anda sebelum Pihak Kedua menandatangani</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                    <thead>
                      <tr>
                        {["No", "Nama", "Jabatan", "NIP", "Status", "Aksi"].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {checkerBawahan.checkerBawahan.map((b, i) => (
                        <tr key={b.userId}>
                          <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{i + 1}</td>
                          <td style={tdStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{b.nama}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{b.email}</p>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{b.jabatan}</td>
                          <td style={{ ...tdStyle, fontSize: 12, fontFamily: "monospace" }}>{b.nip ?? "—"}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", backgroundColor: "#fef9c3", padding: "3px 8px", borderRadius: 20, border: "1px solid #fde68a" }}>
                              ⏳ Menunggu Pengecekan
                            </span>
                          </td>
                          <td style={{ ...tdStyle, display: "flex", gap: 6 }}>
                            <button
                              onClick={() => generateCheckerDoc(b, 'rencana')}
                              style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #d97706", backgroundColor: "white", color: "#d97706", fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              Lihat
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await checkRencanaSKPChecker(b.userId, tahun, null);
                                  const updated = await getSkpCheckerBawahan(user!.id, tahun);
                                  setCheckerBawahan(updated);
                                  toast.success(`Rencana SKP ${b.nama} berhasil divalidasi.`);
                                } catch {
                                  toast.error('Gagal memvalidasi rencana SKP.');
                                }
                              }}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "none", backgroundColor: "#d97706", color: "white", fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              ✓ Validasi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rencana SKP — TTD Pihak Kedua (setelah checker validasi) */}
            {checkerBawahan.rencanaSKPBawahan.length > 0 && (() => {
              const eligible = checkerBawahan.rencanaSKPBawahan.filter(b => b.rencanaStatus === 'checked' || b.rencanaStatus === 'signed_pegawai');
              const done = checkerBawahan.rencanaSKPBawahan.filter(b => b.rencanaStatus === 'signed_pihak_kedua');
              const allSelected = eligible.length > 0 && rencanaSelected.size === eligible.length;
              if (eligible.length === 0 && done.length === 0) return null;
              return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", padding: "3px 10px", borderRadius: 20 }}>
                      Rencana SKP — TTD Pihak Kedua
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>Sudah divalidasi atasan — siap ditandatangani Pihak Kedua</span>
                  </div>
                  {rencanaSelected.size > 0 && (
                    <button
                      onClick={() => setBulkRencanaSignModal(true)}
                      style={{ padding: "8px 18px", borderRadius: 8, border: "none", backgroundColor: "#059669", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      ✍️ TTD Terpilih ({rencanaSelected.size})
                    </button>
                  )}
                </div>
                {eligible.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <button
                      onClick={toggleRencanaSelectAll}
                      style={{ fontSize: 12, color: "#059669", background: "none", border: "1px solid #059669", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}
                    >
                      {allSelected ? "Batal Pilih Semua" : `Pilih Semua Siap TTD (${eligible.length})`}
                    </button>
                  </div>
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 660 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 40, textAlign: "center" }}>✓</th>
                        {["No", "Nama", "Jabatan", "NIP", "Status", "Aksi"].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...eligible, ...done].map((b, i) => {
                        const isDone = b.rencanaStatus === 'signed_pihak_kedua';
                        const checked = rencanaSelected.has(b.userId);
                        return (
                        <tr key={b.userId} style={{ backgroundColor: checked ? "#f0fdf4" : undefined }}>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {!isDone && (
                              <input type="checkbox" checked={checked} onChange={() => toggleRencanaSelect(b.userId)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{i + 1}</td>
                          <td style={tdStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{b.nama}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{b.email}</p>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{b.jabatan}</td>
                          <td style={{ ...tdStyle, fontSize: 12, fontFamily: "monospace" }}>{b.nip ?? "—"}</td>
                          <td style={tdStyle}>
                            {isDone
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", backgroundColor: "#dcfce7", padding: "3px 8px", borderRadius: 20, border: "1px solid #86efac" }}>✓ TTD Selesai</span>
                              : b.rencanaStatus === 'checked'
                                ? <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", backgroundColor: "#eff6ff", padding: "3px 8px", borderRadius: 20, border: "1px solid #bfdbfe" }}>✓ Sudah Dicek</span>
                                : <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", backgroundColor: "#ecfdf5", padding: "3px 8px", borderRadius: 20, border: "1px solid #6ee7b7" }}>✓ Diajukan Pegawai</span>
                            }
                          </td>
                          <td style={{ ...tdStyle, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              onClick={() => generateCheckerDoc(b, 'rencana')}
                              style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #1d4ed8", backgroundColor: "white", color: "#1d4ed8", fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              Cetak
                            </button>
                            {!isDone && (
                              <button
                                onClick={() => setPkSignModal({ open: true, target: b })}
                                style={{ padding: "5px 10px", borderRadius: 6, border: "none", backgroundColor: "#059669", color: "white", fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                ✍️ TTD
                              </button>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            {/* EKP checker */}
            {checkerBawahan.ekpBawahan.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", border: "1px solid #c4b5fd", padding: "3px 10px", borderRadius: 20 }}>
                    Hasil SKP — Pejabat Penilai
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Anda dikonfigurasi sebagai Pejabat Penilai untuk jabatan-jabatan berikut</span>
                </div>
                <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                  Hanya menampilkan pegawai yang realisasinya sudah divalidasi oleh atasan langsung.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                    <thead>
                      <tr>
                        {["No", "Nama", "Jabatan", "NIP", "Status SKP", "Aksi"].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {checkerBawahan.ekpBawahan.map((b, i) => (
                        <tr key={b.userId}>
                          <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{i + 1}</td>
                          <td style={tdStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{b.nama}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{b.email}</p>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{b.jabatan}</td>
                          <td style={{ ...tdStyle, fontSize: 12, fontFamily: "monospace" }}>{b.nip ?? "—"}</td>
                          <td style={tdStyle}>{skpStatusBadge(b.skpStatus || 'pending')}</td>
                          <td style={tdStyle}>
                            <button
                              onClick={() => generateCheckerDoc(b, 'ekp')}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 6,
                                border: "1px solid #7c3aed",
                                backgroundColor: "white",
                                color: "#7c3aed",
                                fontWeight: 600,
                                fontSize: 12,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Cetak Hasil SKP
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {checkerLoading && (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>Memuat data…</p>
            )}
          </div>
        )}

        {/* ── Modal Detail Bawahan ── */}
        {selectedBawahan && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: 14,
                width: "100%",
                maxWidth: 800,
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              }}
            >
              {/* Modal header */}
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>
                    {sigStep === 'review' ? `Detail SKP — ${selectedBawahan.nama}` : 'Tanda Tangan Persetujuan SKP'}
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    {sigStep === 'review' ? `${selectedBawahan.email} • Tahun ${tahun}` : `Buat tanda tangan digital untuk SKP ${selectedBawahan.nama}`}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}
                >
                  ✕
                </button>
              </div>

              {/* Modal body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {sigStep === 'review' ? (
                  <>
                    {/* Stats row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                      {[
                        { label: "Total Indikator", val: selectedBawahan.totalIndikator },
                        { label: "Tervalidasi", val: `${selectedBawahan.validatedCount} / ${selectedBawahan.totalIndikator}` },
                        { label: "Rata-rata Capaian", val: selectedBawahan.avgCapaian !== null ? `${selectedBawahan.avgCapaian}%` : "—" },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: "12px 16px", border: "1px solid #e5e7eb" }}>
                          <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{label}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "#1f2937" }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {/* Realisasi table */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>{["No", "Kode", "Nama Indikator", "Realisasi File", "File Valid", "Capaian", "File"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {selectedBawahan.realisasi.map((r, i) => {
                            const capaian = r.validFileCount !== null && r.realisasiAngka > 0 ? Math.min((r.validFileCount / r.realisasiAngka) * 100, 100) : null;
                            const cap = nilaiCapaian(capaian);
                            const isExpanded = viewingFilesForId === r.indikatorId;
                            return (
                              <React.Fragment key={r.id}>
                                <tr>
                                  <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{i + 1}</td>
                                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, width: 80 }}>{r.kodeIndikator}</td>
                                  <td style={tdStyle}>{r.namaIndikator}</td>
                                  <td style={{ ...tdStyle, textAlign: "center" }}>{r.realisasiAngka}</td>
                                  <td style={{ ...tdStyle, textAlign: "center" }}>
                                    {r.validFileCount !== null ? r.validFileCount : <span style={{ color: "#9ca3af" }}>Belum divalidasi</span>}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, color: cap.color }}>
                                    {cap.nilai}{capaian !== null ? "%" : ""}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: "center" }}>
                                    <button
                                      onClick={() => {
                                        if (isExpanded) {
                                          setViewingFilesForId(null);
                                          setViewFiles([]);
                                        } else {
                                          loadFilesForIndikator(r.indikatorId, selectedBawahan.email);
                                        }
                                      }}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #6366f1",
                                        backgroundColor: isExpanded ? "#6366f1" : "white",
                                        color: isExpanded ? "white" : "#6366f1",
                                        fontWeight: 600,
                                        fontSize: 11,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {isExpanded ? "Tutup" : "Lihat File"}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: "8px 16px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                                      {viewFilesLoading ? (
                                        <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Memuat file…</p>
                                      ) : viewFiles.length === 0 ? (
                                        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Tidak ada file ditemukan untuk indikator ini.</p>
                                      ) : (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                          {viewFiles.map((f, fi) => (
                                            <a
                                              key={fi}
                                              href={f.download_url || f.preview_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                padding: "6px 12px",
                                                borderRadius: 6,
                                                border: "1px solid #e5e7eb",
                                                backgroundColor: "white",
                                                color: "#1f2937",
                                                fontSize: 12,
                                                textDecoration: "none",
                                                fontWeight: 500,
                                              }}
                                            >
                                              📄 {f.name}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {!canApprove && (
                      <div style={{ marginTop: 16, padding: "10px 14px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                        Semua indikator harus divalidasi terlebih dahulu di halaman Validasi Realisasi sebelum SKP dapat disetujui.
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Signature step ── */
                  <div>
                    <p style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
                      Buat tanda tangan di bawah untuk menyetujui SKP <strong>{selectedBawahan.nama}</strong>. Tanda tangan akan dicetak pada surat SKP.
                    </p>
                    <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", cursor: "crosshair" }}>
                      <canvas
                        ref={sigCanvasRef}
                        width={700}
                        height={160}
                        style={{ display: "block", width: "100%", touchAction: "none" }}
                        onMouseDown={sigMouseDown}
                        onMouseMove={sigMouseMove}
                        onMouseUp={sigMouseUp}
                        onMouseLeave={sigMouseUp}
                        onTouchStart={sigTouchStart}
                        onTouchMove={sigTouchMove}
                        onTouchEnd={() => { sigIsDrawing.current = false; }}
                      />
                      {!sigHasDrawn && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 13, pointerEvents: "none" }}>
                          Tanda tangan di sini
                        </div>
                      )}
                    </div>
                    <button
                      onClick={clearSig}
                      style={{ marginTop: 8, fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      ✕ Hapus tanda tangan
                    </button>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                {sigStep === 'review' ? (
                  <>
                    <button onClick={closeModal} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      Tutup
                    </button>
                    <button
                      onClick={() => handleApprove("rejected")}
                      disabled={!canApprove || approving}
                      style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: canApprove ? "#fee2e2" : "#f3f4f6", color: canApprove ? "#991b1b" : "#9ca3af", fontWeight: 600, fontSize: 13, cursor: canApprove ? "pointer" : "not-allowed" }}
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => setSigStep('sign')}
                      disabled={!canApprove}
                      style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: canApprove ? "#FF7900" : "#d1d5db", color: canApprove ? "white" : "#9ca3af", fontWeight: 600, fontSize: 13, cursor: canApprove ? "pointer" : "not-allowed" }}
                    >
                      Setujui SKP →
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setSigStep('review')} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      ← Kembali
                    </button>
                    <button
                      onClick={confirmApprove}
                      disabled={approving}
                      style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#16a34a", color: "white", fontWeight: 600, fontSize: 13, cursor: approving ? "not-allowed" : "pointer" }}
                    >
                      {approving ? "Memproses…" : "Konfirmasi Setujui"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Bulk Signature ── */}
        {bulkSigOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) closeBulkSig(); }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: 14,
                width: "100%",
                maxWidth: 640,
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>
                    Tanda Tangan Massal SKP
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    {selectedForBulk.size} pegawai akan disetujui sekaligus
                  </p>
                </div>
                <button onClick={closeBulkSig} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
              </div>

              {/* Body */}
              <div style={{ padding: "16px 24px" }}>
                {/* Selected names */}
                <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#166534" }}>Pegawai yang akan disetujui:</p>
                  {bawahanList
                    .filter(b => selectedForBulk.has(b.userId))
                    .map(b => (
                      <p key={b.userId} style={{ margin: "2px 0", fontSize: 12, color: "#166534" }}>• {b.nama}</p>
                    ))
                  }
                </div>

                {/* Signature pad */}
                <p style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
                  Tanda tangan di bawah untuk menyetujui semua SKP yang dipilih:
                </p>
                <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", cursor: "crosshair" }}>
                  <canvas
                    ref={bulkSigCanvasRef}
                    width={600}
                    height={150}
                    style={{ display: "block", width: "100%", touchAction: "none" }}
                    onMouseDown={bulkSigMouseDown}
                    onMouseMove={bulkSigMouseMove}
                    onMouseUp={bulkSigMouseUp}
                    onMouseLeave={bulkSigMouseUp}
                    onTouchStart={bulkSigTouchStart}
                    onTouchMove={bulkSigTouchMove}
                    onTouchEnd={() => { bulkSigIsDrawing.current = false; }}
                  />
                  {!bulkSigHasDrawn && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 13, pointerEvents: "none" }}>
                      Tanda tangan di sini
                    </div>
                  )}
                </div>
                <button
                  onClick={clearBulkSig}
                  style={{ marginTop: 8, fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ✕ Hapus tanda tangan
                </button>
              </div>

              {/* Footer */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={closeBulkSig}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  onClick={confirmBulkApprove}
                  disabled={bulkApproving}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#FF7900", color: "white", fontWeight: 700, fontSize: 13, cursor: bulkApproving ? "not-allowed" : "pointer" }}
                >
                  {bulkApproving ? "Memproses…" : `Setujui ${selectedForBulk.size} SKP`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Hidden print template ── */}
        <div style={{ display: "none" }}>
          <div ref={printRef}>
            <div className="wrap">
              <h1>SASARAN KINERJA PEGAWAI</h1>
              <p className="sub">
                Periode Penilaian: 1 Januari {tahun} s/d 31 Desember {tahun}
              </p>
              <table>
                <tbody>
                  {[
                    ["NIP", user?.nip ?? "—"],
                    ["Nama", user?.nama ?? "—"],
                    ["Jabatan", user?.role ?? "—"],
                    ["Unit Kerja", user?.unitNama ?? "—"],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td style={{ width: 160, fontWeight: 600 }}>{label}</td>
                      <td style={{ width: 12 }}>:</td>
                      <td>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table style={{ marginTop: 20 }}>
                <thead>
                  <tr>
                    {["No", "Kode", "Indikator", "Sasaran Program", "Target", "Realisasi", "Capaian (%)", "Predikat"].map(
                      (h) => <th key={h}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cap = nilaiCapaian(row.capaianPersen);
                    return (
                      <tr key={row.id}>
                        <td style={{ textAlign: "center" }}>{row.no}</td>
                        <td>{row.kodeIndikator}</td>
                        <td>{row.namaIndikator}</td>
                        <td>{row.sasaranStrategis}</td>
                        <td style={{ textAlign: "center" }}>
                          {row.targetKuantitas !== null ? row.targetKuantitas : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {row.realisasiKuantitas !== null ? row.realisasiKuantitas : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>{cap.nilai}</td>
                        <td>{cap.predikat}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="signature">
                <div className="sig-box">
                  <p style={{ margin: 0 }}>
                    __________, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p style={{ margin: "4px 0 0" }}>Pejabat Penilai,</p>
                  <div className="sig-line" />
                  <p style={{ margin: 0, fontWeight: 600 }}>NIP. ___________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* ── Modal Bulk TTD Rencana SKP (Pihak Kedua massal) ── */}
        {bulkRencanaSignModal && (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) setBulkRencanaSignModal(false); }}
          >
            <div style={{ backgroundColor: "white", borderRadius: 14, width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>Validasi Massal Rencana SKP</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    {rencanaSelected.size} pegawai akan disetujui sekaligus
                  </p>
                </div>
                <button onClick={() => setBulkRencanaSignModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
              </div>
              <div style={{ padding: "16px 24px" }}>
                <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#166534" }}>Pegawai yang akan divalidasi:</p>
                  {checkerBawahan.rencanaSKPBawahan
                    .filter(b => rencanaSelected.has(b.userId))
                    .map(b => (
                      <p key={b.userId} style={{ margin: "2px 0", fontSize: 12, color: "#166534" }}>• {b.nama} ({b.jabatan})</p>
                    ))}
                </div>
                <p style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>Buat satu tanda tangan untuk menyetujui semua Rencana SKP di atas.</p>
                <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", cursor: "crosshair" }}>
                  <canvas
                    ref={bulkRencanaCanvasRef}
                    width={560}
                    height={150}
                    style={{ display: "block", width: "100%", touchAction: "none" }}
                    onMouseDown={bulkRencanaHandlers.onMouseDown}
                    onMouseMove={bulkRencanaHandlers.onMouseMove}
                    onMouseUp={bulkRencanaHandlers.onMouseUp}
                    onMouseLeave={bulkRencanaHandlers.onMouseUp}
                    onTouchStart={bulkRencanaHandlers.onTouchStart}
                    onTouchMove={bulkRencanaHandlers.onTouchMove}
                    onTouchEnd={bulkRencanaHandlers.onTouchEnd}
                  />
                  {!bulkRencanaHasDrawn && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 13, pointerEvents: "none" }}>
                      Tanda tangan di sini
                    </div>
                  )}
                </div>
                <button onClick={bulkRencanaHandlers.clear} style={{ marginTop: 6, fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  ✕ Hapus tanda tangan
                </button>
              </div>
              <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setBulkRencanaSignModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Batal
                </button>
                <button
                  onClick={handleBulkRencanaSignConfirm}
                  disabled={bulkRencanaSaving}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#059669", color: "white", fontWeight: 600, fontSize: 13, cursor: bulkRencanaSaving ? "not-allowed" : "pointer" }}
                >
                  {bulkRencanaSaving ? "Menyimpan…" : `Setujui ${rencanaSelected.size} Rencana SKP`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal TTD Pihak Kedua (dari checker) ── */}
        {pkSignModal.open && pkSignModal.target && (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) setPkSignModal({ open: false, target: null }); }}
          >
            <div style={{ backgroundColor: "white", borderRadius: 14, width: "100%", maxWidth: 640, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>TTD Persetujuan Rencana SKP</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    Tanda tangan persetujuan untuk <strong>{pkSignModal.target.nama}</strong> — {pkSignModal.target.jabatan}
                  </p>
                </div>
                <button onClick={() => setPkSignModal({ open: false, target: null })} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
              </div>
              <div style={{ padding: "16px 24px" }}>
                <div style={{ marginBottom: 12, padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#166534" }}>
                  Dengan menandatangani, Anda menyetujui Rencana SKP {pkSignModal.target.nama} untuk tahun {tahun} sebagai Pihak Kedua.
                </div>
                <div style={{ position: "relative", border: "2px solid #e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff", cursor: "crosshair" }}>
                  <canvas
                    ref={pkSignCanvasRef}
                    width={560}
                    height={150}
                    style={{ display: "block", width: "100%", touchAction: "none" }}
                    onMouseDown={pkHandlers.onMouseDown}
                    onMouseMove={pkHandlers.onMouseMove}
                    onMouseUp={pkHandlers.onMouseUp}
                    onMouseLeave={pkHandlers.onMouseUp}
                    onTouchStart={pkHandlers.onTouchStart}
                    onTouchMove={pkHandlers.onTouchMove}
                    onTouchEnd={pkHandlers.onTouchEnd}
                  />
                  {!pkSignHasDrawn && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 13, pointerEvents: "none" }}>
                      Tanda tangan di sini
                    </div>
                  )}
                </div>
                <button onClick={pkHandlers.clear} style={{ marginTop: 6, fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  ✕ Hapus tanda tangan
                </button>
              </div>
              <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setPkSignModal({ open: false, target: null })} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Batal
                </button>
                <button
                  onClick={handlePkSignConfirm}
                  disabled={pkSignSaving}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#059669", color: "white", fontWeight: 600, fontSize: 13, cursor: pkSignSaving ? "not-allowed" : "pointer" }}
                >
                  {pkSignSaving ? "Menyimpan…" : "Setujui & Tandatangani"}
                </button>
              </div>
            </div>
          </div>
        )}

      </PageTransition>
    </div>
  );
}
