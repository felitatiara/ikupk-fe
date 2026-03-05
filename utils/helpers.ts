/**
 * Format date to Indonesian format
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDateID(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
}

/**
 * Get user from session storage
 * @returns User object or null
 */
export function getStoredUser(): any {
  if (typeof window === 'undefined') return null;
  const userStr = sessionStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Get token from session storage
 * @returns Token string or null
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('token');
}

/**
 * Clear user session
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('token');
}

/**
 * Store user and token
 */
export function storeSession(user: any, token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('user', JSON.stringify(user));
  sessionStorage.setItem('token', token);
}
