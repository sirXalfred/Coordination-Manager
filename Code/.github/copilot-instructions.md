<!-- Use this file to provide workspace-specific custom instructions to Copilot. -->

- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	<!-- Event Scheduling and Notification System: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui frontend, Node.js + Express + TypeScript backend, Supabase PostgreSQL database, Google Calendar API and Discord.js integrations -->

- [ ] Scaffold the Project
	<!-- Create monorepo structure with pnpm workspaces, frontend and backend apps -->

- [ ] Customize the Project
	<!-- Configure TypeScript, ESLint, Prettier, TailwindCSS, shadcn/ui, and set up folder structures -->

- [ ] Install Required Extensions
	<!-- No specific extensions required at this stage -->

- [ ] Compile the Project
	<!-- Install dependencies and verify builds -->

- [ ] Create and Run Task
	<!-- Create tasks for running dev servers -->

- [ ] Launch the Project
	<!-- Run dev servers with the repo-root launcher script -->
	<!-- IMPORTANT: Always start full stack with `.\start.ps1` from repo root (or `pnpm dev:stack`).
	     This enforces the required sequence: safe stop -> wait -> launch terminals -> health check.
	     Do NOT use ad-hoc detached `pnpm dev` for full-stack startup. -->

- [ ] Ensure Documentation is Complete
	<!-- Verify README.md and all documentation is current -->

## React Component Code-Quality Rules

### Variable Declaration Order (Temporal Dead Zone Prevention)
When adding new `useState`, `useRef`, or any variable declaration inside a React component:
- **ALWAYS** declare derived variables (`const [a, b] = x.split(...)`) BEFORE any `useState()` that references them.
- `const` and `let` are NOT hoisted like `var` -- using them before their declaration causes a runtime `ReferenceError` (temporal dead zone crash).
- TypeScript does NOT catch TDZ errors at compile time, so they only appear as runtime crashes.
- **After adding new state**: visually verify that every variable used in a `useState()` initializer is declared on a PRIOR line.

Example of a crash:
```tsx
// BAD -- dateStr is used before declaration (TDZ crash)
const [localDate, setLocalDate] = useState(dateStr)
const [dateStr, timeStr] = safeCell.split('_')

// GOOD -- declaration before use
const [dateStr, timeStr] = safeCell.split('_')
const [localDate, setLocalDate] = useState(dateStr)
```
