export const API_BASE_URL = 'http://localhost:4000';

export interface Indikator {
  id: number;
  nama: string;
  parentId: number | null;
  level?: number;
  jenis: string;
  kode: string;
  tahun: string;
  jenisData?: string | null;
  linkedIkuId?: number | null;
  kategori?: string | null;
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

export async function getIndikatorById(id: number): Promise<Indikator | null> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}`);
  if (!response.ok) return null;
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
  linkedIkuId?: number | null;
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
  realisasiJumlah?: number | null;
  validRealisasiJumlah?: number | null;
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
  fromUserNama?: string | null;
  kategori?: string | null;
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
  email: string;
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
  realisasiByUser: Record<number, number>;
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

export async function getIkuOptions(tahun: string): Promise<Indikator[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/indikator/iku-options?tahun=${encodeURIComponent(tahun)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ambil dari bawah (CRUD)
export async function createIndikator(data: { jenis: string; kode: string; nama: string; tahun: string; level: number; parentId?: number | null; jenisData?: string | null; sumberData?: string; linkedIkuId?: number | null; kategori?: string | null }): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create indikator');
  return response.json();
}

export async function updateIndikator(id: number, data: Partial<{ jenis: string; kode: string; nama: string; tahun: string; level: number; parentId: number | null; jenisData: string | null; sumberData: string; linkedIkuId: number | null }>): Promise<Indikator> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update indikator');
  const text = await response.text();
  if (!text || text.trim() === '' || text.trim() === 'null') return { id } as Indikator;
  return JSON.parse(text);
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

export interface IndikatorImportRow {
  kode: string;
  nama: string;
  level: number;
  parentKode: string | null;
  kategori: string | null;
  tenggat: string | null;
  target: number | null;
  satuan: string | null;
  sumberData: string;
  linkedIkuKode?: string | null;
}

export async function importIndikatorBulk(
  jenis: string,
  tahun: string,
  rows: IndikatorImportRow[],
  token: string,
  clearFirst = false,
): Promise<{ imported: number; errors: string[] }> {
  const res = await fetch(`${API_BASE_URL}/indikator/import-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jenis, tahun, rows, clearFirst }),
  });
  if (!res.ok) throw new Error('Import gagal');
  return res.json();
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
  const text = await response.text();
  if (!text || text.trim() === '' || text.trim() === 'null') return null;
  return JSON.parse(text);
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


export async function switchRole(roleId: number, token: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_BASE_URL}/auth/switch-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ roleId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Gagal mengganti role');
  }
  return res.json();
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
  toUser?: {
    id: number;
    nama: string;
    role?: string;
    email?: string;
    userRoles?: Array<{ role: { name: string; unitNama: string } }>;
  };
  fromUser?: {
    id: number;
    nama: string;
    userRoles?: Array<{ role: { name: string; unitNama: string } }>;
  };
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

export async function upsertDisposisi(indikatorId: number, tahun: string, items: { toUserId: number; jumlahTarget: number }[], fromUserId?: number | null, skipValidation = false): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/disposisi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indikatorId, tahun, items, fromUserId: fromUserId ?? null, skipValidation }),
  });
  if (!response.ok) {
    let detail = '';
    try { const err = await response.json(); detail = err.message ?? JSON.stringify(err); } catch {}
    throw new Error(`Failed to upsert disposisi (${response.status}): ${detail}`);
  }
  return response.json();
}

export interface DisposisiBawahanResult {
  myReceived: number;
  bawahan: { userId: number; nama: string; jabatan: string; receivedJumlah: number }[];
}

export async function getDisposisiBawahan(userId: number, indikatorId: number, tahun: string): Promise<DisposisiBawahanResult> {
  const res = await fetch(`${API_BASE_URL}/disposisi/bawahan?userId=${userId}&indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`);
  if (!res.ok) throw new Error('Failed to fetch bawahan disposisi');
  return res.json();
}

