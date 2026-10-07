# EduSentrix Light/Dark Theme Migration — Master Specification & Progress Tracker

**Document status:** Planning authority for the app-wide light/dark theme migration  
**Source snapshot inspected:** `edusentrix-web-nextjs copy(6)` (2026-10-06)  
**Primary visual reference:** approved light-mode landing-page mockup derived from `https://demo.tryedusentrix.app/`  
**Default theme:** Light  
**Alternate theme:** Dark (preserve the current dark visual identity)  
**Execution model:** Page-by-page, with shared components migrated exactly once

---

## 1. Objective

Migrate EduSentrix from a dark-first interface into a true dual-theme product:

- **Light mode becomes the default.**
- **Dark mode remains available** and should preserve the current premium dark look as closely as practical.
- Add a **persistent theme switcher** that works across marketing, authentication, admin, teacher, parent, student, platform, public transactional, and onboarding surfaces.
- Apply the approved light-mode aesthetic app-wide:
  - white / very-light off-white page canvas;
  - subtle cyan/violet ambient gradients;
  - translucent white glass surfaces;
  - delicate cool-gray/lavender borders;
  - soft shadows rather than heavy dark shadows;
  - dark navy/charcoal primary text;
  - muted slate secondary text;
  - EduSentrix purple/cyan/emerald accents preserved;
  - readable, accessible contrast;
  - restrained, professional school-SaaS visual language.
- Execute the migration **one page at a time** until every route is covered.
- When a page contains dialogs, drawers, sheets, popovers, tables, dropdowns, date pickers, toasts, forms, charts, empty states, loaders, tooltips, or other UI that appears from that page, those surfaces are part of that page's completion criteria.

This is a **theme-system migration and UI consistency pass**, not a rewrite of business logic.

---

## 2. Current codebase findings that govern this migration

The inspected snapshot contains:

- **309 `page.tsx` routes**.
- **30 layouts**.
- **42 shared primitives** under `src/components/ui`.
- Tailwind CSS v4 and Radix-based/shadcn-style components.
- The app is currently **dark-first at the global token level**:
  - `:root { color-scheme: dark; ... }` in `src/app/globals.css`;
  - `body` uses `bg-bg text-white`;
  - `.dark` currently mirrors the same dark token values as `:root`.
- `next-themes` is **not currently present** in `package.json`.
- Many shared and page-specific components use hardcoded dark-mode utilities such as `text-white`, `border-white/10`, `bg-black/...`, `bg-neutral-950`, and `bg-white/5`.
- Shared components such as `responsive-modal.tsx`, `custom-date-picker.tsx`, `premium-select.tsx`, `premium-dropdown-menu.tsx`, `premium.ts`, `workspace-page-header.tsx`, and others are currently strongly dark-specific.
- `src/app/page.tsx` and `src/components/marketing/SiteNav.tsx` are dark-specific and are the first approved visual conversion target.
- `/sign-in` and `/sign-up` are large custom Clerk Elements flows with many dark-specific styles and **must be included**. They are not to be skipped because they are authentication pages.
- `/enroll` is also a large dark-specific public flow and is explicitly in scope.
- `(public)/authentication/login` currently redirects to `/sign-in`; it still remains in the route inventory for regression verification.

---

## 3. Non-negotiable invariant: shared components are migrated once

### 3.1 First-Touch Ownership Rule

When an agent encounters a **shared component** for the first time while converting a page:

1. Check the **Shared Component Migration Registry** in this document.
2. If the component is `NOT_STARTED`, that page becomes the component's **First-Touch Owner**.
3. Migrate the shared component at its source file so it supports both themes.
4. Find its known consumers (`rg`, imports, or IDE references) and perform a quick regression check.
5. Mark the component `THEME_COMPLETE` in the registry with:
   - first-touch page;
   - source file;
   - date/commit if known;
   - notes.
6. Continue the page migration.

### 3.2 When the same component appears on a later page

**Do not restyle it again.**

The later page must:

- use the already migrated shared component;
- verify it renders correctly in light and dark mode;
- change only page-local composition or props if necessary.

The agent must **not** add page-specific color overrides merely because the component is being encountered again.

### 3.3 If an already-migrated shared component is genuinely wrong

Treat it as a **shared-component regression**, not a new page customization:

1. Reopen the shared component's registry entry.
2. Fix the shared component once at its source.
3. Recheck known consumers.
4. Add a short registry changelog note.
5. Never fork visual styling per page unless the design semantics are truly different.

### 3.4 What counts as shared

A component is shared if any of these are true:

- it lives in `src/components/ui`;
- it is imported by more than one page/component;
- it is part of a global shell/navigation/header/sidebar;
- it is a reusable modal/dialog/sheet/popover/dropdown/toast;
- it is a reusable chart/table/form/field wrapper;
- it is a reusable domain component used across multiple routes.

A page-local component used only by one route may be migrated with that page and does not need a permanent registry entry unless it later becomes shared.

---

## 4. Theme architecture to establish before page migration

### 4.1 Theme provider

Preferred implementation: use `next-themes` (or an equivalently robust class-based provider if the team chooses not to add the dependency).

Required behavior:

- apply `light` / `dark` class to `<html>`;
- `defaultTheme="light"`;
- do **not** let OS preference override the requirement that first-time users default to light;
- persist the user's explicit choice;
- avoid hydration mismatch / flash of the wrong theme;
- add `suppressHydrationWarning` where required by App Router theme class hydration.

### 4.2 One shared theme switcher

Create one reusable component, e.g. `ThemeToggle` / `ThemeSwitcher`.

It must be used, not reimplemented, in:

- marketing `SiteNav`;
- authenticated `AppTopbar`;
- authentication screens (`/sign-in`, `/sign-up`);
- enrol/onboarding/public shells where appropriate;
- mobile navigation equivalents.

The switcher itself is a **shared component and must be migrated/implemented once**.

### 4.3 Semantic token contract

Do not convert 309 pages by scattering `dark:` overrides everywhere. Establish semantic tokens first.

At minimum define theme-aware equivalents for:

- app canvas/background;
- elevated canvas;
- card/surface;
- glass surface;
- stronger glass surface;
- foreground / primary text;
- secondary text;
- muted text;
- soft border;
- stronger border;
- input background/border;
- popover/dropdown background;
- destructive/warning/success/info surfaces;
- focus ring;
- page ambient gradient;
- soft and elevated shadows;
- chart grid/axis/tooltip colors.

`src/app/globals.css` should define **light values in `:root`** and preserve the current dark palette under `.dark`.

### 4.4 Approved light visual language

The approved landing-page mockup is the visual target. Light mode should generally use:

- canvas: `#ffffff` to very light cool off-white;
- strong text: near-black / deep navy, not pure black everywhere;
- muted text: slate gray;
- glass cards: translucent white with backdrop blur;
- borders: cool gray/lavender at low opacity;
- shadows: soft, diffuse, low-opacity blue/gray;
- ambient decoration: very pale violet/cyan radial glows;
- brand actions: purple gradient and cyan outline/accent;
- green success badges remain green, adjusted for light contrast.

Dark mode should remain recognizably the existing EduSentrix look.

### 4.5 Hardcoded-color rule

During a page/component migration:

- replace structural hardcoded dark colors with semantic theme tokens/classes;
- use explicit brand colors only when the color is semantically brand-specific;
- do not mechanically replace every `text-white` with `text-black`;
- do not create light mode by stacking hundreds of one-off `dark:` classes where a semantic shared token is appropriate.

---

## 5. Authentication is explicitly in scope

The following flows are first-class migration targets and **must not be omitted**:

- `/sign-in/[[...sign-in]]`
- `/sign-up/[[...sign-up]]`
- `/enroll`
- `/account/set-password`
- `/auth/switch`
- `/onboard`
- `/launch`
- `/legal/accept`
- `/authentication/login` redirect verification
- any Clerk error/session-conflict UI shown from these routes

### Sign-in / sign-up acceptance details

