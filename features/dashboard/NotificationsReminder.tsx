"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getUpcomingDeadlines,
  type UpcomingDeadlineItem,
} from "@/services/notificationService";

function urgencyFromDays(daysUntil: number) {
  if (daysUntil < 0)  return { label: `Lewat ${Math.abs(daysUntil)} hari!`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
  if (daysUntil === 0) return { label: "Hari ini!",                           color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
  if (daysUntil === 1) return { label: "Besok!",                              color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
  if (daysUntil <= 3)  return { label: `${daysUntil} hari lagi`,              color: "#f97316", bg: "#fff7ed", border: "#fed7aa" };
  return                       { label: `${daysUntil} hari lagi`,              color: "#eab308", bg: "#fefce8", border: "#fef08a" };
}

function deadlineMessage(item: UpcomingDeadlineItem): string {
  const { indikatorNama, tenggat, tahun, daysUntil } = item;
  if (daysUntil < 0)  return `Tenggat "${indikatorNama}" (${tenggat} ${tahun}) sudah lewat ${Math.abs(daysUntil)} hari. Segera input realisasi!`;
  if (daysUntil === 0) return `Tenggat "${indikatorNama}" (${tenggat} ${tahun}) jatuh hari ini! Segera input realisasi!`;
  return `Tenggat "${indikatorNama}" (${tenggat} ${tahun}) tinggal ${daysUntil} hari lagi. Segera input realisasi!`;
}

export default function NotificationsReminder() {
  const [deadlines, setDeadlines] = useState<UpcomingDeadlineItem[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(sessionStorage.getItem("token") ?? "");
  }, []);

  const fetchDeadlines = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const data = await getUpcomingDeadlines(token);
    setDeadlines(data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchDeadlines();
    const id = setInterval(fetchDeadlines, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchDeadlines]);

  if (loading) return null;

  if (deadlines.length === 0) {
    return (
      <div style={{
        marginBottom: 24, padding: "14px 18px", borderRadius: 10,
        backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", backgroundColor: "#dcfce7",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#15803d" }}>Semua tenggat terpantau</p>
          <p style={{ margin: 0, fontSize: 12, color: "#16a34a", opacity: 0.8 }}>
            Tidak ada tenggat yang akan jatuh tempo dalam waktu dekat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", backgroundColor: "#fff7ed",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1f2937" }}>Pengingat Tenggat</span>
        <span style={{
          backgroundColor: "#fef3c7", color: "#92400e",
          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
        }}>
          {deadlines.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deadlines.map((item) => {
          const urgency = urgencyFromDays(item.daysUntil);
          return (
            <div
              key={`${item.indikatorId}-${item.tahun}`}
              style={{
                display: "flex", alignItems: "flex-start", gap: 0,
                borderRadius: 10, border: `1px solid ${urgency.border}`,
                backgroundColor: urgency.bg, overflow: "hidden",
              }}
            >
              <div style={{ width: 4, backgroundColor: urgency.color, flexShrink: 0, alignSelf: "stretch" }} />

              <div style={{ padding: "14px 12px", display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${urgency.border}`,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={urgency.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>

              <div style={{ flex: 1, padding: "12px 16px 12px 0", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: urgency.color,
                    backgroundColor: "#fff", border: `1px solid ${urgency.border}`,
                    padding: "1px 6px", borderRadius: 6,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {urgency.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#1f2937", fontWeight: 500, lineHeight: 1.5 }}>
                  {deadlineMessage(item)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
