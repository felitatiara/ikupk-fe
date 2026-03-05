"use client";

import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const hideLayout = pathname === "/login" || pathname === "/";

  return (
    <html lang="en">
      <body
        className={`${nunitoSans.variable} antialiased`}
        style={{ fontFamily: "var(--font-nunito-sans)" }}
      >
        <div style={{ minHeight: "100vh", backgroundColor: "#f5f7fa" }}>
          {!hideLayout && (
            <>
              {/* HEADER */}
              <div
                style={{
                  background: "linear-gradient(to right, #FF7900, #FF9A3C)",
                  color: "white",
                  padding: "16px 24px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    maxWidth: 1400,
                    margin: "0 auto",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        backgroundColor: "white",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 20 }}>🎓</span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                        Indikator Kinerja Utama & Perjanjian Kerja
                      </p>
                      <p style={{ fontSize: 12, margin: 0, opacity: 0.9 }}>
                        UPN Veteran Jakarta
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        cursor: "pointer",
                        fontSize: 18,
                      }}
                    >
                      🔔
                    </button>
                    <button
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        backgroundColor: "rgba(255,255,255,0.2)",
                        cursor: "pointer",
                        fontSize: 18,
                      }}
                    >
                      👤
                    </button>
                  </div>
                </div>
              </div>

              {/* PAGE CONTENT */}
              <div
                style={{
                  maxWidth: 1400,
                  margin: "0 auto",
                  padding: "24px",
                  display: "flex",
                  gap: 24,
                }}
              >
                <Sidebar />
                <main style={{ flex: 1 }}>{children}</main>
              </div>
            </>
          )}

          {hideLayout && <main>{children}</main>}
        </div>
        </ViewProvider>
      html>
  );
}
