# Dashboard Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. REQUIRED DESIGN SKILLS: read and apply `/Users/mac/.agents/skills/design-taste-frontend/SKILL.md` and `/Users/mac/taste-skill/skills/soft-skill/SKILL.md` before every task that changes UI. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a premium, consistent LeadPilot workspace system before building the lead-management screens.

**Architecture:** Use one token system and focused React primitives, then compose an asymmetric operations workspace. Dynamic motion stays in isolated leaf components; route/layout components remain responsible for structure and data state.

**Tech Stack:** React 19, TanStack Start, Tailwind CSS 4 through `@tailwindcss/vite`, Geist Variable, Geist Mono, Phosphor Icons, Framer Motion after dependency verification, Vitest, Testing Library, Playwright screenshots.

---

## Fixed visual contract

- Skill baseline: design variance `8`, motion intensity `6`, visual density `4`.
- Vibe: `Soft Structuralism`.
- Layout: `Asymmetrical Bento` for overview; editorial split for detail views.
- Fonts: `Geist Variable` for UI and `Geist Mono` for numeric/identifier data. No serif and no Inter.
- Palette: background `#F7F8F6`, surface `#FFFFFF`, foreground `#19211F`, muted `#66706C`, hairline `#DDE3DF`, single accent `#2D6A5F`, accent-soft `#E6F0ED`. Semantic red/amber are status-only and may not become decorative accents.
- Desktop container: `max-w-[1400px] mx-auto`; asymmetric 12-column grid. Below `768px`, reset to one column, `w-full`, `px-4`, and no overlap/rotation.
- Major elevated surfaces: outer radius `2rem`, `p-1.5`, subtle ring; inner radius `calc(2rem - 0.375rem)`, white core, inner highlight. Use this only where elevation communicates hierarchy.
- Motion: custom spring or `cubic-bezier(0.16,1,0.3,1)`; transform/opacity only; full `prefers-reduced-motion` fallback.
- Icons: `@phosphor-icons/react`, weight `regular`, size system `16/20/24`. No emojis or Lucide.
- Required states: success, loading skeleton, empty, inline error, forbidden, stale conflict, and destructive confirmation.

### Task 1: Encode design tokens and automated prohibitions

**Files:**
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/design-system/design-contract.ts`
- Create: `apps/web/src/design-system/design-contract.test.ts`
- Create: `apps/web/src/design-system/css-contract.test.ts`
- Modify: `apps/web/src/routes/__root.tsx`

**Export contracts:**
- `design-contract.ts` exports `LEADPILOT_DESIGN_CONTRACT`, `workspaceMotion`, and `workspaceRadii` as immutable objects.
- `css-contract.test.ts` reads the real stylesheet and enforces the fixed tokens and banned patterns.

- [ ] Write failing tests asserting every fixed palette value, Geist font, motion curve, radii, maximum container, and the absence of Inter, Roboto, Arial, `#000`, purple hex families, `shadow-md`, `ease-in-out`, and `.h-screen`.
- [ ] Replace legacy `.shell`, `.topbar`, `.grid`, `.card`, and `.table` rules with named workspace layers; do not leave two competing dashboard systems.
- [ ] Add `@fontsource-variable/geist` and verify it already exists in `apps/web/package.json`. For Geist Mono, run `npm view @fontsource-variable/geist-mono version`, install the returned exact version, and commit the lockfile before importing it.
- [ ] Define focus rings, selection color, reduced-motion resets, skeleton shimmer, and transform/opacity entrance keyframes.
- [ ] Keep chat-specific typography styles separate from workspace styles and do not add streaming animations.
- [ ] Update `RootDocument` body classes only; do not put feature layout in `__root.tsx`.
- [ ] Run `npm test -w @leadpilot/web -- --run src/design-system/design-contract.test.ts src/design-system/css-contract.test.ts` and require PASS.
- [ ] Commit with `feat(web): establish premium workspace tokens`.

