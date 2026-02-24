"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from '@/components/Sidebar';
import TargetsTable from '@/components/TargetsTable';
import TargetIKUPKAdmin from '@/components/TargetIKUPKAdmin';
import { getTargets } from '@/lib/api';

interface TargetRow {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState("beranda");

  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) {
      window.location.href = "/login";
      return;
    }
    setUser(JSON.parse(userStr));
  }, []);

  useEffect(() => {
    async function fetchTargets() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTargets();
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load targets');
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchTargets();
    }
  }, [user]);

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    window.location.href = "/login";
  };

  if (!user) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }
  if (user.role === "admin" && user.unitId === 4) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
        {/* Header */}  
        <div style={{ backgroundColor: "#FF7900", color: "white", padding: 20 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           
           <p style={{ fontSize: 18, fontWeight: "bold" }}>Indikator Kinerja Utama dan Perjanjian Kerja Fakultas Ilmu Komputer </p>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
        {/* Main Content */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 40 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
            <div style={{ flex: 1 }}>
              {activeMenu === "target" ? (
                <TargetIKUPKAdmin />
              ) : (
                <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                  <h2 style={{ fontSize: 16, fontWeight: "bold", marginBottom: 24, color: "#1f2937" }}>
                    Selamat datang, {user.nama || user.email}!
                  </h2>
                  <p style={{ fontSize: 18, color: "#1f2937" }}>
                    Anda memiliki akses sebagai Admin PKU. Gunakan menu di samping untuk mengelola target.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } 
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#FF7900", color: "white", padding: 20 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 18, fontWeight: "bold" }}>Indikator Kinerja Utama dan Perjanjian Kerja Fakultas Ilmu Komputer </p>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 40 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />

          <div style={{ flex: 1 }}>
            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: 16, fontWeight: "bold", marginBottom: 24, color: "#1f2937" }}>
            Selamat datang, {user.nama || user.email}!
          </h2>

          {/* Notification INFO */}
          <div style={{ backgroundColor: "#f0f9ff", border: "2px solid #0284c7", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: "bold", color: "#0c4a6e" }}>
              Ki ini buat notif target baru
            </h3>
          </div>

            {/* Targets table */}
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Target IKU dan PK</h3>
            {loading && <p>Loading targets...</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            {!loading && !error && <TargetsTable rows={rows} />}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
