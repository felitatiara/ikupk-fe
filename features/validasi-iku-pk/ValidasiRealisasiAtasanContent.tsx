"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import {
  getSubmissionsForAtasan,
  validateRealisasiAtasan,
  getAllRealisasiFiles,
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
  const [detailFiles, setDetailFiles] = useState<{ name: string; previewUrl?: string; tanggal: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Export loading
  const [exporting, setExporting] = useState(false);

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
        const filtered = result.files
          .filter(f => (f.ownerEmail || f.owner?.email) === detail.dosenEmail)
          .map(f => ({
            name: f.name,
            previewUrl: f.preview_url,
            tanggal: f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-',
          }));
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
      await validateRealisasiAtasan(submissionId, val);
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
      // Fetch all files per unique indikatorId in one pass
      const indikatorIds = [...new Set(
        dosenGroups.flatMap(dg => dg.submissions.map(s => s.indikatorId))
      )];
      const fileResults = await Promise.all(
        indikatorIds.map(id => getAllRealisasiFiles(id, token).catch(() => ({ files: [] as any[] })))
      );
      // Map: "indikatorId:dosenEmail" → comma-separated download URLs
      const fileUrlMap = new Map<string, string>();
      indikatorIds.forEach((id, idx) => {
        const { files } = fileResults[idx];
        const byDosen = new Map<string, string[]>();
        for (const f of files) {
          const email = f.ownerEmail || f.owner?.email || '';
          if (!byDosen.has(email)) byDosen.set(email, []);
          byDosen.get(email)!.push(f.download_url || f.preview_url || '');
        }
        byDosen.forEach((urls, email) => {
          fileUrlMap.set(`${id}:${email}`, urls.filter(Boolean).join(' | '));
        });
      });

      const rows: any[] = [];
      dosenGroups.forEach((dg) => {
        dg.submissions.forEach((s, i) => {
          rows.push({
            "Nama Dosen": dg.dosenNama,
            "Email Dosen": dg.dosenEmail,
            No: i + 1,
            Indikator: s.indikatorKode + " - " + s.indikatorNama,
            "Jumlah File": s.fileCount,
            "File Valid": s.validFileCount ?? "-",
            Target: s.targetDosen ?? "-",
            Periode: s.periode ?? "-",
            Status: s.status,
            "Link File": fileUrlMap.get(`${s.indikatorId}:${dg.dosenEmail}`) || "-",
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Validasi Realisasi");
      XLSX.writeFile(wb, `Validasi_Realisasi_${tahun}.xlsx`);
    } catch (err) {
      toast.error("Gagal mengekspor data.");
    } finally {
      setExporting(false);
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
                <option value="PK">Perjanjian Kerja (PK)</option>
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
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={exportToExcel} disabled={exporting} className="btn-green-sm">
                {exporting ? "Mengekspor..." : "Export Excel"}
              </button>
            </div>
          </div>
        </div>

        {/* Detail Modal */}
        {detail && (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setDetail(null)}
          >
            <div
              style={{ backgroundColor: "white", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1f2937" }}>Detail Realisasi</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{detail.dosenNama} · {detail.dosenEmail}</p>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" }}>✕</button>
              </div>

              {/* Info */}
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Indikator</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", margin: "2px 0 0" }}>
                    {detail.submission.indikatorKode} — {detail.submission.indikatorNama}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Target Dosen</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", margin: "2px 0 0" }}>
                    {detail.submission.targetDosen !== null ? detail.submission.targetDosen : "—"}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>File Diunggah</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", margin: "2px 0 0" }}>{detail.submission.fileCount}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>File Valid</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: detail.submission.validFileCount !== null ? "#16a34a" : "#9ca3af", margin: "2px 0 0" }}>
                    {detail.submission.validFileCount !== null ? detail.submission.validFileCount : "Belum divalidasi"}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Periode</p>
                  <p style={{ fontSize: 13, color: "#1f2937", margin: "2px 0 0" }}>{detail.submission.periode ?? "—"}</p>
                </div>
              </div>

              {/* File list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>Daftar File</p>
                {detailLoading ? (
                  <p style={{ textAlign: "center", color: "#6b7280", padding: 16, fontSize: 13 }}>Memuat file…</p>
                ) : detailFiles.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#9ca3af", padding: 16, fontSize: 13 }}>Tidak ada file.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "5px 8px", textAlign: "left", fontSize: 11, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>Nama File</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", fontSize: 11, color: "#6b7280", borderBottom: "1px solid #e5e7eb", width: 90 }}>Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailFiles.map((f, i) => (
                        <tr key={i}>
                          <td style={{ padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f3f4f6" }}>
                            {f.previewUrl
                              ? <a href={f.previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>{f.name}</a>
                              : f.name}
                          </td>
                          <td style={{ padding: "6px 8px", fontSize: 11, color: "#6b7280", textAlign: "center", borderBottom: "1px solid #f3f4f6" }}>{f.tanggal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
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
