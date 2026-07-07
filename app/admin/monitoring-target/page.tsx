"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import MonitoringTargetPage from "@/features/monitoring-target/MonitoringTargetPage";

export default function MonitoringTargetRoute() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [canAccess, setCanAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/admin/dashboard");
      setChecking(false);
      return;
    }
    const isSuperAdmin =
      (user.roleLevel ?? 99) === 0 || (user?.role ?? "").toLowerCase() === "admin";
    setCanAccess(isSuperAdmin);
    setChecking(false);
    if (!isSuperAdmin) router.replace("/admin/dashboard");
  }, [user, loading, router]);

  if (loading || checking) return null;
  if (!canAccess) return null;

  return <MonitoringTargetPage />;
}