The custom Clerk Elements flows contain multiple states. Every state must be checked in both themes, including where present:

- initial identifier/email form;
- password form;
- OTP / verification code form;
- forgot/reset password flow;
- strategy selection;
- Google/SSO buttons;
- invitation flows;
- password visibility buttons;
- loading states;
- global and field errors;
- success/confirmation states;
- back actions;
- session conflict card;
- development-only login panel if enabled;
- mobile and desktop brand panels.

A sign-in page is not complete merely because its first screen looks correct.

---

## 6. Page-by-page execution protocol for AI agents

For **every page**, agents must follow this exact sequence.

### Step A — Read tracking state

Before editing:

- locate the page in the Page Migration Tracker;
- read its current status;
- review the Shared Component Migration Registry;
- do not modify a component already marked `THEME_COMPLETE` unless a real shared regression is found.

### Step B — Inventory the page

Record:

- page file;
- layout/shell it uses;
- imported shared components;
- page-local components;
- dialogs/modals/sheets/popovers/dropdowns launched from the page;
- tables/charts/forms/date pickers/tooltips;
- loading/empty/error/success states;
- portal-rendered surfaces that may not be visible at initial load.

### Step C — First-touch shared components

For each shared component encountered:

- migrate only if registry says `NOT_STARTED`;
- otherwise verify only.

### Step D — Migrate page-local styling

Apply semantic theme classes/tokens. Preserve information hierarchy and business behavior.

### Step E — Update attached page surfaces

Open and inspect every user-triggered surface reachable from the page:

- dialogs;
- confirmation dialogs;
- responsive modals;
- sheets/drawers;
- dropdown menus;
- selects;
- date pickers/calendars;
- popovers;
- tooltips;
- toasts;
- command palettes;
- upload dialogs;
- inline editors;
- chart tooltips;
- rich text surfaces.

If the surface is shared and already complete, verify rather than restyle.

### Step F — Verify both modes

Check:

- light desktop;
- dark desktop;
- light mobile/narrow viewport;
- dark mobile/narrow viewport;
- keyboard focus;
- hover/active/disabled states;
- no unreadable text;
- no dark-only blank panels in light mode;
- no light-only glaring panels in dark mode.

### Step G — Update progress immediately

Mark the page status and shared registry before ending the task.

---

## 7. Status vocabulary

Use only these statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `THEME_COMPLETE`
- `NEEDS_REVIEW`
- `BLOCKED`

A page may be `THEME_COMPLETE` only if its attached interactive surfaces have also been checked.

---

## 8. Shared Component Migration Registry

This registry is authoritative. **An agent must consult it before touching shared styling.**

### 8.1 Global shell / navigation components

| Component / area | Source | Status | First-touch page | Notes |
|---|---|---|---|---|
| Root theme provider | `src/app/layout.tsx`, `src/providers/theme-provider.tsx` | THEME_COMPLETE | `/` | Light default, class on `<html>`, OS preference ignored, choice stored as `edusentrix-theme`. Global shadcn tokens unchanged. |
| Global theme tokens | `src/app/globals.css` | IN_PROGRESS | `/` | Marketing tokens (`--m-*`) are light on `:root` and dark under `.dark`. Existing shadcn palette is still dark in both. |
| Theme switcher | `src/components/theme/ThemeToggle.tsx` | THEME_COMPLETE | `/` | Used in `SiteNav` desktop and mobile menu |
| Marketing navigation | `src/components/marketing/SiteNav.tsx` | THEME_COMPLETE | `/` | Includes shared theme toggle and BrandMark |
| Authenticated topbar | `src/components/app/AppTopbar.tsx` | THEME_COMPLETE | `/admin` | `m-header`, shared `ThemeToggle`, and school brand. Page bodies stay dark |
| Topbar user menu | `src/components/app/AppTopbarUserMenu.tsx` | THEME_COMPLETE | `/admin` | Portaled menu uses marketing tokens. Sign-out behavior unchanged |
| School brand | `src/components/brand/SchoolBrand.tsx` | THEME_COMPLETE | `/admin` | Logo tile follows `--m-logo-bg` |
| EduSentrix wordmark | `src/components/brand/EduSentrixWordmark.tsx` | THEME_COMPLETE | `/` | `tone="adaptive"` follows marketing foreground; gradient tone unchanged |
| Brand mark | `src/components/brand/BrandMark.tsx` | THEME_COMPLETE | `/` | Transparent logo on a white tile in light mode and a dark glass tile in dark mode |
| Auth surfaces | `src/components/auth/auth-surfaces.ts` | THEME_COMPLETE | `/sign-in` | Shared input, code, strategy, button, and glow classes for sign-in, sign-up, and enrol |
| Session conflict card | `src/components/auth/AuthSessionConflictCard.tsx` | THEME_COMPLETE | `/sign-in` | Also rendered by `/sign-up` |
| Responsive modal | `src/components/modals/ResponsiveModal.tsx` | THEME_COMPLETE | `/enroll` | Marketing tokens. The authenticated app shell is locked to `.dark`, so admin modals keep the dark look. `src/components/ui/responsive-modal.tsx` is unchanged |
| Legal acceptance modal | `src/components/legal/LegalAcceptanceModal.tsx` | THEME_COMPLETE | `/enroll` | Footer actions follow marketing tokens. `LegalDocumentBody` uses `surface="theme"` here and on `/privacy` and `/terms` |
| Public marketing nav | `src/components/marketing/PublicMarketingNav.tsx` | THEME_COMPLETE | `/about` | Shared by about, contact, privacy, and terms. BrandMark, ThemeToggle, and marketing header tokens |
| Public marketing footer | `src/components/marketing/PublicMarketingFooter.tsx` | THEME_COMPLETE | `/about` | Shared by about, contact, privacy, and terms |
| Public contact form | `src/components/marketing/PublicContactForm.tsx` | THEME_COMPLETE | `/contact` | Auth field classes. Select menu overrides are local. Form was not submitted |
| Launch wizard | `src/components/onboarding/LaunchWizard.tsx` | THEME_COMPLETE | `/onboard` | Also `/launch`. Platform school onboarding keeps dark portaled selects and the dark date picker |
| App shell theme lock | `src/app/(app)/layout.tsx` | THEME_COMPLETE | `/admin` | `.dark` wraps the page column (`AdminMainContent`, student main, `/docs`, `/profile`), not the top bar or sidebars. `/bursar` redirects into admin finance |
| Demo banner | `src/components/demo/DemoBanner.tsx` | NOT_STARTED | demo landing/app | Verify both themes |
| Navigation sidebars | `src/components/nav/sidebars/*`, `src/components/platform/PlatformSidebar.tsx` | THEME_COMPLETE | `/admin` | Admin, bursar, billing owner, delegated, teacher, parent, student, and platform frames follow the shell theme. Nav routes unchanged |

### 8.2 Shared UI primitives

The following files exist under `src/components/ui` and are first-touch governed:

