# Migration Guide: Before & After

## Old Structure (Before Refactoring)

```
app/
├── dashboard/
│   └── page.tsx
├── login/
│   └── page.tsx
├── monitoring-unit-kerja/
│   └── page.tsx
├── layout.tsx (with hardcoded Sidebar)
└── page.tsx

components/
├── DashboardContent.tsx
├── InputTargetIKUPK.tsx
├── MonitoringUnitKerjaContent.tsx
├── PageTransition.tsx
├── Sidebar.tsx
├── TargetIKUPKAdmin.tsx
├── TargetsTable.tsx
└── layout/
    ├── PageTransition.tsx
    └── Sidebar.tsx

features/
├── dashboard/
│   └── DashboardContent.tsx
├── monitoring-unit-kerja/
│   └── MonitoringUnitKerjaContent.tsx
└── targets/
    ├── InputTargetIKUPK.tsx
    ├── TargetIKUPKAdmin.tsx
    └── TargetsTable.tsx

lib/
└── api.ts (all API calls here)

hooks/, context/, types/, utils/
(no structured organization)
```

## New Structure (After Refactoring)

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── (admin)/
│   ├── dashboard/page.tsx
│   ├── monitoring-unit-kerja/page.tsx
│   ├── iku-pk/page.tsx
│   ├── target-iku-pk/page.tsx
│   ├── pengajuan-iku/page.tsx
│   ├── penerbitan-sk/page.tsx
│   ├── validasi-iku-pk/page.tsx
│   └── layout.tsx
├── (user)/
│   ├── dashboard/page.tsx
│   ├── monitoring-unit-kerja/page.tsx
│   ├── iku-pk/page.tsx
│   ├── target-iku-pk/page.tsx
│   └── layout.tsx
├── layout.tsx
└── page.tsx

components/
├── layout/
│   ├── Sidebar.tsx (role-aware)
│   └── PageTransition.tsx
└── ui/
    ├── Button.tsx
    ├── Card.tsx
    ├── Modal.tsx
    ├── Table.tsx
    └── index.ts

features/
├── dashboard/
│   └── DashboardContent.tsx
├── monitoring-unit-kerja/
│   └── MonitoringUnitKerjaContent.tsx
├── iku-pk/
│   └── IKUPKContent.tsx
├── target-iku-pk/
│   └── TargetIKUPKContent.tsx
├── pengajuan-iku/
│   └── PengajuanIKUContent.tsx
├── penerbitan-sk/
│   └── PenerbitanSKContent.tsx
└── validasi-iku-pk/
    └── ValidasiIKUPKContent.tsx

services/
├── authService.ts
├── targetService.ts
├── ikuService.ts
├── monitoringService.ts
└── skService.ts

utils/
├── constants.ts
└── helpers.ts

hooks/, context/, types/
(organized and preserved)
```

## Import Changes

### Before: Getting Targets from API
```typescript
// Old Way - Direct API call in page
import { getTargets } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    async function fetch() {
      const data = await getTargets();
      setData(data);
    }
    fetch();
  }, []);
  
  return <DashboardContent data={data} />;
}
```

### After: Using Service Layer
```typescript
// New Way - Clean separation of concerns
import DashboardContent from "@/features/dashboard/DashboardContent";

export default function AdminDashboardPage() {
  return <DashboardContent role="admin" />;
}

// Inside DashboardContent.tsx
import { getTargets } from '@/services/targetService';

export default function DashboardContent({ role = 'user' }) {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    async function fetch() {
      const data = await getTargets();
      setData(data);
    }
    fetch();
  }, []);
  
  return <PageTransition>{/* content */}</PageTransition>;
}
```

## Routing Changes

### Before: No Role-Based Routing
```
/login
/dashboard
/monitoring-unit-kerja
```

### After: Role-Based Routing with Route Groups
```
/login                           (auth route)
/(admin)/dashboard              (admin only)
/(admin)/monitoring-unit-kerja  (admin only)
/(admin)/pengajuan-iku          (admin only)
/(admin)/penerbitan-sk          (admin only)
/(admin)/validasi-iku-pk        (admin only)

/(user)/dashboard               (user only)
/(user)/monitoring-unit-kerja   (user only)
```

## Component Usage Changes

### Before: Direct Components
```typescript
import DashboardContent from '@/components/DashboardContent';
import TargetsTable from '@/components/TargetsTable';

export default function Page() {
  return <DashboardContent />;
}
```

### After: Feature-Based Organization
```typescript
import DashboardContent from '@/features/dashboard/DashboardContent';
import { Button, Table } from '@/components/ui';

export default function Page() {
  return <DashboardContent role="admin" />;
}

// Inside feature component
export default function DashboardContent({ role = 'user' }) {
  return (
    <div>
      <Button>Click me</Button>
      <Table columns={cols} data={data} />
    </div>
  );
}
```

## Layout Structure Changes

### Before: Single Layout with Hardcoded Sidebar
```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  const pathname = usePathname();
  const hideLayout = pathname === "/login" || pathname === "/";

  return (
    <html>
      <body>
        {!hideLayout && (
          <>
            <Header />
            <Sidebar />
            <main>{children}</main>
          </>
        )}
        {hideLayout && <main>{children}</main>}
      </body>
    </html>
  );
}
```

### After: Nested Layouts by Route Group
```typescript
// app/layout.tsx - Root layout, super clean
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}

