"use client";

import { useState } from "react";
import IKUPKContent from "@/features/iku-pk/IKUPKContent";
import { useAuth } from "@/hooks/useAuth";
import MonitoringBoxes from "./MonitoringBoxes";

export default function DashboardContent() {
  const { user: authUser } = useAuth();
  const roleLevel = authUser?.roleLevel ?? 4;

  // Di beranda, admin tampilkan monitoring overview (bukan verification panel)
  // Verification panel ada di menu "Verifikasi Biro PKU" yang terpisah
  const role: "admin" | "pimpinan" | "user" =
    roleLevel <= 1 ? "pimpinan" : "user";

  const [jenis, setJenis] = useState<"IKU" | "PK" | "PK_IKU">("IKU");
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));

  return (
    <IKUPKContent
      role={role}
      pageTitle="Beranda"
      externalJenis={jenis}
      externalTahun={tahun}
      hideFilter
      headerSlot={
        <MonitoringBoxes
          jenis={jenis}
          setJenis={setJenis}
          tahun={tahun}
          setTahun={setTahun}
        />
      }
    />
  );
}