export interface DekanDashboardSummary {
  totalIndikator: number;
  belumDisposisi: number;
  proses: number;
  selesai: number;
  persentaseCapaian: number;
}

export interface DekanDashboardItem {
  id: number;
  kode: string;
  nama: string;
  kategori: string | null;
  targetUniversitas: number;
  satuan: string | null;
  realisasi: number;
  progress: number;
  status: 'belum_disposisi' | 'proses' | 'selesai';
  penerima: { userId: number; nama: string; jumlahTarget: number }[];
  realisasiStatus: { pending: number; approved: number; rejected: number };
}

export interface DekanDashboardResult {
  tahun: string;
  jenis: string;
  summary: DekanDashboardSummary;
  items: DekanDashboardItem[];
}

export async function getDekanDashboard(tahun: string, jenis: string): Promise<DekanDashboardResult> {
  const res = await fetch(`${API_BASE_URL}/monitoring/dekan-dashboard?tahun=${encodeURIComponent(tahun)}&jenis=${jenis}`);
  if (!res.ok) throw new Error('Failed to fetch dekan dashboard');
  return res.json();
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

export async function createRole(data: { name: string; unitNama: string; level: number }): Promise<RoleOption> {
  const res = await fetch(`${API_BASE_URL}/users/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create role');
  return res.json();
}

export async function updateRole(id: number, data: { name?: string; unitNama?: string; level?: number }): Promise<RoleOption> {
  const res = await fetch(`${API_BASE_URL}/users/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update role');
  return res.json();
}

export async function deleteRole(id: number): Promise<{ deleted: boolean; reason?: string }> {
  const res = await fetch(`${API_BASE_URL}/users/roles/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete role');
  return res.json();
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
  jenis?: string;
  unitId?: number | null;
  atasanId?: number | null;
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

/** Mengambil semua bawahan secara rekursif (termasuk bawahan dari bawahan) */
export async function getAllBawahanFor(userId: number): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/all-bawahan?userId=${userId}`);
  if (!response.ok) return [];
  return response.json();
}

/** Mengambil semua dosen (semua prodi) */
export async function getAllDosen(): Promise<UnitUser[]> {
  const response = await fetch(`${API_BASE_URL}/users/all-dosen`);
  if (!response.ok) return [];
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

export async function getIndikatorCascadeChain(id: number): Promise<(number | number[])[]> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}/cascade-chain`);
  if (!response.ok) return [];
  return response.json();
}

export async function saveIndikatorCascadeChain(id: number, chain: (number | number[])[], tahun?: string, skipMaterialize?: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/indikator/${id}/cascade-chain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chain, tahun, ...(skipMaterialize ? { skipMaterialize } : {}) }),
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

export async function getUserRoles(userId: number): Promise<Array<{ id: number; name: string; unitNama: string; level: number; isPrimary: boolean }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.userRoles ?? []).map((ur: any) => ({
      id: ur.roleId ?? ur.role?.id,
      name: ur.role?.name ?? '',
      unitNama: ur.role?.unitNama ?? '',
      level: ur.role?.level ?? 99,
      isPrimary: ur.isPrimary ?? false,
    }));
  } catch {
    return [];
  }
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
  let url = `${API_BASE_URL}/integration/files/search?name=${encodeURIComponent(name)}`;
  if (email) url += `&email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

/** Fetch accessible folders for a user from Repository system */
export async function fetchRepositoryFolders(email: string): Promise<any[]> {
  const url = `${API_BASE_URL}/integration/folders?email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

/** Fetch files from a specific folder in Repository system */
export async function fetchRepositoryFilesByFolder(folderId: string, email: string): Promise<any[]> {
  const url = `${API_BASE_URL}/integration/files?folderId=${encodeURIComponent(folderId)}&email=${encodeURIComponent(email)}`;
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
    const res = await fetch(`${API_BASE_URL}/integration/folders?email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function getRepoFiles(folderId: string, email: string): Promise<RepoFile[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/integration/files?folderId=${encodeURIComponent(folderId)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function searchRepoFilesByFolderName(folderName: string, email: string): Promise<RepoFile[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/integration/files/search?name=${encodeURIComponent(folderName)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

/**
 * Mengambil semua file dari sub-folder (level-2) di bawah parentFolderId.
 */
export async function getRepoFilesFromChildren(parentFolderId: string, email: string): Promise<RepoFile[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/integration/files/in-children?parentFolderId=${encodeURIComponent(parentFolderId)}&email=${encodeURIComponent(email)}`);
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
    if (!res.ok) return { indikatorKode: '', indikatorNama: '', folderLink: null, files: [] };
    return res.json();
  } catch {
    return { indikatorKode: '', indikatorNama: '', folderLink: null, files: [] };
  }
}

/**
 * Ambil file milik sendiri berdasarkan nama/kode indikator langsung (tanpa indikatorId).
 * Email otomatis dari JWT — tidak perlu di-pass secara eksplisit.
 */
export async function getMyFilesByIndikator(
  params: { jenis: string; nama: string; kode?: string },
  token: string,
): Promise<RepoFile[]> {
  try {
    const q = new URLSearchParams({ jenis: params.jenis, nama: params.nama });
    if (params.kode) q.set('kode', params.kode);
    const res = await fetch(`${API_BASE_URL}/integration/my-files?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
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
    if (!res.ok) return { indikatorKode: '', indikatorNama: '', folderLink: null, files: [] };
    return res.json();
  } catch {
    return { indikatorKode: '', indikatorNama: '', folderLink: null, files: [] };
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
  catatanRevisi: string | null;
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

/** Atasan meminta user merevisi submission — set status needs_revision */
export async function requestRevision(
  id: number,
  catatan?: string,
  token?: string,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}/realisasi/${id}/request-revision`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ catatan }),
  });
  if (!res.ok) throw new Error('Gagal meminta revisi');
}

export interface NeedsRevisionItem {
  id: number;
  indikatorId: number;
  indikatorKode: string;
  indikatorNama: string;
  periode: string | null;
  realisasiAngka: number;
  validFileCount: number | null;
  keterangan: string | null;
  catatanRevisi: string | null;
  createdAt: string;
}

/** Daftar realisasi milik user yang sedang menunggu revisi */
export async function getMyNeedsRevision(
  userId: number,
  tahun: string,
): Promise<NeedsRevisionItem[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/my-needs-revision?userId=${userId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface SubmissionPerIndikator {
  indikator: { id: number; kode: string; nama: string; jenis: string; level: number; sumberData?: string };
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
  atasan: { nama: string; nip: string | null; jabatan?: string | null } | null;
  atasanPenilai: { nama: string; nip: string | null; jabatan?: string | null } | null;
}

/** Status SKP milik sendiri: status aggregate + daftar realisasi + info atasan */
export async function getMySkpStatus(userId: number, tahun: string): Promise<MySkpStatus> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/my-skp?userId=${userId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return { status: 'pending', realisasi: [], atasan: null, atasanPenilai: null };
    return res.json();
  } catch {
    return { status: 'pending', realisasi: [], atasan: null, atasanPenilai: null };
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

export async function getIkupkFilesByUser(
  userId: number,
  indikatorId: number,
  tahun: string,
): Promise<IkupkFile[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/ikupk-files-by-user?userId=${userId}&indikatorId=${indikatorId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Approve atau reject semua realisasi validated_wd2 bawahan (Dekan) */
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

/**
 * Pimpinan: daftar realisasi bawahan yang sudah divalidasi atasan langsung,
 * dikelompokkan per bawahan → per indikator (mengikuti rantai disposisi).
 */
export async function getSubmissionsForPimpinan(pimpinanId: number, tahun: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/submissions-for-pimpinan?pimpinanId=${pimpinanId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Pimpinan memvalidasi capaian bawahan untuk satu indikator → validated_wd2 */
export async function validatePimpinan(
  pimpinanId: number,
  bawahanId: number,
  indikatorId: number,
  tahun: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/realisasi/validate-pimpinan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pimpinanId, bawahanId, indikatorId, tahun }),
  });
  if (!res.ok) throw new Error('Failed to validate');
}

/** @deprecated Gunakan getSubmissionsForPimpinan */
export async function getSubmissionsForWD2(tahun: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/realisasi/submissions-for-wd2?tahun=${encodeURIComponent(tahun)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** @deprecated Gunakan validatePimpinan */
export async function validateWD2Batch(userId: number, tahun: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/realisasi/skp-wd2/${userId}/validate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tahun }),
  });
  if (!res.ok) throw new Error('Failed to validate WD2');
}

export interface ValidasiBiroPKUItem {
  id: number;
  indikatorId: number;
  tahun: string;
  jumlahValid: number | null;
  keterangan: string | null;
  inputBy: number | null;
}

export async function getValidasiBiroPKU(tahun: string): Promise<ValidasiBiroPKUItem[]> {
  const res = await fetch(`${API_BASE_URL}/monitoring/validasi-biro-pku?tahun=${encodeURIComponent(tahun)}`);
  if (!res.ok) throw new Error('Failed to fetch validasi biro pku');
  return res.json();
}

export async function upsertValidasiBiroPKU(data: {
  indikatorId: number;
  tahun: string;
  jumlahValid: number | null;
  keterangan?: string;
  inputBy?: number;
}): Promise<ValidasiBiroPKUItem> {
  const res = await fetch(`${API_BASE_URL}/monitoring/validasi-biro-pku`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to upsert validasi biro pku');
  return res.json();
}

export async function getRealisasiCounts(jenis: string, tahun: string): Promise<Record<number, number>> {
  const res = await fetch(`${API_BASE_URL}/monitoring/realisasi-counts?jenis=${encodeURIComponent(jenis)}&tahun=${encodeURIComponent(tahun)}`);
  if (!res.ok) return {};
  return res.json();
}

export async function bulkUpsertValidasiBiroPKU(items: {
  indikatorId: number;
  tahun: string;
  jumlahValid: number | null;
  keterangan?: string;
  inputBy?: number;
}[]): Promise<{ saved: number; skipped: number }> {
  const res = await fetch(`${API_BASE_URL}/monitoring/validasi-biro-pku/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('Failed to bulk upsert validasi biro pku');
  return res.json();
}

export async function getMonitoringScope(
  userId: number,
  tahun: string,
  jenis: string,
): Promise<number[]> {
  const params = new URLSearchParams({ userId: String(userId), tahun, jenis });
  const res = await fetch(`${API_BASE_URL}/monitoring/scope?${params}`);
  if (!res.ok) return [];
  return res.json();
}

// ── SKP Penilai Config ────────────────────────────────────────────────────────

export interface SkpPenilaiConfigRow {
  id: number;
  roleId: number;
  roleName: string;
  roleLevel: number;
  unitNama: string;
  // Checker (Rencana SKP — step 1)
  checkerUserId: number | null;
  checkerNama: string | null;
  // Pihak Kedua (Rencana SKP — step 2)
  pihakKeduaUserId: number | null;
  pihakKeduaNama: string | null;
  // EKP
  penilaiUserId: number | null;
  penilaiNama: string | null;
  penilaiNip: string | null;
}

export interface SkpPenilaiRole {
  id: number;
  name: string;
  unitNama: string;
  level: number;
}

export interface SkpPenilaiUser {
  id: number;
  nama: string;
  nip: string | null;
  jabatan: string;
}

export async function getSkpPenilaiConfigs(): Promise<SkpPenilaiConfigRow[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/skp-penilai`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getSkpPenilaiRoles(): Promise<SkpPenilaiRole[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/skp-penilai/roles`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getSkpPenilaiUsers(): Promise<SkpPenilaiUser[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/skp-penilai/users`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function upsertSkpPenilai(
  roleId: number,
  body: { checkerUserId?: number | null; pihakKeduaUserId?: number | null; penilaiUserId?: number | null },
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/skp-penilai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId, ...body }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan konfigurasi penilai');
}

export async function deleteSkpPenilai(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/skp-penilai/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Gagal menghapus konfigurasi penilai');
}

export interface SkpCheckerUser {
  userId: number;
  nama: string;
  nip: string | null;
  email: string;
  jabatan: string;
  roleId: number;
  skpStatus: string;
  rencanaStatus?: string;
  hasChecker?: boolean;
}

// ── Rencana SKP Signature Status ─────────────────────────────────────────────

export interface SkpRencanaStatusData {
  userId: number;
  tahun: string;
  status: 'draft' | 'signed_pegawai' | 'checked' | 'signed_pihak_kedua' | 'needs_revision';
  signaturePegawai: string | null;
  signatureChecker: string | null;
  signaturePihakKedua: string | null;
  signedAtPegawai: string | null;
  checkedAt: string | null;
  signedAtPihakKedua: string | null;
}

export async function getSkpRencanaStatus(userId: number, tahun: string): Promise<SkpRencanaStatusData> {
  try {
    const res = await fetch(`${API_BASE_URL}/skp-rencana/status?userId=${userId}&tahun=${encodeURIComponent(tahun)}`);
    if (!res.ok) return { userId, tahun, status: 'draft', signaturePegawai: null, signatureChecker: null, signaturePihakKedua: null, signedAtPegawai: null, checkedAt: null, signedAtPihakKedua: null };
    return res.json();
  } catch {
    return { userId, tahun, status: 'draft', signaturePegawai: null, signatureChecker: null, signaturePihakKedua: null, signedAtPegawai: null, checkedAt: null, signedAtPihakKedua: null };
  }
}

export async function signRencanaSKPPegawai(userId: number, tahun: string, signature: string | null): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/sign-pegawai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tahun, signature }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan tanda tangan');
  return res.json();
}

export async function setujuRencanaSKPPegawai(userId: number, tahun: string): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/setuju-pegawai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tahun }),
  });
  if (!res.ok) throw new Error('Gagal menyetujui Rencana SKP');
  return res.json();
}

export async function validasiRencanaSKPAtasan(targetUserId: number, tahun: string): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/validasi-atasan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, tahun }),
  });
  if (!res.ok) throw new Error('Gagal memvalidasi Rencana SKP');
  return res.json();
}

export async function signRencanaSKPPihakKedua(targetUserId: number, tahun: string, signature: string | null): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/sign-pihak-kedua`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, tahun, signature }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan tanda tangan Pihak Kedua');
  return res.json();
}

export interface SkpCheckerBawahan {
  checkerBawahan: SkpCheckerUser[];
  rencanaSKPBawahan: SkpCheckerUser[];
  ekpBawahan: (SkpCheckerUser & { skpStatus: string; hasilStatus: string })[];
  hasilCheckerBawahan: (SkpCheckerUser & { hasilStatus: string })[];
  hasilPenilaiDapatTTD: (SkpCheckerUser & { hasilStatus: string })[];
}

export async function getSkpCheckerBawahan(userId: number, tahun: string): Promise<SkpCheckerBawahan> {
  const empty: SkpCheckerBawahan = { checkerBawahan: [], rencanaSKPBawahan: [], ekpBawahan: [], hasilCheckerBawahan: [], hasilPenilaiDapatTTD: [] };
  try {
    const res = await fetch(`${API_BASE_URL}/skp-penilai/checker/${userId}?tahun=${encodeURIComponent(tahun)}`);
    if (!res.ok) return empty;
    const data = await res.json();
    return { ...empty, ...data };
  } catch {
    return empty;
  }
}

export async function checkRencanaSKPChecker(targetUserId: number, tahun: string, signature: string | null): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/check-checker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, tahun, signature }),
  });
  if (!res.ok) throw new Error('Gagal memvalidasi Rencana SKP');
  return res.json();
}

// ── Hasil SKP ─────────────────────────────────────────────────────────────────

export interface SkpHasilStatusData {
  userId: number;
  tahun: string;
  status: 'pending' | 'signed_pegawai' | 'checked' | 'signed_penilai' | 'needs_revision';
  signaturePegawai: string | null;
  signatureChecker: string | null;
  signaturePenilai: string | null;
  signedAtPegawai: string | null;
  checkedAt: string | null;
  signedAtPenilai: string | null;
}

const EMPTY_HASIL = (userId: number, tahun: string): SkpHasilStatusData => ({
  userId, tahun, status: 'pending',
  signaturePegawai: null, signatureChecker: null, signaturePenilai: null,
  signedAtPegawai: null, checkedAt: null, signedAtPenilai: null,
});

export async function getSkpHasilStatus(userId: number, tahun: string): Promise<SkpHasilStatusData> {
  try {
    const res = await fetch(`${API_BASE_URL}/skp-hasil/status?userId=${userId}&tahun=${encodeURIComponent(tahun)}`);
    if (!res.ok) return EMPTY_HASIL(userId, tahun);
    return res.json();
  } catch {
    return EMPTY_HASIL(userId, tahun);
  }
}

export async function submitHasilSKPPegawai(userId: number, tahun: string, signature: string | null): Promise<SkpHasilStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-hasil/submit-pegawai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tahun, signature }),
  });
  if (!res.ok) throw new Error('Gagal mengajukan Hasil SKP');
  return res.json();
}

