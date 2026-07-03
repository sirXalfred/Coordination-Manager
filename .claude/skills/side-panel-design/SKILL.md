---
name: side-panel-design
description: Build FAB clusters and sliding side panels for contextual tools and information
---

# side-panel-design

## Purpose

Provides the sliding side panel pattern used throughout Coordination Manager. A Floating Action Button (FAB) cluster gives quick access to contextual tools (Feedback, AI Assistant, Chat, Support) that slide in from the right edge without navigating away from the current page.

## When to Use

- Adding a new contextual tool panel to the app
- Modifying the FAB cluster or panel set
- Building a side panel for any page-level contextual feature
- Opening panels programmatically from other components
- Adding mobile backdrop support for panels

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Panel name and purpose | User describes the new panel | yes |
| Color scheme | User specifies or follows existing pattern | no |

## Workflow

1. **Plan the panel with a color-coded identity**:
   | Existing Panel | Border Color | Icon Color | Icon | Purpose |
   |---------------|-------------|------------|------|---------|
   | Feedback | amber-400 | amber-500 | MessageSquare | User feedback, bug reports |
   | AI Assistant | purple-400 | purple-500 | Sparkles | AI chat, suggestions |
   | Chat | sky-400 | sky-500 | MessageCircle | Community chat polls |
   | Support | blue-400 | blue-500 | LifeBuoy | Help resources, contact |
   New panels must pick a distinct color not already used.
   Panel color config in `PANEL_COLORS` object (bg, faded, active ring classes per panel ID).

2. **Build the side panel component** (`Code/apps/web/src/components/{Name}SidePanel.tsx`):
   - Fixed CSS pattern:
     ```
     fixed top-0 right-0 z-50
     w-[22rem] sm:w-96
     translate-x-full (closed) / translate-x-0 (open)
     duration-300 ease-in-out transition-transform
     border-l-2 border-{color}-400
     flex flex-col h-full bg-background
     ```
   - Header: icon + title + LearnerHelpIcon + close button (X icon)
   - Body: `flex-1 overflow-y-auto p-4` for scrollable content
   - Footer: optional, for links or actions
   - Props: `isOpen: boolean`, `onClose: () => void`

3. **Register in FloatingPanels** (`Code/apps/web/src/components/FloatingPanels.tsx`):
   - Add panel ID to `PanelId` type: `'feedback' | 'ai' | 'chat' | 'support' | null`
   - Add FAB button with icon, label, and color scheme
   - Conditionally render the panel component when activePanel matches
   - FAB z-index: `z-[55]` (above panels at z-50)
   - Active button: `ring-2 ring-offset-2 scale-105`
   - Inactive buttons when panel open: `opacity-25`
   - FAB layout: `flex-col-reverse` (pyramid stack: support, chat, ai, feedback)
   - Note: AI/Guide panels (`AiGuideSidePanel`, `CalendarAiPanel`) render separately in Layout, not FloatingPanels

4. **Integrate with Layout state**:
   - `activePanel` state lives in Layout.tsx (single source of truth)
   - Passed as props to FloatingPanels: `activePanel`, `setActivePanel`
   - Clicking same FAB button toggles panel closed
   - Only one panel can be open at a time

5. **Add remote opening via custom events**:
   - Dispatch: `window.dispatchEvent(new Event('open{Name}Panel'))`
   - Listen in Layout.tsx: `window.addEventListener('open{Name}Panel', handler)`
   - Existing events: `'openAiPanel'`, `'openFeedbackPanel'`
   - This allows any component to open a panel without prop drilling

6. **Add mobile support**:
   - Semi-transparent backdrop: `bg-black/40 z-40 lg:hidden`
   - Backdrop click closes the panel
   - FAB position shifts when panel open: `right-[22.5rem] sm:right-[24.5rem]`

7. **FAB state machine**:
   - Closed: gradient circle button (neutral state)
   - Open (no panel): pill shape with "Hide" button + stacked panel buttons
   - Panel active: collapsed mini pill + active panel button highlighted
   - Transitions: 300ms position, 200ms opacity

## Outputs

| Output | Format | Location |
|--------|--------|----------|
| Panel component | .tsx | `Code/apps/web/src/components/{Name}SidePanel.tsx` |
| FAB update | .tsx | `Code/apps/web/src/components/FloatingPanels.tsx` |
| Layout integration | .tsx | `Code/apps/web/src/components/Layout.tsx` |

## Constraints

- Panel width MUST be `w-[22rem] sm:w-96` (352px/384px)
- Only one panel can be open at a time (single activePanel state)
- FAB z-index: z-[55]; panels z-50; mobile backdrop z-40
- Panels MUST NOT be used for primary navigation or multi-step workflows
- Each panel MUST have a distinct color-coded border and icon
- Include LearnerHelpIcon in headers for learner mode support
- Use duration-300 ease-in-out for slide transitions
- AI-related panels render in Layout.tsx, not FloatingPanels.tsx

## Self-Validation

### Trigger Indicators
- [ ] User asked to add a side panel, FAB option, or contextual overlay
- [ ] Task involves FloatingPanels.tsx or a SidePanel component
- [ ] User mentioned sliding panel, FAB cluster, or contextual tool

### Completion Markers
- [ ] Panel slides in/out with 300ms ease-in-out transition
- [ ] Registered in FloatingPanels with color-coded FAB button
- [ ] Layout state manages activePanel correctly
- [ ] Mobile backdrop closes panel on click

### Quality Signals
- [ ] Only one panel open at a time
- [ ] FAB shifts to correct position when panel is open
- [ ] Panel body scrolls independently (overflow-y-auto)
- [ ] Remote opening works via custom DOM events
- [ ] FAB state transitions follow the 3-state machine

### Lint Checks
- [ ] TypeScript compiles without errors
- [ ] Panel uses the standard CSS pattern (fixed, z-50, w-[22rem])
- [ ] No non-ASCII characters in panel text
