'use client';

import { useContext } from 'react';
import { TargetContext } from '@/context/TargetContext';
import { TargetContextType } from '@/types';

export function useTargets(): TargetContextType {
  const context = useContext(TargetContext);
  if (context === undefined) {
    throw new Error('useTargets must be used within a TargetProvider');
  }
  return context;
}
