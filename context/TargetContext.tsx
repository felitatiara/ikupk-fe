'use client';

import React, { createContext, useCallback, useState } from 'react';
import { TargetContextType, TargetDetail, TargetRow, TargetCreateRequest, TargetUpdateRequest } from '@/types';
import {
  getTargets,
  getTargetsByUnit,
  getTargetsForAdminFIK as getTargetsForSuperAdmin,
} from '@/lib/api';

export const TargetContext = createContext<TargetContextType | undefined>(undefined);

interface TargetProviderProps {
  children: React.ReactNode;
}

export function TargetProvider({ children }: TargetProviderProps) {
  const [targets, setTargets] = useState<TargetDetail[]>([]);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTargets = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTargets();
      setRows(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat target';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTargetsByUnit = useCallback(async (unitId: number): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTargetsByUnit(unitId);
      setTargets(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat target berdasarkan unit';
      setError(message);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTargetsForSuperAdmin = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTargetsForSuperAdmin();
      setTargets(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat target untuk super admin';
      setError(message);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTarget = useCallback(
    async (data: TargetCreateRequest): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        // TODO: Implement API call
        console.log('Creating target:', data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal membuat target';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateTarget = useCallback(
    async (id: number, data: TargetUpdateRequest): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        // TODO: Implement API call
        console.log('Updating target:', id, data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memperbarui target';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteTarget = useCallback(
    async (id: number): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        // TODO: Implement API call
        console.log('Deleting target:', id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal menghapus target';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const value: TargetContextType = {
    targets,
    rows,
    loading,
    error,
    fetchTargets,
    fetchTargetsByUnit,
    fetchTargetsForSuperAdmin,
    createTarget,
    updateTarget,
    deleteTarget,
    clearError,
  };

  return <TargetContext.Provider value={value}>{children}</TargetContext.Provider>;
}