### Task 2: Rebuild UI primitives with complete states

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/badge.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/ui/textarea.tsx`
- Modify: `apps/web/src/components/ui/skeleton.tsx`
- Modify: `apps/web/src/components/ui/tabs.tsx`
- Create: `apps/web/src/components/ui/workspace-surface.tsx`
- Create: `apps/web/src/components/ui/field.tsx`
- Create: `apps/web/src/components/ui/state-panel.tsx`
- Create: `apps/web/src/components/ui/status-indicator.tsx`
- Test: `apps/web/src/components/ui/button.test.tsx`
- Test: `apps/web/src/components/ui/badge.test.tsx`
- Test: `apps/web/src/components/ui/input.test.tsx`
- Test: `apps/web/src/components/ui/textarea.test.tsx`
- Test: `apps/web/src/components/ui/skeleton.test.tsx`
- Test: `apps/web/src/components/ui/tabs.test.tsx`
- Test: `apps/web/src/components/ui/field.test.tsx`
- Test: `apps/web/src/components/ui/state-panel.test.tsx`
- Test: `apps/web/src/components/ui/status-indicator.test.tsx`
- Test: `apps/web/src/components/ui/workspace-surface.test.tsx`

**Export contracts:**
- `Button` supports `primary | secondary | quiet | destructive`, loading, disabled, leading icon, and nested trailing-icon island.
- `WorkspaceSurface` supports `elevated | inset | plain`; only `elevated` renders double-bezel DOM.
- `Field` owns label, helper, error, `aria-describedby`, and input slot.
- `StatePanel` supports `loading | empty | error | forbidden | conflict` with required title/action rules.
- `StatusIndicator` exposes accessible text and never relies on color alone.

- [ ] Write interaction and accessibility tests before implementation: keyboard focus, disabled/loading click suppression, accessible names, label association, error description, state actions, and reduced-motion class behavior.
- [ ] Use Phosphor icons only after confirming the existing dependency. Standardize icon weight/size in these primitives.
- [ ] Apply tactile `active:scale-[0.98]` or `-translate-y-px`; use no animated width/height/top/left.
- [ ] Use cards only through `WorkspaceSurface`; prohibit feature code from recreating generic white bordered boxes.
- [ ] Run the four named tests plus web typecheck; require PASS.
- [ ] Commit with `feat(web): add high fidelity workspace primitives`.

### Task 3: Add isolated motion leaves

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/design-system/motion-reveal.tsx`
- Create: `apps/web/src/design-system/motion-list.tsx`
- Create: `apps/web/src/design-system/live-status.tsx`
- Test: `apps/web/src/design-system/motion-reveal.test.tsx`
- Test: `apps/web/src/design-system/motion-list.test.tsx`
- Test: `apps/web/src/design-system/live-status.test.tsx`

**Export contracts:**
- `MotionReveal` animates transform/opacity once and returns static content when reduced motion is preferred.
- `MotionList` owns parent/child variants in one component tree and accepts stable item keys.
- `LiveStatus` provides one memoized, low-cost breathing indicator and accessible status text.

- [ ] Inspect `apps/web/package.json`; because Framer Motion is absent, run `npm view framer-motion version`, install that exact version in `@leadpilot/web`, and commit the lockfile with this task.
- [ ] Write tests mocking reduced motion and verifying no infinite animation config is applied in reduced-motion mode.
- [ ] Use `type: 'spring', stiffness: 100, damping: 20` for layout changes. Infinite motion is permitted only in `LiveStatus`, must be memoized, and must pause when the document is hidden.
- [ ] Do not add GSAP, ThreeJS, scroll listeners, magnetic cursor tracking, or animation state to page-level components.
- [ ] Run named tests and web typecheck; require PASS.
- [ ] Commit with `feat(web): add isolated workspace motion`.

### Task 4: Rebuild the responsive workspace shell

**Files:**
- Modify: `apps/web/src/features/dashboard/components/dashboard-shell.tsx`
- Modify: `apps/web/src/features/dashboard/components/dashboard-sidebar.tsx`
- Modify: `apps/web/src/features/dashboard/components/dashboard-page-header.tsx`
- Modify: `apps/web/src/features/dashboard/components/dashboard-state.tsx`
- Create: `apps/web/src/features/dashboard/components/workspace-mobile-nav.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-shell.test.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-sidebar.test.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-page-header.test.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-state.test.tsx`
- Test: `apps/web/src/features/dashboard/components/workspace-mobile-nav.test.tsx`

**Component contracts:**
- `DashboardShell` renders the `max-w-[1400px]` workspace grid and accepts typed navigation/content slots.
- `DashboardSidebar` uses real route state, Phosphor icons, keyboard navigation, and no hard-coded demo tenant.
- `WorkspaceMobileNav` is an isolated interactive leaf with focus trapping, escape close, morphing menu control, and reduced-motion fallback.
- `DashboardState` delegates all non-success states to `StatePanel`.

