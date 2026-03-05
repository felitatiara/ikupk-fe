/**
 * IKU-PK Application Entry Point
 * This file documents all available imports for the refactored architecture
 */

// ============================================================================
// SERVICES - API LAYER
// ============================================================================
// import { login, logout, getCurrentUser } from '@/services/authService';
// import { getTargets, createTarget, updateTarget } from '@/services/targetService';
// import { getIKUList, createIKU } from '@/services/ikuService';
// import { getMonitoringData, getMonitoringCharts } from '@/services/monitoringService';
// import { uploadSK, publishSK } from '@/services/skService';

// ============================================================================
// UI COMPONENTS - REUSABLE COMPONENTS
// ============================================================================
// import { Button, Card, Modal, Table } from '@/components/ui';
// import Button from '@/components/ui/Button';
// import Card from '@/components/ui/Card';
// import Modal from '@/components/ui/Modal';
// import Table from '@/components/ui/Table';

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================
// import Sidebar from '@/components/layout/Sidebar';
// import PageTransition from '@/components/layout/PageTransition';

// ============================================================================
// FEATURES - FEATURE COMPONENTS
// ============================================================================
// import DashboardContent from '@/features/dashboard/DashboardContent';
// import MonitoringUnitKerjaContent from '@/features/monitoring-unit-kerja/MonitoringUnitKerjaContent';
// import IKUPKContent from '@/features/iku-pk/IKUPKContent';
// import TargetIKUPKContent from '@/features/target-iku-pk/TargetIKUPKContent';
// import PengajuanIKUContent from '@/features/pengajuan-iku/PengajuanIKUContent';
// import PenerbitanSKContent from '@/features/penerbitan-sk/PenerbitanSKContent';
// import ValidasiIKUPKContent from '@/features/validasi-iku-pk/ValidasiIKUPKContent';

// ============================================================================
// UTILITIES
// ============================================================================
// import { formatDateID, getStoredUser, getStoredToken, storeSession, clearSession } from '@/utils/helpers';
// import { API_BASE_URL, HTTP_STATUS, ROLES, MENU_KEYS } from '@/utils/constants';

// ============================================================================
// HOOKS (PRESERVED FROM ORIGINAL STRUCTURE)
// ============================================================================
// import { useAuth } from '@/hooks/useAuth';
// import { useTargets } from '@/hooks/useTargets';
// import { useUser } from '@/hooks/useUser';

// ============================================================================
// CONTEXT (PRESERVED FROM ORIGINAL STRUCTURE)
// ============================================================================
// import { AuthContext } from '@/context/AuthContext';
// import { TargetContext } from '@/context/TargetContext';
// import { ViewContext } from '@/context/ViewContext';

// ============================================================================
// TYPES (PRESERVED FROM ORIGINAL STRUCTURE)
// ============================================================================
// import { /* type definitions */ } from '@/types';

// ============================================================================
// ROUTE STRUCTURE
// ============================================================================
/**
 * Auth Routes (No Sidebar)
 * POST /auth/login -> login page
 * 
 * Admin Routes (Admin Sidebar)
 * GET /(admin)/dashboard
 * GET /(admin)/monitoring-unit-kerja
 * GET /(admin)/iku-pk
 * GET /(admin)/target-iku-pk
 * GET /(admin)/pengajuan-iku
 * GET /(admin)/penerbitan-sk
 * GET /(admin)/validasi-iku-pk
 * 
 * User Routes (User Sidebar)
 * GET /(user)/dashboard
 * GET /(user)/monitoring-unit-kerja
 * GET /(user)/iku-pk
 * GET /(user)/target-iku-pk
 */

// ============================================================================
// COMMON PATTERNS
// ============================================================================

/**
 * PATTERN 1: Create a Page Component
 * 
 * File: app/(admin)/feature/page.tsx
 * 
 * import FeatureContent from '@/features/feature/FeatureContent';
 * 
 * export default function FeaturePage() {
 *   return <FeatureContent role="admin" />;
 * }
 */

/**
 * PATTERN 2: Create a Feature Component
 * 
 * File: features/feature/FeatureContent.tsx
 * 
 * 'use client';
 * 
 * import { useEffect, useState } from 'react';
 * import PageTransition from '@/components/layout/PageTransition';
 * import { getFeatureData } from '@/services/featureService';
 * import { Button, Card } from '@/components/ui';
 * 
 * export default function FeatureContent({ role = 'user' }) {
 *   const [data, setData] = useState([]);
 *   const [loading, setLoading] = useState(true);
 * 
 *   useEffect(() => {
 *     fetchData();
 *   }, []);
 * 
 *   async function fetchData() {
 *     try {
 *       const result = await getFeatureData();
 *       setData(result);
 *     } catch (err) {
 *       console.error(err);
 *     } finally {
 *       setLoading(false);
 *     }
 *   }
 * 
 *   return (
 *     <PageTransition>
 *       <Button>Action</Button>
 *       <Card title="Data">{data}</Card>
 *     </PageTransition>
 *   );
 * }
 */

/**
 * PATTERN 3: Create a Service
 * 
 * File: services/featureService.ts
 * 
 * const API_BASE_URL = 'http://localhost:4000';
 * 
 * export interface FeatureData {
 *   id: number;
 *   name: string;
 * }
 * 
 * export async function getFeatureData(): Promise<FeatureData[]> {
 *   const response = await fetch(`${API_BASE_URL}/feature`);
 *   if (!response.ok) throw new Error('Failed to fetch');
 *   return response.json();
 * }
 */

/**
 * PATTERN 4: Use UI Components
 * 
 * import { Button, Card, Modal, Table } from '@/components/ui';
 * 
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Click Me
 * </Button>
 * 
 * <Card title="My Card">
 *   Content here
 * </Card>
 * 
 * <Table
 *   columns={[
 *     { key: 'name', label: 'Name' },
 *     { key: 'status', label: 'Status' },
 *   ]}
 *   data={data}
 *   onRowClick={(row) => console.log(row)}
 * />
 * 
 * <Modal isOpen={open} onClose={close} title="Dialog">
 *   Content
 * </Modal>
 */

// ============================================================================
// DOCUMENTATION
// ============================================================================
/**
 * For complete documentation, see:
 * - ARCHITECTURE.md - Full architecture guide
 * - REFACTORING_SUMMARY.md - What was done
 * - MIGRATION_GUIDE.md - Before and after comparison
 */

export {};
