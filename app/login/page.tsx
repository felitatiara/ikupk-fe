'use client';

import { useState } from 'react';
import { login } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
      try {
        const res = await login(email, password);
        // backend returns { accessToken, user }
        const access = res.accessToken ?? res.token ?? res;
        const user = res.user ?? null;
        if (user) {
          sessionStorage.setItem('user', JSON.stringify(user));
        }
        sessionStorage.setItem('token', access as string);
        // redirect to dashboard
        window.location.href = '/dashboard';
      } catch (err) {
      setError(err instanceof Error ? err.message : 'Login error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Login</h2>
        {token ? (
          <div className="p-4 bg-green-50 rounded">
            <p className="text-green-800">Login successful.</p>
            <p className="text-sm break-all">Token: {token}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
              >
                {loading ? 'Logging in…' : 'Login'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
