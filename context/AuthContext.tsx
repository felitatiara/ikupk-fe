'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { AuthContextType, User, LoginResponse } from '@/types';
import { login as apiLogin } from '@/lib/api';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth from sessionStorage
  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    const tokenStr = sessionStorage.getItem('token');

    if (userStr && tokenStr) {
      try {
        setUser(JSON.parse(userStr));
        setToken(tokenStr);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        setLoading(true);
        const response: LoginResponse = await apiLogin(email, password);

        const primaryRole = (response.user as any).roles?.find((r: any) => r.isPrimary) ?? (response.user as any).roles?.[0];
        const mappedUser: User = {
          ...(response.user as any),
          roleLevel: primaryRole?.level ?? 4,
        };

        setUser(mappedUser);
        setToken(response.token);
        sessionStorage.setItem('user', JSON.stringify(mappedUser));
        sessionStorage.setItem('token', response.token);
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback((): void => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  }, []);

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
