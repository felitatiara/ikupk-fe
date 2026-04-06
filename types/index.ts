// User Types
export interface User {
  id: number;
  nip?: string;
  email: string;
  nama: string;
  role: 'user' | 'admin' | 'pku';
  unitId: number;
  unitNama?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Target Types
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

export interface TargetCreateRequest {
  targetNama: string;
  sasaranStrategis: string;
  capaian: string;
  targetAngka: number;
  tahun: string;
}

export interface TargetUpdateRequest {
  targetNama?: string;
  sasaranStrategis?: string;
  capaian?: string;
  targetAngka?: number;
}

// Auth Context Types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

// Target Context Types
export interface TargetContextType {
  targets: TargetDetail[];
  rows: TargetRow[];
  loading: boolean;
  error: string | null;
  fetchTargets: () => Promise<void>;
  fetchTargetsByUnit: (unitId: number) => Promise<void>;
  fetchTargetsForAdminPKU: () => Promise<void>;
  createTarget: (data: TargetCreateRequest) => Promise<void>;
  updateTarget: (id: number, data: TargetUpdateRequest) => Promise<void>;
  deleteTarget: (id: number) => Promise<void>;
  clearError: () => void;
}

// Menu Types
export type MenuType = 'beranda' | 'target' | 'laporan' | 'pengaturan';

export interface MenuOption {
  id: MenuType;
  label: string;
  icon?: string;
}
