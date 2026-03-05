const API_BASE_URL = 'http://localhost:4000';

export interface MonitoringData {
  unitId: number;
  unitName: string;
  period: string;
  indicators: any[];
  charts: any;
}

export async function getMonitoringData(unitId?: number): Promise<MonitoringData> {
  const params = unitId ? `?unitId=${unitId}` : '';
  const response = await fetch(`${API_BASE_URL}/monitoring${params}`);
  if (!response.ok) throw new Error('Failed to fetch monitoring data');
  return response.json();
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
