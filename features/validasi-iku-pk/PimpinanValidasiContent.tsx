"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import { getPimpinanValidasi, updateTargetStatus } from "@/lib/api";
import type { PimpinanValidasiRow } from "@/lib/api";
import { toast } from "sonner";

interface ValidasiData {
  id: number;
  tenggat: string;
  target: string;
  sasaranStrategis: string;
  capaian: number;
  status: string;
}

export default function PimpinanValidasiContent() {
  const [data, setData] = useState<ValidasiData[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  useEffect(() => {
    async function fetchData() {
      try {
        const userStr = sessionStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);
        const rows: PimpinanValidasiRow[] = await getPimpinanValidasi(user.roleId);
        const mapped: ValidasiData[] = rows.map((r) => ({
          id: r.id,
          tenggat: r.tahun,
          target: r.target,
          sasaranStrategis: r.sasaranStrategis,
          capaian: r.capaian,
          status: r.status,
        }));
        setData(mapped);
      } catch (err) {
        console.error("Failed to fetch pimpinan validasi data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const targetOptions = [
    "semua",
    ...Array.from(new Set(data.map((item) => item.target))),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(new Set(data.map((item) => item.tenggat))),
  ];

  const handleValidate = async (id: number) => {
    try {
      await updateTargetStatus(id, "disposisi");
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "disposisi" } : item
        )
      );
      toast.success("Target berhasil disetujui.");
    } catch (err) {
      console.error("Failed to validate:", err);
      toast.error("Gagal menyetujui target.");
    }
  };

  const handleReject = async (id: number) => {
    try {
      await updateTargetStatus(id, "rejected");
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "rejected" } : item
        )
      );
      toast.success("Target berhasil ditolak.");
    } catch (err) {
      console.error("Failed to reject:", err);
      toast.error("Gagal menolak target.");
    }
  };

  const handleResetFilter = () => {
    setFilterTarget("semua");
    setFilterPeriode("semua");
    setFilterStatus("semua");
  };

  const exportToExcel = () => {
    const rows = filteredData.map((item, i) => ({
      No: i + 1,
      Tahun: item.tenggat,
      Target: item.target,
      "Sasaran Strategis": item.sasaranStrategis,
      "Capaian (%)": item.capaian,
      Status: item.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Validasi Pimpinan");
    XLSX.writeFile(wb, `Validasi_Pimpinan_${new Date().getFullYear()}.xlsx`);
  };

  const filteredData = data.filter((item) => {
    const matchTarget = filterTarget === "semua" || item.target === filterTarget;
    const matchPeriode = filterPeriode === "semua" || item.tenggat === filterPeriode;
    const matchStatus = filterStatus === "semua" || item.status === filterStatus;
    return matchTarget && matchPeriode && matchStatus;
  });

  return (
    <div>
      <PageTransition>
        <p className="ikupk-header-text">
          Validasi Indikator Kinerja Utama &amp; Perjanjian Kerja
        </p>

        <div className="page-card">
          <h3 className="ikupk-card-title">
            Validasi Target IKU &amp; PK
          </h3>

          <div className="filter-section">
            <div className="filter-grid-2">
              <div>
                <label className="filter-label">Target</label>
                <select
                  value={filterTarget}
                  onChange={(e) => setFilterTarget(e.target.value)}
                  className="filter-isi"
                >
                  {targetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "semua" ? "Semua" : option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="filter-label">Periode</label>
                <select
                  value={filterPeriode}
                  onChange={(e) => setFilterPeriode(e.target.value)}
                  className="filter-isi"
                >
                  {periodeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "semua" ? "Semua" : option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="btn-row-end">
              <button onClick={handleResetFilter} className="btn-outline-green">
                Reset Filter
              </button>
              <button className="btn-green-sm">
                Cari
              </button>
              <button onClick={exportToExcel} className="btn-green-sm">
                Export Excel
              </button>
            </div>
          </div>

          {loading && <p className="text-loading">Loading...</p>}

          {!loading && (
            <div className="table-wrapper">
              <h4 className="section-heading">Target Menunggu Validasi</h4>
              <table className="table-validasi">
                <thead>
                  <tr>
                    <th>Tahun</th>
                    <th>Target</th>
                    <th>Sasaran Strategis</th>
                    <th className="text-center">Capaian</th>
                    <th className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? (
                    filteredData.map((item) => (
                      <tr key={item.id}>
                        <td className="td-year">{item.tenggat}</td>
                        <td>{item.target}</td>
                        <td className="td-gray">{item.sasaranStrategis}</td>
                        <td className="td-center-bold">{item.capaian}</td>
                        <td className="text-center">
                          {item.status === "pending_pimpinan" ? (
                            <div className="btn-row-center">
                              <button
                                onClick={() => handleValidate(item.id)}
                                className="btn-validate-green"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => handleReject(item.id)}
                                className="btn-validate-red"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="status-done">
                              {item.status === "disposisi" ? "Disetujui" : item.status === "rejected" ? "Ditolak" : item.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="td-empty-row">
                        Tidak ada data untuk filter ini
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
