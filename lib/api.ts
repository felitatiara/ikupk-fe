export const API_BASE_URL = 'http://localhost:4000';
const REPOSITORY_API_URL = 'http://localhost:3000/api';

export interface Indikator {
  id: number;
  nama: string;
  parentId: number | null;
  level?: number;
  jenis: string;
  kode: string;
  tahun: string;
  jenisData?: string | null;
}

export interface Kriteria {
  id: number;
  nama: string;
  indikatorId: number;
}

export async function getIndikator(tahun?: string): Promise<Indikator[]> {
  const url = tahun
    ? `${API_BASE_URL}/indikator?tahun=${encodeURIComponent(tahun)}`
    : `${API_BASE_URL}/indikator`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch indikator');
  return response.json();
}

// ambil dari atas (grouped)
export interface IndikatorGroupedLevel3 {
  id: number;
  kode: string;
  nama: string;
  level: number;
  tahun: string;
  targetId: number | null;
  nilaiTarget: number | null;
  satuan?: string | null;
  sumberData?: string;
  disposisiJumlah?: number | null;
  realisasiJumlah?: number | null;
  validRealisasiJumlah?: number | null;
}

export interface IndikatorGroupedChild {
  id: number;
  kode: string;
  nama: string;
  level: number;
  tahun: string;
  targetId: number | null;
  nilaiTarget: number | null;
  satuan?: string | null;
  baselineJumlah: number | null;
  sumberData?: string;
  disposisiJumlah?: number | null;
  children: IndikatorGroupedLevel3[];
}

export interface IndikatorGroupedSub {
  id: number;
  kode: string;
  nama: string;
  level: number;
  tahun: string;
  parentId: number | null;
  targetId: number | null;
  nilaiTarget: number | null;
  baselineJumlah: number | null;
  sumberData?: string;
  isPkBerbasisIku?: boolean;
  disposisiJumlah?: number | null;
  realisasiJumlah?: number | null;
  validRealisasiJumlah?: number | null;
  children: IndikatorGroupedChild[];
}

export interface IndikatorGrouped {
  id: number;
  kode: string;
  nama: string;
  tahun: string;
  persentaseTarget: number | null;
  targetAbsolut: number | null;
  satuan?: string | null;
  tenggat: string | null;
  baselineJumlah: number | null;
  subIndikators: IndikatorGroupedSub[];
}

// ── Laporan hierarki dengan realisasi (untuk export Excel) ─────────────────

export interface LaporanChildNode {
  id: number;
  kode: string;
  nama: string;
  level: number;
  nilaiTarget: number | null;
  targetKualitas: number | null;
  realisasiKuantitas: number;
  realisasiKualitas: number | null;
  persenCapaian: number;
  baselineJumlah: number | null;
  tenggat?: string | null;
  satuan?: string | null;
  children: LaporanChildNode[];
}

export interface LaporanGroup {
  id: number;
  kode: string;
  nama: string;
  tahun: string;
  persentaseTarget: number | null;
  targetAbsolut: number | null;
  baselineJumlah: number | null;
  tenggat?: string | null;
  sdPersen: number;
  subIndikators: LaporanChildNode[];
}

export async function getLaporanWithRealisasi(
  jenis: string,
  tahun: string,
  roleId: number,
  periode?: string,
): Promise<LaporanGroup[]> {
  let url = `${API_BASE_URL}/indikator/laporan?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}&roleId=${roleId}`;
  if (periode) url += `&periode=${encodeURIComponent(periode)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getIndikatorGrouped(jenis: string, tahun: string, roleId?: number): Promise<IndikatorGrouped[]> {
  let url = `${API_BASE_URL}/indikator/grouped?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}`;
  if (roleId) url += `&roleId=${roleId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch grouped indikator');
  return response.json();
}

export async function getIndikatorGroupedForUser(jenis: string, tahun: string, userId: number, roleId: number): Promise<IndikatorGrouped[]> {
  const url = `${API_BASE_URL}/indikator/grouped-user?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}&userId=${userId}&roleId=${roleId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch grouped indikator for user');
  return response.json();
}

// ── Monitoring Bawahan ────────────────────────────────────────────────────────

export interface MonitoringBawahanUser {
  id: number;
  nama: string;
  roleName: string;
  roleLevel: number;
  unitNama: string | null;
}

export interface MonitoringBawahanRow {
  groupId: number;
  groupKode: string;
  groupNama: string;
  subId: number;
  subKode: string;
  subNama: string;
  leafId: number;
  leafKode: string;
  leafNama: string;
  nilaiTarget: number | null;
  satuan: string | null;
  disposisiByUser: Record<number, number>;
}

export interface MonitoringBawahanResult {
  bawahanList: MonitoringBawahanUser[];
  rows: MonitoringBawahanRow[];
}

export async function getMonitoringBawahan(
  jenis: string,
  tahun: string,
  userId: number,
  roleLevel: number,
): Promise<MonitoringBawahanResult> {
  const url = `${API_BASE_URL}/indikator/monitoring-bawahan?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}&userId=${userId}&roleLevel=${roleLevel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch monitoring bawahan');
  return res.json();
}

