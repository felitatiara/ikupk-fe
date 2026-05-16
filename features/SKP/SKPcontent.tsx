"use client";

import React, { useState, useEffect, useRef } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import {
  getIndikatorGroupedForUser,
  getSkpBawahan,
  approveBawahanSkp,
  getMySkpStatus,
  getAllRealisasiFiles,
  getAvailableYears,
  type SkpBawahanRow,
  type MySkpStatus,
} from "@/lib/api";
import { toast } from "sonner";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
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
function nilaiCapaian(persen: number | null): { nilai: string; predikat: string; color: string } {
  if (persen === null) return { nilai: "—", predikat: "Belum ada data", color: "#6b7280" };
  if (persen >= 100) return { nilai: persen.toFixed(1), predikat: "Sangat Baik", color: "#16a34a" };
  if (persen >= 76) return { nilai: persen.toFixed(1), predikat: "Baik", color: "#2563eb" };
  if (persen >= 51) return { nilai: persen.toFixed(1), predikat: "Cukup", color: "#d97706" };
  return { nilai: persen.toFixed(1), predikat: "Kurang", color: "#dc2626" };
}

function skpStatusBadge(status: 'approved' | 'rejected' | 'pending') {
  const map = {
    pending: { label: "Menunggu Persetujuan", bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
    approved: { label: "Disetujui", bg: "#dcfce7", color: "#166534", border: "#86efac" },
    rejected: { label: "Ditolak", bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  };
  const s = map[status];
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
  }, [user, tahun]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOwnSKP() {
    setLoading(true);
    try {
      const roleId: number = user?.roleId
      ?? user?.roles?.find((r: { id: number; isPrimary: boolean }) => r.isPrimary)?.id
      ?? user?.roles?.[0]?.id
      ?? 0;
      const [ikuData, pkData] = await Promise.all([
        getIndikatorGroupedForUser("IKU", tahun, user!.id, roleId),
        getIndikatorGroupedForUser("PK", tahun, user!.id, roleId),
      ]);
      const allData = [...ikuData, ...pkData];
      const newRows: SKPRow[] = [];
      let no = 1;

      function pushRow(item: any, sasaran: string) {
        const target = (item.disposisiJumlah ?? null) as number | null;
        const realisasi = (item.realisasiJumlah ?? null) as number | null;
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

      for (const group of allData) {
        for (const sub of group.subIndikators) {
          const children = (sub.children ?? []) as any[];
          if (children.length === 0) {
            pushRow(sub, group.nama);
          } else {
            for (const child of children) {
              const grandchildren = (child.children ?? []) as any[];
              if (grandchildren.length === 0) {
                // IKU leaf at L2
                pushRow(child, group.nama);
              } else {
                // PK leaf at L3
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
    const jabatan = user?.role ?? "—";
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
        <th>Sasaran Strategis</th>
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
    padding: "10px 12px",
    fontWeight: 700,
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    textAlign: "left",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
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
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Sasaran Kinerja Pegawai (SKP)
        </p>

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
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 16 }}>
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
                onClick={generateRencanaSKP}
                disabled={rows.length === 0}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: rows.length > 0 ? "#2563eb" : "#d1d5db",
                  color: rows.length > 0 ? "white" : "#9ca3af",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: rows.length > 0 ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                🖨️ Cetak Rencana SKP
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
              {!isDosen && (
                <>
                  <button
                    onClick={handleCetak}
                    disabled={!allValidated}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      backgroundColor: allValidated ? "#FF7900" : "#d1d5db",
                      color: allValidated ? "white" : "#9ca3af",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: allValidated ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    🖨️ Cetak / Unduh SKP
                  </button>
                  {!allValidated && (
                    <span style={{ fontSize: 11, color: "#6b7280", textAlign: "right" }}>
                      Tersedia setelah semua indikator diisi
                    </span>
                  )}
                </>
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
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 20 }}>
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
                    {["No", "Kode", "Indikator / Sasaran Strategis", "Target", "Realisasi", "Capaian (%)", "Predikat"].map(
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
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 0 }}>
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
                    {["No", "Kode", "Indikator", "Sasaran Strategis", "Target", "Realisasi", "Capaian (%)", "Predikat"].map(
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
      </PageTransition>
    </div>
  );
}
