export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
};

export const MENU_KEYS = {
  DASHBOARD: 'beranda',
  MONITORING: 'monitoring',
  IKU_PK: 'iku_pk',
  TARGET: 'target',
  PENGAJUAN: 'pengajuan',
  PENERBITAN: 'penerbitan',
  VALIDASI: 'validasi',
};