// ambil dari bawah (CRUD)
export async function createIndikator(data: { jenis: string; kode: string; nama: string; tahun: string; level: number; parentId?: number | null; jenisData?: string | null; sumberData?: string }): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create indikator');
  return response.json();
}

export async function updateIndikator(id: number, data: Partial<{ jenis: string; kode: string; nama: string; tahun: string; level: number; parentId: number | null; jenisData: string | null; sumberData: string }>): Promise<Indikator> {
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

export async function deleteAllIndikator(tahun?: string): Promise<void> {
  const url = tahun
    ? `${API_BASE_URL}/indikator/all?tahun=${encodeURIComponent(tahun)}`
    : `${API_BASE_URL}/indikator/all`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete all indikator');
}

export async function getAvailableYears(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/indikator/years`);
  if (!response.ok) throw new Error('Failed to fetch available years');
  return response.json();
}

export async function copyIndikatorYear(fromTahun: string, toTahun: string): Promise<{ copied: number }> {
  const response = await fetch(`${API_BASE_URL}/indikator/copy-year`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromTahun, toTahun }),
  });
  if (!response.ok) throw new Error('Failed to copy indikator year');
  return response.json();
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
  jenisData: string;
  jumlah: number;
  tahun: string;
  keterangan: string | null;
}

export async function getAllBaselineData(tahun?: string): Promise<BaselineData[]> {
  const url = tahun
    ? `${API_BASE_URL}/baseline-data?tahun=${encodeURIComponent(tahun)}`
    : `${API_BASE_URL}/baseline-data`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch all baseline data');
  return response.json();
}

export async function upsertBaselineData(data: { jenisData: string; jumlah: number; tahun: string; keterangan?: string | null }): Promise<BaselineData> {
  const response = await fetch(`${API_BASE_URL}/baseline-data/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to upsert baseline data');
  return response.json();
}

export async function updateBaselineData(id: number, data: Partial<{ jenisData: string; jumlah: number; tahun: string; keterangan: string | null }>): Promise<BaselineData> {
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


export interface TargetUniversitasData {
  id: number;
  indikatorId: number;
  tahun: string;
  targetAngka: number;
  satuan?: string | null;
  tenggat?: string | null;
}

export async function getTargetUniversitas(indikatorId: number, tahun: string): Promise<TargetUniversitasData | null> {
  const response = await fetch(`${API_BASE_URL}/targets/target-universitas?indikatorId=${indikatorId}&tahun=${tahun}`);
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

export async function upsertTargetUniversitas(indikatorId: number, tahun: string, persentase: number, tenggat?: string, satuan?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/upsert-target-universitas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, tahun, persentase, tenggat, satuan }),
  });
  if (!response.ok) throw new Error('Failed to upsert target universitas');
  return response.json();
}

export async function getPengajuanGrouped(jenis: string, tahun: string, roleId: number): Promise<any[]> {
  const url = `${API_BASE_URL}/indikator/pengajuan-grouped?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}&roleId=${roleId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch pengajuan grouped');
  return response.json();
}

export async function upsertTargetFakultas(indikatorId: number, roleId: number, tahun: string, nilaiTarget: number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/targets/upsert-target-fakultas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, roleId, tahun, nilaiTarget }),
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

export async function getPimpinanValidasi(roleId: number): Promise<PimpinanValidasiRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets/pimpinan-validasi?roleId=${roleId}`);
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
  toUserId: number;
  jumlahTarget: number;
  fromUserId?: number | null;
  toUser?: { id: number; nama: string; role: string };
}