- [ ] Write tests for desktop navigation, active route, mobile open/close, escape, focus return, reduced motion, organization name overflow, and 320px viewport no-horizontal-scroll contract.
- [ ] Use `min-h-[100dvh]`, never `h-screen`. Backdrop blur is allowed only on the fixed mobile overlay/nav.
- [ ] Avoid an edge-glued generic topbar; the shell should feel like a contained operational instrument.
- [ ] Run named tests and commit with `feat(web): rebuild responsive workspace shell`.

### Task 5: Compose the premium overview

**Files:**
- Modify: `apps/web/src/features/dashboard/components/dashboard-overview.tsx`
- Modify: `apps/web/src/features/dashboard/components/metric-tile.tsx`
- Modify: `apps/web/src/features/dashboard/components/conversation-leads.tsx`
- Modify: `apps/web/src/features/dashboard/components/booking-requests.tsx`
- Modify: `apps/web/src/features/dashboard/components/dashboard-panel.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-overview.test.tsx`
- Test: `apps/web/src/features/dashboard/components/metric-tile.test.tsx`
- Test: `apps/web/src/features/dashboard/components/conversation-leads.test.tsx`
- Test: `apps/web/src/features/dashboard/components/booking-requests.test.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-panel.test.tsx`
- Test: `apps/web/src/features/dashboard/components/dashboard-rendering.test.tsx`

**Component contracts:**
- `DashboardOverview` uses a 12-column asymmetric layout: primary lead-priority area spans 8 columns and booking/follow-up rail spans 4; mobile resets to one column.
- `MetricTile` is typography-first, not a generic card; all numbers use Geist Mono and accessible labels.
- `ConversationLeads` uses semantic list/table behavior and `MotionList` only for actual reorder/filter transitions.
- `BookingRequests` exposes pending/empty/error/loading states and never fakes confirmed appointments.

- [ ] Use organic test fixtures such as `Amara Okonkwo`, `Theo Whitfield`, and non-round metrics; ban John/Jane Doe, Acme, and placeholder percentages.
- [ ] Test success, loading, empty, API error, forbidden, and stale/conflict states for the composed overview.
- [ ] Test layout class contracts at desktop/mobile and keyboard access to every lead/booking action.
- [ ] Keep major section labels outside elevated surface cores where the hierarchy remains understandable.
- [ ] Run dashboard tests and commit with `feat(web): compose premium lead overview`.

### Task 6: Add visual, accessibility, and performance gates

**Files:**
- Create: `apps/web/e2e/dashboard-visual.spec.ts`
- Create: `apps/web/e2e/dashboard-accessibility.spec.ts`
- Create: `apps/web/e2e/dashboard-responsive.spec.ts`
- Create: `apps/web/e2e/fixtures/dashboard-fixtures.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `docs/superpowers/plans/multi-tenant-plans/evidence/05a-dashboard-visual-review.md`
- Modify: `apps/web/package.json`

- [ ] Inspect `apps/web/package.json`; because Playwright is absent, run `npm view @playwright/test version`, install that exact version as an `@leadpilot/web` dev dependency, run its browser install command, and commit the lockfile with this task.
- [ ] Configure four named projects in `apps/web/playwright.config.ts`: `desktop-wide` (`1440×1024`), `desktop-compact` (`1024×768`), `tablet` (`768×1024`), and `mobile` (`390×844`). Set `snapshotPathTemplate` to `e2e/__screenshots__/{projectName}/{arg}{ext}` so snapshot locations are deterministic.
- [ ] Capture deterministic screenshots at `1440×1024`, `1024×768`, `768×1024`, and `390×844` for overview success, loading, empty, error, and mobile navigation states.
- [ ] Store snapshots in the Playwright-configured snapshot directory; do not loosen pixel thresholds to accept regressions.
- [ ] Test WCAG AA contrast, visible focus, landmark/heading order, labels, keyboard-only navigation, 44px mobile touch targets, reduced motion, and zero horizontal overflow.
- [ ] Record dependency verification, archetypes, palette, typography, motion, screenshot paths, and every manual visual finding in the evidence file.
- [ ] Run `npm test -w @leadpilot/web`, web typecheck/build, and the three named E2E specs; require PASS.
- [ ] Run the two skill preflight checklists and record each item pass/fail. Any fail blocks Plan 06.
- [ ] Commit with `test(web): enforce dashboard visual quality`.
