"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getAllRoles,
  getAllRoleViewPermissions,
  setRoleViewPermissions,
  type RoleOption,
  type RoleViewPermission,
} from "@/lib/api";

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
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      whiteSpace: "nowrap" as const,
    }}>
      <span style={{ fontSize: 10, opacity: 0.7 }}>L{role.level}</span>
      {role.name}{role.unitNama ? ` · ${role.unitNama}` : ""}
    </span>
  );
}

export default function RBACContent() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [permissions, setPermissions] = useState<RoleViewPermission[]>([]);
  const [selectedViewerRoleId, setSelectedViewerRoleId] = useState<number | null>(null);
  const [pendingViewableIds, setPendingViewableIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    Promise.all([getAllRoles(), getAllRoleViewPermissions()])
      .then(([r, p]) => {
        // Sort by level then name
        const sorted = [...r].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "id") || a.unitNama.localeCompare(b.unitNama, "id"));
        setRoles(sorted);
        setPermissions(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // When viewer role is selected, load their current viewable IDs
  const selectViewerRole = useCallback((roleId: number) => {
    if (isDirty) {
      if (!confirm("Ada perubahan yang belum disimpan. Lanjutkan?")) return;
    }
    setSelectedViewerRoleId(roleId);
    const current = new Set(
      permissions.filter(p => p.viewerRoleId === roleId).map(p => p.viewableRoleId)
    );
    setPendingViewableIds(current);
    setIsDirty(false);
  }, [permissions, isDirty]);

  const toggleViewable = (roleId: number) => {
    setPendingViewableIds(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedViewerRoleId) return;
    setSaving(true);
    try {
      const updated = await setRoleViewPermissions(selectedViewerRoleId, Array.from(pendingViewableIds));
      // Update local permissions state
      setPermissions(prev => [
        ...prev.filter(p => p.viewerRoleId !== selectedViewerRoleId),
        ...updated,
      ]);
      setIsDirty(false);
      toast.success("Konfigurasi akses berhasil disimpan.");
    } catch {
      toast.error("Gagal menyimpan konfigurasi akses.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = () => {
    const targetRoles = roles.filter(r => r.id !== selectedViewerRoleId);
    setPendingViewableIds(new Set(targetRoles.map(r => r.id)));
    setIsDirty(true);
  };

  const handleClearAll = () => {
    setPendingViewableIds(new Set());
    setIsDirty(true);
  };

  // Group roles by level for display
  const rolesByLevel = roles.reduce<Record<number, RoleOption[]>>((acc, r) => {
    if (!acc[r.level]) acc[r.level] = [];
    acc[r.level].push(r);
    return acc;
  }, {});

  const selectedViewerRole = roles.find(r => r.id === selectedViewerRoleId);

  // Count permissions per viewer role
  const permCountByViewer = permissions.reduce<Record<number, number>>((acc, p) => {
    acc[p.viewerRoleId] = (acc[p.viewerRoleId] ?? 0) + 1;
    return acc;
  }, {});

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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, color: "#111827", margin: "0 0 4px" }}>
          Konfigurasi Akses RBAC
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Atur role mana yang dapat melihat data dari role lain (Lihat Progress, Monitoring, Validasi).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
        {/* Left panel: Viewer role list */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
              Role (Pemilik Akses)
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>Pilih role untuk konfigurasi</p>
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto" as const }}>
            {Object.entries(rolesByLevel).map(([levelStr, levelRoles]) => {
              const level = Number(levelStr);
              if (level === 0) return null; // Admin doesn't need view permissions
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
                      <button
                        key={role.id}
                        onClick={() => selectViewerRole(role.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "10px 16px",
                          background: isSelected ? "#eff6ff" : "transparent",
                          border: "none",
                          borderBottom: "1px solid #f3f4f6",
                          borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
                          cursor: "pointer",
                          textAlign: "left" as const,
                          transition: "background 0.12s",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 600, color: isSelected ? "#1d4ed8" : "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {role.name}
                          </div>
                          {role.unitNama && (
                            <div style={{ fontSize: 10.5, color: isSelected ? "#60a5fa" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {role.unitNama}
                            </div>
                          )}
                        </div>
                        {count > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: isSelected ? "#dbeafe" : "#f3f4f6", color: isSelected ? "#1d4ed8" : "#6b7280", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: Permission editor */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {!selectedViewerRole ? (
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "72px 32px", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Pilih role di sebelah kiri</div>
              <div style={{ fontSize: 12.5, textAlign: "center" as const }}>
                Klik salah satu role untuk mengatur siapa yang dapat dilihat datanya.
              </div>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <RoleBadge role={selectedViewerRole} />
                    {isDirty && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", borderRadius: 20, padding: "1px 7px" }}>
                        Belum disimpan
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                    Centang role yang dapat dilihat datanya oleh <strong>{selectedViewerRole.name}{selectedViewerRole.unitNama ? ` (${selectedViewerRole.unitNama})` : ""}</strong>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={handleSelectAll} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                    Semua
                  </button>
                  <button onClick={handleClearAll} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
                    Kosongkan
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    style={{
                      padding: "5px 14px", borderRadius: 7, border: "none",
                      background: saving || !isDirty ? "#d1d5db" : "#16a34a",
                      color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving || !isDirty ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </div>

              {/* Permission checkboxes grouped by level */}
              <div style={{ padding: "16px 20px", maxHeight: 480, overflowY: "auto" as const }}>
                {Object.entries(rolesByLevel).map(([levelStr, levelRoles]) => {
                  const level = Number(levelStr);
                  const c = LEVEL_COLOR[level] ?? LEVEL_COLOR[4];
                  // Filter out the viewer role itself
                  const candidates = levelRoles.filter(r => r.id !== selectedViewerRoleId);
                  if (candidates.length === 0) return null;

                  const allChecked = candidates.every(r => pendingViewableIds.has(r.id));
                  const someChecked = candidates.some(r => pendingViewableIds.has(r.id));

                  const toggleLevel = () => {
                    setPendingViewableIds(prev => {
                      const next = new Set(prev);
                      if (allChecked) candidates.forEach(r => next.delete(r.id));
                      else candidates.forEach(r => next.add(r.id));
                      return next;
                    });
                    setIsDirty(true);
                  };

                  return (
                    <div key={levelStr} style={{ marginBottom: 16 }}>
                      {/* Level group header */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                        paddingBottom: 6, borderBottom: `2px solid ${c.border}`,
                      }}>
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={toggleLevel}
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: c.text }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 800, color: c.text, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                          {LEVEL_LABEL[level] ?? `Level ${level}`}
                        </span>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>
                          {candidates.filter(r => pendingViewableIds.has(r.id)).length}/{candidates.length} dipilih
                        </span>
                      </div>

                      {/* Role checkboxes */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                        {candidates.map(role => {
                          const checked = pendingViewableIds.has(role.id);
                          return (
                            <label
                              key={role.id}
                              style={{
                                display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px",
                                borderRadius: 8, border: `1px solid ${checked ? c.border : "#f3f4f6"}`,
                                background: checked ? c.bg : "#fafafa",
                                cursor: "pointer", transition: "all 0.1s",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleViewable(role.id)}
                                style={{ marginTop: 1, width: 14, height: 14, cursor: "pointer", accentColor: c.text, flexShrink: 0 }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: checked ? 700 : 500, color: checked ? c.text : "#374151", lineHeight: 1.3 }}>
                                  {role.name}
                                </div>
                                {role.unitNama && (
                                  <div style={{ fontSize: 10.5, color: checked ? c.text : "#9ca3af", opacity: checked ? 0.8 : 1, marginTop: 1 }}>
                                    {role.unitNama}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary footer */}
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
                    {pendingViewableIds.size > 5 && (
                      <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>+{pendingViewableIds.size - 5} lainnya</span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info card */}
      <div style={{ marginTop: 20, padding: "14px 18px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>ℹ️ Catatan Penggunaan RBAC</p>
        <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "#374151", lineHeight: 1.8 }}>
          <li>Konfigurasi ini menentukan data siapa yang dapat dilihat di fitur <strong>Lihat Progress</strong>, <strong>Monitoring</strong>, dan <strong>Validasi</strong>.</li>
          <li>Untuk distribusi target, gunakan fitur <strong>Disposisi</strong> yang menentukan siapa yang menerima target.</li>
          <li>Contoh: Kaprodi S1 SI hanya dapat melihat Dosen S1 SI → centang role "Dosen · S1 Sistem Informasi" saja.</li>
          <li>Contoh: Kajur FIK dapat melihat semua Kaprodi dan Dosen → centang semua level 3 dan 4.</li>
        </ul>
      </div>
    </div>
  );
}
