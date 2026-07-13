"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import PageTransition from "@/components/layout/PageTransition";
import { getDekanDashboard, getAvailableYears, type DekanDashboardResult, type DekanDashboardItem } from "@/lib/api";
import { toast } from "sonner";

const STATUS_CONFIG = {
  belum_disposisi: { label: "Belum Disposisi", bg: "#fef9c3", color: "#854d0e", dot: "#f59e0b" },
  proses: { label: "Sedang Berjalan", bg: "#dbeafe", color: "#1e3a8a", dot: "#3b82f6" },
  selesai: { label: "Selesai", bg: "#dcfce7", color: "#14532d", dot: "#22c55e" },
} as const;

function StatCard({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "18px 22px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 4, opacity: 0.8 }}>{label}</div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function IndikatorRow({ item, onDetail }: { item: DekanDashboardItem; onDetail: (item: DekanDashboardItem) => void }) {
  const st = STATUS_CONFIG[item.status];
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#FF7900", fontSize: 12, whiteSpace: "nowrap" }}>{item.kode}</td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>{item.nama}</div>
        {item.kategori && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{item.kategori}</div>}
      </td>
      <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {item.targetUniversitas > 0 ? item.targetUniversitas.toLocaleString('id-ID') : '—'}
        {item.satuan && <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 11, marginLeft: 4 }}>{item.satuan}</span>}
      </td>
      <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {item.realisasi > 0 ? item.realisasi.toLocaleString('id-ID') : '—'}
      </td>
      <td style={{ padding: "10px 14px", minWidth: 120 }}>
        <ProgressBar value={item.progress} />
      </td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: "2px 8px", borderRadius: 20 }}>{st.label}</span>
        </div>
      </td>
      <td style={{ padding: "10px 14px" }}>
        {item.penerima.length > 0 ? (
          <div style={{ fontSize: 11, color: "#374151" }}>
            {item.penerima.slice(0, 2).map((p) => (
              <div key={p.userId} style={{ marginBottom: 1 }}>
                <span style={{ fontWeight: 600 }}>{p.nama}</span>
                <span style={{ color: "#9ca3af", marginLeft: 4 }}>({p.jumlahTarget.toLocaleString('id-ID')})</span>
              </div>
            ))}
            {item.penerima.length > 2 && (
              <div style={{ color: "#9ca3af" }}>+{item.penerima.length - 2} lainnya</div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
        )}
      </td>
      <td style={{ padding: "10px 14px", textAlign: "center" }}>
        <button
          onClick={() => onDetail(item)}
          style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
        >
          Detail
        </button>
      </td>
    </tr>
  );
}

function DetailModal({ item, onClose }: { item: DekanDashboardItem; onClose: () => void }) {
  const st = STATUS_CONFIG[item.status];
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content modal-content--md">
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{item.kode} — {item.nama}</h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: "2px 8px", borderRadius: 20, display: "inline-block", marginTop: 4 }}>{st.label}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {/* Progress */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Progress Capaian</div>
            <ProgressBar value={item.progress} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#374151" }}>
              <span>Realisasi: <strong>{item.realisasi.toLocaleString('id-ID')} {item.satuan ?? ''}</strong></span>
              <span>Target: <strong>{item.targetUniversitas.toLocaleString('id-ID')} {item.satuan ?? ''}</strong></span>
            </div>
          </div>

          {/* Realisasi status */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status Realisasi</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "Disetujui", val: item.realisasiStatus.approved, color: "#059669", bg: "#dcfce7" },
                { label: "Proses", val: item.realisasiStatus.pending, color: "#1d4ed8", bg: "#dbeafe" },
                { label: "Ditolak", val: item.realisasiStatus.rejected, color: "#dc2626", bg: "#fee2e2" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{ flex: 1, background: bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Penerima disposisi */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Penerima Disposisi</div>
            {item.penerima.length === 0 ? (
              <div className="alert-banner alert-banner--warning">Belum ada disposisi untuk indikator ini.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>Nama</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>Target Disposisi</th>
                  </tr>
                </thead>
                <tbody>
                  {item.penerima.map((p) => (
                    <tr key={p.userId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#111827" }}>{p.nama}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#374151" }}>{p.jumlahTarget.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Tutup</button>
        </div>
      </div>
    </div>
  );
}

export default function MonitoringDekanContent() {
  const { user } = useAuth();
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [years, setYears] = useState<string[]>([]);
  const [jenis, setJenis] = useState<'IKU' | 'PK'>('IKU');
  const [data, setData] = useState<DekanDashboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'belum_disposisi' | 'proses' | 'selesai'>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DekanDashboardItem | null>(null);

  useEffect(() => {
    getAvailableYears().then((y) => {
      const cy = new Date().getFullYear();
      setYears([...new Set([...y, String(cy - 1), String(cy), String(cy + 1)])].sort());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getDekanDashboard(tahun, jenis)
      .then(setData)
      .catch(() => toast.error('Gagal memuat data dashboard'))
      .finally(() => setLoading(false));
  }, [tahun, jenis]);

  const filtered = (data?.items ?? []).filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (search && !item.nama.toLowerCase().includes(search.toLowerCase()) && !item.kode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const s = data?.summary;

  return (
    <PageTransition>
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Dashboard Monitoring Dekan</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, margin: 0 }}>Pantau seluruh indikator kinerja, disposisi, dan capaian secara real-time.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Jenis</span>
              <select value={jenis} onChange={(e) => setJenis(e.target.value as 'IKU' | 'PK')}
                style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#111827", cursor: "pointer", outline: "none" }}>
                <option value="IKU">IKU</option>
                <option value="PK">PK</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Tahun</span>
              <select value={tahun} onChange={(e) => setTahun(e.target.value)}
                style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#111827", cursor: "pointer", outline: "none" }}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        {s && (
          <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            <StatCard value={s.totalIndikator} label="Total Indikator" color="#1e3a8a" bg="#eff6ff" />
            <StatCard value={s.belumDisposisi} label="Belum Disposisi" color="#854d0e" bg="#fef9c3" />
            <StatCard value={s.proses} label="Sedang Berjalan" color="#1e3a8a" bg="#dbeafe" />
            <StatCard value={s.selesai} label="Selesai" color="#14532d" bg="#dcfce7" />
            <StatCard value={`${s.persentaseCapaian}%`} label="Rata-rata Capaian" color="#7c3aed" bg="#ede9fe" />
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Cari indikator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, width: 240, outline: "none" }}
          />
          {(['all', 'belum_disposisi', 'proses', 'selesai'] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                borderColor: statusFilter === f ? '#1d4ed8' : '#e5e7eb',
                background: statusFilter === f ? '#1d4ed8' : '#fff',
                color: statusFilter === f ? '#fff' : '#374151',
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
              {f === 'all' ? 'Semua' : STATUS_CONFIG[f].label}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>{filtered.length} indikator</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
            Memuat data monitoring…
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    {["Kode", "Nama Indikator", "Target", "Realisasi", "Progres", "Status", "Penerima Disposisi", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: h === "Target" || h === "Realisasi" ? "right" : "left", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                        Tidak ada indikator yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <IndikatorRow key={item.id} item={item} onDetail={setDetail} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
      </div>
    </PageTransition>
  );
}
