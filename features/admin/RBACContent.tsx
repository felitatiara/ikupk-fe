"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getAllRoles,
  getAllRoleViewPermissions,
  setRoleViewPermissions,
  getAllRoleFeaturePermissions,
  setRoleFeaturePermissions,
  type RoleOption,
  type RoleViewPermission,
  type RoleFeaturePermission,
} from "@/lib/api";

const FEATURES: { key: string; label: string; description: string }[] = [
  { key: 'monitoring', label: 'Monitoring Indikator Kinerja', description: 'Memantau progress indikator di unit kerja' },
  { key: 'iku_pk', label: 'Indikator Kinerja Utama & PK', description: 'Input dan lihat target IKU dan Perjanjian Kinerja' },
  { key: 'verifikasi_capaian', label: 'Verifikasi Capaian', description: 'Verifikasi capaian dan penilaian ekspektasi dari bawahan' },
  { key: 'skp', label: 'SKP', description: 'Sasaran Kinerja Pegawai — rencana, penilaian, dan cetak' },
];

const LEVEL_LABEL: Record<number, string> = {
  0: "Admin",
  1: "Pimpinan",
  2: "Kepala Jurusan",
  3: "Koordinator Prodi",
  4: "Dosen / Tendik",
};

const LEVEL_COLOR: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  1: { bg: "#dbeafe", border: "#bfdbfe", text: "#1e40af" },
  2: { bg: "#ede9fe", border: "#ddd6fe", text: "#5b21b6" },
  3: { bg: "#d1fae5", border: "#a7f3d0", text: "#065f46" },
  4: { bg: "#f3f4f6", border: "#e5e7eb", text: "#374151" },
};

function RoleBadge({ role }: { role: RoleOption }) {
  const c = LEVEL_COLOR[role.level] ?? LEVEL_COLOR[4];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, border: `1px solid ${c.border}`, color: c.text, whiteSpace: "nowrap" as const }}>
      <span style={{ fontSize: 10, opacity: 0.7 }}>L{role.level}</span>
      {role.name}{role.unitNama ? ` · ${role.unitNama}` : ""}
    </span>
  );
}

// ── Tab: Akses Data ────────────────────────────────────────────────────────────