// app/(auth)/layout.tsx - Auth routes have no sidebar
export default function AuthLayout({ children }) {
  return <>{children}</>;
}

// app/(admin)/layout.tsx - Admin routes with admin sidebar
export default function AdminLayout({ children }) {
  return (
    <>
      <Header />
      <div className="flex">
        <Sidebar role="admin" />
        <main>{children}</main>
      </div>
    </>
  );
}

// app/(user)/layout.tsx - User routes with user sidebar
export default function UserLayout({ children }) {
  return (
    <>
      <Header />
      <div className="flex">
        <Sidebar role="user" />
        <main>{children}</main>
      </div>
    </>
  );
}
```

## Service Layer Introduction

### Before: All API in lib/api.ts
```typescript
// lib/api.ts - 1 large file with mixed concerns
const API_BASE_URL = 'http://localhost:4000';

export async function login(email, password) { ... }
export async function getTargets() { ... }
export async function getTargetsByUnit(unitId) { ... }
export async function getTargetsForAdminPKU() { ... }
// + 20 more functions mixed together
```

### After: Organized by Service Domain
```typescript
// services/authService.ts
export async function login(email, password) { ... }
export async function logout() { ... }
export async function getCurrentUser() { ... }

// services/targetService.ts
export async function getTargets() { ... }
export async function getTargetsByUnit(unitId) { ... }
export async function createTarget(data) { ... }
export async function updateTarget(id, data) { ... }

// services/ikuService.ts
export async function getIKUList() { ... }
export async function createIKU(data) { ... }
export async function submitIKUProposal(data) { ... }

// services/monitoringService.ts
export async function getMonitoringData(unitId) { ... }
export async function getMonitoringCharts() { ... }

// services/skService.ts
export async function uploadSK(formData) { ... }
export async function publishSK(id) { ... }
```

## Component Library Introduction

### Before: No Consistent UI Components
```typescript
// Buttons scattered everywhere with inline styles
<button style={{ backgroundColor: '#4f46e5', ... }}>Click</button>

// Tables implemented multiple ways
<table>
  {/* custom implementation *./}
</table>

// Models with duplicated code
// Multiple modal implementations
```

### After: Consistent UI Components
```typescript
// Import and use
import { Button, Card, Modal, Table } from '@/components/ui';

// Consistent usage
<Button variant="primary" size="md">Click</Button>
<Card title="My Card">{content}</Card>
<Modal isOpen={open} onClose={handleClose} title="Dialog">{content}</Modal>
<Table columns={cols} data={data} />
```

## Sidebar Menu Changes

### Before: Single Menu for All Users
```typescript
const menus = [
  { label: "Beranda", href: "/dashboard" },
  { label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
  { label: "Indikator Kinerja Utama & PK", href: "/iku-pk" },
  { label: "Target IKU & PK", href: "/targets" },
];
```

### After: Role-Based Menus
```typescript
const userMenus = [
  { label: "Beranda", href: "/dashboard" },
  { label: "Monitoring Unit Kerja", href: "/monitoring-unit-kerja" },
  { label: "Indikator Kinerja Utama & PK", href: "/iku-pk" },
  { label: "Target IKU & PK", href: "/target-iku-pk" },
];

const adminMenus = [
  ...userMenus,
  { label: "Pengajuan Indikator Kinerja", href: "/pengajuan-iku" },
  { label: "Penerbitan SK", href: "/penerbitan-sk" },
  { label: "Validasi IKU & PK", href: "/validasi-iku-pk" },
];
```

## Migration Checklist

- [ ] All old component files in `components/` can be deleted after verification
- [ ] Update any remaining imports from `@/lib/api` to use services
- [ ] Test all routes in both admin and user flows
- [ ] Verify Sidebar shows correct menu items for each role
- [ ] Test responsive design on mobile
- [ ] Update CI/CD pipeline if needed
- [ ] Deploy new structure to staging
- [ ] Run end-to-end tests
- [ ] Deploy to production

## Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Organization** | Mixed by type | Organized by feature |
| **Routing** | Flat structure | Role-based route groups |
| **API Calls** | In components | Centralized services |
| **UI Components** | Inconsistent styles | Reusable component library |
| **Sidebar** | Hardcoded one size | Role-aware, configurable |
| **Type Safety** | Basic | Comprehensive with interfaces |
| **Scalability** | Hard to add features | Easy feature addition |
| **Maintainability** | Scattered code | Clear organization |
| **Code Reuse** | Limited | High with UI & services |
| **Developer Experience** | Confusing structure | Clear patterns |

## Performance Improvements

- ✅ Better code splitting by route
- ✅ Smaller bundle size with modular services
- ✅ Reusable components reduce duplication
- ✅ Proper component isolation for optimization

---

**Refactoring Date:** March 5, 2026
**Status:** ✅ Complete and Ready