export async function checkHasilSKPChecker(targetUserId: number, tahun: string): Promise<SkpHasilStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-hasil/check-checker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, tahun }),
  });
  if (!res.ok) throw new Error('Gagal memvalidasi Hasil SKP');
  return res.json();
}

export async function signHasilSKPPenilai(targetUserId: number, tahun: string, signature: string | null): Promise<SkpHasilStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-hasil/sign-penilai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, tahun, signature }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan tanda tangan Pejabat Penilai');
  return res.json();
}

// ── SKP Revision Flow ─────────────────────────────────────────────────────────

export interface SkpRevisionLog {
  id: number;
  userId: number;
  tahun: string;
  docType: string;
  fromStatus: string;
  reason: string | null;
  note: string | null;
  revisedByUserId: number;
  revisedAt: string;
  resubmittedAt: string | null;
}

export async function returnRencanaSKPForRevision(
  targetUserId: number, tahun: string, reason: string | null, note: string | null, token: string
): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/return-revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetUserId, tahun, reason, note }),
  });
  if (!res.ok) throw new Error('Gagal mengembalikan Rencana SKP untuk revisi');
  return res.json();
}

export async function resubmitRencanaSKP(tahun: string, token: string): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/resubmit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tahun }),
  });
  if (!res.ok) throw new Error('Gagal mengajukan kembali Rencana SKP');
  return res.json();
}