function AksesDataTab({ roles, permissions, setPermissions }: {
  roles: RoleOption[];
  permissions: RoleViewPermission[];
  setPermissions: React.Dispatch<React.SetStateAction<RoleViewPermission[]>>;
}) {
  const [selectedViewerRoleId, setSelectedViewerRoleId] = useState<number | null>(null);
  const [pendingViewableIds, setPendingViewableIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const rolesByLevel = roles.reduce<Record<number, RoleOption[]>>((acc, r) => {
    if (!acc[r.level]) acc[r.level] = [];
    acc[r.level].push(r);
    return acc;
  }, {});

  const selectedViewerRole = roles.find(r => r.id === selectedViewerRoleId);
  const permCountByViewer = permissions.reduce<Record<number, number>>((acc, p) => {
    acc[p.viewerRoleId] = (acc[p.viewerRoleId] ?? 0) + 1;
    return acc;
  }, {});

  const selectViewerRole = useCallback((roleId: number) => {
    if (isDirty) { if (!confirm("Ada perubahan yang belum disimpan. Lanjutkan?")) return; }
    setSelectedViewerRoleId(roleId);
    const current = new Set(permissions.filter(p => p.viewerRoleId === roleId).map(p => p.viewableRoleId));
    setPendingViewableIds(current);
    setIsDirty(false);
  }, [permissions, isDirty]);

  const toggleViewable = (roleId: number) => {
    setPendingViewableIds(prev => { const next = new Set(prev); if (next.has(roleId)) next.delete(roleId); else next.add(roleId); return next; });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedViewerRoleId) return;
    setSaving(true);
    try {
      const updated = await setRoleViewPermissions(selectedViewerRoleId, Array.from(pendingViewableIds));
      setPermissions(prev => [...prev.filter(p => p.viewerRoleId !== selectedViewerRoleId), ...updated]);
      setIsDirty(false);
      toast.success("Konfigurasi akses berhasil disimpan.");
    } catch { toast.error("Gagal menyimpan konfigurasi akses."); }
    finally { setSaving(false); }
  };

  const handleSelectAll = () => { setPendingViewableIds(new Set(roles.filter(r => r.id !== selectedViewerRoleId).map(r => r.id))); setIsDirty(true); };
  const handleClearAll = () => { setPendingViewableIds(new Set()); setIsDirty(true); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      {/* Left panel */}
      <div className="rbac-panel">
        <div className="rbac-panel-header">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#e8eef7", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Role (Pemilik Akses)</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7aa3c8" }}>Pilih role untuk konfigurasi</p>
        </div>
        <div style={{ maxHeight: 520, overflowY: "auto" as const }}>
          {Object.entries(rolesByLevel).map(([levelStr, levelRoles]) => {
            const level = Number(levelStr);
            if (level === 0) return null;
            const c = LEVEL_COLOR[level] ?? LEVEL_COLOR[4];
            return (
              <div key={levelStr}>
                <div style={{ padding: "6px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.text, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    {LEVEL_LABEL[level] ?? `Level ${level}`}
                  </span>
                </div>
                {levelRoles.map(role => {
                  const isSelected = role.id === selectedViewerRoleId;
                  const count = permCountByViewer[role.id] ?? 0;
                  return (
                    <button key={role.id} onClick={() => selectViewerRole(role.id)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 16px", background: isSelected ? "#eff6ff" : "transparent", border: "none", borderBottom: "1px solid #f3f4f6", borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent", cursor: "pointer", textAlign: "left" as const, transition: "background 0.12s" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 600, color: isSelected ? "#1d4ed8" : "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{role.name}</div>
                        {role.unitNama && <div style={{ fontSize: 10.5, color: isSelected ? "#60a5fa" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{role.unitNama}</div>}
                      </div>
                      {count > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: isSelected ? "#dbeafe" : "#f3f4f6", color: isSelected ? "#1d4ed8" : "#6b7280", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="rbac-panel">
        {!selectedViewerRole ? (
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "72px 32px", color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Pilih role di sebelah kiri</div>
            <div style={{ fontSize: 12.5, textAlign: "center" as const }}>Klik salah satu role untuk mengatur siapa yang dapat dilihat datanya.</div>
          </div>
        ) : (
          <>
            <div className="rbac-panel-header" style={{ background: "#f8fafc", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <RoleBadge role={selectedViewerRole} />
                  {isDirty && <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", borderRadius: 20, padding: "1px 7px" }}>Belum disimpan</span>}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                  Centang role yang dapat dilihat datanya oleh <strong>{selectedViewerRole.name}{selectedViewerRole.unitNama ? ` (${selectedViewerRole.unitNama})` : ""}</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={handleSelectAll} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Semua</button>
                <button onClick={handleClearAll} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Kosongkan</button>
                <button onClick={handleSave} disabled={saving || !isDirty}
                  style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: saving || !isDirty ? "#d1d5db" : "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving || !isDirty ? "not-allowed" : "pointer" }}>
                  {saving ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </div>

            <div style={{ padding: "16px 20px", maxHeight: 480, overflowY: "auto" as const }}>
              {Object.entries(rolesByLevel).map(([levelStr, levelRoles]) => {
                const level = Number(levelStr);
                const c = LEVEL_COLOR[level] ?? LEVEL_COLOR[4];
                const candidates = levelRoles.filter(r => r.id !== selectedViewerRoleId);
                if (candidates.length === 0) return null;
                const allChecked = candidates.every(r => pendingViewableIds.has(r.id));
                const someChecked = candidates.some(r => pendingViewableIds.has(r.id));
                const toggleLevel = () => {
                  setPendingViewableIds(prev => { const next = new Set(prev); if (allChecked) candidates.forEach(r => next.delete(r.id)); else candidates.forEach(r => next.add(r.id)); return next; });
                  setIsDirty(true);
                };
                return (
                  <div key={levelStr} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${c.border}` }}>
                      <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }} onChange={toggleLevel}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: c.text }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: c.text, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{LEVEL_LABEL[level] ?? `Level ${level}`}</span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{candidates.filter(r => pendingViewableIds.has(r.id)).length}/{candidates.length} dipilih</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                      {candidates.map(role => {
                        const checked = pendingViewableIds.has(role.id);
                        return (
                          <label key={role.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1px solid ${checked ? c.border : "#f3f4f6"}`, background: checked ? c.bg : "#fafafa", cursor: "pointer", transition: "all 0.1s" }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleViewable(role.id)} style={{ marginTop: 1, width: 14, height: 14, cursor: "pointer", accentColor: c.text, flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: checked ? 700 : 500, color: checked ? c.text : "#374151", lineHeight: 1.3 }}>{role.name}</div>
                              {role.unitNama && <div style={{ fontSize: 10.5, color: checked ? c.text : "#9ca3af", opacity: checked ? 0.8 : 1, marginTop: 1 }}>{role.unitNama}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "10px 20px", background: "#f8fafc", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 11.5, color: "#6b7280" }}>
                <strong style={{ color: "#111827" }}>{pendingViewableIds.size}</strong> role dipilih sebagai yang dapat dilihat oleh <strong style={{ color: "#111827" }}>{selectedViewerRole.name}</strong>
              </span>
              {pendingViewableIds.size > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, flex: 1 }}>
                  {Array.from(pendingViewableIds).slice(0, 5).map(id => {
                    const r = roles.find(r => r.id === id);
                    if (!r) return null;
                    return <RoleBadge key={id} role={r} />;
                  })}
                  {pendingViewableIds.size > 5 && <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>+{pendingViewableIds.size - 5} lainnya</span>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: Akses Fitur ───────────────────────────────────────────────────────────

function AksesFiturTab({ roles, featurePermissions, setFeaturePermissions }: {
  roles: RoleOption[];
  featurePermissions: RoleFeaturePermission[];
  setFeaturePermissions: React.Dispatch<React.SetStateAction<RoleFeaturePermission[]>>;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const rolesByLevel = roles.reduce<Record<number, RoleOption[]>>((acc, r) => {
    if (!acc[r.level]) acc[r.level] = [];
    acc[r.level].push(r);
    return acc;
  }, {});

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const featureCountByRole = featurePermissions.reduce<Record<number, number>>((acc, p) => {
    acc[p.roleId] = (acc[p.roleId] ?? 0) + 1;
    return acc;
  }, {});

  const selectRole = useCallback((roleId: number) => {
    if (isDirty) { if (!confirm("Ada perubahan yang belum disimpan. Lanjutkan?")) return; }
    setSelectedRoleId(roleId);
    const current = new Set(featurePermissions.filter(p => p.roleId === roleId).map(p => p.featureKey));
    setPendingKeys(current);
    setIsDirty(false);
  }, [featurePermissions, isDirty]);

  const toggleKey = (key: string) => {
    setPendingKeys(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const updated = await setRoleFeaturePermissions(selectedRoleId, Array.from(pendingKeys));
      setFeaturePermissions(prev => [...prev.filter(p => p.roleId !== selectedRoleId), ...updated]);
      setIsDirty(false);
      toast.success("Konfigurasi akses fitur berhasil disimpan.");
    } catch { toast.error("Gagal menyimpan konfigurasi akses fitur."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      {/* Left panel */}
      <div className="rbac-panel">
        <div className="rbac-panel-header">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#e8eef7", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Role</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7aa3c8" }}>Pilih role untuk konfigurasi fitur</p>
        </div>
        <div style={{ maxHeight: 520, overflowY: "auto" as const }}>
          {Object.entries(rolesByLevel).map(([levelStr, levelRoles]) => {
            const level = Number(levelStr);
            if (level === 0) return null;
            const c = LEVEL_COLOR[level] ?? LEVEL_COLOR[4];
            return (
              <div key={levelStr}>
                <div style={{ padding: "6px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.text, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{LEVEL_LABEL[level] ?? `Level ${level}`}</span>
                </div>
                {levelRoles.map(role => {
                  const isSelected = role.id === selectedRoleId;
                  const count = featureCountByRole[role.id] ?? 0;
                  return (
                    <button key={role.id} onClick={() => selectRole(role.id)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 16px", background: isSelected ? "#f0fdf4" : "transparent", border: "none", borderBottom: "1px solid #f3f4f6", borderLeft: isSelected ? "3px solid #16a34a" : "3px solid transparent", cursor: "pointer", textAlign: "left" as const, transition: "background 0.12s" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 600, color: isSelected ? "#15803d" : "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{role.name}</div>
                        {role.unitNama && <div style={{ fontSize: 10.5, color: isSelected ? "#4ade80" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{role.unitNama}</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: isSelected ? "#dcfce7" : "#f3f4f6", color: isSelected ? "#15803d" : "#6b7280", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>
                        {count === 0 ? "Semua" : `${count} fitur`}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="rbac-panel">
        {!selectedRole ? (
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "72px 32px", color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Pilih role di sebelah kiri</div>
            <div style={{ fontSize: 12.5, textAlign: "center" as const }}>Klik salah satu role untuk mengatur fitur yang dapat diakses.</div>
          </div>
        ) : (
          <>
            <div className="rbac-panel-header" style={{ background: "#f8fafc", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <RoleBadge role={selectedRole} />
                  {isDirty && <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", borderRadius: 20, padding: "1px 7px" }}>Belum disimpan</span>}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                  Centang fitur yang dapat diakses oleh <strong>{selectedRole.name}{selectedRole.unitNama ? ` (${selectedRole.unitNama})` : ""}</strong>.{" "}
                  <span style={{ color: "#9ca3af" }}>Kosong = semua fitur boleh diakses.</span>
                </p>
              </div>
              <button onClick={handleSave} disabled={saving || !isDirty}
                style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: saving || !isDirty ? "#d1d5db" : "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving || !isDirty ? "not-allowed" : "pointer", flexShrink: 0 }}>
                {saving ? "Menyimpan…" : "Simpan"}</button>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{ display: "grid", gap: 10 }}>
                {FEATURES.map(feature => {
                  const checked = pendingKeys.has(feature.key);
                  return (
                    <label key={feature.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 10, border: `1.5px solid ${checked ? "#16a34a" : "#e5e7eb"}`, background: checked ? "#f0fdf4" : "#fafafa", cursor: "pointer", transition: "all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleKey(feature.key)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#16a34a", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: checked ? 700 : 600, color: checked ? "#15803d" : "#1e293b", marginBottom: 2 }}>{feature.label}</div>
                        <div style={{ fontSize: 11.5, color: checked ? "#4ade80" : "#9ca3af" }}>{feature.description}</div>
                      </div>
                      {checked && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#15803d", background: "#dcfce7", borderRadius: 20, padding: "2px 9px", flexShrink: 0 }}>Diizinkan</span>}
                    </label>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#92400e" }}>
                  <strong>Catatan:</strong> Jika tidak ada fitur yang dipilih, role ini dapat mengakses <em>semua fitur</em> (tidak ada pembatasan). Beranda selalu dapat diakses.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RBACContent() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [permissions, setPermissions] = useState<RoleViewPermission[]>([]);
  const [featurePermissions, setFeaturePermissions] = useState<RoleFeaturePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'data' | 'fitur'>('data');

  useEffect(() => {
    Promise.all([getAllRoles(), getAllRoleViewPermissions(), getAllRoleFeaturePermissions()])
      .then(([r, p, fp]) => {
        const sorted = [...r].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "id") || a.unitNama.localeCompare(b.unitNama, "id"));
        setRoles(sorted); setPermissions(p); setFeaturePermissions(fp); setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const configuredCount = new Set(permissions.map(p => p.viewerRoleId)).size;

  if (loading) {
    return (
      <div style={{ fontFamily: "var(--font-nunito-sans, sans-serif)", maxWidth: 1100, padding: "32px 0" }}>
        <div style={{ height: 48, background: "#f3f4f6", borderRadius: 10, marginBottom: 12, opacity: 0.6 }} />
        <div style={{ height: 400, background: "#f3f4f6", borderRadius: 12, opacity: 0.4 }} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-nunito-sans, sans-serif)", maxWidth: 1100 }}>
      <style>{`
        .rbac-hero {
          display: flex; justify-content: space-between; gap: 24px; align-items: stretch;
          margin-bottom: 18px; padding: 22px 24px; border: 1px solid #e2e8f0; border-radius: 18px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #f0fdf4 100%);
          box-shadow: 0 18px 42px rgba(15,23,42,0.08);
        }
        .rbac-eyebrow { margin: 0 0 6px; color: #16a34a; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
        .rbac-title { margin: 0 0 8px; color: #0f172a; font-size: 22px; font-weight: 900; }
        .rbac-subtitle { max-width: 560px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
        .rbac-stats-card { min-width: 260px; padding: 16px 20px; border: 1px solid #bbf7d0; border-radius: 14px; background: #fff; display: flex; align-items: center; }
        .rbac-stats-grid { display: flex; align-items: center; gap: 0; width: 100%; }
        .rbac-stat { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
        .rbac-stat-val { font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1; }
        .rbac-stat-lbl { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }
        .rbac-stat-divider { width: 1px; height: 40px; background: #e2e8f0; margin: 0 6px; flex-shrink: 0; }
        .rbac-toolbar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          margin-bottom: 18px; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 14px;
          background: #fff; box-shadow: 0 4px 16px rgba(15,23,42,0.06);
        }
        .rbac-tab-group { display: flex; background: #f3f4f6; border-radius: 10px; padding: 3px; gap: 2px; }
        .rbac-tab { padding: 7px 18px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; background: transparent; color: #6b7280; }
        .rbac-tab--active { background: #fff; color: #111827; box-shadow: 0 1px 4px rgba(0,0,0,0.10); }
        .rbac-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,23,42,0.06); }
        .rbac-panel-header { display: flex; align-items: center; padding: 12px 16px; background: #0f2f4f; border-bottom: 1px solid rgba(255,255,255,0.1); }
        @media (max-width: 900px) {
          .rbac-hero { flex-direction: column; align-items: stretch; }
          .rbac-stats-card { min-width: 0; }
        }
      `}</style>

      {/* ── Hero Card ── */}
      <div className="rbac-hero">
        <div>
          <p className="rbac-eyebrow">Admin · Konfigurasi</p>
          <h3 className="rbac-title">Konfigurasi Akses RBAC</h3>
          <p className="rbac-subtitle">Atur hak akses data dan fitur untuk setiap role dalam sistem.</p>
        </div>
        <div className="rbac-stats-card">
          <div className="rbac-stats-grid">
            <div className="rbac-stat">
              <span className="rbac-stat-val">{roles.length}</span>
              <span className="rbac-stat-lbl">Total Role</span>
            </div>
            <div className="rbac-stat-divider" />
            <div className="rbac-stat">
              <span className="rbac-stat-val">{configuredCount}</span>
              <span className="rbac-stat-lbl">Dikonfigurasi</span>
            </div>
            <div className="rbac-stat-divider" />
            <div className="rbac-stat">
              <span className="rbac-stat-val">{FEATURES.length}</span>
              <span className="rbac-stat-lbl">Fitur</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar with tabs ── */}
      <div className="rbac-toolbar">
        <div className="rbac-tab-group">
          {([
            { key: 'data' as const, label: '🔍 Akses Data', desc: 'Role mana yang datanya dapat dilihat' },
            { key: 'fitur' as const, label: '🛡️ Akses Fitur', desc: 'Fitur/menu mana yang dapat diakses' },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} title={tab.desc}
              className={`rbac-tab${activeTab === tab.key ? " rbac-tab--active" : ""}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {activeTab === 'data' ? `${configuredCount} dari ${roles.filter(r => r.level > 0).length} role dikonfigurasi` : `${FEATURES.length} fitur tersedia`}
        </span>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'data'
        ? <AksesDataTab roles={roles} permissions={permissions} setPermissions={setPermissions} />
        : <AksesFiturTab roles={roles} featurePermissions={featurePermissions} setFeaturePermissions={setFeaturePermissions} />
      }
    </div>
  );
}