| `accordion.tsx` | `src/components/ui/accordion.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `alert.tsx` | `src/components/ui/alert.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `avatar.tsx` | `src/components/ui/avatar.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `badge.tsx` | `src/components/ui/badge.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `button.tsx` | `src/components/ui/button.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `calendar.tsx` | `src/components/ui/calendar.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `card.tsx` | `src/components/ui/card.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `checkbox.tsx` | `src/components/ui/checkbox.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `coming-soon-panel.tsx` | `src/components/ui/coming-soon-panel.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `coming-soon-state.tsx` | `src/components/ui/coming-soon-state.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `command.tsx` | `src/components/ui/command.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `confirmation-dialog.tsx` | `src/components/ui/confirmation-dialog.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `custom-date-picker.tsx` | `src/components/ui/custom-date-picker.tsx` | NOT_STARTED | `/onboard` | Optional `surface="theme"` added. Default remains the dark picker so admin calendars stay unchanged |
| `dialog.tsx` | `src/components/ui/dialog.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `dropdown-menu.tsx` | `src/components/ui/dropdown-menu.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `ghana-phone-input.tsx` | `src/components/ui/ghana-phone-input.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `glass-panel.tsx` | `src/components/ui/glass-panel.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `html-content.tsx` | `src/components/ui/html-content.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `image-upload.tsx` | `src/components/ui/image-upload.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `input.tsx` | `src/components/ui/input.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `label.tsx` | `src/components/ui/label.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `metric-info-tip.tsx` | `src/components/ui/metric-info-tip.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `popover.tsx` | `src/components/ui/popover.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `premium-dropdown-menu.tsx` | `src/components/ui/premium-dropdown-menu.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `premium-select.tsx` | `src/components/ui/premium-select.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `premium.ts` | `src/components/ui/premium.ts` | NOT_STARTED | `/admin` | `premiumSideItem`, `premiumSideItemActive`, and `premiumTopLink` follow shell tokens. Menu and select classes stay dark |
| `progress.tsx` | `src/components/ui/progress.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `prompt-dialog.tsx` | `src/components/ui/prompt-dialog.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `radio-group.tsx` | `src/components/ui/radio-group.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `responsive-modal.tsx` | `src/components/ui/responsive-modal.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `rich-text-editor.tsx` | `src/components/ui/rich-text-editor.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `select.tsx` | `src/components/ui/select.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `separator.tsx` | `src/components/ui/separator.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `sheet.tsx` | `src/components/ui/sheet.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `skeleton.tsx` | `src/components/ui/skeleton.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `switch.tsx` | `src/components/ui/switch.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `table.tsx` | `src/components/ui/table.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `tabs.tsx` | `src/components/ui/tabs.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `textarea.tsx` | `src/components/ui/textarea.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `tooltip.tsx` | `src/components/ui/tooltip.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `workspace-page-header.tsx` | `src/components/ui/workspace-page-header.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |
| `workspace-page-shell.tsx` | `src/components/ui/workspace-page-shell.tsx` | NOT_STARTED | — | Migrate once; later pages verify only |


### 8.3 Other shared component directories

When a reusable component is first encountered in any of these areas, add it to this registry before changing its theme styles:

- `src/components/common`
- `src/components/modals`
- `src/components/dashboard`
- `src/components/admin/**`
- `src/components/teacher/**`
- `src/components/parent/**`
- `src/components/student/**`
- `src/components/platform/**`
- `src/components/academics/**`
- `src/components/fees/**` where applicable
- `src/components/examinations/**`
- `src/components/library/**`
- `src/components/meetings/**`
- `src/components/lesson-notes/**`
- `src/components/lessons/**`
- `src/components/schemes/**`
- `src/components/timetable/**`
- `src/components/community/**`
- `src/components/learn/**`
- `src/components/email/**`
- `src/components/admissions/**`

The registry is intentionally extensible because not every reusable domain component should be pre-migrated before a page actually needs it.

---

## 9. Recommended rollout order

Do not attempt a global find/replace across the entire application.

### Cycle 0 — Theme foundation

- provider and persistence;
- light/dark semantic tokens;
- `ThemeToggle`;
- body/root color-scheme behavior;
- shared glass utility classes;
- global focus/scrollbar/prose styles;
- baseline chart/token strategy;
- no business-page redesign yet.

### Cycle 1 — Marketing + authentication

Start here because the approved visual reference is the landing page and these routes are highly visible:

1. `/`
2. `SiteNav` and footer/marketing shared components encountered there
3. `/sign-in/[[...sign-in]]`
4. `/sign-up/[[...sign-up]]`
5. `/enroll`
6. `/account/set-password`
7. `/auth/switch`
8. `/onboard`
9. `/launch`
10. `/legal/accept`
11. supporting public marketing pages (`/about`, `/contact`, `/privacy`, `/terms`)

### Cycle 2 — Authenticated global shell + highest-value admin pages

Theme the app chrome once, then proceed page-by-page through `/admin`, students, fees, teachers, classes, academics, reports, communications, settings.

### Cycle 3 — Remaining admin modules

Finance, examinations, library, admissions, community, Learn management, lesson/scheme operations, subscriptions, supplies, etc.

### Cycle 4 — Teacher app

Start with teacher shell/dashboard, then attendance, students/classes, gradebook/marks, schemes, lesson notes, lessons, communications, exams, Studio, Learn, library, meetings, settings.

### Cycle 5 — Parent app

Parent shell/dashboard, wards, academics, attendance, fees/payments/receipts, reports, messages, meetings, library, store/supplies, Learn.

### Cycle 6 — Student app

Student shell/dashboard, assignments, lessons, timetable, results, exams, library, notices, profile/calendar.

### Cycle 7 — Platform administration

Platform shell and all platform operations/subscription/implementation/proposal/staff/settings pages.

### Cycle 8 — Public transactional/application routes + remaining authenticated routes

Applications, donation/payment-return, verification, upload, school onboarding, bursar/docs/profile, etc.

### Cycle 9 — Whole-app visual audit

Use code search and runtime route traversal to find missed dark-only styling and shared-surface regressions.

---

## 10. Design acceptance criteria

### Light mode

A page is visually acceptable only when:

- the main canvas is white or light off-white;
- glass elements remain clearly visible against the white canvas;
- primary text is dark navy/charcoal;
- muted text remains readable;
- borders are subtle but distinguish surfaces;
- cards do not disappear into the background;
- shadows are soft and premium, not muddy;
- purple/cyan brand accents remain intentional;
- tables, charts and forms do not look like pasted dark-mode fragments;
- modal overlays and dialog surfaces are coherent with the light theme.

### Dark mode

A page is acceptable only when:

- the current EduSentrix dark identity remains intact;
- converting to semantic tokens did not wash out cards or typography;
- overlays/dropdowns remain legible;
- no light-only white cards appear unexpectedly;
- chart axes/tooltips remain readable.

### Accessibility

- do not rely on color alone to communicate status;
- maintain WCAG-appropriate text contrast wherever practical;
- preserve keyboard focus visibility in both themes;
- do not remove semantic labels/ARIA behavior while restyling.

---

## 11. Testing and validation requirements

For each migration slice:

- targeted lint on changed TS/TSX;
- relevant tests;
- TypeScript/build before merging a meaningful batch;
- visual inspection of both themes;
- no business logic or authorization regressions.

At phase boundaries run:

```bash
npm test
npm run build
```

Also search periodically for remaining dark-only assumptions, for example:

```bash
rg -n 'text-white|bg-neutral-950|bg-black|border-white/|bg-white/[0-9]' src/app src/components
```

Do not treat every match as wrong; brand/overlay semantics can legitimately use explicit colors. The goal is to identify un-migrated structural styling.

---

## 12. AI agent completion report format

Every agent must report:

### Page(s) completed
- route
- source file(s)

### Shared components first-touched
- component
- source
- registry status change

### Already-migrated shared components verified
- list only; do not claim they were reimplemented

### Attached surfaces checked
- modal/dialog/sheet/dropdown/date picker/table/chart/etc.

### Theme verification
- light desktop
- dark desktop
- light mobile
- dark mobile

### Validation
- lint/tests/build as applicable

### Tracker update
- page status updated
- shared component registry updated

### Limitations / follow-up
- anything not verified

---

## 13. Page Migration Tracker

**Tracker rule:** `THEME_COMPLETE` means the page itself **and every reachable page-specific surface** have been verified. Shared components should be referenced, not re-migrated.


### Marketing / auth / root (15 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/403` | `src/app/403/page.tsx` |  |
| THEME_COMPLETE | `/about` | `src/app/about/page.tsx` | Marketing shell, nav, and footer. Learn mark image unchanged. |
| THEME_COMPLETE | `/account/set-password` | `src/app/account/set-password/page.tsx` | Shell themed. Clerk `UserProfile` appearance follows the resolved theme. `routing="path"` and `path="/account"` unchanged. Live session required to open the password fields. |
| THEME_COMPLETE | `/auth/switch` | `src/app/auth/switch/page.tsx` | Loading and school-picker cards themed. `/api/me` and `/api/auth/active-school` unchanged. |
| THEME_COMPLETE | `/contact` | `src/app/contact/page.tsx` | Public contact form themed. Form was not submitted. |
| NOT_STARTED | `/dashboard` | `src/app/dashboard/page.tsx` |  |
| THEME_COMPLETE | `/enroll` | `src/app/enroll/page.tsx` | Form, success view, selects, checkboxes, and terms/privacy modal. Real application was not submitted. |
| THEME_COMPLETE | `/launch` | `src/app/launch/page.tsx` | Re-exports the school launch wizard. Full steps need a signed-in school invite. |
| THEME_COMPLETE | `/legal/accept` | `src/app/legal/accept/page.tsx` | Card, checkbox, and links themed. Violet Accept button kept. Acceptance was not submitted. |
| THEME_COMPLETE | `/onboard` | `src/app/onboard/page.tsx` | Launch wizard shells and fields. Full steps need a signed-in school invite. |
| THEME_COMPLETE | `/` | `src/app/page.tsx` | Light default matches the approved hero. First-touch: `BrandMark`, `ThemeToggle`, `MarketingHeroPreview`, `SiteNav`. Demo mode still renders `DemoLandingPage`. |
| THEME_COMPLETE | `/privacy` | `src/app/privacy/page.tsx` | `LegalDocumentBody` uses `surface="theme"`. |
| THEME_COMPLETE | `/sign-in/[[...sign-in]]` | `src/app/sign-in/[[...sign-in]]/page.tsx` | Start screen verified in the browser. Password, email-code, other strategies, forgot-password, reset-password, and choose-strategy share the auth surface classes. Session conflict, school-disabled, and multi-school banners are themed. Live Clerk account required to open those later steps. |
| THEME_COMPLETE | `/sign-up/[[...sign-up]]` | `src/app/sign-up/[[...sign-up]]/page.tsx` | Start screen verified in the browser. Continue, verifications, restricted, and invitation-preparing states share the auth surface classes. Live Clerk invite required to open those later steps. |
| THEME_COMPLETE | `/terms` | `src/app/terms/page.tsx` | `LegalDocumentBody` uses `surface="theme"`. |

### School onboarding (1 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/onboarding` | `src/app/(school)/onboarding/page.tsx` |  |

### Other authenticated (3 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/bursar` | `src/app/(app)/bursar/page.tsx` |  |
| NOT_STARTED | `/docs` | `src/app/(app)/docs/page.tsx` |  |
| NOT_STARTED | `/profile` | `src/app/(app)/profile/page.tsx` |  |

### Admin (116 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/admin/academic-calendar` | `src/app/(app)/admin/academic-calendar/page.tsx` |  |
| NOT_STARTED | `/admin/academics/assessment-plans` | `src/app/(app)/admin/academics/assessment-plans/page.tsx` |  |
| NOT_STARTED | `/admin/academics/grading` | `src/app/(app)/admin/academics/grading/page.tsx` |  |
| NOT_STARTED | `/admin/admissions/[cycleId]` | `src/app/(app)/admin/admissions/[cycleId]/page.tsx` |  |
| NOT_STARTED | `/admin/admissions` | `src/app/(app)/admin/admissions/page.tsx` |  |
| NOT_STARTED | `/admin/background-tasks` | `src/app/(app)/admin/background-tasks/page.tsx` |  |
| NOT_STARTED | `/admin/classes/[classId]` | `src/app/(app)/admin/classes/[classId]/page.tsx` |  |
| NOT_STARTED | `/admin/classes` | `src/app/(app)/admin/classes/page.tsx` |  |
| NOT_STARTED | `/admin/communications` | `src/app/(app)/admin/communications/page.tsx` |  |
| NOT_STARTED | `/admin/community/fundraising/[id]/donations` | `src/app/(app)/admin/community/fundraising/[id]/donations/page.tsx` |  |
| NOT_STARTED | `/admin/community/fundraising/[id]` | `src/app/(app)/admin/community/fundraising/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/community/fundraising` | `src/app/(app)/admin/community/fundraising/page.tsx` |  |
| NOT_STARTED | `/admin/community` | `src/app/(app)/admin/community/page.tsx` |  |
| NOT_STARTED | `/admin/community/polls/[id]` | `src/app/(app)/admin/community/polls/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/community/polls` | `src/app/(app)/admin/community/polls/page.tsx` |  |
| NOT_STARTED | `/admin/curricula/[id]` | `src/app/(app)/admin/curricula/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/curricula` | `src/app/(app)/admin/curricula/page.tsx` |  |
| NOT_STARTED | `/admin/delegations` | `src/app/(app)/admin/delegations/page.tsx` |  |
| NOT_STARTED | `/admin/docs` | `src/app/(app)/admin/docs/page.tsx` |  |
| NOT_STARTED | `/admin/documents` | `src/app/(app)/admin/documents/page.tsx` |  |
| NOT_STARTED | `/admin/email` | `src/app/(app)/admin/email/page.tsx` |  |
| NOT_STARTED | `/admin/examinations/[examPaperId]` | `src/app/(app)/admin/examinations/[examPaperId]/page.tsx` |  |
| NOT_STARTED | `/admin/examinations` | `src/app/(app)/admin/examinations/page.tsx` |  |
| NOT_STARTED | `/admin/exams/analytics` | `src/app/(app)/admin/exams/analytics/page.tsx` |  |
| NOT_STARTED | `/admin/exams/sessions/[sessionId]/conflicts` | `src/app/(app)/admin/exams/sessions/[sessionId]/conflicts/page.tsx` |  |
| NOT_STARTED | `/admin/exams/sessions/[sessionId]/timetable` | `src/app/(app)/admin/exams/sessions/[sessionId]/timetable/page.tsx` |  |
| NOT_STARTED | `/admin/exams/sessions` | `src/app/(app)/admin/exams/sessions/page.tsx` |  |
| NOT_STARTED | `/admin/exams/venues` | `src/app/(app)/admin/exams/venues/page.tsx` |  |
| NOT_STARTED | `/admin/expenses/[id]` | `src/app/(app)/admin/expenses/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/expenses` | `src/app/(app)/admin/expenses/page.tsx` |  |
| NOT_STARTED | `/admin/fees/invoices/[id]` | `src/app/(app)/admin/fees/invoices/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/fees/invoices/new` | `src/app/(app)/admin/fees/invoices/new/page.tsx` |  |
| NOT_STARTED | `/admin/fees/invoices` | `src/app/(app)/admin/fees/invoices/page.tsx` |  |
| NOT_STARTED | `/admin/fees` | `src/app/(app)/admin/fees/page.tsx` |  |
| NOT_STARTED | `/admin/fees/payments/record` | `src/app/(app)/admin/fees/payments/record/page.tsx` |  |
| NOT_STARTED | `/admin/fees/structures` | `src/app/(app)/admin/fees/structures/page.tsx` |  |
| NOT_STARTED | `/admin/finance/budgets/create` | `src/app/(app)/admin/finance/budgets/create/page.tsx` |  |
| NOT_STARTED | `/admin/finance/budgets` | `src/app/(app)/admin/finance/budgets/page.tsx` |  |
| NOT_STARTED | `/admin/finance/cash-close` | `src/app/(app)/admin/finance/cash-close/page.tsx` |  |
| NOT_STARTED | `/admin/finance/disbursements` | `src/app/(app)/admin/finance/disbursements/page.tsx` |  |
| NOT_STARTED | `/admin/finance/meetings/[meetingId]` | `src/app/(app)/admin/finance/meetings/[meetingId]/page.tsx` |  |
| NOT_STARTED | `/admin/finance/meetings` | `src/app/(app)/admin/finance/meetings/page.tsx` |  |
| NOT_STARTED | `/admin/finance` | `src/app/(app)/admin/finance/page.tsx` |  |
| NOT_STARTED | `/admin/finance/payments` | `src/app/(app)/admin/finance/payments/page.tsx` |  |
| NOT_STARTED | `/admin/finance/receipts` | `src/app/(app)/admin/finance/receipts/page.tsx` |  |
| NOT_STARTED | `/admin/finance/reconciliation` | `src/app/(app)/admin/finance/reconciliation/page.tsx` |  |
| NOT_STARTED | `/admin/finance/reconciliation/sessions/[id]` | `src/app/(app)/admin/finance/reconciliation/sessions/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/finance/reconciliation/sessions/new` | `src/app/(app)/admin/finance/reconciliation/sessions/new/page.tsx` |  |
| NOT_STARTED | `/admin/finance/reconciliation/sessions` | `src/app/(app)/admin/finance/reconciliation/sessions/page.tsx` |  |
| NOT_STARTED | `/admin/finance/reports` | `src/app/(app)/admin/finance/reports/page.tsx` |  |
| NOT_STARTED | `/admin/finance/transactions/[id]` | `src/app/(app)/admin/finance/transactions/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/finance/transactions` | `src/app/(app)/admin/finance/transactions/page.tsx` |  |
| NOT_STARTED | `/admin/grades/[gradeId]` | `src/app/(app)/admin/grades/[gradeId]/page.tsx` |  |
| NOT_STARTED | `/admin/grades` | `src/app/(app)/admin/grades/page.tsx` |  |
| NOT_STARTED | `/admin/invitations` | `src/app/(app)/admin/invitations/page.tsx` |  |
| NOT_STARTED | `/admin/learn/accounts` | `src/app/(app)/admin/learn/accounts/page.tsx` |  |
| NOT_STARTED | `/admin/learn/activity` | `src/app/(app)/admin/learn/activity/page.tsx` |  |
| NOT_STARTED | `/admin/learn/eligible-students` | `src/app/(app)/admin/learn/eligible-students/page.tsx` |  |
| NOT_STARTED | `/admin/learn/explore-content/[adventureId]` | `src/app/(app)/admin/learn/explore-content/[adventureId]/page.tsx` |  |
| NOT_STARTED | `/admin/learn/explore-content` | `src/app/(app)/admin/learn/explore-content/page.tsx` |  |
| NOT_STARTED | `/admin/learn` | `src/app/(app)/admin/learn/page.tsx` |  |
| NOT_STARTED | `/admin/learn/settings` | `src/app/(app)/admin/learn/settings/page.tsx` |  |
| NOT_STARTED | `/admin/lesson-notes/[id]` | `src/app/(app)/admin/lesson-notes/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/lesson-notes` | `src/app/(app)/admin/lesson-notes/page.tsx` |  |
| NOT_STARTED | `/admin/lesson-notes/review` | `src/app/(app)/admin/lesson-notes/review/page.tsx` |  |
| NOT_STARTED | `/admin/lessons/analytics` | `src/app/(app)/admin/lessons/analytics/page.tsx` |  |
| NOT_STARTED | `/admin/lessons/audit` | `src/app/(app)/admin/lessons/audit/page.tsx` |  |
| NOT_STARTED | `/admin/lessons/sessions/[id]` | `src/app/(app)/admin/lessons/sessions/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/lessons/sessions` | `src/app/(app)/admin/lessons/sessions/page.tsx` |  |
| NOT_STARTED | `/admin/library/books/[bookId]` | `src/app/(app)/admin/library/books/[bookId]/page.tsx` |  |
| NOT_STARTED | `/admin/library/books/new` | `src/app/(app)/admin/library/books/new/page.tsx` |  |
| NOT_STARTED | `/admin/library/books` | `src/app/(app)/admin/library/books/page.tsx` |  |
| NOT_STARTED | `/admin/library/circulation` | `src/app/(app)/admin/library/circulation/page.tsx` |  |
| NOT_STARTED | `/admin/library/history` | `src/app/(app)/admin/library/history/page.tsx` |  |
| NOT_STARTED | `/admin/library/imports` | `src/app/(app)/admin/library/imports/page.tsx` |  |
| NOT_STARTED | `/admin/library/notices` | `src/app/(app)/admin/library/notices/page.tsx` |  |
| NOT_STARTED | `/admin/library/overdue` | `src/app/(app)/admin/library/overdue/page.tsx` |  |
| NOT_STARTED | `/admin/library` | `src/app/(app)/admin/library/page.tsx` |  |
| NOT_STARTED | `/admin/library/reports` | `src/app/(app)/admin/library/reports/page.tsx` |  |
| NOT_STARTED | `/admin/library/reservations` | `src/app/(app)/admin/library/reservations/page.tsx` |  |
| NOT_STARTED | `/admin/library/scan` | `src/app/(app)/admin/library/scan/page.tsx` |  |
| NOT_STARTED | `/admin/library/settings` | `src/app/(app)/admin/library/settings/page.tsx` |  |
| NOT_STARTED | `/admin/meetings/[meetingId]` | `src/app/(app)/admin/meetings/[meetingId]/page.tsx` |  |
| NOT_STARTED | `/admin/meetings` | `src/app/(app)/admin/meetings/page.tsx` |  |
| NOT_STARTED | `/admin/notifications` | `src/app/(app)/admin/notifications/page.tsx` |  |
| NOT_STARTED | `/admin/overdue-report` | `src/app/(app)/admin/overdue-report/page.tsx` |  |
| NOT_STARTED | `/admin` | `src/app/(app)/admin/page.tsx` |  |
| NOT_STARTED | `/admin/periods/[periodId]` | `src/app/(app)/admin/periods/[periodId]/page.tsx` |  |
| NOT_STARTED | `/admin/periods` | `src/app/(app)/admin/periods/page.tsx` |  |
| NOT_STARTED | `/admin/promotions` | `src/app/(app)/admin/promotions/page.tsx` |  |
| NOT_STARTED | `/admin/question-bank` | `src/app/(app)/admin/question-bank/page.tsx` |  |
| NOT_STARTED | `/admin/reconciliation` | `src/app/(app)/admin/reconciliation/page.tsx` |  |
| NOT_STARTED | `/admin/reports/cards/view` | `src/app/(app)/admin/reports/cards/view/page.tsx` |  |
| NOT_STARTED | `/admin/reports` | `src/app/(app)/admin/reports/page.tsx` |  |
| NOT_STARTED | `/admin/reports/report-runs/[id]` | `src/app/(app)/admin/reports/report-runs/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/reports/report-runs` | `src/app/(app)/admin/reports/report-runs/page.tsx` |  |
| NOT_STARTED | `/admin/roles-duties` | `src/app/(app)/admin/roles-duties/page.tsx` |  |
| NOT_STARTED | `/admin/schemes/[id]` | `src/app/(app)/admin/schemes/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/schemes/import` | `src/app/(app)/admin/schemes/import/page.tsx` |  |
| NOT_STARTED | `/admin/schemes` | `src/app/(app)/admin/schemes/page.tsx` |  |
| NOT_STARTED | `/admin/settings/curriculum` | `src/app/(app)/admin/settings/curriculum/page.tsx` |  |
| NOT_STARTED | `/admin/settings/email` | `src/app/(app)/admin/settings/email/page.tsx` |  |
| NOT_STARTED | `/admin/settings` | `src/app/(app)/admin/settings/page.tsx` |  |
| NOT_STARTED | `/admin/settings/payment-setup` | `src/app/(app)/admin/settings/payment-setup/page.tsx` |  |
| NOT_STARTED | `/admin/staff-attendance` | `src/app/(app)/admin/staff-attendance/page.tsx` |  |
| NOT_STARTED | `/admin/store` | `src/app/(app)/admin/store/page.tsx` |  |
| NOT_STARTED | `/admin/students/[studentId]` | `src/app/(app)/admin/students/[studentId]/page.tsx` |  |
| NOT_STARTED | `/admin/students` | `src/app/(app)/admin/students/page.tsx` |  |
| NOT_STARTED | `/admin/subjects/[subjectId]` | `src/app/(app)/admin/subjects/[subjectId]/page.tsx` |  |
| NOT_STARTED | `/admin/subjects` | `src/app/(app)/admin/subjects/page.tsx` |  |
| NOT_STARTED | `/admin/subscription` | `src/app/(app)/admin/subscription/page.tsx` |  |
| NOT_STARTED | `/admin/supplies` | `src/app/(app)/admin/supplies/page.tsx` |  |
| NOT_STARTED | `/admin/tasks` | `src/app/(app)/admin/tasks/page.tsx` |  |
| NOT_STARTED | `/admin/teachers/[id]` | `src/app/(app)/admin/teachers/[id]/page.tsx` |  |
| NOT_STARTED | `/admin/teachers` | `src/app/(app)/admin/teachers/page.tsx` |  |
| NOT_STARTED | `/admin/teachers/reports` | `src/app/(app)/admin/teachers/reports/page.tsx` |  |

### Teacher (75 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/teacher/admissions/[cycleId]` | `src/app/(app)/teacher/admissions/[cycleId]/page.tsx` |  |
| NOT_STARTED | `/teacher/admissions` | `src/app/(app)/teacher/admissions/page.tsx` |  |
| NOT_STARTED | `/teacher/analytics/at-risk` | `src/app/(app)/teacher/analytics/at-risk/page.tsx` |  |
| NOT_STARTED | `/teacher/analytics` | `src/app/(app)/teacher/analytics/page.tsx` |  |
| NOT_STARTED | `/teacher/attendance/history` | `src/app/(app)/teacher/attendance/history/page.tsx` |  |
| NOT_STARTED | `/teacher/attendance/homeroom` | `src/app/(app)/teacher/attendance/homeroom/page.tsx` |  |
| NOT_STARTED | `/teacher/attendance` | `src/app/(app)/teacher/attendance/page.tsx` |  |
| NOT_STARTED | `/teacher/attendance/period` | `src/app/(app)/teacher/attendance/period/page.tsx` |  |
| NOT_STARTED | `/teacher/background-tasks` | `src/app/(app)/teacher/background-tasks/page.tsx` |  |
| NOT_STARTED | `/teacher/calendar` | `src/app/(app)/teacher/calendar/page.tsx` |  |
| NOT_STARTED | `/teacher/classes` | `src/app/(app)/teacher/classes/page.tsx` |  |
| NOT_STARTED | `/teacher/communication/escalations` | `src/app/(app)/teacher/communication/escalations/page.tsx` |  |
| NOT_STARTED | `/teacher/communication/messages/[threadId]` | `src/app/(app)/teacher/communication/messages/[threadId]/page.tsx` |  |
| NOT_STARTED | `/teacher/communication/messages` | `src/app/(app)/teacher/communication/messages/page.tsx` |  |
| NOT_STARTED | `/teacher/communication/notices/new` | `src/app/(app)/teacher/communication/notices/new/page.tsx` |  |
| NOT_STARTED | `/teacher/communication/notices` | `src/app/(app)/teacher/communication/notices/page.tsx` |  |
| NOT_STARTED | `/teacher/coverage` | `src/app/(app)/teacher/coverage/page.tsx` |  |
| NOT_STARTED | `/teacher/examinations/[examPaperId]` | `src/app/(app)/teacher/examinations/[examPaperId]/page.tsx` |  |
| NOT_STARTED | `/teacher/examinations` | `src/app/(app)/teacher/examinations/page.tsx` |  |
| NOT_STARTED | `/teacher/exams` | `src/app/(app)/teacher/exams/page.tsx` |  |
| NOT_STARTED | `/teacher/gradebook/[classGroupId]/[subjectId]` | `src/app/(app)/teacher/gradebook/[classGroupId]/[subjectId]/page.tsx` |  |
| NOT_STARTED | `/teacher/gradebook` | `src/app/(app)/teacher/gradebook/page.tsx` |  |
| NOT_STARTED | `/teacher/homeroom/reports/[classGroupId]` | `src/app/(app)/teacher/homeroom/reports/[classGroupId]/page.tsx` |  |
| NOT_STARTED | `/teacher/homeroom/reports` | `src/app/(app)/teacher/homeroom/reports/page.tsx` |  |
| NOT_STARTED | `/teacher/homeroom/timetable` | `src/app/(app)/teacher/homeroom/timetable/page.tsx` |  |
| NOT_STARTED | `/teacher/journal/[classGroupId]` | `src/app/(app)/teacher/journal/[classGroupId]/page.tsx` |  |
| NOT_STARTED | `/teacher/journal` | `src/app/(app)/teacher/journal/page.tsx` |  |
| NOT_STARTED | `/teacher/learn/activity` | `src/app/(app)/teacher/learn/activity/page.tsx` |  |
| NOT_STARTED | `/teacher/learn/class/[classGroupId]` | `src/app/(app)/teacher/learn/class/[classGroupId]/page.tsx` |  |
| NOT_STARTED | `/teacher/learn/explore-content/[adventureId]` | `src/app/(app)/teacher/learn/explore-content/[adventureId]/page.tsx` |  |
| NOT_STARTED | `/teacher/learn/explore-content` | `src/app/(app)/teacher/learn/explore-content/page.tsx` |  |
| NOT_STARTED | `/teacher/learn` | `src/app/(app)/teacher/learn/page.tsx` |  |
| NOT_STARTED | `/teacher/learn/student/[studentId]/explore` | `src/app/(app)/teacher/learn/student/[studentId]/explore/page.tsx` |  |
| NOT_STARTED | `/teacher/learn/student/[studentId]` | `src/app/(app)/teacher/learn/student/[studentId]/page.tsx` |  |
| NOT_STARTED | `/teacher/lesson-notes/[id]` | `src/app/(app)/teacher/lesson-notes/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/lesson-notes/[id]/preview-week` | `src/app/(app)/teacher/lesson-notes/[id]/preview-week/page.tsx` |  |
| NOT_STARTED | `/teacher/lesson-notes` | `src/app/(app)/teacher/lesson-notes/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/[id]` | `src/app/(app)/teacher/lessons/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/analytics` | `src/app/(app)/teacher/lessons/analytics/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/bank` | `src/app/(app)/teacher/lessons/bank/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/create` | `src/app/(app)/teacher/lessons/create/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons` | `src/app/(app)/teacher/lessons/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/sessions/[id]` | `src/app/(app)/teacher/lessons/sessions/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/sessions/[id]/teach` | `src/app/(app)/teacher/lessons/sessions/[id]/teach/page.tsx` |  |
| NOT_STARTED | `/teacher/lessons/week-plans/[id]/notebook-summary` | `src/app/(app)/teacher/lessons/week-plans/[id]/notebook-summary/page.tsx` |  |
| NOT_STARTED | `/teacher/library/[bookId]` | `src/app/(app)/teacher/library/[bookId]/page.tsx` |  |
| NOT_STARTED | `/teacher/library` | `src/app/(app)/teacher/library/page.tsx` |  |
| NOT_STARTED | `/teacher/marks/[classGroupId]/[subjectId]` | `src/app/(app)/teacher/marks/[classGroupId]/[subjectId]/page.tsx` |  |
| NOT_STARTED | `/teacher/marks` | `src/app/(app)/teacher/marks/page.tsx` |  |
| NOT_STARTED | `/teacher/meetings/[meetingId]` | `src/app/(app)/teacher/meetings/[meetingId]/page.tsx` |  |
| NOT_STARTED | `/teacher/meetings` | `src/app/(app)/teacher/meetings/page.tsx` |  |
| NOT_STARTED | `/teacher/notifications` | `src/app/(app)/teacher/notifications/page.tsx` |  |
| NOT_STARTED | `/teacher` | `src/app/(app)/teacher/page.tsx` |  |
| NOT_STARTED | `/teacher/question-bank` | `src/app/(app)/teacher/question-bank/page.tsx` |  |
| NOT_STARTED | `/teacher/schemes/[id]` | `src/app/(app)/teacher/schemes/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/schemes/import` | `src/app/(app)/teacher/schemes/import/page.tsx` |  |
| NOT_STARTED | `/teacher/schemes` | `src/app/(app)/teacher/schemes/page.tsx` |  |
| NOT_STARTED | `/teacher/settings` | `src/app/(app)/teacher/settings/page.tsx` |  |
| NOT_STARTED | `/teacher/students/[studentId]` | `src/app/(app)/teacher/students/[studentId]/page.tsx` |  |
| NOT_STARTED | `/teacher/students` | `src/app/(app)/teacher/students/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/assignments/[id]` | `src/app/(app)/teacher/studio/assignments/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/assignments/[id]/submissions` | `src/app/(app)/teacher/studio/assignments/[id]/submissions/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/assignments/new` | `src/app/(app)/teacher/studio/assignments/new/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/assignments` | `src/app/(app)/teacher/studio/assignments/page.tsx` |  |
| NOT_STARTED | `/teacher/studio` | `src/app/(app)/teacher/studio/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/projects` | `src/app/(app)/teacher/studio/projects/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/quizzes/[id]` | `src/app/(app)/teacher/studio/quizzes/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/quizzes/[id]/submissions` | `src/app/(app)/teacher/studio/quizzes/[id]/submissions/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/quizzes/new` | `src/app/(app)/teacher/studio/quizzes/new/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/quizzes` | `src/app/(app)/teacher/studio/quizzes/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/resources` | `src/app/(app)/teacher/studio/resources/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/rubrics` | `src/app/(app)/teacher/studio/rubrics/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/submissions/[id]` | `src/app/(app)/teacher/studio/submissions/[id]/page.tsx` |  |
| NOT_STARTED | `/teacher/studio/submissions` | `src/app/(app)/teacher/studio/submissions/page.tsx` |  |
| NOT_STARTED | `/teacher/supplies` | `src/app/(app)/teacher/supplies/page.tsx` |  |

### Parent (26 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/parent/academics` | `src/app/(app)/parent/academics/page.tsx` |  |
| NOT_STARTED | `/parent/attendance` | `src/app/(app)/parent/attendance/page.tsx` |  |
| NOT_STARTED | `/parent/calendar` | `src/app/(app)/parent/calendar/page.tsx` |  |
| NOT_STARTED | `/parent/exams` | `src/app/(app)/parent/exams/page.tsx` |  |
| NOT_STARTED | `/parent/fees` | `src/app/(app)/parent/fees/page.tsx` |  |
| NOT_STARTED | `/parent/learn/credentials` | `src/app/(app)/parent/learn/credentials/page.tsx` |  |
| NOT_STARTED | `/parent/learn` | `src/app/(app)/parent/learn/page.tsx` |  |
| NOT_STARTED | `/parent/learn/payments` | `src/app/(app)/parent/learn/payments/page.tsx` |  |
| NOT_STARTED | `/parent/learn/wards/[studentId]` | `src/app/(app)/parent/learn/wards/[studentId]/page.tsx` |  |
| NOT_STARTED | `/parent/library/[bookId]` | `src/app/(app)/parent/library/[bookId]/page.tsx` |  |
| NOT_STARTED | `/parent/library` | `src/app/(app)/parent/library/page.tsx` |  |
| NOT_STARTED | `/parent/meetings/[meetingId]` | `src/app/(app)/parent/meetings/[meetingId]/page.tsx` |  |
| NOT_STARTED | `/parent/meetings` | `src/app/(app)/parent/meetings/page.tsx` |  |
| NOT_STARTED | `/parent/messages` | `src/app/(app)/parent/messages/page.tsx` |  |
| NOT_STARTED | `/parent/notifications` | `src/app/(app)/parent/notifications/page.tsx` |  |
| NOT_STARTED | `/parent` | `src/app/(app)/parent/page.tsx` |  |
| NOT_STARTED | `/parent/payments` | `src/app/(app)/parent/payments/page.tsx` |  |
| NOT_STARTED | `/parent/receipts` | `src/app/(app)/parent/receipts/page.tsx` |  |
| NOT_STARTED | `/parent/reports` | `src/app/(app)/parent/reports/page.tsx` |  |
| NOT_STARTED | `/parent/store` | `src/app/(app)/parent/store/page.tsx` |  |
| NOT_STARTED | `/parent/supplies` | `src/app/(app)/parent/supplies/page.tsx` |  |
| NOT_STARTED | `/parent/wards/[id]/lesson-sessions/[sessionId]` | `src/app/(app)/parent/wards/[id]/lesson-sessions/[sessionId]/page.tsx` |  |
| NOT_STARTED | `/parent/wards/[id]/lessons/[lessonId]` | `src/app/(app)/parent/wards/[id]/lessons/[lessonId]/page.tsx` |  |
| NOT_STARTED | `/parent/wards/[id]/lessons` | `src/app/(app)/parent/wards/[id]/lessons/page.tsx` |  |
| NOT_STARTED | `/parent/wards/[id]` | `src/app/(app)/parent/wards/[id]/page.tsx` |  |
| NOT_STARTED | `/parent/wards` | `src/app/(app)/parent/wards/page.tsx` |  |

### Student (13 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/student/assignments/[id]` | `src/app/(app)/student/assignments/[id]/page.tsx` |  |
| NOT_STARTED | `/student/assignments` | `src/app/(app)/student/assignments/page.tsx` |  |
| NOT_STARTED | `/student/calendar` | `src/app/(app)/student/calendar/page.tsx` |  |
| NOT_STARTED | `/student/exams` | `src/app/(app)/student/exams/page.tsx` |  |
| NOT_STARTED | `/student/lessons/[id]` | `src/app/(app)/student/lessons/[id]/page.tsx` |  |
| NOT_STARTED | `/student/lessons` | `src/app/(app)/student/lessons/page.tsx` |  |
| NOT_STARTED | `/student/library/[bookId]` | `src/app/(app)/student/library/[bookId]/page.tsx` |  |
| NOT_STARTED | `/student/library` | `src/app/(app)/student/library/page.tsx` |  |
| NOT_STARTED | `/student/notices` | `src/app/(app)/student/notices/page.tsx` |  |
| NOT_STARTED | `/student` | `src/app/(app)/student/page.tsx` |  |
| NOT_STARTED | `/student/profile` | `src/app/(app)/student/profile/page.tsx` |  |
| NOT_STARTED | `/student/results` | `src/app/(app)/student/results/page.tsx` |  |
| NOT_STARTED | `/student/timetable` | `src/app/(app)/student/timetable/page.tsx` |  |

### Platform (49 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/platform/applications` | `src/app/(app)/platform/applications/page.tsx` |  |
| NOT_STARTED | `/platform/audit` | `src/app/(app)/platform/audit/page.tsx` |  |
| NOT_STARTED | `/platform/background-work` | `src/app/(app)/platform/background-work/page.tsx` |  |
| NOT_STARTED | `/platform/delegations` | `src/app/(app)/platform/delegations/page.tsx` |  |
| NOT_STARTED | `/platform/demo-leads/[leadId]` | `src/app/(app)/platform/demo-leads/[leadId]/page.tsx` |  |
| NOT_STARTED | `/platform/demo-leads` | `src/app/(app)/platform/demo-leads/page.tsx` |  |
| NOT_STARTED | `/platform/email` | `src/app/(app)/platform/email/page.tsx` |  |
| NOT_STARTED | `/platform/emails` | `src/app/(app)/platform/emails/page.tsx` |  |
| NOT_STARTED | `/platform/flags` | `src/app/(app)/platform/flags/page.tsx` |  |
| NOT_STARTED | `/platform/learn/gifts` | `src/app/(app)/platform/learn/gifts/page.tsx` |  |
| NOT_STARTED | `/platform/learn` | `src/app/(app)/platform/learn/page.tsx` |  |
| NOT_STARTED | `/platform/learn/payments` | `src/app/(app)/platform/learn/payments/page.tsx` |  |
| NOT_STARTED | `/platform/learn/schools` | `src/app/(app)/platform/learn/schools/page.tsx` |  |
| NOT_STARTED | `/platform/learn/settings` | `src/app/(app)/platform/learn/settings/page.tsx` |  |
| NOT_STARTED | `/platform/learn/students` | `src/app/(app)/platform/learn/students/page.tsx` |  |
| NOT_STARTED | `/platform/leo` | `src/app/(app)/platform/leo/page.tsx` |  |
| NOT_STARTED | `/platform` | `src/app/(app)/platform/page.tsx` |  |
| NOT_STARTED | `/platform/proposals/[proposalId]` | `src/app/(app)/platform/proposals/[proposalId]/page.tsx` |  |
| NOT_STARTED | `/platform/proposals/[proposalId]/preview` | `src/app/(app)/platform/proposals/[proposalId]/preview/page.tsx` |  |
| NOT_STARTED | `/platform/proposals/new` | `src/app/(app)/platform/proposals/new/page.tsx` |  |
| NOT_STARTED | `/platform/proposals` | `src/app/(app)/platform/proposals/page.tsx` |  |
| NOT_STARTED | `/platform/prospects` | `src/app/(app)/platform/prospects/page.tsx` |  |
| NOT_STARTED | `/platform/reconciliation` | `src/app/(app)/platform/reconciliation/page.tsx` |  |
| NOT_STARTED | `/platform/schools/[id]/onboarding` | `src/app/(app)/platform/schools/[id]/onboarding/page.tsx` |  |
| NOT_STARTED | `/platform/schools/[id]` | `src/app/(app)/platform/schools/[id]/page.tsx` |  |
| NOT_STARTED | `/platform/schools/[id]/subscription` | `src/app/(app)/platform/schools/[id]/subscription/page.tsx` |  |
| NOT_STARTED | `/platform/schools/[id]/usage` | `src/app/(app)/platform/schools/[id]/usage/page.tsx` |  |
| NOT_STARTED | `/platform/schools/new` | `src/app/(app)/platform/schools/new/page.tsx` |  |
| NOT_STARTED | `/platform/schools` | `src/app/(app)/platform/schools/page.tsx` |  |
| NOT_STARTED | `/platform/settings` | `src/app/(app)/platform/settings/page.tsx` |  |
| NOT_STARTED | `/platform/staff/[id]` | `src/app/(app)/platform/staff/[id]/page.tsx` |  |
| NOT_STARTED | `/platform/staff/new` | `src/app/(app)/platform/staff/new/page.tsx` |  |
| NOT_STARTED | `/platform/staff` | `src/app/(app)/platform/staff/page.tsx` |  |
| NOT_STARTED | `/platform/subscription-billing` | `src/app/(app)/platform/subscription-billing/page.tsx` |  |
| NOT_STARTED | `/platform/subscription-notifications` | `src/app/(app)/platform/subscription-notifications/page.tsx` |  |
| NOT_STARTED | `/platform/subscription-plans/[id]` | `src/app/(app)/platform/subscription-plans/[id]/page.tsx` |  |
| NOT_STARTED | `/platform/subscription-plans` | `src/app/(app)/platform/subscription-plans/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/add-ons` | `src/app/(app)/platform/subscriptions/add-ons/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/invoices` | `src/app/(app)/platform/subscriptions/invoices/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/leakage` | `src/app/(app)/platform/subscriptions/leakage/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions` | `src/app/(app)/platform/subscriptions/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/payment-charges` | `src/app/(app)/platform/subscriptions/payment-charges/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/plans` | `src/app/(app)/platform/subscriptions/plans/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/schools` | `src/app/(app)/platform/subscriptions/schools/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/settings` | `src/app/(app)/platform/subscriptions/settings/page.tsx` |  |
| NOT_STARTED | `/platform/subscriptions/usage` | `src/app/(app)/platform/subscriptions/usage/page.tsx` |  |
| NOT_STARTED | `/platform/tasks` | `src/app/(app)/platform/tasks/page.tsx` |  |
| NOT_STARTED | `/platform/users` | `src/app/(app)/platform/users/page.tsx` |  |
| NOT_STARTED | `/platform/webhooks` | `src/app/(app)/platform/webhooks/page.tsx` |  |

### Public transactional / application (11 pages)

| Status | Route | Source | First-touch shared components / notes |
|---|---|---|---|
| NOT_STARTED | `/apply/[schoolId]/[cycleSlug]` | `src/app/(public)/apply/[schoolId]/[cycleSlug]/page.tsx` |  |
| NOT_STARTED | `/apply/lookup` | `src/app/(public)/apply/lookup/page.tsx` |  |
| NOT_STARTED | `/apply/supplemental/[token]` | `src/app/(public)/apply/supplemental/[token]/page.tsx` |  |
| NOT_STARTED | `/apply/track/[token]` | `src/app/(public)/apply/track/[token]/page.tsx` |  |
| NOT_STARTED | `/authentication/login` | `src/app/(public)/authentication/login/page.tsx` | Redirect verification to `/sign-in` |
| NOT_STARTED | `/donate/[token]` | `src/app/(public)/donate/[token]/page.tsx` |  |
| NOT_STARTED | `/payment-return/paystack` | `src/app/(public)/payment-return/paystack/page.tsx` |  |
| NOT_STARTED | `/platform-bootstrap/[secret]` | `src/app/(public)/platform-bootstrap/[secret]/page.tsx` |  |
| NOT_STARTED | `/upload/parent-document/[token]` | `src/app/(public)/upload/parent-document/[token]/page.tsx` |  |
| NOT_STARTED | `/verify/receipt/[verificationId]` | `src/app/(public)/verify/receipt/[verificationId]/page.tsx` |  |
| NOT_STARTED | `/verify/report/[verificationId]` | `src/app/(public)/verify/report/[verificationId]/page.tsx` |  |


---

## 14. Progress summary (agents must keep current)

| Area | Total pages | Complete | In progress | Needs review | Blocked |
|---|---:|---:|---:|---:|---:|
| Marketing / auth / root | 15 | 13 | 0 | 0 | 0 |
| School onboarding | 1 | 0 | 0 | 0 | 0 |
| Other authenticated | 3 | 0 | 0 | 0 | 0 |
| Admin | 116 | 0 | 0 | 0 | 0 |
| Teacher | 75 | 0 | 0 | 0 | 0 |
| Parent | 26 | 0 | 0 | 0 | 0 |
| Student | 13 | 0 | 0 | 0 | 0 |
| Platform | 49 | 0 | 0 | 0 | 0 |
| Public transactional / application | 11 | 0 | 0 | 0 | 0 |
| **TOTAL** | **309** | **13** | **0** | **0** | **0** |


> When page statuses change, update this summary in the same change. Do not allow the tracker and summary to drift.

---

## 15. Final whole-app definition of done

The migration is complete only when all of the following are true:

1. Light mode is the default for first-time users.
2. Dark mode can be selected and persists.
3. Theme switching works on marketing, authentication, authenticated app shells, and public flows.
4. All 309 tracked pages are `THEME_COMPLETE` or intentionally documented as not user-rendered/redirect-only.
5. `/sign-in` and `/sign-up` are fully themed across all Clerk states.
6. `/enroll` and onboarding flows are fully themed.
7. Every shared UI primitive that appears in the application has been migrated once and recorded.
8. No page contains an unthemed modal/dialog/dropdown/date picker simply because it was hidden during the initial screenshot.
9. Later pages did not create duplicate styling forks of already migrated shared components.
10. Current dark mode remains visually coherent.
11. Light mode follows the approved white/glass EduSentrix design direction.
12. Responsive layouts remain functional.
13. Tests/build are green.
14. A final hardcoded-color audit has been completed.
15. The progress tracker and shared component registry reflect the actual code state.

---

## 16. Agent operating principle

**Theme the system, not each screenshot independently.**

A page is the unit of execution and verification, but a shared component is the unit of reuse. The first page that encounters a shared component owns its theme migration; every later page consumes and verifies that work rather than repeating it.