export async function getDisposisi(indikatorId: number, tahun: string, fromUserId?: number | null): Promise<DisposisiItem[]> {
  let url = `${API_BASE_URL}/disposisi?indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`;
  if (fromUserId !== undefined) {
    url += `&fromUserId=${fromUserId === null ? 'null' : fromUserId}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch disposisi');
  return response.json();
}

export async function getReceivedDisposisiJumlah(toUserId: number, indikatorId: number, tahun: string): Promise<number> {
  const url = `${API_BASE_URL}/disposisi/received-jumlah?toUserId=${toUserId}&indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`;
  const response = await fetch(url);
  if (!response.ok) return 0;
  const data = await response.json();
  return Number(data.jumlah) || 0;
}

export async function upsertDisposisi(indikatorId: number, tahun: string, items: { toUserId: number; jumlahTarget: number }[], fromUserId?: number | null): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/disposisi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, tahun, items, fromUserId: fromUserId ?? null }),
  });
  if (!response.ok) throw new Error('Failed to upsert disposisi');
  return response.json();
}

export interface RoleOption {
  id: number;
  name: string;
  unitNama: string;
  level: number;
}

export async function getAllRoles(): Promise<RoleOption[]> {
  const response = await fetch(`${API_BASE_URL}/users/roles`);
  if (!response.ok) throw new Error('Failed to fetch roles');
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

export async function getUsersByRole(roleId: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/by-role?roleId=${roleId}`);
  if (!response.ok) throw new Error('Failed to fetch users by role');
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

/** Mengambil semua user yang primary role-nya memiliki level tertentu */
export async function getUsersByLevel(level: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/by-level?level=${level}`);
  if (!response.ok) throw new Error('Failed to fetch users by level');
  return response.json();
}

/** Mengambil semua Dosen (termasuk struktural yang juga Dosen) dalam satu unitNama */
export async function getDosenByUnit(unitNama: string): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/dosen-by-unit?unitNama=${encodeURIComponent(unitNama)}`);
  if (!response.ok) throw new Error('Failed to fetch dosen by unit');
  return response.json();
}

export async function getIndikatorCascadeChain(id: number): Promise<number[]> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}/cascade-chain`);
  if (!response.ok) return [];
  return response.json();
}

export async function saveIndikatorCascadeChain(id: number, chain: number[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}/cascade-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chain }),
  });
  if (!response.ok) throw new Error('Failed to save cascade chain');
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
  userRealisasi: { id: number; realisasiAngka: number; status: string };
  totalRealisasi: number;
  nilaiTarget: number | null;
  disposisiUsers: { userId: number; nama: string; jumlahTarget: number; realisasi: number }[];
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

// ─────────────────────────────────────────────
//  Target Validation (Admin)
// ─────────────────────────────────────────────

export interface TargetWithRepositoryFile {
  id: number;
  no?: number;
  unitKerja: string;
  namaIndikator: string;
  kodeIndikator: string;
  targetKuantitas: number | null;
  satuan: string;
  linkFile: string; // URL dari Repository API
  namaFile: string;
  periode: string;
  statusValidasi: "pending" | "approved" | "rejected";
  catatanAdmin?: string;
}

/**
 * TODO: Implementasi di Backend
 * GET /targets/for-validation
 * Mengambil semua target beserta link file dari Repository
 * Filter: unitId?, tahun?, statusValidasi?
 */
export async function getTargetsForValidation(unitId?: number, tahun?: string, statusValidasi?: string): Promise<TargetWithRepositoryFile[]> {
  const params = new URLSearchParams();
  if (unitId) params.append('unitId', String(unitId));
  if (tahun) params.append('tahun', tahun);
  if (statusValidasi) params.append('statusValidasi', statusValidasi);

  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/targets/for-validation?${queryString}` : `${API_BASE_URL}/targets/for-validation`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch targets for validation');
  return response.json();
}

/**
 * TODO: Implementasi di Backend
 * PATCH /targets/:id/validation-status
 * Update status validasi target beserta catatan admin
 */
