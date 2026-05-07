"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import PageTransition from "@/components/layout/PageTransition";
import { getRealisasiForValidasi, updateRealisasiStatus, ValidasiRow, getLaporanWithRealisasi } from "@/lib/api";
import { toast } from "sonner";

export interface ValidasiData {
  id: number;
  tenggat: string;
  target: string;
  sasaranStrategis: string;
  capaian: number;
  status: "pending" | "validated";
}

interface ValidasiIKUPKContentProps {
  role?: 'admin' | 'user';
}

export default function ValidasiIKUPKContent({ role = 'user' }: ValidasiIKUPKContentProps) {
  const [data, setData] = useState<ValidasiData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const rows: ValidasiRow[] = await getRealisasiForValidasi();
        const mapped: ValidasiData[] = rows.map((r) => ({
          id: r.id,
          tenggat: r.tahun,
          target: r.target,
          sasaranStrategis: r.sasaranStrategis,
          capaian: r.realisasiAngka,
          status: r.status === 'validated' ? 'validated' : 'pending',
        }));
        setData(mapped);
      } catch (err) {
        console.error('Failed to fetch validasi data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const [filterTarget, setFilterTarget] = useState("semua");
  const [filterPeriode, setFilterPeriode] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");

  const targetOptions = [
    "semua",
    ...Array.from(new Set(data.map((item) => item.target))),
  ];

  const periodeOptions = [
    "semua",
    ...Array.from(
      new Set(data.map((item) => item.tenggat.split(" ").slice(-1)[0]))
    ),
  ];

  const handleValidate = async (id: number) => {
    try {
      await updateRealisasiStatus(id, 'validated');
      setData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "validated" } : item
        )
      );
      toast.success("Berhasil divalidasi.");
    } catch (err) {
      console.error('Failed to validate:', err);
      toast.error("Gagal memvalidasi data.");
    }
  };

  const handleResetFilter = () => {
    setFilterTarget("semua");
    setFilterPeriode("semua");
    setFilterStatus("semua");
  };

  const exportToExcel = async () => {
    try {
      const userStr = sessionStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : {};
      const roleId: number = user.roleId ?? 0;
      const tahun = filterPeriode !== "semua" ? filterPeriode : new Date().getFullYear().toString();

      const jenisList: string[] =
        filterTarget === "semua" ? ["IKU", "PK"]
        : filterTarget === "Indikator Kinerja Utama" ? ["IKU"]
        : ["PK"];

      const wb = XLSX.utils.book_new();
      type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

      for (const jenis of jenisList) {
        const grouped = await getLaporanWithRealisasi(jenis, tahun, roleId);
        if (grouped.length === 0) continue;

        const aoa: (string | number)[][] = [];
        const merges: MergeRange[] = [];

        if (jenis === "IKU") {
          // Header 2 baris, 8 kolom
          // No | Sasaran Strategis | Indikator Kinerja Kegiatan | Target Universitas | Tenggat | Realisasi(%) | Realisasi(Angka) | Data Link
          aoa.push(["No.", "Sasaran Strategis", "Indikator Kinerja Kegiatan", "Target Universitas", "Tenggat", "Realisasi", "", "Data Link"]);
          aoa.push(["", "", "", "", "", "%", "Angka", ""]);
          merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
          merges.push({ s: { r: 0, c: 1 }, e: { r: 1, c: 1 } });
          merges.push({ s: { r: 0, c: 2 }, e: { r: 1, c: 2 } });
          merges.push({ s: { r: 0, c: 3 }, e: { r: 1, c: 3 } });
          merges.push({ s: { r: 0, c: 4 }, e: { r: 1, c: 4 } });
          merges.push({ s: { r: 0, c: 5 }, e: { r: 0, c: 6 } }); // "Realisasi" span 2
          merges.push({ s: { r: 0, c: 7 }, e: { r: 1, c: 7 } });

          let no = 1;
          for (const group of grouped) {
            const groupStart = aoa.length;
            aoa.push([
              no + ".", group.nama, "",
              group.persentaseTarget !== null ? group.persentaseTarget + "%" : "",
              group.tenggat || "",
              "", "", "",
            ]);

            for (const sub of group.subIndikators) {
              // L1
              aoa.push([
                "", "", sub.kode + "  " + sub.nama, "", "",
                sub.realisasiKualitas !== null ? sub.realisasiKualitas + "%" : "",
                sub.realisasiKuantitas || "",
                "",
              ]);
              for (const child of sub.children ?? []) {
                // L2
                aoa.push([
                  "", "", "    " + child.kode + "  " + child.nama, "", "",
                  "",
                  child.realisasiKuantitas || "",
                  "",
                ]);
              }
            }

            const groupEnd = aoa.length - 1;
            if (groupEnd > groupStart) {
              merges.push({ s: { r: groupStart, c: 0 }, e: { r: groupEnd, c: 0 } });
              merges.push({ s: { r: groupStart, c: 1 }, e: { r: groupEnd, c: 1 } });
              merges.push({ s: { r: groupStart, c: 3 }, e: { r: groupEnd, c: 3 } });
              merges.push({ s: { r: groupStart, c: 4 }, e: { r: groupEnd, c: 4 } });
            }
            no++;
          }

          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws["!merges"] = merges;
          ws["!cols"] = [
            { wch: 6 }, { wch: 30 }, { wch: 44 },
            { wch: 16 }, { wch: 14 },
            { wch: 12 }, { wch: 12 }, { wch: 30 },
          ];
          XLSX.utils.book_append_sheet(wb, ws, "Laporan IKU");

        } else {
          // PK — Header 1 baris, 8 kolom
          // No | Sasaran Strategis | Indikator Kinerja Kegiatan | Waktu Pelaporan | Satuan | Target[tahun] | Realisasi | Data Link
          aoa.push(["No.", "Sasaran Strategis", "Indikator Kinerja Kegiatan", "Waktu Pelaporan", "Satuan", `Target ${tahun}`, "Realisasi", "Data Link"]);

          let no = 1;
          for (const group of grouped) {
            const groupStart = aoa.length;
            aoa.push([no + ".", group.nama, "", "", "", "", "", ""]);

            for (const sub of group.subIndikators) {
              // L1
              aoa.push(["", "", sub.kode + "  " + sub.nama, "", "", "", "", ""]);
              for (const child of sub.children ?? []) {
                // L2
                aoa.push(["", "", "    " + child.kode + "  " + child.nama, "", "", "", "", ""]);
                for (const l3 of child.children ?? []) {
                  // L3 — target, satuan, tenggat dari target_universitas di L3
                  aoa.push([
                    "", "",
                    "        " + l3.kode + "  " + l3.nama,
                    l3.tenggat || "",
                    l3.satuan || "",
                    l3.nilaiTarget ?? "",
                    l3.realisasiKuantitas || "",
                    "",
                  ]);
                }
              }
            }

            const groupEnd = aoa.length - 1;
            if (groupEnd > groupStart) {
              merges.push({ s: { r: groupStart, c: 0 }, e: { r: groupEnd, c: 0 } });
              merges.push({ s: { r: groupStart, c: 1 }, e: { r: groupEnd, c: 1 } });
            }
            no++;
          }

          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws["!merges"] = merges;
          ws["!cols"] = [
            { wch: 6 }, { wch: 30 }, { wch: 44 },
            { wch: 22 }, { wch: 14 },
            { wch: 12 }, { wch: 12 }, { wch: 30 },
          ];
          XLSX.utils.book_append_sheet(wb, ws, "Laporan PK");
        }
      }

      XLSX.writeFile(wb, `Laporan_IKU_PK_${tahun}.xlsx`);
    } catch (err) {
      console.error("Failed to export Excel:", err);
      toast.error("Gagal export Excel.");
    }
  };

  const filteredData = data.filter((item) => {
    const matchTarget = filterTarget === "semua" || item.target === filterTarget;
    const year = item.tenggat.split(" ").slice(-1)[0] || "";
    const matchPeriode = filterPeriode === "semua" || year === filterPeriode;
    const statusLabel = item.status === "validated" ? "validated" : "pending";
    const matchStatus = filterStatus === "semua" || filterStatus === statusLabel;
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
            Validasi Indikator Kinerja Utama &amp; Perjanjian Kerja
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

            <div className="filter-status-wrapper">
              <label className="filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-isi"
              >
                <option value="semua">Semua</option>
                <option value="pending">Menunggu Validasi</option>
                <option value="validated">Tervalidasi</option>
              </select>
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

          <div className="table-wrapper">
            <h4 className="section-heading">Target IKU dan PK</h4>
            <table className="table-validasi">
              <thead>
                <tr>
                  <th>Tenggat</th>
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
                        {item.status !== "validated" ? (
                          <button
                            onClick={() => handleValidate(item.id)}
                            className="btn-validate-green"
                          >
                            Validasi
                          </button>
                        ) : (
                          <span className="status-validated">Tervalidasi</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="td-empty-row">
                      Tidak ada data untuk divalidasi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
