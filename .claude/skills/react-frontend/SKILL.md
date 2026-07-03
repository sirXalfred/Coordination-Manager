---
name: react-frontend
description: Create React components, pages, and hooks following project patterns with TailwindCSS
---

# react-frontend

## Purpose

Guides creation and modification of React 18 frontend code in `Code/apps/web/`. Covers component patterns, context usage, routing, TailwindCSS theming with HSL CSS variables, lazy loading, and the project's established service layer.

## When to Use

- Creating or editing React components in `Code/apps/web/src/components/`
- Adding new pages to `Code/apps/web/src/pages/`
- Creating custom hooks in `Code/apps/web/src/hooks/`
- Working with contexts (Auth, Theme, LearnerMode, AiAssistant, Toast)
- Adding or modifying routes in App.tsx
- Building modals, side panels, or floating panels
- Implementing dark mode or custom theme support

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Component/page name | User provides | yes |
| Feature description | User describes the functionality | yes |
| Route path | User specifies for new pages | no |

## Workflow

1. **Determine file location and type**:
   - Pages: `Code/apps/web/src/pages/{FeatureName}Page.tsx`
   - Components: `Code/apps/web/src/components/{FeatureName}.tsx`
   - Hooks: `Code/apps/web/src/hooks/use{FeatureName}.ts`
   - Contexts: `Code/apps/web/src/contexts/{FeatureName}Context.tsx`
   - Services: `Code/apps/web/src/lib/{feature-name}.ts`
   - Use `@/` alias for imports (resolves to `./src`)

2. **Build the component**:
   - Function components with hooks only (no class components)
   - TypeScript interface for all props (PascalCase naming)
   - TailwindCSS utility classes for all styling
   - Use `dark:` prefix for dark mode variants
   - Use HSL CSS variable colors: `bg-background`, `text-foreground`, `border-border`
   - Import icons from `lucide-react` (the project uses 40+ icons)
   - Use `date-fns` for date formatting and manipulation

3. **Integrate with contexts** (nesting order in main.tsx):
   - ErrorBoundary > BrowserRouter > AuthProvider > ThemeProvider > LearnerModeProvider > ToastProvider > App
   - Auth: `const { user, isAuthenticated, isTraveler, isCardano } = useAuth()`
   - Theme: `const { isDark, mode, activeThemeId, customThemes } = useTheme()`
   - LearnerMode: `const { learnerMode } = useLearnerMode()`
   - Toast: `const { addToast } = useToast()`
   - AI: `const { pageContext, setPageContext } = useAiAssistant()`

4. **Data fetching pattern**:
   - Use the API client from `Code/apps/web/src/lib/api-client.ts`
   - Use `dedupedGet(url, config?)` for GET requests (coalesces identical concurrent calls by URL+params)
   - Auth token injected via Axios interceptor (reads Supabase session, 3s timeout)
   - Handle loading, error, and empty states explicitly
   - Rate-limit soft warning: listen for `RATE_LIMIT_WARN_EVENT` (persisted 6h for admins, 2min for users)
   - 401 responses auto-retry with refreshed token; redirect to login on failure

5. **Add routing** (for new pages):
   - All pages lazy-loaded: `const NewPage = lazy(() => import('./pages/NewPage'))`
   - Auth routes (no Layout): `/auth/login`, `/auth/callback`
   - Guest routes (no Layout): `/join/invite/:code`, `/join/:hash`
   - Public routes: inside `<Route element={<Layout />}>` block
   - Protected routes: inside `<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>`
   - Fallback: `<Route path="*" element={<NotFoundPage />} />`
   - Suspense fallback: centered loading spinner overlay
   - Use `key` prop to force remount when route params change
   - BrowserRouter uses v7 future flags: `v7_relativeSplatPath`, `v7_startTransition`

6. **Use reusable UI patterns**:
   - `ConfirmDialog` for destructive actions (reusable confirmation modal)
   - `LearnerHelpIcon` for contextual help (visible when learnerMode on or unauthenticated)
   - `ErrorBoundary` wraps the entire app (catches render errors, shows reload button)
   - `Toast` for success/error notifications via `addToast()`
   - Layout includes health-check banner (polls `/health` every 30s, shows after 2 failures)

7. **Apply project conventions**:
   - No `any` type; use `unknown` and narrow with type guards
   - ASCII-safe text only (no smart quotes, no em dashes)
   - Object parameters when function has 3+ arguments
   - Early returns for validation and loading states
   - `VITE_` prefix for all environment variables (public, bundled into browser JS)
   - Session data in `sessionStorage` (cleared on logout by AuthContext)

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Component/page file | .tsx | `Code/apps/web/src/{components,pages}/` |
| Hook file | .ts | `Code/apps/web/src/hooks/` |
| Route registration | Modified | `Code/apps/web/src/App.tsx` |

## Constraints

- MUST use TailwindCSS (no CSS modules, no styled-components)
- MUST use HSL CSS variable colors for theme compatibility
- NEVER hardcode API URLs; use `VITE_API_URL` environment variable
- NEVER use `any` type; use `unknown` and narrow
- NEVER put secrets in frontend code (VITE_ vars are public)
- MUST handle loading, error, and empty states
- Components should stay focused; extract logic to hooks when complex

## Self-Validation

### Trigger Indicators
- [ ] User asked to create/edit/build a React component, page, or hook
- [ ] Task involves files in `Code/apps/web/src/`
- [ ] User mentioned TailwindCSS, routing, context, or dark mode

### Completion Markers
- [ ] Component file created with TypeScript props interface
- [ ] TailwindCSS classes used for all styling (HSL variables for colors)
- [ ] Contexts used correctly (useAuth, useTheme, etc.)
- [ ] Route registered in App.tsx with lazy loading (for new pages)

### Quality Signals
- [ ] No `any` types in created code
- [ ] Loading, error, and empty states handled
- [ ] Dark mode variants included where visible
- [ ] dedupedGet used for GET requests (not raw apiClient.get)
- [ ] ConfirmDialog used for destructive actions

### Lint Checks
- [ ] TypeScript compiles without errors
- [ ] No non-ASCII characters in UI text
- [ ] All imports use `@/` alias or relative paths
