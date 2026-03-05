# IKU-PK Project Architecture

## Project Overview

This is a performance monitoring system called "Indikator Kinerja Utama & Perjanjian Kerja (IKU-PK)" built with Next.js 14, App Router, TypeScript, and React.

## Folder Structure

```
ikupk-fe/
├── app/                          # Next.js App Router
│   ├── (auth)                    # Auth route group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (admin)                   # Admin route group
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── monitoring-unit-kerja/
│   │   │   └── page.tsx
│   │   ├── iku-pk/
│   │   │   └── page.tsx
│   │   ├── target-iku-pk/
│   │   │   └── page.tsx
│   │   ├── pengajuan-iku/
│   │   │   └── page.tsx
│   │   ├── penerbitan-sk/
│   │   │   └── page.tsx
│   │   ├── validasi-iku-pk/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (user)                    # User route group
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── monitoring-unit-kerja/
│   │   │   └── page.tsx
│   │   ├── iku-pk/
│   │   │   └── page.tsx
│   │   ├── target-iku-pk/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Root page
│   └── globals.css
│
├── components/                   # Reusable UI components
│   ├── layout/                   # Layout components
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   ├── PageTransition.tsx   # Page transition animation
│   │   └── Header.tsx            # Header component
│   │
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   └── index.ts              # Barrel export
│   │
│   ├── DashboardContent.tsx      # Legacy - to be removed
│   └── ...                       # Other legacy components
│
├── features/                     # Feature-based components
│   ├── dashboard/
│   │   └── DashboardContent.tsx
│   │
│   ├── monitoring-unit-kerja/
│   │   ├── MonitoringUnitKerjaContent.tsx
│   │   ├── MonitoringChart.tsx
│   │   └── MonitoringTable.tsx
│   │
│   ├── iku-pk/
│   │   ├── IKUPKContent.tsx
│   │   ├── IKUTable.tsx
│   │   └── RepositoryModal.tsx
│   │
│   ├── target-iku-pk/
│   │   ├── TargetIKUPKContent.tsx
│   │   ├── TargetTable.tsx
│   │   └── InputTargetForm.tsx
│   │
│   ├── pengajuan-iku/
│   │   ├── PengajuanIKUContent.tsx
│   │   └── PengajuanForm.tsx
│   │
│   ├── penerbitan-sk/
│   │   ├── PenerbitanSKContent.tsx
│   │   └── UploadSKModal.tsx
│   │
│   └── validasi-iku-pk/
│       ├── ValidasiIKUPKContent.tsx
│       └── ValidasiForm.tsx
│
├── services/                     # API service layer
│   ├── authService.ts           # Authentication API calls
│   ├── targetService.ts         # Target management API calls
│   ├── ikuService.ts            # IKU management API calls
│   ├── monitoringService.ts     # Monitoring data API calls
│   └── skService.ts             # SK (Surat Keputusan) API calls
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts
│   ├── useTargets.ts
│   └── useUser.ts
│
├── context/                      # React Context providers
│   ├── AuthContext.tsx
│   ├── TargetContext.tsx
│   └── ViewContext.tsx
│
├── types/                        # TypeScript type definitions
│   └── index.ts
│
├── utils/                        # Utility functions
│   ├── constants.ts              # App constants
│   └── helpers.ts                # Helper functions
│
├── lib/                          # Legacy API layer (to be deprecated)
│   └── api.ts
│
├── public/                       # Static assets
├── node_modules/
├── .git/
├── .env.local                    # Environment variables (local)
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json
├── package-lock.json
└── README.md
```

## Route Groups Explanation

### (auth)
- Contains public routes for authentication
- No layout wrapper (requires full page auth UI)
- Route: `/login`

### (admin)
- Contains admin-only routes
- Includes sidebar with admin-specific menu items
- Routes: `/dashboard`, `/monitoring-unit-kerja`, `/iku-pk`, `/target-iku-pk`, `/pengajuan-iku`, `/penerbitan-sk`, `/validasi-iku-pk`

