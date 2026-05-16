const API_BASE_URL = 'http://localhost:4000';

export interface MonitoringData {
  unitId: number;
  unitName: string;
  period: string;
  indicators: any[];
  charts: any;
}

export interface ProgressChartSubChild {
  id: number;
  kode: string;
  nama: string;
  realisasi: number;
  nilaiTarget?: number | null;
  satuan?: string | null;
}

export interface ProgressChartSubItem {
  id: number;
  kode: string;
  nama: string;
  targetFakultas: number;
  realisasi: number;
  status: string;
  children: ProgressChartSubChild[];
}

export interface ProgressChartItem {
  id: number;
  kode: string;
  nama: string;
  jenis: string;
  targetUniversitas: number;   // IKU: %; PK: nilai absolut
  satuan: string | null;       // unit untuk PK (e.g. "Dokumen")
  targetAbsolut: number | null;
  targetFakultas: number;      // sum target_unit (IKU: L1, PK: L3)
  realisasi: number;
  persentaseRealisasi: number | null;
  tenggat: string;
  status: string;
  progress: number;
  chartProgress: number;
  subIndikators: ProgressChartSubItem[];
}

export interface DetailEntry {
  realisasiId: number;
  indikatorId: number;
  indikatorKode: string;
  indikatorNama: string;
  uploaderNama: string;
  uploaderEmail: string;
  realisasiAngka: number;
  status: string;
  tahun: string | null;
  periode: string | null;
  createdAt: string;
  files: { id: number; fileName: string; fileUrl: string; repositoryFileId: string | null }[];
}

export interface IndikatorDetail {
  indikator: { id: number; kode: string; nama: string; jenis: string } | null;
  entries: DetailEntry[];
}

export async function getMonitoringData(unitId?: number): Promise<MonitoringData> {
  const params = unitId ? `?unitId=${unitId}` : '';
  const response = await fetch(`${API_BASE_URL}/monitoring${params}`);
  if (!response.ok) throw new Error('Failed to fetch monitoring data');
  return response.json();
}

export async function getAggregatedProgress(tahun: string, jenis: string): Promise<ProgressChartItem[]> {
  const response = await fetch(`${API_BASE_URL}/monitoring/aggregated?tahun=${tahun}&jenis=${jenis}`);
  if (!response.ok) throw new Error('Failed to fetch aggregated progress');
  const result = await response.json();
  return result.data;
}

export async function getIndikatorMonitoringDetail(indikatorId: number, tahun: string): Promise<IndikatorDetail> {
  const response = await fetch(`${API_BASE_URL}/monitoring/indikator/${indikatorId}/detail?tahun=${tahun}`);
  if (!response.ok) throw new Error('Failed to fetch indikator detail');
  return response.json();
}

export async function getProgressChart(unitId: number, tahun: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/monitoring/progress?unitId=${unitId}&tahun=${tahun}`);
  if (!response.ok) throw new Error('Failed to fetch progress chart');
  const result = await response.json();
  return result.data;
}

export async function getMonitoringCharts(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/monitoring/charts`);
  if (!response.ok) throw new Error('Failed to fetch monitoring charts');
  return response.json();
}

export async function getUnitPerformance(unitId: number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/monitoring/units/${unitId}/performance`);
  if (!response.ok) throw new Error('Failed to fetch unit performance');
  return response.json();
}

export async function getMonitoringReport(startDate: string, endDate: string): Promise<any> {
  const response = await fetch(
    `${API_BASE_URL}/monitoring/report?startDate=${startDate}&endDate=${endDate}`
  );
  if (!response.ok) throw new Error('Failed to fetch monitoring report');
  return response.json();
}
