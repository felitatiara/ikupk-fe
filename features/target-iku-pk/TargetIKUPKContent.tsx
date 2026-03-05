"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { getTargets, createTarget } from "@/services/targetService";

export interface TargetData {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export default function TargetIKUPKContent({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [targets, setTargets] = useState<TargetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTargets() {
      try {
        setLoading(true);
        const data = await getTargets();
        setTargets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load targets');
      } finally {
        setLoading(false);
      }
    }

    fetchTargets();
  }, []);

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Target IKU & PK
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Daftar Target IKU dan PK
          </h3>

          {loading && <p>Loading...</p>}
          {error && <p style={{ color: "red" }}>Error: {error}</p>}

          {!loading && !error && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Tanggal</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Target</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Sasaran Strategis</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Capaian</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 600, color: "#374151" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.length > 0 ? (
                    targets.map((target, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "16px", color: "#0284c7", fontWeight: 600 }}>{target.date}</td>
                        <td style={{ padding: "16px", color: "#374151" }}>{target.title}</td>
                        <td style={{ padding: "16px", color: "#374151" }}>{target.sasaran}</td>
                        <td style={{ padding: "16px", textAlign: "center", color: "#374151", fontWeight: 600 }}>{target.capaian}</td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <button style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "6px 12px", borderRadius: 6, border: "1px solid #d1fae5", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            Input
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>
                        Tidak ada data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
