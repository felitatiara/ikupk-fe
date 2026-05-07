"use client";

import IKUPKContent from "@/features/iku-pk/IKUPKContent";
import { useAuth } from "@/hooks/useAuth";
import NotificationsReminder from "./NotificationsReminder";

export default function DashboardContent() {
  const { user: authUser } = useAuth();
  const roleLevel = authUser?.roleLevel ?? 4;

  const role: "admin" | "pimpinan" | "user" =
    roleLevel === 0 ? "admin" : roleLevel === 1 ? "pimpinan" : "user";

  return <IKUPKContent role={role} pageTitle="Beranda" headerSlot={<NotificationsReminder />} />;
}
