"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getIndikatorGroupedForUser,
  getMySkpStatus,
  getAvailableYears,
  getSkpRencanaStatus,
  setujuRencanaSKPPegawai,
  type IndikatorGrouped,
  type SkpRencanaStatusData,
} from "@/lib/api";
import { toast } from "sonner";

const INSTITUSI = 'Universitas Pembangunan Nasional "Veteran" Jakarta';

// ─── Types ───────────────────────────────────────────────────────────────────

type PkRow =
  | { kind: "sub-header"; nama: string }
  | { kind: "child-header"; kode: string; nama: string }
  | { kind: "leaf"; kode: string; nama: string; satuan: string; target: string };

interface PkGroup {
  no: number;
  sasaran: string;
  rows: PkRow[];
}

interface IkuRow {
  no: number;
  sasaran: string;
  kode: string;
  nama: string;
  satuan: string;
  target: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveTarget(item: any): string {
  const v = item.disposisiJumlah ?? item.nilaiTarget;
  return v !== null && v !== undefined ? String(v) : "-";
}

function buildPkGroups(data: IndikatorGrouped[]): PkGroup[] {
  return data.map((group, gi) => {
    const rows: PkRow[] = [];
    for (const sub of group.subIndikators) {
      rows.push({ kind: "sub-header", nama: sub.nama });
      for (const child of sub.children) {
        const l3s = child.children ?? [];
        if (l3s.length === 0) {
          rows.push({
            kind: "leaf",
            kode: child.kode,
            nama: child.nama,
            satuan: child.satuan ?? "",
            target: resolveTarget(child),
          });
        } else {
          rows.push({ kind: "child-header", kode: child.kode, nama: child.nama });
          for (const l3 of l3s) {
            rows.push({
              kind: "leaf",
              kode: l3.kode,
              nama: l3.nama,
              satuan: l3.satuan ?? "",
              target: resolveTarget(l3),
            });
          }
        }
      }
    }
    return { no: gi + 1, sasaran: group.nama, rows };
  });
}

function buildIkuRows(data: IndikatorGrouped[]): IkuRow[] {
  const rows: IkuRow[] = [];
  let no = 1;
  for (const group of data) {
    for (const sub of group.subIndikators) {
      const children = sub.children ?? [];
      if (children.length === 0) {
        rows.push({ no: no++, sasaran: group.nama, kode: sub.kode, nama: sub.nama, satuan: (sub as any).satuan ?? "", target: resolveTarget(sub) });
      } else {
        for (const child of children) {
          const l3s = child.children ?? [];
          if (l3s.length === 0) {
            rows.push({ no: no++, sasaran: group.nama, kode: child.kode, nama: child.nama, satuan: child.satuan ?? "", target: resolveTarget(child) });
          } else {
            for (const l3 of l3s) {
              rows.push({ no: no++, sasaran: group.nama, kode: l3.kode, nama: l3.nama, satuan: l3.satuan ?? "", target: resolveTarget(l3) });
            }
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

function PageHeader({ lampiran, title, jabatan, unitNama, tahun, spDipa }: {
  lampiran?: string; title: string; jabatan: string; unitNama: string; tahun: string; spDipa: string;
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
        <div>DEKAN {unitNama}</div>
        <div>{INSTITUSI.toUpperCase()}</div>
        <div>TAHUN ANGGARAN {tahun}</div>
        <div>BERDASARKAN {spDipa}</div>
      </div>
    </>
  );
}

function SignatureRow({ leftLabel, leftName, rightDate, rightLabel, rightName }: {
  leftLabel: string; leftName: string;
  rightDate: string; rightLabel?: string; rightName: string;
}) {
  const sigStyle: React.CSSProperties = { fontSize: 10.5, lineHeight: 1.6 };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, ...sigStyle }}>
      <div style={{ width: "42%" }}>
        <div>{leftLabel},</div>
        <div style={{ height: 70 }} />
        <div style={{ borderTop: "1px solid #000", paddingTop: 4, display: "inline-block", minWidth: 200 }}>{leftName}</div>
      </div>
      <div style={{ width: "42%", textAlign: "center" }}>
        <div>{rightDate}</div>
        {rightLabel && <div>{rightLabel},</div>}
        <div style={{ height: 70 }} />
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
  const { user } = useAuth();
  const router = useRouter();
  const [tahun, setTahun] = useState("2026");
  const [years, setYears] = useState<string[]>(["2025", "2026", "2027"]);
  const [ikuRows, setIkuRows] = useState<IkuRow[]>([]);
  const [pkGroups, setPkGroups] = useState<PkGroup[]>([]);
  const [dekan, setDekan] = useState<{ nama: string; nip: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rencanaStatus, setRencanaStatus] = useState<SkpRencanaStatusData | null>(null);
  const [setujuSaving, setSetujuSaving] = useState(false);

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
    Promise.all([
      getIndikatorGroupedForUser("IKU", tahun, user.id, roleId),
      getIndikatorGroupedForUser("PK", tahun, user.id, roleId),
      getMySkpStatus(user.id, tahun),
      getSkpRencanaStatus(user.id, tahun),
    ])
      .then(([iku, pk, skpStatus, rStatus]) => {
        setIkuRows(buildIkuRows(iku));
        setPkGroups(buildPkGroups(pk));
        setDekan(skpStatus.atasanPenilai ?? skpStatus.atasan ?? null);
        setRencanaStatus(rStatus);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, tahun, roleId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSetuju() {
    if (!user?.id) return;
    setSetujuSaving(true);
    try {
      const result = await setujuRencanaSKPPegawai(user.id, tahun);
      setRencanaStatus(result);
      toast.success('Rencana SKP berhasil disetujui. Menunggu validasi atasan.');
    } catch {
      toast.error('Gagal menyetujui Rencana SKP.');
    } finally {
      setSetujuSaving(false);
    }
  }

  const jabatan = [user?.role, user?.unitNama].filter(Boolean).join(" ");
  const spDipa = `SP DIPA-139.03.2.693372/${tahun}`;
  const tanggalTtd = `Jakarta, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  const atasanNama = dekan?.nama ?? "...";
  const unitUpper = (user?.unitNama ?? "Fakultas Ilmu Komputer").toUpperCase();

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
            padding: 32px 0 48px;
          }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div
        className="no-print"
        style={{
          padding: "0 24px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          height: 56,
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 100,
          fontFamily: "sans-serif",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 14px", border: "1px solid #d1fae5",
            borderRadius: 8, cursor: "pointer",
            background: "#ecfdf5", color: "#0f9f6e",
            fontSize: 13, fontWeight: 500,
          }}
        >
          ← Kembali
        </button>

        <div style={{ width: 1, height: 22, background: "#e5e7eb" }} />

        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Rencana SKP</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 12px" }}>
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

        <div style={{ flex: 1 }} />

        {rencanaStatus?.status === 'draft' || !rencanaStatus ? (
          <button
            onClick={handleSetuju}
            disabled={setujuSaving}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 20px", border: "none", borderRadius: 8,
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#fff", fontWeight: 600, fontSize: 13,
              cursor: setujuSaving ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(245,158,11,.30)",
              opacity: setujuSaving ? 0.7 : 1,
            }}
          >
            ✅ {setujuSaving ? "Menyimpan…" : "Setuju Rencana SKP"}
          </button>
        ) : rencanaStatus.status === 'disetujui_pegawai' ? (
          <span style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "#dbeafe", color: "#1d4ed8",
          }}>
            ⏳ Menunggu Validasi Atasan
          </span>
        ) : (
          <button
            onClick={() => window.print()}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "7px 20px", border: "none", borderRadius: 8,
              background: "linear-gradient(135deg, #0f9f6e 0%, #087a55 100%)",
              color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13,
              boxShadow: "0 2px 8px rgba(15,159,110,.30)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Cetak Rencana SKP
          </button>
        )}
      </div>

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
              <div>{jabatan}</div>
              <div>dengan</div>
              <div>Dekan {user?.unitNama ?? "Fakultas Ilmu Komputer"}</div>
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
                  <td style={{ fontSize: 12, paddingBottom: 3 }}>{user?.nama ?? "..."}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, verticalAlign: "top" }}>Jabatan</td>
                  <td style={{ fontSize: 12, verticalAlign: "top" }}>:</td>
                  <td style={{ fontSize: 12, verticalAlign: "top", lineHeight: 1.5 }}>{jabatan}<br />{INSTITUSI}</td>
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
                    Dekan {user?.unitNama ?? "Fakultas Ilmu Komputer"}<br />{INSTITUSI}
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
              rightDate={tanggalTtd}
              rightLabel="Pihak Pertama"
              rightName={user?.nama ?? "..."}
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
                jabatan={jabatan}
                unitNama={unitUpper}
                tahun={tahun}
                spDipa={spDipa}
              />

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 32 }}>No.</th>
                    <th style={{ ...th, width: "28%" }}>Sasaran Program</th>
                    <th style={{ ...th, width: 50 }}>Kode</th>
                    <th style={th}>Indikator Kinerja Utama</th>
                    <th style={{ ...th, width: 70 }}>Satuan</th>
                    <th style={{ ...th, width: 52 }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {ikuRows.map((row) => (
                    <tr key={row.no}>
                      <td style={cellC}>{row.no}</td>
                      <td style={cell}>{row.sasaran}</td>
                      <td style={cellC}>{row.kode}</td>
                      <td style={cell}>{row.nama}</td>
                      <td style={cellC}>{row.satuan}</td>
                      <td style={cellC}>{row.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <SignatureRow
                leftLabel={`Dekan ${user?.unitNama ?? ""}`}
                leftName={atasanNama}
                rightDate={tanggalTtd}
                rightLabel={jabatan}
                rightName={user?.nama ?? "..."}
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════
              LAMPIRAN 2 — PK (Perjanjian Kinerja Kegiatan)
          ════════════════════════════════════════════════ */}
          {pkGroups.length > 0 && (
            <div className="cetak-page">
              <PageHeader
                lampiran="Lampiran 2"
                title="PERJANJIAN KINERJA"
                jabatan={jabatan}
                unitNama={unitUpper}
                tahun={tahun}
                spDipa={spDipa}
              />

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 28 }}>No.</th>
                    <th style={{ ...th, width: "22%" }}>Sasaran Program</th>
                    <th style={{ ...th, width: 44 }} colSpan={2}>Indikator Kinerja Kegiatan</th>
                    <th style={{ ...th, width: 70 }}>Satuan</th>
                    <th style={{ ...th, width: 50 }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {pkGroups.flatMap((group) => {
                    const rowCount = group.rows.length;
                    let isFirst = true;
                    return group.rows.map((row, ri) => {
                      const leadCells = isFirst ? (
                        <>
                          <td rowSpan={rowCount} style={{ ...cellC, fontWeight: "bold" }}>{group.no}</td>
                          <td rowSpan={rowCount} style={{ ...cell, verticalAlign: "top" }}>{group.sasaran}</td>
                        </>
                      ) : null;
                      isFirst = false;

                      if (row.kind === "sub-header") {
                        return (
                          <tr key={`${group.no}-${ri}`}>
                            {leadCells}
                            <td colSpan={2} style={{ ...cell, fontWeight: "bold", fontStyle: "italic" }}>{row.nama}</td>
                            <td style={cell} />
                            <td style={cell} />
                          </tr>
                        );
                      }
                      if (row.kind === "child-header") {
                        return (
                          <tr key={`${group.no}-${ri}`}>
                            {leadCells}
                            <td style={{ ...cellC, fontWeight: "bold", width: 44 }}>{row.kode}</td>
                            <td style={{ ...cell, fontWeight: "bold" }} colSpan={3}>{row.nama}</td>
                          </tr>
                        );
                      }
                      // leaf
                      return (
                        <tr key={`${group.no}-${ri}`}>
                          {leadCells}
                          <td style={{ ...cellC, width: 44 }}>{row.kode}</td>
                          <td style={cell}>{row.nama}</td>
                          <td style={cellC}>{row.satuan}</td>
                          <td style={cellC}>{row.target}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>

              <SignatureRow
                leftLabel={`Dekan ${user?.unitNama ?? ""}`}
                leftName={atasanNama}
                rightDate={tanggalTtd}
                rightLabel={jabatan}
                rightName={user?.nama ?? "..."}
              />
            </div>
          )}

          {ikuRows.length === 0 && pkGroups.length === 0 && (
            <div className="no-print cetak-page" style={{ textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 14 }}>
              Belum ada data target yang didisposisikan kepada Anda untuk tahun {tahun}.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
