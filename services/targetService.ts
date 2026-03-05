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

export async function getTargetById(id: number): Promise<TargetDetail> {
  const response = await fetch(`${API_BASE_URL}/targets/${id}`);
  if (!response.ok) throw new Error('Failed to fetch target');
  return response.json();
}

export async function createTarget(data: any): Promise<TargetDetail> {
  const response = await fetch(`${API_BASE_URL}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create target');
  return response.json();
}

export async function updateTarget(id: number, data: any): Promise<TargetDetail> {
  const response = await fetch(`${API_BASE_URL}/targets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update target');
  return response.json();
}

export async function deleteTarget(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/targets/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete target');
}
