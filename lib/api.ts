const API_BASE_URL = 'http://localhost:4000';
const REPOSITORY_API_URL = 'http://localhost:3002/api';

export interface Indikator {
  id: number;
  nama: string;
  parentId: number | null;
  level?: number;
  jenis: string;
  kode: string;
  isPkBerbasisIku?: boolean;
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
  targetFakultas: number | null;
  targetUniversitas: number | null;
  targetUniversitasId: number | null;
  tenggat: string | null;
  baselineJumlah: number | null;
  isPkBerbasisIku?: boolean;
}

export interface IndikatorGroupedSub {
  id: number;
  kode: string;
  nama: string;
  level: number;
  parentId: number | null;
  targetId: number | null;
  targetFakultas: number | null;
  targetUniversitas: number | null;
  targetPersentase?: number | null;
  baselineJumlah: number | null;
  isPkBerbasisIku?: boolean;
  children: IndikatorGroupedChild[];
}


export interface IndikatorGrouped {
  id: number;
  kode: string;
  nama: string;
  targetUniversitas: number | null;
  tenggat: string | null;
  targetUniversitasTahun: string;
  baselineJumlah: number | null;
  subIndikators: IndikatorGroupedSub[];
}

export async function getIndikatorGrouped(jenis: string, tahun: string, unitId?: number): Promise<IndikatorGrouped[]> {
  let url = `${API_BASE_URL}/indikator/grouped?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}`;
  if (unitId) url += `&unitId=${unitId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch grouped indikator');
  return response.json();
}

export async function getIndikatorGroupedForUser(jenis: string, tahun: string, userId: number, unitId: number): Promise<IndikatorGrouped[]> {
  const url = `${API_BASE_URL}/indikator/grouped-user?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}&userId=${userId}&unitId=${unitId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch grouped indikator for user');
  return response.json();
}

// ambil dari bawah (CRUD)
export async function createIndikator(data: { jenis: string; kode: string; nama: string; level: number; parentId?: number | null; jenisData?: string | null; isPkBerbasisIku?: boolean }): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create indikator');
  return response.json();
}