export async function updateTargetValidationStatus(
  targetId: number,
  status: "approved" | "rejected",
  catatanAdmin?: string
): Promise<TargetWithRepositoryFile> {
  const response = await fetch(`${API_BASE_URL}/targets/${targetId}/validation-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, catatanAdmin }),
  });
  if (!response.ok) throw new Error('Failed to update target validation status');
  return response.json();
}

// ─────────────────────────────────────────────
//  Master SKP (Admin)
// ─────────────────────────────────────────────

export interface MasterSKPRow {
  id: number;
  userId: number;
  nip: string;
  namaPegawai: string;
  jabatan: string;
  unitKerja: string;
  unitId?: number;
  periode: string;
  jumlahIndikator: number;
  tervalidasi: number;
  statusSKP: "draft" | "submitted" | "approved" | "rejected";
  rataCapaian: number | null;
}

export async function getMasterSKP(tahun?: string, unitId?: number): Promise<MasterSKPRow[]> {
  const params = new URLSearchParams();
  if (tahun) params.append('tahun', tahun);
  if (unitId) params.append('unitId', String(unitId));
  const qs = params.toString();
  const url = qs ? `${API_BASE_URL}/targets/master-skp?${qs}` : `${API_BASE_URL}/targets/master-skp`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch master SKP');
  return response.json();
}

export async function updateUserSKPStatus(
  userId: number,
  status: 'approved' | 'rejected',
  tahun?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/targets/master-skp/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, tahun }),
  });
  if (!response.ok) throw new Error('Failed to update SKP status');
}

// ── Repository Integration ─────────────────────────────────────────────────

export interface RepoFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface RepoFile {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  created_at: string;
  folder_id: string;
  owner?: { name: string; email: string } | null;
}

export async function getRepoFolders(email: string): Promise<RepoFolder[]> {
  try {
    const res = await fetch(`${REPOSITORY_API_URL}/integration/folders?email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function getRepoFiles(folderId: string, email: string): Promise<RepoFile[]> {
  try {
    const res = await fetch(`${REPOSITORY_API_URL}/integration/files?folderId=${encodeURIComponent(folderId)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function searchRepoFilesByFolderName(folderName: string, email: string): Promise<RepoFile[]> {
  try {
    const res = await fetch(`${REPOSITORY_API_URL}/integration/files/search?name=${encodeURIComponent(folderName)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

/**
 * Mengambil semua file dari sub-folder (level-2) di bawah parentFolderId.
 * Digunakan ketika user klik Input File pada sub-indikator level-1.
 */
export async function getRepoFilesFromChildren(parentFolderId: string, email: string): Promise<RepoFile[]> {
  try {
    const res = await fetch(`${REPOSITORY_API_URL}/integration/files/in-children?parentFolderId=${encodeURIComponent(parentFolderId)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ── IKUPK-BE Integration (Auth-Token Based) ────────────────────────────────

export interface RealisasiFileItem {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  created_at: string;
  folder_id: string;
  owner?: { name: string; email: string } | null;
  ownerName?: string;
  ownerEmail?: string;
  preview_url: string;
  download_url: string;
}

export interface RealisasiFilesResult {
  indikatorKode: string;
  indikatorNama: string;
  folderLink: string | null;
  files: RealisasiFileItem[];
}

/**
 * Ambil file dari IKUPK-BE yang sudah terautentikasi.
 * IKUPK-BE akan otomatis ekstrak email dari JWT token dan query ke repository-nest.
 * File yang dikembalikan hanya milik user yang sedang login, di folder bernama = kode indikator.
 */
export async function getRealisasiFiles(
  indikatorId: number,
  token: string,
): Promise<RealisasiFilesResult> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/integration/realisasi-files?indikatorId=${indikatorId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) return { indikatorKode: '', indikatorNama: '', files: [] };
    return res.json();
  } catch {
    return { indikatorKode: '', indikatorNama: '', files: [] };
  }
}

/**
 * Ambil SEMUA file untuk indikator dari semua dosen (untuk atasan: kaprodi, kajur, dekan).
 * File yang dikembalikan menyertakan ownerName dan ownerEmail untuk identifikasi per dosen.
 */
export async function getAllRealisasiFiles(
  indikatorId: number,
  token: string,
): Promise<RealisasiFilesResult> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/integration/all-realisasi-files?indikatorId=${indikatorId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { indikatorKode: '', indikatorNama: '', files: [] };
    return res.json();
  } catch {
    return { indikatorKode: '', indikatorNama: '', files: [] };
  }
}

/**
 * Submit realisasi (jumlah file) ke IKUPK-BE dengan JWT token.
 * userId dan roleId diekstrak otomatis dari token di backend.
 */
export async function submitFileRealisasiWithAuth(
  data: {
    indikatorId: number;
    tahun: string;
    periode: string;
    fileCount: number;
  },
  token: string,
): Promise<FileRealisasiResult> {
  const res = await fetch(`${API_BASE_URL}/realisasi/from-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to submit file realisasi');
  return res.json();
}

// ── Validasi Atasan ──────────────────────────────────────────────────────────

export interface RealisasiSubmission {
  id: number;
  dosenId: number;
  dosenNama: string;
  dosenEmail: string;
  fileCount: number;
  validFileCount: number | null;
  targetDosen: number | null;
  status: string;
  tahun: string | null;
  periode: string | null;
}

/** Semua submission realisasi dosen untuk indikator tertentu (dipakai atasan untuk validasi) */
export async function getRealisasiSubmissions(
  indikatorId: number,
  tahun: string,
): Promise<RealisasiSubmission[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/submissions?indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Atasan menetapkan jumlah file valid pada submission dosen */
export async function validateRealisasiAtasan(
  id: number,
  validFileCount: number,
  token?: string,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/realisasi/${id}/validate-atasan`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ validFileCount }),
  });
  if (!res.ok) throw new Error('Failed to validate submission');
}

export interface SubmissionPerIndikator {
  indikator: { id: number; kode: string; nama: string; jenis: string; level: number };
  submissions: RealisasiSubmission[];
}

/** Semua submission realisasi dari bawahan langsung seorang atasan, dikelompokkan per indikator */
export async function getSubmissionsForAtasan(
  userId: number,
  tahun: string,
): Promise<SubmissionPerIndikator[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/submissions-for-atasan?userId=${userId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── SKP Bawahan (Atasan) ──────────────────────────────────────────────────────

export interface SkpBawahanRealisasiRow {
  id: number;
  indikatorId: number;
  kodeIndikator: string;
  namaIndikator: string;
  realisasiAngka: number;
  validFileCount: number | null;
  status: string;
  tahun: string;
  periode: string;
}

export interface SkpBawahanRow {
  userId: number;
  nama: string;
  email: string;
  totalIndikator: number;
  validatedCount: number;
  avgCapaian: number | null;
  skpStatus: 'approved' | 'rejected' | 'pending';
  realisasi: SkpBawahanRealisasiRow[];
}

/** SKP summary per-bawahan untuk atasan; forDekan=true → semua user di sistem */
export async function getSkpBawahan(atasanId: number, tahun: string, forDekan = false): Promise<SkpBawahanRow[]> {
  try {
    const url = `${API_BASE_URL}/realisasi/skp-bawahan?atasanId=${atasanId}&tahun=${encodeURIComponent(tahun)}${forDekan ? '&forDekan=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface MySkpStatus {
  status: 'approved' | 'rejected' | 'pending';
  realisasi: SkpBawahanRealisasiRow[];
  atasan: { nama: string; nip: string | null } | null;
}

/** Status SKP milik sendiri: status aggregate + daftar realisasi + info atasan */
export async function getMySkpStatus(userId: number, tahun: string): Promise<MySkpStatus> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/my-skp?userId=${userId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return { status: 'pending', realisasi: [], atasan: null };
    return res.json();
  } catch {
    return { status: 'pending', realisasi: [], atasan: null };
  }
}

// ── Direct Input Realisasi (sumberData = 'ikupk') ─────────────────────────────

export interface DirectRealisasiItem {
  id: number;
  realisasiAngka: number;
  periode: string | null;
  keterangan: string | null;
  status: string;
  createdAt: string;
}

/** Ambil riwayat realisasi direct-input milik user login untuk indikator + tahun */
export async function getMyRealisasiDirect(
  indikatorId: number,
  tahun: string,
  token: string,
): Promise<DirectRealisasiItem[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/direct-input?indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Submit atau upsert realisasi direct-input */
export async function submitRealisasiDirect(
  data: { indikatorId: number; tahun: string; periode: string; realisasiAngka: number; keterangan?: string },
  token: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/realisasi/direct-input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Gagal menyimpan realisasi');
}

// ── IKUPK File Upload (sumberData = 'ikupk') ──────────────────────────────────

export interface IkupkFile {
  id: number;
  fileName: string;
  fileUrl: string;
  periode: string | null;
  createdAt: string;
}

export async function uploadIkupkFile(
  data: { indikatorId: number; tahun: string; periode: string; file: File },
  token: string,
): Promise<IkupkFile> {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('indikatorId', String(data.indikatorId));
  formData.append('tahun', data.tahun);
  formData.append('periode', data.periode);
  const res = await fetch(`${API_BASE_URL}/realisasi/ikupk-upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload gagal');
  return res.json();
}

export async function getIkupkFiles(
  indikatorId: number,
  tahun: string,
  token: string,
): Promise<IkupkFile[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/ikupk-files?indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function deleteIkupkFile(id: number, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/realisasi/ikupk-files/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Gagal menghapus file');
}

/** Approve atau reject semua realisasi bawahan untuk tahun tertentu */
export async function approveBawahanSkp(
  userId: number,
  action: 'approved' | 'rejected',
  tahun: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/realisasi/skp-bawahan/${userId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, tahun }),
  });
  if (!res.ok) throw new Error('Failed to approve/reject SKP bawahan');
}
