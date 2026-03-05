const API_BASE_URL = 'http://localhost:4000';

export interface IKUData {
  id: number;
  nama: string;
  kode: string;
  jenis: string;
  tipe: string;
  targets: any[];
}

export async function getIKUList(): Promise<IKUData[]> {
  const response = await fetch(`${API_BASE_URL}/iku`);
  if (!response.ok) throw new Error('Failed to fetch IKU list');
  return response.json();
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
