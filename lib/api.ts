const API_BASE_URL = 'http://localhost:4000';

export interface Indikator {
  id: number;
  nama: string;
  parentId: number | null;
  level?: number;
  jenis: string;
  kode: string;
}

export interface Kriteria {
  id: number;
  nama: string;
  indikatorId: number;
}

export async function getIndikator(): Promise<Indikator[]> {
  const response = await fetch(`${API_BASE_URL}/indikator`);
  if (!response.ok) throw new Error('Failed to fetch indikator');
  return response.json();
}

// ambil dari atas (grouped)
export interface IndikatorGroupedChild {
  id: number;
  kode: string;
  nama: string;
  level: number;
}

export interface IndikatorGroupedSub {
  id: number;
  kode: string;
  nama: string;
  level: number;
  parentId: number | null;
  children: IndikatorGroupedChild[];
}

export interface IndikatorGrouped {
  id: number;
  kode: string;
  nama: string;
  targetUniversitas: number | null;
  targetUniversitasTahun: string;
  baselineJumlah: number | null;
  subIndikators: IndikatorGroupedSub[];
}

export async function getIndikatorGrouped(jenis: string, tahun: string): Promise<IndikatorGrouped[]> {
  const response = await fetch(`${API_BASE_URL}/indikator/grouped?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}`);
  if (!response.ok) throw new Error('Failed to fetch grouped indikator');
  return response.json();
}

// ambil dari bawah (CRUD)
export async function createIndikator(data: { jenis: string; kode: string; nama: string; level: number; parentId?: number | null }): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create indikator');
  return response.json();
}

export async function updateIndikator(id: number, data: Partial<{ jenis: string; kode: string; nama: string; level: number; parentId: number | null }>): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update indikator');
  return response.json();
}

export async function deleteIndikator(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete indikator');
}
export async function createIndikator(data: { jenis: string; kode: string; nama: string; level: number; parentId?: number | null }): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create indikator');
  return response.json();
}

export async function updateIndikator(id: number, data: Partial<{ jenis: string; kode: string; nama: string; level: number; parentId: number | null }>): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update indikator');
  return response.json();
}

export async function deleteIndikator(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete indikator');
}

>>>>>>> a99b636bd7d1dd561440ae871b8b8652d1d17e2b
export async function getKriteria(): Promise<Kriteria[]> {
  const response = await fetch(`${API_BASE_URL}/kriteria`);
  if (!response.ok) throw new Error('Failed to fetch kriteria');
  return response.json();
}

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
export interface BaselineData {
  id: number;
  indikatorId: number;
  unitId: number;
  tahun: string;
  jenisData: string;
  jumlah: number;
  createdAt: string;
}

export async function getBaselineDataByIndikatorAndUnit(indikatorId: number, unitId: number): Promise<BaselineData[]> {
  const response = await fetch(`${API_BASE_URL}/baseline-data?indikatorId=${indikatorId}&unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch baseline data');
  return response.json();
}

export interface Unit {
  id: number;
  nama: string;
  jenis: string | null;
  parentId: number | null;
}

export async function getUnits(): Promise<Unit[]> {
  const response = await fetch(`${API_BASE_URL}/units`);
  if (!response.ok) throw new Error('Failed to fetch units');
  return response.json();
}

export interface TargetUniversitasData {
  id: number;
  indikatorId: number;
  tahun: string;
  targetAngka: number;
}

export async function getTargetUniversitas(indikatorId: number, tahun: string): Promise<TargetUniversitasData | null> {
  const response = await fetch(`${API_BASE_URL}/target-universitas?indikatorId=${indikatorId}&tahun=${tahun}`);
  if (!response.ok) throw new Error('Failed to fetch target universitas');
  return response.json();
}

export async function saveTargetUniversitas(indikatorId: number, tahun: string, targetAngka: number): Promise<TargetUniversitasData> {
  const response = await fetch(`${API_BASE_URL}/target-universitas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, tahun, targetAngka }),
  });
  if (!response.ok) throw new Error('Failed to save target universitas');
  return response.json();
}

export async function upsertTargetUniversitas(indikatorId: number, unitId: number, tahun: string, targetUniversitas: number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/upsert-target-universitas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, unitId, tahun, targetUniversitas }),
  });
  if (!response.ok) throw new Error('Failed to upsert target universitas');
  return response.json();
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

export async function createTarget(data: { indikatorId: number; unitId: number; tahun: string; targetUniversitas?: number | null }): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create target');
  return response.json();
}