export async function getRencanaSKPRevisionLogs(userId: number, tahun: string, token: string): Promise<SkpRevisionLog[]> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/revisions?userId=${userId}&tahun=${tahun}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function checkRencanaSKPNewTargets(tahun: string, token: string): Promise<{ hasNewTargets: boolean; newCount: number }> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/check-new-targets?tahun=${tahun}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { hasNewTargets: false, newCount: 0 };
  return res.json();
}

export async function resetRencanaSKPForNewTargets(tahun: string, token: string): Promise<SkpRencanaStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-rencana/reset-for-new-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tahun }),
  });
  if (!res.ok) throw new Error('Gagal mengajukan revisi');
  return res.json();
}

export async function returnHasilSKPForRevision(
  targetUserId: number, tahun: string, reason: string | null, note: string | null, token: string
): Promise<SkpHasilStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-hasil/return-revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetUserId, tahun, reason, note }),
  });
  if (!res.ok) throw new Error('Gagal mengembalikan Hasil SKP untuk revisi');
  return res.json();
}

export async function resubmitHasilSKP(tahun: string, token: string): Promise<SkpHasilStatusData> {
  const res = await fetch(`${API_BASE_URL}/skp-hasil/resubmit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tahun }),
  });
  if (!res.ok) throw new Error('Gagal mengajukan kembali Hasil SKP');
  return res.json();
}

export async function getHasilSKPRevisionLogs(userId: number, tahun: string, token: string): Promise<SkpRevisionLog[]> {
  const res = await fetch(`${API_BASE_URL}/skp-hasil/revisions?userId=${userId}&tahun=${tahun}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export interface UserSkpInfo {
  id: number;
  nama: string;
  nip: string | null;
  jabatan?: string | null;
  roleId?: number;
  roles?: Array<{ id: number; name: string; level: number; isPrimary: boolean }>;
  userRoles?: Array<{ id: number; level: number; isPrimary?: boolean; role: { id: number; name: string; level: number } }>;
}

export async function getUserSkpInfo(userId: number, token: string): Promise<UserSkpInfo> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Gagal mengambil data user');
  return res.json();
}

// ── RBAC View Permissions ──────────────────────────────────────────────────────

export interface RoleViewPermission {
  id: number;
  viewerRoleId: number;
  viewableRoleId: number;
  viewerRole?: RoleOption;
  viewableRole?: RoleOption;
}

export async function getAllRoleViewPermissions(): Promise<RoleViewPermission[]> {
  const res = await fetch(`${API_BASE_URL}/role-view-permissions`);
  if (!res.ok) return [];
  return res.json();
}

export async function getRoleViewPermissionsForViewer(viewerRoleId: number): Promise<RoleViewPermission[]> {
  const res = await fetch(`${API_BASE_URL}/role-view-permissions/${viewerRoleId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function setRoleViewPermissions(viewerRoleId: number, viewableRoleIds: number[]): Promise<RoleViewPermission[]> {
  const res = await fetch(`${API_BASE_URL}/role-view-permissions/${viewerRoleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewableRoleIds }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan konfigurasi akses');
  return res.json();
}

export async function getViewableRoleIds(viewerRoleId: number): Promise<number[]> {
  const res = await fetch(`${API_BASE_URL}/role-view-permissions/${viewerRoleId}/viewable-ids`);
  if (!res.ok) return [];
  return res.json();
}

// ── RBAC Feature Permissions ───────────────────────────────────────────────────

export interface RoleFeaturePermission {
  id: number;
  roleId: number;
  featureKey: string;
}

export async function getAllRoleFeaturePermissions(): Promise<RoleFeaturePermission[]> {
  const res = await fetch(`${API_BASE_URL}/role-feature-permissions`);
  if (!res.ok) return [];
  return res.json();
}

export async function getRoleFeatureKeys(roleId: number): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/role-feature-permissions/${roleId}/feature-keys`);
  if (!res.ok) return [];
  return res.json();
}

export async function setRoleFeaturePermissions(roleId: number, featureKeys: string[]): Promise<RoleFeaturePermission[]> {
  const res = await fetch(`${API_BASE_URL}/role-feature-permissions/${roleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featureKeys }),
  });
  if (!res.ok) throw new Error('Gagal menyimpan konfigurasi fitur');
  return res.json();
}

// ── Verifikasi Ekspektasi ──────────────────────────────────────────────────────

export interface EkspektasiBawahanRow {
  userId: number;
  nama: string;
  email: string;
  totalIndikator: number;
  validatedCount: number;
  ekspektasi: 'melebihi' | 'sesuai' | 'di_bawah' | null;
  catatan: string | null;
}

export async function getEkspektasiBawahan(penilaiId: number, tahun: string): Promise<EkspektasiBawahanRow[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/realisasi/ekspektasi-bawahan?penilaiId=${penilaiId}&tahun=${encodeURIComponent(tahun)}`,
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function upsertEkspektasi(data: {
  penilaiId: number;
  targetUserId: number;
  tahun: string;
  ekspektasi: string;
  catatan?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/realisasi/ekspektasi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Gagal menyimpan penilaian ekspektasi');
}
