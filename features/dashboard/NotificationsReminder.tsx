"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "@/services/notificationService";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Baru saja";
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Kemarin";
  return `${days} hari lalu`;
}

function urgencyFromType(type: string | null) {
  if (type === "tenggat_1hari") return { label: "Hari ini!", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
  if (type === "tenggat_7hari") return { label: "7 hari lagi", color: "#f97316", bg: "#fff7ed", border: "#fed7aa" };
  return { label: "", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };
}

export default function NotificationsReminder() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());

  useEffect(() => {
    setToken(sessionStorage.getItem("token") ?? "");
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const data = await getNotifications(token);
    setNotifications(data.filter((n) => !n.isRead));
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleDismiss = async (id: number) => {
    setDismissing((prev) => new Set(prev).add(id));
    await markNotificationRead(id, token);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setDismissing((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleDismissAll = async () => {
    await markAllNotificationsRead(token);
    setNotifications([]);
  };

  if (loading) return null;

  // All clear state
  if (notifications.length === 0) {
    return (
      <div style={{
        marginBottom: 24,
        padding: "14px 18px",
        borderRadius: 10,
        backgroundColor: "#f0fdf4",
        border: "1px solid #bbf7d0",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          backgroundColor: "#dcfce7",
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
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            backgroundColor: "#fff7ed",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1f2937" }}>
            Pengingat Tenggat
          </span>
          <span style={{
            backgroundColor: "#fef3c7", color: "#92400e",
            fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 10,
          }}>
            {notifications.length}
          </span>
        </div>

        {notifications.length > 1 && (
          <button
            onClick={handleDismissAll}
            style={{
              background: "none", border: "none",
              fontSize: 12, color: "#6b7280", cursor: "pointer",
              fontWeight: 600, padding: "4px 0",
              textDecoration: "underline", textDecorationColor: "#d1d5db",
            }}
          >
            Tandai semua selesai
          </button>
        )}
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map((n) => {
          const urgency = urgencyFromType(n.type);
          const isDismissing = dismissing.has(n.id);
          return (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0,
                borderRadius: 10,
                border: `1px solid ${urgency.border}`,
                backgroundColor: urgency.bg,
                overflow: "hidden",
                opacity: isDismissing ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {/* Colored left stripe */}
              <div style={{ width: 4, backgroundColor: urgency.color, flexShrink: 0, alignSelf: "stretch" }} />

              {/* Icon */}
              <div style={{
                padding: "14px 12px",
                display: "flex", alignItems: "flex-start", flexShrink: 0,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  backgroundColor: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${urgency.border}`,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={urgency.color} strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: "12px 0", minWidth: 0 }}>
                {/* Urgency badge + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {urgency.label && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: urgency.color,
                      backgroundColor: "#fff",
                      border: `1px solid ${urgency.border}`,
                      padding: "1px 6px", borderRadius: 6,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      {urgency.label}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>

                {/* Message */}
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#1f2937",
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {n.message}
                </p>
              </div>

              {/* Dismiss button */}
              <div style={{ padding: "12px 14px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                <button
                  onClick={() => handleDismiss(n.id)}
                  disabled={isDismissing}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: `1px solid ${urgency.border}`,
                    backgroundColor: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    color: urgency.color,
                    cursor: isDismissing ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Selesai
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
