const API_BASE_URL = 'http://localhost:4000';

export interface LoginResponse {
  accessToken?: string;
  token?: string;
  user?: any;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
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

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Logout failed');
  }
}

export async function getCurrentUser(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/auth/me`);
  if (!response.ok) throw new Error('Failed to fetch current user');
  return response.json();
}
