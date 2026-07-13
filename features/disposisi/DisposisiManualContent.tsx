"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import PageTransition from "@/components/layout/PageTransition";
import {
  getIndikatorGroupedForUser,
  getDisposisiBawahan,
  upsertDisposisi,
  getAvailableYears,
  type IndikatorGrouped,
  type DisposisiBawahanResult,
} from "@/lib/api";
import { toast } from "sonner";

interface LeafRow {
  id: number;
  kode: string;
  nama: string;
  satuan: string | null;
  disposisiJumlah: number;
  parentNama: string;
}

function collectLeaves(grouped: IndikatorGrouped[]): LeafRow[] {
  const out: LeafRow[] = [];
  for (const l0 of grouped) {
    for (const sub of l0.subIndikators) {
      const parentNama = l0.nama;
      const children = sub.children ?? [];
      if (children.length === 0) {
        if ((sub.disposisiJumlah ?? 0) > 0)
          out.push({ id: sub.id, kode: sub.kode, nama: sub.nama, satuan: (sub as any).satuan ?? null, disposisiJumlah: sub.disposisiJumlah ?? 0, parentNama });
      } else {
        for (const child of children) {
          const l3s = child.children ?? [];
          if (l3s.length === 0) {
            if ((child.disposisiJumlah ?? 0) > 0)
              out.push({ id: child.id, kode: child.kode, nama: child.nama, satuan: (child as any).satuan ?? null, disposisiJumlah: child.disposisiJumlah ?? 0, parentNama });
          } else {
            for (const l3 of l3s) {
              if ((l3.disposisiJumlah ?? 0) > 0)
                out.push({ id: l3.id, kode: l3.kode, nama: l3.nama, satuan: (l3 as any).satuan ?? null, disposisiJumlah: l3.disposisiJumlah ?? 0, parentNama });
            }
          }
        }
      }
    }
  }
  return out;
}

interface DisposisiModalProps {
  userId: number;
  indikator: LeafRow;
  tahun: string;
  onClose: () => void;
  onSuccess: () => void;
}

