"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MonitoringDekanPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pimpinan/monitoring-keseluruhan");
  }, [router]);
  return null;
}
