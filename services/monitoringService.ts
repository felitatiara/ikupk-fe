const API_BASE_URL = 'http://localhost:4000';

export interface MonitoringData {
  unitId: number;
  unitName: string;
  period: string;
  indicators: any[];
  charts: any;
}

export interface ProgressChartItem {
  id: number;
  kode: string;
  nama: string;
  targetUniversitas: number;
  targetFakultas: number;
  realisasi: number;
  tenggat: string;
  status: string;
  progress: number;
  chartProgress: number;
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

// Keeping old function just in case other parts use it, but most likely we'll use getAggregatedProgress now.
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
