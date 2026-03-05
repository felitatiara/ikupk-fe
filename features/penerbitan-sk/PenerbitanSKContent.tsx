"use client";

import { useState } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { uploadSK, publishSK } from "@/services/skService";

export default function PenerbitanSKContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);
      await uploadSK(formData);
      alert('File SK berhasil diunggah');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageTransition>
        <p style={{ color: "#FF7900", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          Penerbitan SK
        </p>

        <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", maxWidth: 600 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "#1f2937" }}>
            Unggah Surat Keputusan
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 16, border: "2px dashed #d1d5db", borderRadius: 8, textAlign: "center", cursor: "pointer" }}>
              <input
                type="file"
                onChange={handleFileChange}
                style={{ display: "none" }}
                id="file-upload"
                accept=".pdf,.doc,.docx"
                disabled={loading}
              />
              <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
                <p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>
                  {loading ? 'Upload in progress...' : 'Klik atau drag file di sini'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                  PDF, DOC, DOCX (Max 10MB)
                </p>
              </label>
            </div>

            {error && <p style={{ color: "red", fontSize: 14 }}>{error}</p>}
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