function DisposisiModal({ userId, indikator, tahun, onClose, onSuccess }: DisposisiModalProps) {
  const [data, setData] = useState<DisposisiBawahanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDisposisiBawahan(userId, indikator.id, tahun)
      .then((res) => {
        console.log(`[DisposisiModal] userId=${userId} indikatorId=${indikator.id} → bawahan:`, res.bawahan);
        setData(res);
        const init: Record<number, string> = {};
        for (const b of res.bawahan) init[b.userId] = b.receivedJumlah > 0 ? String(b.receivedJumlah) : '';
        setAlloc(init);
      })
      .catch(() => toast.error('Gagal memuat data bawahan'))
      .finally(() => setLoading(false));
  }, [userId, indikator.id, tahun]);

  const total = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);
  const myReceived = data?.myReceived ?? 0;
  const overLimit = myReceived > 0 && total > myReceived;

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const items = data.bawahan
        .map((b) => ({ toUserId: b.userId, jumlahTarget: Number(alloc[b.userId]) || 0 }))
        .filter((i) => i.jumlahTarget > 0);
      if (items.length === 0) { toast.error('Isi minimal satu alokasi target.'); return; }
      await upsertDisposisi(indikator.id, tahun, items, userId);
      toast.success(`Disposisi berhasil disimpan untuk ${items.length} bawahan.`);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? 'Gagal menyimpan disposisi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content modal-content--md">
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1f2937" }}>Distribusi Target ke Bawahan</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{indikator.kode} — {indikator.nama}</p>
            {myReceived > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#374151" }}>
                Target diterima: <strong>{myReceived.toLocaleString('id-ID')} {indikator.satuan ?? ''}</strong>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ padding: "16px 24px", maxHeight: 400, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#6b7280", fontSize: 13 }}>Memuat daftar bawahan…</div>
          ) : !data || data.bawahan.length === 0 ? (
            <div className="alert-banner alert-banner--warning">
              <strong>Tidak ada bawahan langsung ditemukan untuk user ID {userId}.</strong>
              <br />Pastikan setiap bawahan sudah dikonfigurasi atasannya di Master User. Verifikasi via:{' '}
              <code style={{ fontSize: 11 }}>/disposisi/debug-bawahan?userId={userId}</code>
            </div>
          ) : (
            <>
              {overLimit && (
                <div className="alert-banner alert-banner--warning mb-4">
                  Total alokasi ({total.toLocaleString('id-ID')}) melebihi target yang Anda terima ({myReceived.toLocaleString('id-ID')}).
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Nama</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Jabatan</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#374151" }}>Alokasi Target</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bawahan.map((b) => (
                    <tr key={b.userId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{b.nama}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{b.jabatan}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <input
                          type="number"
                          min={0}
                          value={alloc[b.userId] ?? ''}
                          onChange={(e) => setAlloc((prev) => ({ ...prev, [b.userId]: e.target.value }))}
                          style={{ width: 90, padding: "5px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, textAlign: "right" }}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                    <td colSpan={2} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151" }}>Total</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: overLimit ? "#dc2626" : "#059669" }}>
                      {total.toLocaleString('id-ID')} {indikator.satuan ?? ''}
                      {myReceived > 0 && <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 11, marginLeft: 4 }}>/ {myReceived.toLocaleString('id-ID')}</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleSave} disabled={saving || overLimit || loading} className="btn-green">
            {saving ? 'Menyimpan…' : '✓ Simpan Disposisi'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DisposisiManualContent() {
  const { user } = useAuth();
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [years, setYears] = useState<string[]>([]);
  const [jenis, setJenis] = useState<'IKU' | 'PK'>('IKU');
  const [leaves, setLeaves] = useState<LeafRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<LeafRow | null>(null);

  const roleId: number =
    user?.roleId ??
    (user?.roles as any[])?.find((r: any) => r.isPrimary)?.id ??
    (user?.roles as any[])?.[0]?.id ?? 0;

  useEffect(() => {
    getAvailableYears().then((y) => {
      const cy = new Date().getFullYear();
      setYears([...new Set([...y, String(cy - 1), String(cy), String(cy + 1)])].sort());
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const grouped = await getIndikatorGroupedForUser(jenis, tahun, user.id, roleId);
      setLeaves(collectLeaves(grouped));
    } catch {
      toast.error('Gagal memuat data indikator');
    } finally {
      setLoading(false);
    }
  }, [user?.id, roleId, jenis, tahun]);

  useEffect(() => { load(); }, [load]);

  const noData = !loading && leaves.length === 0;

  return (
    <PageTransition>
      <div style={{ padding: "24px 28px", maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Disposisi Manual</h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, margin: 0 }}>
            Distribusikan target indikator yang Anda terima kepada bawahan langsung sesuai struktur organisasi.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Jenis</span>
            <select value={jenis} onChange={(e) => setJenis(e.target.value as 'IKU' | 'PK')}
              style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#111827", cursor: "pointer", outline: "none" }}>
              <option value="IKU">IKU</option>
              <option value="PK">PK</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Tahun</span>
            <select value={tahun} onChange={(e) => setTahun(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#111827", cursor: "pointer", outline: "none" }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            Memuat indikator yang diterima…
          </div>
        ) : noData ? (
          <div className="alert-banner alert-banner--info">
            Belum ada indikator yang didisposisikan kepada Anda untuk {jenis} tahun {tahun}.
            Hubungi admin atau pimpinan untuk mendapatkan distribusi target.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                {leaves.length} indikator siap didistribusikan
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>Klik "Distribusikan" untuk mengatur alokasi ke bawahan</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Kode</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Indikator</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Diterima</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", fontWeight: 600, color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#FF7900", fontSize: 12, whiteSpace: "nowrap" }}>{row.kode}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#111827" }}>{row.nama}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{row.parentNama}</div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#374151" }}>
                      {row.disposisiJumlah.toLocaleString('id-ID')} <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 11 }}>{row.satuan ?? ''}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button
                        onClick={() => setModal(row)}
                        style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Distribusikan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {modal && user?.id && (
          <DisposisiModal
            userId={user.id}
            indikator={modal}
            tahun={tahun}
            onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); load(); }}
          />
        )}
      </div>
    </PageTransition>
  );
}
