
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import type { Metadata } from "next";
import 'bootstrap/dist/css/bootstrap.min.css';
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "IKU & PK UPN Veteran Jakarta",
};
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
          <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}>
            {children}
          </div>
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