### (user)
- Contains user-only routes
- Includes sidebar with user-specific menu items
- Routes: `/dashboard`, `/monitoring-unit-kerja`, `/iku-pk`, `/target-iku-pk`

## File Organization

### Pages (`app/*/page.tsx`)
- Minimal responsibility
- Only imports and renders a feature component
- Passes role props to components

Example:
```tsx
import DashboardContent from "@/features/dashboard/DashboardContent";

export default function AdminDashboardPage() {
  return <DashboardContent role="admin" />;
}
```

### Features (`features/*`)
- Main UI logic for each feature
- Handles state management for that feature
- Calls services for API interactions
- Can contain sub-components specific to that feature

### Services (`services/*`)
- Pure API functions
- No state management
- Generic and reusable across components
- Error handling at service level

Example:
```tsx
export async function getTargets(): Promise<TargetRow[]> {
  const response = await fetch(`${API_BASE_URL}/targets`);
  if (!response.ok) throw new Error('Failed to fetch targets');
  return response.json();
}
```

### Components
- **layout/** - Shared layout components (Sidebar, Header, PageTransition)
- **ui/** - Reusable UI components (Button, Card, Modal, Table)
- Feature-specific components should live inside the feature folder

### Hooks & Context
- **hooks/** - Custom React hooks for common logic
- **context/** - React Context providers for global state
- Keep as they are for now

## Architecture Principles

### 1. Feature-Based Organization
- Group related code by feature, not by type
- Each feature is self-contained and independent

### 2. Role-Based Access
- Routes are organized by role: (admin), (user), (auth)
- Components accept role props for conditional rendering
- Sidebar shows different menus based on role

### 3. Service-Based API Layer
- API calls are centralized in services
- Components use services instead of direct fetch calls
- Services are easily mockable for testing

### 4. Component Hierarchy
- Page → Feature Component → UI Components
- UI components are reusable and stateless when possible
- Feature components manage feature-specific state

### 5. Type Safety
- All TypeScript types in `types/`
- Service functions have proper return types
- Props interfaces for all components

## Common Workflows

### Adding a New Page

1. Create folder in `app/(role)/feature-name/`
2. Create `page.tsx` that imports the feature component
3. Create feature component in `features/feature-name/`
4. Update Sidebar menus if needed

### Adding a New API Endpoint

1. Create or update service file in `services/`
2. Define interfaces for request/response
3. Add error handling
4. Use in feature components

### Adding a New Reusable Component

1. Create component in `components/ui/`
2. Export from `components/ui/index.ts`
3. Import and use across features

## Environment Setup

Create `.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

## Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Services Available

- **authService** - Login, logout, user management
- **targetService** - CRUD operations for targets
- **ikuService** - CRUD operations for IKU indicators
- **monitoringService** - Monitoring data and charts
- **skService** - SK (Surat Keputusan) management

## Utility Functions

### Constants (`utils/constants.ts`)
- `API_BASE_URL`
- `HTTP_STATUS`
- `ROLES`
- `MENU_KEYS`

### Helpers (`utils/helpers.ts`)
- `formatDateID()` - Format date to Indonesian locale
- `getStoredUser()` - Get user from session storage
- `getStoredToken()` - Get auth token
- `storeSession()` - Store user and token
- `clearSession()` - Clear session on logout

## Best Practices

1. **Always use `@/` path alias** - Never use relative imports
2. **Keep components small** - Extract complex logic into sub-components
3. **Error handling** - All service calls should have try-catch
4. **Loading states** - Show loading indicators for async operations
5. **TypeScript** - Use proper types for all props and state
6. **Naming** - Feature components should end with `Content` (e.g., `DashboardContent`)
7. **Props** - Pass role prop to components for role-based rendering

## Migration Notes

- Old component files in `components/` are legacy and will be removed
- Use new services from `services/` instead of `lib/api.ts`
- Import UI components from `components/ui/` for consistency
- Update imports in existing features to use new service layer

## Next Steps

1. Migrate remaining legacy components to new structure
2. Add authentication middleware/guards
3. Add error boundary components
4. Add loading skeleton components
5. Add form validation utilities
6. Add API error handling middleware
7. Add unit and integration tests
