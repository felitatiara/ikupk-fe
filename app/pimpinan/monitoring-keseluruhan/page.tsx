"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import MonitoringDekanContent from "@/features/monitoring-dekan/MonitoringDekanContent";

function canAccessKeseluruhan(roleName: string): boolean {
  const rn = roleName.toLowerCase().trim();
  // Dekan (bukan Wakil Dekan)
  if (rn === "dekan" || (rn.startsWith("dekan") && !rn.includes("wakil"))) return true;
  // Wakil Dekan II / Wakil Dekan 2 — pastikan bukan I atau III
  if (rn.includes("wakil") && rn.includes("dekan")) {
    if ((rn.includes("ii") && !rn.includes("iii")) || rn.includes(" 2") || rn.endsWith("2") || rn.includes("kedua")) return true;
  }
  return false;
}

export default function MonitoringKeseluruhanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (!canAccessKeseluruhan(user.role ?? "")) {
      router.replace("/pimpinan/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;
  if (!canAccessKeseluruhan(user.role ?? "")) return null;

  return <MonitoringDekanContent />;
}
