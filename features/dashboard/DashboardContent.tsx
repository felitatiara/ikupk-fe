"use client";

import IKUPKContent from "@/features/iku-pk/IKUPKContent";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardContent() {
  const { user: authUser } = useAuth();
  const roleLevel = authUser?.roleLevel ?? 4;

  const role: "admin" | "pimpinan" | "user" =
    roleLevel === 0 ? "admin" : roleLevel === 1 ? "pimpinan" : "user";

  const banner = (
    <div className="info-banner-green" style={{ marginBottom: 24 }}>
      <div>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: "#15803d", margin: "0 0 4px" }}>
          Target Baru
        </h3>
        <p style={{ fontSize: 13, color: "#3f6619", margin: 0 }}>
          Segera periksa target Indikator Kinerja Utama dan Perjanjian Kerja Anda, lalu lakukan penyesuaian sebelum tanggal 30 Oktober.
        </p>
      </div>
      <button className="btn-green-sm" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
        Telusuri
      </button>
    </div>
  );

  return <IKUPKContent role={role} pageTitle="Beranda" headerSlot={banner} />;
}
