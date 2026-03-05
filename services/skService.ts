const API_BASE_URL = 'http://localhost:4000';

export interface SKData {
  id: number;
  nomor: string;
  tanggal: string;
  perihal: string;
  file: string;
  status: string;
}

export async function getSKList(): Promise<SKData[]> {
  const response = await fetch(`${API_BASE_URL}/sk`);
  if (!response.ok) throw new Error('Failed to fetch SK list');
  return response.json();
}

export async function getSKById(id: number): Promise<SKData> {
  const response = await fetch(`${API_BASE_URL}/sk/${id}`);
  if (!response.ok) throw new Error('Failed to fetch SK');
  return response.json();
}

export async function uploadSK(formData: FormData): Promise<SKData> {
  const response = await fetch(`${API_BASE_URL}/sk/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload SK');
  return response.json();
}

export async function publishSK(id: number): Promise<SKData> {
  const response = await fetch(`${API_BASE_URL}/sk/${id}/publish`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error('Failed to publish SK');
  return response.json();
}

export async function deleteSK(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sk/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete SK');
}
