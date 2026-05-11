"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import {
  getSubmissionsForAtasan,
  validateRealisasiAtasan,
  getAllRealisasiFiles,
  getLaporanWithRealisasi,
  SubmissionPerIndikator,
  RealisasiSubmission,
} from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type DosenSubmission = RealisasiSubmission & {
  indikatorId: number;
  indikatorKode: string;
  indikatorNama: string;
};

type DosenGroup = {
  dosenId: number;
  dosenNama: string;
  dosenEmail: string;
  submissions: DosenSubmission[];
};

type DetailModal = {
  dosenNama: string;
  dosenEmail: string;
  submission: DosenSubmission;
};

export default function ValidasiRealisasiAtasanContent() {
  const { user, token } = useAuth();
  const [rawGroups, setRawGroups] = useState<SubmissionPerIndikator[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [jenisFilter, setJenisFilter] = useState<"IKU" | "PK">("IKU");
  const [validInputs, setValidInputs] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  // Detail modal
  const [detail, setDetail] = useState<DetailModal | null>(null);
  const [detailFiles, setDetailFiles] = useState<{ name: string; previewUrl?: string; tanggal: string; ownerName?: string; ownerEmail?: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Export loading
  const [exporting, setExporting] = useState(false);
  const [exportingLaporan, setExportingLaporan] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
  }, [user?.id, tahun]);

  useEffect(() => {
    if (!detail || !token) return;
    setDetailLoading(true);
    setDetailFiles([]);
    getAllRealisasiFiles(detail.submission.indikatorId, token)
      .then((result) => {
        const dosenEmailLower = detail.dosenEmail.toLowerCase();
        const mapFile = (f: any) => ({
          name: f.name,
          previewUrl: f.preview_url,
          tanggal: f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-',
          ownerName: f.ownerName || f.owner?.name,
          ownerEmail: f.ownerEmail || f.owner?.email,
        });
        const filtered = result.files
          .filter(f => (f.ownerEmail || f.owner?.email || '').toLowerCase() === dosenEmailLower)
          .map(mapFile);
        setDetailFiles(filtered);
      })
      .catch(() => setDetailFiles([]))
      .finally(() => setDetailLoading(false));
  }, [detail, token]);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await getSubmissionsForAtasan(user!.id, tahun);
      setRawGroups(data);
      const inputs: Record<number, string> = {};
      data.forEach((g) =>
        g.submissions.forEach((s) => {
          inputs[s.id] = s.validFileCount !== null ? String(s.validFileCount) : "";
        })
      );
      setValidInputs(inputs);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
      setRawGroups([]);
    } finally {
      setLoading(false);
    }
  }

  // Transform indikator-grouped → dosen-grouped
  const dosenGroups: DosenGroup[] = (() => {
    const filtered = rawGroups.filter(g => g.indikator.jenis.toUpperCase() === jenisFilter);
    const map = new Map<number, DosenGroup>();
    filtered.forEach(g => {
      g.submissions.forEach(s => {
        if (!map.has(s.dosenId)) {
          map.set(s.dosenId, { dosenId: s.dosenId, dosenNama: s.dosenNama, dosenEmail: s.dosenEmail, submissions: [] });
        }
        map.get(s.dosenId)!.submissions.push({
          ...s,
          indikatorId: g.indikator.id,
          indikatorKode: g.indikator.kode,
          indikatorNama: g.indikator.nama,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
  })();

  const totalSubmissions = rawGroups.reduce((n, g) => n + g.submissions.length, 0);
  const totalValidated = rawGroups.reduce(
    (n, g) => n + g.submissions.filter((s) => s.validFileCount !== null).length,
    0
  );

  const handleSave = async (submissionId: number) => {
    const val = parseInt(validInputs[submissionId] ?? "");
    if (isNaN(val) || val < 0) return;
    setSaving((prev) => ({ ...prev, [submissionId]: true }));
    try {
      await validateRealisasiAtasan(submissionId, val, token ?? undefined);
      setRawGroups((prev) =>
        prev.map((g) => ({
          ...g,
          submissions: g.submissions.map((s) =>
            s.id === submissionId ? { ...s, validFileCount: val, status: "validated" } : s
          ),
        }))
      );
      toast.success("Validasi berhasil disimpan.");
    } catch (err) {
      toast.error("Gagal menyimpan validasi.");
    } finally {
      setSaving((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  const exportToExcel = async () => {
    if (!token) return;
    setExporting(true);
    try {
      // Fetch folder link per unique indikatorId
      const indikatorIds = [...new Set(
        dosenGroups.flatMap(dg => dg.submissions.map(s => s.indikatorId))
      )];
      const fileResults = await Promise.all(
        indikatorIds.map(id =>
          getAllRealisasiFiles(id, token).catch(() => ({ folderLink: null, files: [] as any[] }))
        )
      );
      // Map: indikatorId → folder link
      const folderLinkMap = new Map<number, string>();
      indikatorIds.forEach((id, idx) => {
        const link = (fileResults[idx] as any).folderLink;
        if (link) folderLinkMap.set(id, link);
      });

      // Build flat rows: header row + data
      type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };
      const COLS = ["Nama Dosen", "Email", "Indikator", "Periode", "Target", "File Diunggah", "File Valid", "Status", "Link Folder"];
      const aoa: (string | number)[][] = [COLS];
      const merges: MergeRange[] = [];

      dosenGroups.forEach((dg) => {
        dg.submissions.forEach((s) => {
          const rowIdx = aoa.length;
          const folderLink = folderLinkMap.get(s.indikatorId) || "-";
          aoa.push([
            dg.dosenNama,
            dg.dosenEmail,
            s.indikatorKode + " — " + s.indikatorNama,
            s.periode ?? "-",
            s.targetDosen ?? "-",
            s.fileCount,
            s.validFileCount ?? "-",
            s.status,
            folderLink,
          ]);

          // Merge "Link Folder" cells for same indikatorId vertically
          // (collect ranges after building all rows — handled below)
          void rowIdx;
        });
      });

      // Merge Link Folder (col 8) for consecutive rows with same indikator link
      const LINK_COL = 8;
      let i = 1; // skip header
      while (i < aoa.length) {
        const link = aoa[i][LINK_COL];
        let j = i + 1;
        while (j < aoa.length && aoa[j][LINK_COL] === link && link !== "-") j++;
        if (j - i > 1) {
          merges.push({ s: { r: i, c: LINK_COL }, e: { r: j - 1, c: LINK_COL } });
        }
        i = j;
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"] = merges;
      ws["!cols"] = [
        { wch: 24 }, { wch: 28 }, { wch: 40 }, { wch: 22 },
        { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 50 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Validasi Realisasi");
      XLSX.writeFile(wb, `Validasi_Realisasi_${tahun}.xlsx`);
    } catch (err) {
      toast.error("Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  };

  const exportLaporanIKUPK = async () => {
    if (!user?.roleId || !token) return;
    setExportingLaporan(true);
    try {
      type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };
      const wb = XLSX.utils.book_new();

      for (const jenisExport of ["IKU", "PK"]) {
        const grouped = await getLaporanWithRealisasi(jenisExport, tahun, user.roleId);
        if (grouped.length === 0) continue;

        // Kumpulkan semua indikator ID yang perlu folder link
        const indikatorIds: number[] = [];
        for (const group of grouped) {
          for (const sub of group.subIndikators) {
            if (jenisExport === "IKU") {
              indikatorIds.push(sub.id);
            } else {
              for (const child of sub.children ?? []) {
                for (const l3 of (child as any).children ?? []) {
                  indikatorIds.push(l3.id);
                }
              }
            }
          }
        }
        const uniqueIds = [...new Set(indikatorIds)];
        const folderResults = await Promise.all(
          uniqueIds.map(id =>
            getAllRealisasiFiles(id, token).catch(() => ({ folderLink: null, files: [] }))
          )
        );
        const folderLinkMap = new Map<number, string>();
        uniqueIds.forEach((id, idx) => {
          const link = (folderResults[idx] as any).folderLink;
          if (link) folderLinkMap.set(id, link);
        });

        const aoa: (string | number)[][] = [];
        const merges: MergeRange[] = [];

        if (jenisExport === "IKU") {
          aoa.push(["No.", "Sasaran Strategis", "Indikator Kinerja Kegiatan", "Target Universitas", "Tenggat", "Realisasi", "", "Data Link"]);
          aoa.push(["", "", "", "", "", "%", "Angka", ""]);
          merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
          merges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } });
          merges.push({ s: { r: 0, c: 2 }, e: { r: 1, c: 2 } });
          merges.push({ s: { r: 0, c: 3 }, e: { r: 1, c: 3 } });
          merges.push({ s: { r: 0, c: 4 }, e: { r: 1, c: 4 } });
          merges.push({ s: { r: 0, c: 5 }, e: { r: 0, c: 6 } });
          merges.push({ s: { r: 0, c: 7 }, e: { r: 1, c: 7 } });

          let no = 1;
          for (const group of grouped) {
            const groupStart = aoa.length;
            aoa.push([no + ".", group.nama, "", group.persentaseTarget !== null ? group.persentaseTarget + "%" : "", group.tenggat || "", "", "", ""]);
            for (const sub of group.subIndikators) {
              const subRowIdx = aoa.length;
              const childCount = (sub.children ?? []).length;
              const folderLink = folderLinkMap.get(sub.id) || "";
              aoa.push(["", "", sub.kode + "  " + sub.nama, "", "", sub.realisasiKualitas !== null ? sub.realisasiKualitas + "%" : "", sub.realisasiKuantitas || "", folderLink]);
              for (const child of sub.children ?? []) {
                aoa.push(["", "", "    " + child.kode + "  " + child.nama, "", "", "", child.realisasiKuantitas || "", folderLink]);
              }
              // Merge Data Link kolom 7 untuk sub + semua children-nya
              if (childCount > 0 && folderLink) {
                merges.push({ s: { r: subRowIdx, c: 7 }, e: { r: subRowIdx + childCount, c: 7 } });
              }
            }
            const groupEnd = aoa.length - 1;
            if (groupEnd > groupStart) {
              merges.push({ s: { r: groupStart, c: 0 }, e: { r: groupEnd, c: 0 } });
              merges.push({ s: { r: groupStart, c: 1 }, e: { r: groupEnd, c: 1 } });
              merges.push({ s: { r: groupStart, c: 3 }, e: { r: groupEnd, c: 3 } });
              merges.push({ s: { r: groupStart, c: 4 }, e: { r: groupEnd, c: 4 } });
            }
            no++;
          }
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws["!merges"] = merges;
          ws["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 44 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
          XLSX.utils.book_append_sheet(wb, ws, "Laporan IKU");

        } else {
          aoa.push(["No.", "Sasaran Strategis", "Indikator Kinerja Kegiatan", "Waktu Pelaporan", "Satuan", `Target ${tahun}`, "Realisasi", "Data Link"]);
          let no = 1;
          for (const group of grouped) {
            const groupStart = aoa.length;
            aoa.push([no + ".", group.nama, "", "", "", "", "", ""]);
            for (const sub of group.subIndikators) {
              aoa.push(["", "", sub.kode + "  " + sub.nama, "", "", "", "", ""]);
              for (const child of sub.children ?? []) {
                aoa.push(["", "", "    " + child.kode + "  " + child.nama, "", "", "", "", ""]);
                for (const l3 of (child as any).children ?? []) {
                  const folderLink = folderLinkMap.get(l3.id) || "";
                  aoa.push(["", "", "        " + l3.kode + "  " + l3.nama, l3.tenggat || "", l3.satuan || "", l3.nilaiTarget ?? "", l3.realisasiKuantitas || "", folderLink]);
                }
              }
            }
            const groupEnd = aoa.length - 1;
            if (groupEnd > groupStart) {
              merges.push({ s: { r: groupStart, c: 0 }, e: { r: groupEnd, c: 0 } });
              merges.push({ s: { r: groupStart, c: 1 }, e: { r: groupEnd, c: 1 } });
            }
            no++;
          }
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws["!merges"] = merges;
          ws["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 44 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
          XLSX.utils.book_append_sheet(wb, ws, "Laporan PK");
        }
      }

      XLSX.writeFile(wb, `Laporan_IKU_PK_${tahun}.xlsx`);
      toast.success("Export laporan berhasil.");
    } catch {
      toast.error("Gagal mengekspor laporan.");
    } finally {
      setExportingLaporan(false);
    }
  };

  return (
    <div>
      <PageTransition>
        <p className="ikupk-header-text">Validasi Realisasi Bawahan</p>

        <div className="info-banner-blue">
          <span className="icon-lg">📋</span>
          <p>
            <strong>Validasi Realisasi</strong> — Periksa file yang diunggah bawahan, tetapkan jumlah file yang valid.
          </p>
        </div>

        {/* Statistik */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: "4px solid #6366f1" }}>
            <p className="stat-card-label">Total Dosen</p>
            <p className="stat-card-value" style={{ color: "#6366f1" }}>{dosenGroups.length}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "4px solid #d97706" }}>
            <p className="stat-card-label">Total Submission</p>
            <p className="stat-card-value" style={{ color: "#d97706" }}>{totalSubmissions}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "4px solid #16a34a" }}>
            <p className="stat-card-label">Sudah Divalidasi</p>
            <p className="stat-card-value" style={{ color: "#16a34a" }}>{totalValidated}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "4px solid #dc2626" }}>
            <p className="stat-card-label">Belum Divalidasi</p>
            <p className="stat-card-value" style={{ color: "#dc2626" }}>{totalSubmissions - totalValidated}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="filter-card">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label className="filter-label">Jenis</label>
              <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value as "IKU" | "PK")} className="filter-isi">
                <option value="IKU">Indikator Kinerja Utama (IKU)</option>
                <option value="PK">Perjanjian Kinerja (PK)</option>
              </select>
            </div>
            <div>
              <label className="filter-label">Tahun</label>
              <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="filter-isi">
                {[2023, 2024, 2025, 2026].map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button onClick={exportToExcel} disabled={exporting} className="btn-green-sm">
                {exporting ? "Mengekspor..." : "Export Validasi"}
              </button>
              <button onClick={exportLaporanIKUPK} disabled={exportingLaporan} className="btn-green-sm">
                {exportingLaporan ? "Mengekspor..." : "Export Laporan IKU/PK"}
              </button>
            </div>
          </div>
        </div>

        {/* Detail Modal */}
        {detail && createPortal(
          <div className="modal-overlay" onClick={() => setDetail(null)}>
            <div className="modal-content modal-content--md" onClick={e => e.stopPropagation()} style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: "85vh", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 className="modal-title" style={{ marginBottom: 4 }}>Detail Realisasi</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{detail.dosenNama} · {detail.dosenEmail}</p>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280", fontSize: 14, flexShrink: 0, marginLeft: 12 }}
                >
                  ✕
                </button>
              </div>

              {/* Info cards */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Indikator</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "3px 0 0" }}>
                      {detail.submission.indikatorKode} — {detail.submission.indikatorNama}
                    </p>
                  </div>
                  <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>File Diunggah</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: "2px 0 0" }}>{detail.submission.fileCount}</p>
                  </div>
                  <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>File Valid</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: detail.submission.validFileCount !== null ? "#16a34a" : "#9ca3af", margin: "2px 0 0" }}>
                      {detail.submission.validFileCount !== null ? detail.submission.validFileCount : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Target Dosen</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", margin: "3px 0 0" }}>
                      {detail.submission.targetDosen !== null ? detail.submission.targetDosen : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Periode</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", margin: "3px 0 0" }}>{detail.submission.periode ?? "—"}</p>
                  </div>
                </div>
              </div>

              {/* File list — scrollable */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Daftar File {!detailLoading && detailFiles.length > 0 && <span style={{ color: "#6b7280", fontWeight: 400 }}>({detailFiles.length} file)</span>}
                </p>
                {detailLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>Memuat file…</div>
                ) : detailFiles.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>Tidak ada file ditemukan.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detailFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                          📄
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {f.previewUrl
                            ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: "#2563eb", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</a>
                            : <span style={{ fontSize: 13, fontWeight: 500, color: "#1f2937", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          }
                          {f.ownerName && (
                            <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{f.ownerName}{f.ownerEmail ? ` · ${f.ownerEmail}` : ""}</p>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{f.tanggal}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", background: "#f9fafb", borderRadius: "0 0 12px 12px" }}>
                <button
                  onClick={() => setDetail(null)}
                  style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer", color: "#374151" }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Content */}
        {loading ? (
          <p className="text-loading text-center" style={{ padding: 40 }}>Memuat data…</p>
        ) : dosenGroups.length === 0 ? (
          <p className="text-empty">Tidak ada submission {jenisFilter} dari bawahan Anda untuk tahun {tahun}.</p>
        ) : (
          dosenGroups.map((dg) => (
            <div key={dg.dosenId} className="table-section-card" style={{ marginBottom: 16 }}>
              <div className="table-section-header">
                <div>
                  <h3 className="table-section-title">{dg.dosenNama}</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>{dg.dosenEmail}</p>
                </div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {dg.submissions.filter(s => s.validFileCount !== null).length}/{dg.submissions.length} divalidasi
                </span>
              </div>

              <div className="table-wrapper">
                <table className="atasan-table">
                  <thead>
                    <tr>
                      <th className="text-left">Indikator</th>
                      <th className="text-center">Periode</th>
                      <th className="text-center">Target</th>
                      <th className="text-center">File Diunggah</th>
                      <th className="text-center">File Valid</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dg.submissions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{s.indikatorKode}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{s.indikatorNama}</div>
                        </td>
                        <td className="text-center" style={{ fontSize: 12 }}>{s.periode ?? "-"}</td>
                        <td className="text-center" style={{ fontSize: 13, fontWeight: 600 }}>
                          {s.targetDosen !== null ? s.targetDosen : "-"}
                        </td>
                        <td className="text-center">
                          <span className={s.fileCount > 0 ? "file-count-green" : "file-count-gray"}>
                            {s.fileCount} file
                          </span>
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            min={0}
                            max={s.fileCount}
                            value={validInputs[s.id] ?? ""}
                            onChange={(e) =>
                              setValidInputs((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            className="valid-input"
                            placeholder="0"
                          />
                        </td>
                        <td className="text-center">
                          {s.validFileCount !== null ? (
                            <span className="status-validated">{s.validFileCount} valid</span>
                          ) : (
                            <span className="badge-pending">Belum</span>
                          )}
                        </td>
                        <td className="text-center">
                          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                              onClick={() => handleSave(s.id)}
                              disabled={saving[s.id] || validInputs[s.id] === ""}
                              className="btn-validasi-save"
                            >
                              {saving[s.id] ? "…" : "Simpan"}
                            </button>
                            <button
                              onClick={() => setDetail({ dosenNama: dg.dosenNama, dosenEmail: dg.dosenEmail, submission: s })}
                              style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", color: "#374151" }}
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </PageTransition>
    </div>
  );
}
