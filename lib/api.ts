const API_BASE_URL = 'http://localhost:4000';

export interface TargetRow {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export interface TargetDetail {
  id: number;
  tenggat: string;
  targetNama: string;
  sasaranStrategis: string;
  capaian: string;
  unitNama: string;
  tahun: string;
  targetAngka: number;
}

export async function login(email: string, password: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Login failed');
  }
  return response.json();
}

export async function getTargets(): Promise<TargetRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets`);
  if (!response.ok) throw new Error('Failed to fetch targets');
  return response.json();
}

export async function getTargetsByUnit(unitId: number): Promise<TargetDetail[]> {
  const response = await fetch(`${API_BASE_URL}/targets/unit/${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch targets by unit');
  return response.json();
}

export async function getTargetsForAdminPKU(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/targets/admin/pku`);
  if (!response.ok) throw new Error('Failed to fetch targets for admin PKU');
  return response.json();
}