export async function updateIndikator(id: number, data: Partial<{ jenis: string; kode: string; nama: string; level: number; parentId: number | null; jenisData: string | null; isPkBerbasisIku: boolean }>): Promise<Indikator> {
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

export async function deleteAllIndikator(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/indikator/all`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete all indikator');
}

export async function getBaselineByJenisData(jenisData: string, tahun: string): Promise<{ jumlah: number | null } | null> {
  const url = `${API_BASE_URL}/baseline-data?jenisData=${encodeURIComponent(jenisData)}&tahun=${encodeURIComponent(tahun)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

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
  unitId: number;
  jenisData: string;
  jumlah: number;
  tahun: string;
}

export async function getBaselineDataByJenisDataAndUnit(jenisData: string, unitId: number): Promise<BaselineData[]> {
  const response = await fetch(`${API_BASE_URL}/baseline-data?jenisData=${encodeURIComponent(jenisData)}&unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch baseline data');
  return response.json();
}

export async function getAllBaselineData(): Promise<BaselineData[]> {
  const response = await fetch(`${API_BASE_URL}/baseline-data`);
  if (!response.ok) throw new Error('Failed to fetch all baseline data');
  return response.json();
}

export async function getBaselineDataByUnit(unitId: number): Promise<BaselineData[]> {
  const response = await fetch(`${API_BASE_URL}/baseline-data/unit/${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch baseline data by unit');
  return response.json();
}

export async function createBaselineData(data: { unitId: number; jenisData: string; jumlah: number; tahun: string }): Promise<BaselineData> {
  const response = await fetch(`${API_BASE_URL}/baseline-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create baseline data');
  return response.json();
}

export async function updateBaselineData(id: number, data: Partial<{ unitId: number; jenisData: string; jumlah: number; tahun: string }>): Promise<BaselineData> {
  const response = await fetch(`${API_BASE_URL}/baseline-data/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update baseline data');
  return response.json();
}

export async function deleteBaselineData(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/baseline-data/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete baseline data');
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
  tenggat?: string | null;
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

export async function upsertTargetUniversitas(indikatorId: number, unitId: number, tahun: string, targetUniversitas: number, tenggat?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/upsert-target-universitas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, unitId, tahun, targetUniversitas, tenggat }),
  });
  if (!response.ok) throw new Error('Failed to upsert target universitas');
  return response.json();
}

export async function getPengajuanGrouped(jenis: string, tahun: string, unitId: number): Promise<any[]> {
  const url = `${API_BASE_URL}/indikator/pengajuan-grouped?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}&unitId=${unitId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch pengajuan grouped');
  return response.json();
}

export async function upsertTargetFakultas(indikatorId: number, unitId: number, tahun: string, targetFakultas: number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/upsert-target-fakultas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, unitId, tahun, targetFakultas }),
  });
  if (!response.ok) throw new Error('Failed to upsert target fakultas');
  return response.json();
}


export async function login(email: string, password: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nip: email, password }),
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

export async function getTargetsForAdminFIK(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/targets/admin/fik`);
  if (!response.ok) throw new Error('Failed to fetch targets for admin FIK');
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

export interface PimpinanValidasiRow {
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

export async function getPimpinanValidasi(unitId: number): Promise<PimpinanValidasiRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets/pimpinan-validasi?unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch pimpinan validasi');
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

export interface DisposisiItem {
  id?: number;
  assignedTo: number;
  assignedUser?: { id: number; nama: string };
  jumlah: number;
}

export async function getDisposisi(indikatorId: number, unitId: number, tahun: string, disposedBy?: number | null): Promise<DisposisiItem[]> {
  let url = `${API_BASE_URL}/disposisi?indikatorId=${indikatorId}&unitId=${unitId}&tahun=${encodeURIComponent(tahun)}`;
  if (disposedBy !== undefined) {
    url += `&disposedBy=${disposedBy === null ? 'null' : disposedBy}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch disposisi');
  return response.json();
}

export async function getReceivedDisposisiJumlah(assignedTo: number, indikatorId: number, unitId: number, tahun: string): Promise<number> {
  const url = `${API_BASE_URL}/disposisi/received-jumlah?assignedTo=${assignedTo}&indikatorId=${indikatorId}&unitId=${unitId}&tahun=${encodeURIComponent(tahun)}`;
  const response = await fetch(url);
  if (!response.ok) return 0;
  const data = await response.json();
  return Number(data.jumlah) || 0;
}

export async function upsertDisposisi(indikatorId: number, unitId: number, tahun: string, items: { assignedTo: number; jumlah: number }[], disposedBy?: number | null): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/disposisi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, unitId, tahun, items, disposedBy: disposedBy ?? null }),
  });
  if (!response.ok) throw new Error('Failed to upsert disposisi');
  return response.json();
}

export async function getUsers(): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

export interface UnitUser {
  id: number;
  nama: string;
  email: string;
  role: string;
}

export interface CreateUserPayload {
  nip?: string;
  nama: string;
  email: string;
  password: string;
  role: string;
  jenis: string;
  unitId?: number | null;
  atasanId?: number | null;
}

export async function getUsersByUnit(unitId: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/by-unit?unitId=${unitId}`);
  if (!response.ok) throw new Error('Failed to fetch users by unit');
  return response.json();
}

/** Mengambil bawahan langsung dari seorang user (berdasarkan user_relations di mana parent_id = userId) */
export async function getRelatedUsersFor(userId: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/related?userId=${userId}`);
  if (!response.ok) throw new Error('Failed to fetch related users for user');
  return response.json();
}

/** Cek apakah user memiliki bawahan */
export async function hasRelatedUsers(userId: number): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/users/has-related?userId=${userId}`);
  if (!response.ok) return false;
  const data = await response.json();
  return data.hasRelated === true;
}

/** (legacy) Mengambil user yang berelasi dengan userId - aitu parent dari userId */
export async function getRelatedUsers(userId: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/related?userId=${userId}`);
  if (!response.ok) throw new Error('Failed to fetch related users');
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

export async function updateUserAccount(id: number, data: Partial<CreateUserPayload>): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update user');
  return response.json();
}

export async function deleteUserAccount(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete user');
}

export interface FileRealisasiResult {
  totalRealisasi: number;
  targetFakultas: number | null;
  targetUniversitas: number | null;
  disposisiUsers: { userId: number; nama: string; jumlah: number; realisasi: number }[];
}

export async function submitFileRealisasi(data: {
  indikatorId: number;
  unitId: number;
  tahun: string;
  periode: string;
  fileCount: number;
  userId: number;
}): Promise<FileRealisasiResult> {
  const response = await fetch(`${API_BASE_URL}/realisasi/from-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to submit file realisasi');
  return response.json();
}

/** Fetch real files from Repository system matching a name */
export async function fetchRepositoryFilesByName(name: string, email?: string): Promise<any[]> {
  let url = `${REPOSITORY_API_URL}/integration/files/search?name=${encodeURIComponent(name)}`;
  if (email) {
    url += `&email=${encodeURIComponent(email)}`;
  }
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

/** Fetch accessible folders for a user from Repository system */
export async function fetchRepositoryFolders(email: string): Promise<any[]> {
  const url = `${REPOSITORY_API_URL}/integration/folders?email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

/** Fetch files from a specific folder in Repository system */
export async function fetchRepositoryFilesByFolder(folderId: string, email: string): Promise<any[]> {
  const url = `${REPOSITORY_API_URL}/integration/files?folderId=${encodeURIComponent(folderId)}&email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

