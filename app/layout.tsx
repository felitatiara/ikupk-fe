"use client";

import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

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
  return (
    <html lang="en">
      <body
        className={`${nunitoSans.variable} antialiased`}
        style={{ fontFamily: "var(--font-nunito-sans)" }}
      >
        <AuthProvider>
          <div style={{ minHeight: "100vh", backgroundColor: "#f5f7fa" }}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