export interface PengajuanRow {
  id: number;
  unitKerja: string;
  waktuPengajuan: string;
  target: string;
  sasaranStrategis: string;
  targetAngka: number;
  targetUniversitas: number | null;
  tahun: string;
}

export async function getPengajuan(): Promise<PengajuanRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets/pengajuan`);
  if (!response.ok) throw new Error('Failed to fetch pengajuan');
  return response.json();
}

export interface IkuPkRow {
  id: number;
  indikatorId: number;
  tahun: string;
  target: string;
  sasaranStrategis: string;
  targetUniversitas: number;
  capaian: number;
  tenggat: string;
  unitId: number | null;
}

export async function getIkuPk(unitId: number, userId?: number): Promise<IkuPkRow[]> {
  let url = `${API_BASE_URL}/targets/iku-pk?unitId=${unitId}`;
  if (userId) url += `&userId=${userId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch iku-pk');
  return response.json();
}

export interface ValidasiRow {
  id: number;
  targetId: number;
  tahun: string;
  target: string;
  sasaranStrategis: string;
  realisasiAngka: number;
  status: string;
  createdAt: string;
}

export async function getRealisasiForValidasi(): Promise<ValidasiRow[]> {
  const response = await fetch(`${API_BASE_URL}/realisasi/validasi`);
  if (!response.ok) throw new Error('Failed to fetch realisasi for validasi');
  return response.json();
}

export async function updateRealisasiStatus(id: number, status: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/realisasi/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to update realisasi status');
  return response.json();
}

export interface DekanValidasiRow {
  id: number;
  indikatorId: number;
  tahun: string;
  target: string;
  sasaranStrategis: string;
  targetUniversitas: number;
  capaian: number;
  status: string;
  createdAt: string;
}

export async function getDekanValidasi(unitId: number): Promise<DekanValidasiRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets/dekan-validasi?unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch dekan validasi');
  return response.json();
}

export interface PendingFakultasRow {
  id: number;
  indikatorId: number;
  tahun: string;
  target: string;
  sasaranStrategis: string;
  targetUniversitas: number;
  targetFakultas: number;
  targetAngka: number;
  status: string;
  createdAt: string;
}

export async function getPendingFakultas(unitId: number): Promise<PendingFakultasRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets/pending-fakultas?unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch pending fakultas');
  return response.json();
}

export interface AdminTargetRow {
  id: number;
  indikatorId: number;
  tahun: string;
  target: string;
  sasaranStrategis: string;
  targetUniversitas: number;
  unitId: number;
  unitNama: string;
  status: string;
  createdAt: string;
}

export async function getAdminTargetsGrouped(): Promise<AdminTargetRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets/admin/targets-grouped`);
  if (!response.ok) throw new Error('Failed to fetch admin targets');
  return response.json();
}

export async function inputTargetFakultas(id: number, targetAngka: number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/${id}/target-fakultas`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetAngka }),
  });
  if (!response.ok) throw new Error('Failed to input target fakultas');
  return response.json();
}

export async function submitTargetFakultas(items: { targetId: number; targetAngka: number }[]): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/submit-fakultas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) throw new Error('Failed to submit target fakultas');
  return response.json();
}

export interface TargetItem {
  targetId: number;
  indikatorId: number;
  indikatorNama: string;
  indikatorKode: string;
  targetAngka: number;
  status: string;
}

export async function getTargetItems(unitId: number, rootIndikatorId: number, tahun: string): Promise<TargetItem[]> {
  const response = await fetch(`${API_BASE_URL}/targets/target-items?unitId=${unitId}&rootIndikatorId=${rootIndikatorId}&tahun=${tahun}`);
  if (!response.ok) throw new Error('Failed to fetch target items');
  return response.json();
}

export async function updateTargetStatus(id: number, status: string, assignedTo?: number): Promise<any> {
  const body: any = { status };
  if (assignedTo !== undefined) body.assignedTo = assignedTo;
  const response = await fetch(`${API_BASE_URL}/targets/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Failed to update target status');
  return response.json();
}

export interface UnitUser {
  id: number;
  nama: string;
  email: string;
  role: string;
}

export interface CreateUserPayload {
  nama: string;
  email: string;
  password: string;
  role: string;
  unitId?: number | null;
}

export async function getUsersByUnit(unitId: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/by-unit?unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch users by unit');
  return response.json();
}

export async function createUserAccount(data: CreateUserPayload): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create user');
  return response.json();
}
