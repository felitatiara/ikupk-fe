const API_BASE_URL = 'http://localhost:4000';

export interface IKUData {
  id: number;
  nama: string;
  kode: string;
  jenis: string;
  tipe: string;
  targets: any[];
}

function normalizeIKURow(item: any, index: number): IKUData {
  return {
    id: Number(item?.id ?? item?.parentId ?? index + 1),
    nama: String(item?.nama ?? item?.indikatorNama ?? '-'),
    kode: String(item?.kode ?? item?.indikatorKode ?? '-'),
    jenis: String(item?.jenis ?? item?.indikatorJenis ?? '-'),
    tipe: String(item?.tipe ?? item?.indikatorTipe ?? '-'),
    targets: Array.isArray(item?.targets) ? item.targets : [],
  };
}

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getIKUList(): Promise<IKUData[]> {
  const errors: string[] = [];

  try {
    const primary = await fetchJSON(`${API_BASE_URL}/iku`);
    const rows = Array.isArray(primary) ? primary : [];
    return rows.map(normalizeIKURow);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Primary endpoint failed');
  }

  try {
    const fallback = await fetchJSON(`${API_BASE_URL}/targets/admin/pku`);
    const rows = Array.isArray(fallback) ? fallback : [];
    return rows.map(normalizeIKURow);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Fallback endpoint failed');
  }

  throw new Error(`Failed to fetch IKU list (${errors.join(' | ')})`);
}

export async function getIKUById(id: number): Promise<IKUData> {
  const response = await fetch(`${API_BASE_URL}/iku/${id}`);
  if (!response.ok) throw new Error('Failed to fetch IKU');
  return response.json();
}

export async function createIKU(data: any): Promise<IKUData> {
  const response = await fetch(`${API_BASE_URL}/iku`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create IKU');
  return response.json();
}

export async function updateIKU(id: number, data: any): Promise<IKUData> {
  const response = await fetch(`${API_BASE_URL}/iku/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update IKU');
  return response.json();
}

export async function deleteIKU(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/iku/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete IKU');
}

export async function getIKUForAdmin(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/iku/admin/list`);
  if (!response.ok) throw new Error('Failed to fetch IKU for admin');
  return response.json();
}

export async function submitIKUProposal(data: any): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/iku/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to submit IKU proposal');
  return response.json();
}
