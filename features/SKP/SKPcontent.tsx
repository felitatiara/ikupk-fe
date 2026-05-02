"use client";

import React, { useState, useEffect, useRef } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import {
  getIndikatorGroupedForUser,
  getSkpBawahan,
  approveBawahanSkp,
  getMySkpStatus,
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
  const { user } = useAuth();
  const roleLevel = user?.roleLevel ?? 4;
  const isDosen = roleLevel >= 4;
  const tahun = new Date().getFullYear().toString();

  // Own SKP
  const [rows, setRows] = useState<SKPRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dosen: own SKP approval status
  const [mySkpStatus, setMySkpStatus] = useState<MySkpStatus | null>(null);

  // Atasan: bawahan list
  const [bawahanList, setBawahanList] = useState<SkpBawahanRow[]>([]);
  const [bawahanLoading, setBawahanLoading] = useState(false);

  // Atasan: approval modal
  const [selectedBawahan, setSelectedBawahan] = useState<SkpBawahanRow | null>(null);
  const [approving, setApproving] = useState(false);

  // Signature pad
  const [sigStep, setSigStep] = useState<'review' | 'sign'>('review');
  const [sigHasDrawn, setSigHasDrawn] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigIsDrawing = useRef(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchOwnSKP();
    if (isDosen) fetchMySkpStatus();
    else fetchBawahanSKP();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOwnSKP() {
    setLoading(true);
    try {
      const roleId = user?.roleId ?? 0;
      const [ikuData, pkData] = await Promise.all([
        getIndikatorGroupedForUser("IKU", tahun, user!.id, roleId),
        getIndikatorGroupedForUser("PK", tahun, user!.id, roleId),
      ]);
      const allData = [...ikuData, ...pkData];
      const newRows: SKPRow[] = [];
      let no = 1;
      for (const group of allData) {
        for (const sub of group.subIndikators) {
          const target = sub.disposisiJumlah ?? null;
          const realisasi = sub.realisasiJumlah ?? null;
          const capaian =
            target !== null && target > 0 && realisasi !== null
              ? Math.min((realisasi / target) * 100, 100)
              : null;
          newRows.push({
            id: sub.id,
            no: no++,
            kodeIndikator: sub.kode,
            namaIndikator: sub.nama,
            sasaranStrategis: group.nama,
            targetKuantitas: target,
            realisasiKuantitas: realisasi,
            capaianPersen: capaian,
          });
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
      const data = await getSkpBawahan(user!.id, tahun);
      setBawahanList(data);
    } catch (err) {
      console.error("Failed to fetch bawahan SKP:", err);
    } finally {
      setBawahanLoading(false);
    }
  }

  // ── Signature pad helpers ──
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

  function closeModal() {
    setSelectedBawahan(null);
    setSigStep('review');
    setSigHasDrawn(false);
  }

  async function confirmApprove() {
    if (!sigCanvasRef.current || !selectedBawahan) return;
    const sigDataUrl = sigHasDrawn ? sigCanvasRef.current.toDataURL('image/png') : undefined;
    await handleApprove("approved", sigDataUrl);
  }

  function openSuratSKP(opts: {
    subjekNama: string;
    realisasiItems: { namaIndikator: string; realisasiAngka: number }[];
    signerNama: string;
    signerNip: string | null;
    sigDataUrl?: string;
  }) {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const tanggal = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const indikatorLines = opts.realisasiItems
      .map(
        (r) =>
          `<p style="margin:0 0 6px;line-height:1.8;color:#1a237e;">Dinyatakan bahwa <em>${r.namaIndikator}</em> dengan target <strong>${r.realisasiAngka}</strong> terpenuhi</p>`,
      )
      .join("");

    const sigImg = opts.sigDataUrl
      ? `<img src="${opts.sigDataUrl}" style="max-height:56pt;max-width:180pt;display:block;margin:4pt auto;" />`
      : `<div style="height:56pt;"></div>`;

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Surat SKP — ${opts.subjekNama}</title>
  <style>
    @page { size: A4; margin: 40mm 30mm 30mm 30mm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; margin: 0; }
    .wrap { padding: 0; }
    .recipient { margin-bottom: 36pt; }
    .recipient p { margin: 0; line-height: 1.7; color: #1a237e; font-weight: bold; }
    .body { margin-bottom: 36pt; }
    .body p { margin: 0 0 8pt; line-height: 1.8; text-align: justify; }
    .closing { color: #000; line-height: 1.8; }
    .signature-area { display: flex; justify-content: flex-end; margin-top: 48pt; }
    .sig-box { text-align: center; min-width: 200pt; }
    .sig-date { margin: 0 0 4pt; font-style: italic; color: #555; }
    .sig-name { margin: 0; font-weight: bold; }
    .sig-nip { margin: 0; font-size: 11pt; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
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
        <p class="sig-date">Jakarta, ${tanggal}</p>
        ${sigImg}
        <p class="sig-name">${opts.signerNama}</p>
        <p class="sig-nip">NIP. ${opts.signerNip ?? "—"}</p>
      </div>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
  }

  function generateSuratSKP(bawahan: SkpBawahanRow, sigDataUrl?: string) {
    openSuratSKP({
      subjekNama: bawahan.nama,
      realisasiItems: bawahan.realisasi,
      signerNama: user?.nama ?? "—",
      signerNip: user?.nip ?? null,
      sigDataUrl,
    });
  }

  function generateSuratSKPDosen() {
    if (!mySkpStatus) return;
    openSuratSKP({
      subjekNama: user?.nama ?? "—",
      realisasiItems: mySkpStatus.realisasi,
      signerNama: mySkpStatus.atasan?.nama ?? "—",
      signerNip: mySkpStatus.atasan?.nip ?? null,
    });
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
              {/* Tombol Cetak Surat SKP — hanya muncul jika disetujui atasan (dosen) */}
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
                  🖨️ Cetak Surat SKP
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
              {/* Tombol cetak tabel SKP biasa (non-dosen atau internal) */}
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

        {/* ── Seksi Persetujuan SKP Bawahan (hanya untuk atasan) ── */}
        {!isDosen && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
              Persetujuan SKP Bawahan
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, margin: "0 0 20px" }}>
              Tinjau dan setujui SKP bawahan langsung Anda. Pastikan validasi realisasi sudah dilakukan sebelum memberikan persetujuan.
            </p>

            {bawahanLoading ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>Memuat data bawahan…</p>
            ) : bawahanList.length === 0 ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>
                Tidak ada bawahan langsung yang terdaftar.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr>
                      {["No", "Nama", "Total Indikator", "Tervalidasi", "Rata-rata Capaian", "Status SKP", "Aksi"].map(
                        (h) => <th key={h} style={thStyle}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {bawahanList.map((b, i) => {
                      const cap = nilaiCapaian(b.avgCapaian);
                      return (
                        <tr key={b.userId}>
                          <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>{i + 1}</td>
                          <td style={tdStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#1f2937" }}>{b.nama}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{b.email}</p>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>{b.totalIndikator}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ color: b.validatedCount >= b.totalIndikator && b.totalIndikator > 0 ? "#16a34a" : "#d97706", fontWeight: 600 }}>
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
                                🖨️ Cetak Surat
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
                maxWidth: 760,
                maxHeight: "85vh",
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
                          <tr>{["No", "Kode", "Nama Indikator", "Realisasi File", "File Valid", "Capaian"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {selectedBawahan.realisasi.map((r, i) => {
                            const capaian = r.validFileCount !== null && r.realisasiAngka > 0 ? Math.min((r.validFileCount / r.realisasiAngka) * 100, 100) : null;
                            const cap = nilaiCapaian(capaian);
                            return (
                              <tr key={r.id}>
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
                              </tr>
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
