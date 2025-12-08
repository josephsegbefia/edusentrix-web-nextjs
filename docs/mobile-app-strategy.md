# Mobile App Strategy & Feature Matrix

> Strategy document for EduSentrix mobile app (React Native/Expo) - Feature scope and style consistency approach

---

## 📱 Overview

The mobile app will serve as a **companion** to the web platform, with different feature sets based on user roles:

- **Parents & Students**: Full-featured mobile experience
- **School Admin, Teachers, Platform Admin**: Streamlined "on-the-go" version with essential features

---

## 🎯 Feature Matrix by Role

### ✅ **Parents & Students** - Full Features

#### Dashboard
- ✅ Full dashboard with all metrics
- ✅ Quick stats cards
- ✅ Recent activity feed
- ✅ Notifications center

#### Student Management (Parents)
- ✅ View student profiles
- ✅ View academic records
- ✅ View attendance records
- ✅ View fee statements
- ✅ View class schedules
- ✅ View assignments and grades
- ✅ View exam results
- ✅ View report cards

#### Payments (Parents)
- ✅ View fee breakdown
- ✅ Make payments (Paystack integration)
- ✅ Payment history
- ✅ Receipts download
- ✅ Payment reminders
- ✅ Installment plans

#### Communication
- ✅ Messages from school/teachers
- ✅ Announcements
- ✅ Event notifications
- ✅ Push notifications
- ✅ In-app messaging (if implemented)

#### Calendar & Events
- ✅ School calendar
- ✅ Upcoming events
- ✅ Exam schedules
- ✅ Holiday calendar
- ✅ Event reminders

#### Academic (Students)
- ✅ View assignments
- ✅ Submit assignments (if file upload supported)
- ✅ View grades
- ✅ View timetable
- ✅ View exam schedules
- ✅ View academic progress

---

### 📋 **School Admin** - Streamlined Mobile Features

#### ✅ **KEEP** (Essential Mobile Features)

##### Dashboard (Simplified)
- ✅ Key metrics only (3-4 cards max)
  - Total students
  - Pending invitations
  - Today's activities count
  - Quick action buttons
- ✅ Recent activity feed (last 10 items)
- ✅ Notifications

##### Quick Actions
- ✅ Approve/reject invitations (swipe actions)
- ✅ Quick student search
- ✅ View student details
- ✅ View teacher details
- ✅ Mark attendance (if teacher portal exists)
- ✅ Send quick announcements

##### View-Only Features
- ✅ Browse students list (simplified, no advanced filters)
- ✅ Browse teachers list
- ✅ View student details
- ✅ View teacher details
- ✅ View class groups
- ✅ View academic periods
- ✅ View activity feed

##### Notifications & Communication
- ✅ Push notifications
- ✅ View announcements
- ✅ Quick reply to messages

#### ❌ **OMIT** (Desktop-Only Features)

##### Complex Data Entry
- ❌ Create student (multi-step form)
- ❌ Create teacher (multi-step form)
- ❌ Create class groups
- ❌ Create subjects
- ❌ Academic period configuration
- ❌ Bulk operations
- ❌ Import CSV/Excel

##### Advanced Management
- ❌ Advanced filtering (keep basic search only)
- ❌ Bulk actions
- ❌ Export functionality (CSV/Excel)
- ❌ Advanced reporting
- ❌ Settings configuration
- ❌ Document management
- ❌ Fee structure management
- ❌ Payment processing (admin side)

##### Complex UI Elements
- ❌ Advanced filters panel
- ❌ Complex dashboards with many metrics
- ❌ Data visualization charts
- ❌ Table views (use card lists instead)
- ❌ Multi-step wizards
- ❌ Drag-and-drop interfaces

##### Administrative Tasks
- ❌ School onboarding
- ❌ Application management (platform admin)
- ❌ System configuration
- ❌ User role management
- ❌ Permission management

---

### 👨‍🏫 **Teachers** - Streamlined Mobile Features

#### ✅ **KEEP** (Essential Mobile Features)

##### Dashboard (Simplified)
- ✅ My classes overview
- ✅ Today's schedule
- ✅ Pending tasks count
- ✅ Quick actions

##### Class Management
- ✅ View assigned classes
- ✅ View class students
- ✅ View student details
- ✅ Basic student search

##### Attendance (If Implemented)
- ✅ Mark attendance (quick action)
- ✅ View attendance records
- ✅ Attendance history

##### Assignments & Grades (If Implemented)
- ✅ View assignments
- ✅ Quick grade entry (simplified)
- ✅ View grades

##### Communication
- ✅ Send messages to parents
- ✅ View messages
- ✅ Push notifications
- ✅ Announcements

#### ❌ **OMIT** (Desktop-Only Features)

##### Complex Management
- ❌ Create/edit assignments (complex forms)
- ❌ Bulk grade entry
- ❌ Advanced grade management
- ❌ Report generation
- ❌ Advanced analytics
- ❌ Class configuration
- ❌ Subject management

##### Administrative Tasks
- ❌ Student enrollment
- ❌ Teacher management
- ❌ School settings
- ❌ Fee management

---

### 🔧 **Platform Admin** - Minimal Mobile Features

#### ✅ **KEEP** (Essential Mobile Features)

##### Dashboard (Minimal)
- ✅ Pending applications count
- ✅ Quick stats (2-3 cards)
- ✅ Recent activity

##### Quick Actions
- ✅ Approve/reject applications (swipe actions)
- ✅ View application details
- ✅ Quick search

##### View-Only Features
- ✅ Browse applications
- ✅ View school details
- ✅ View activity feed

#### ❌ **OMIT** (Desktop-Only Features)

##### Everything Else
- ❌ Application processing (complex workflow)
- ❌ School provisioning
- ❌ Platform settings
- ❌ User management
- ❌ Advanced reporting
- ❌ System configuration

---

## 🎨 Style Consistency Strategy

### 1. **Shared Design Tokens**

Create a **shared design system** that both web and mobile reference:

```
edusentrix-design-system/
├── tokens/
│   ├── colors.ts          # Color palette
│   ├── typography.ts      # Font sizes, weights, line heights
│   ├── spacing.ts          # Spacing scale
│   ├── shadows.ts         # Shadow definitions
│   ├── borders.ts         # Border radius, widths
│   └── animations.ts       # Animation timings, easings
├── components/
│   ├── web/               # Web-specific components
│   └── mobile/            # Mobile-specific components
└── README.md
```

#### Implementation Approach

**Option A: Shared Package (Recommended)**
- Create `@edusentrix/design-tokens` npm package
- Both web and mobile import from same source
- Single source of truth for colors, spacing, etc.

**Option B: Shared Git Submodule**
- Design tokens in separate repo
- Both projects reference as submodule
- Good for version control

**Option C: JSON/YAML Config**
- Design tokens as JSON/YAML files
- Both projects read from same files
- Simple but less type-safe

### 2. **Color Palette Consistency**

Extract from `globals.css`:

```typescript
// shared-design-tokens/colors.ts
export const colors = {
  // Backgrounds
  bg: '#0b0f1a',
  card: '#0f1524',
  muted: '#9aa3b2',

  // Brand
  brand: '#0ea5e9',
  primary: '#6d28d9',
  danger: '#ef4444',

  // Gradients (for mobile, use React Native LinearGradient)
  gradients: {
    card: ['rgba(255, 255, 255, 0.05)', 'transparent'],
    primary: ['rgba(109, 40, 217, 0.1)', 'transparent'],
  },

  // Opacity variants
  white: {
    5: 'rgba(255, 255, 255, 0.05)',
    10: 'rgba(255, 255, 255, 0.10)',
    60: 'rgba(255, 255, 255, 0.60)',
    80: 'rgba(255, 255, 255, 0.80)',
  },
};
```

### 3. **Typography Consistency**

```typescript
// shared-design-tokens/typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};
```

### 4. **Component Mapping Strategy**

Map web components to mobile equivalents:

| Web Component | Mobile Equivalent | Notes |
|--------------|-------------------|-------|
| `Card` | `View` with styled wrapper | Same visual style, different implementation |
| `Button` | `TouchableOpacity` / `Pressable` | Same variants, native touch feedback |
| `Input` | `TextInput` | Same styling, native keyboard |
| `Modal` | `Modal` (RN) | Same overlay style |
| `Badge` | `View` with text | Same colors and sizing |
| `Avatar` | `Image` / `View` | Same circular style |
| `Toast` | React Native Toast library | Same positioning and styling |

### 5. **Visual Language Consistency**

#### Premium Design Elements

**Cards:**
- Same border: `border-white/10`
- Same background: `from-white/5 to-transparent` gradient
- Same shadow: `shadow-lg shadow-black/20`
- Same backdrop blur effect (use `BlurView` in React Native)

**Buttons:**
- Same variants: `default`, `outline`, `ghost`, `destructive`
- Same sizes: `sm`, `default`, `lg`
- Same hover/press states
- Same focus rings

**Typography:**
- Same font family (Inter)
- Same font sizes
- Same font weights
- Same text colors (`text-white/80`, `text-muted`, etc.)

**Spacing:**
- Same spacing scale (4px base unit)
- Same padding/margin patterns
- Same gap spacing

**Animations:**
- Same transition timings (250ms default)
- Same easing functions
- Same micro-interactions

### 6. **Navigation Patterns**

**Web:** Sidebar navigation
**Mobile:** Bottom tab navigation + drawer menu

**Mapping:**
- Main sections → Bottom tabs (max 5)
- Secondary sections → Drawer menu
- Deep links → Stack navigation

**Example for School Admin:**
```
Bottom Tabs:
- Dashboard (home icon)
- Students (users icon)
- Teachers (graduation cap icon)
- Invitations (mail icon)
- More (menu icon) → Opens drawer

Drawer Menu:
- Classes
- Subjects
- Periods
- Reports
- Settings
- Tasks
```

### 7. **API Consistency**

**Shared API Client:**
- Same API endpoints
- Same request/response formats
- Same error handling
- Same authentication (Clerk tokens)

**React Query Setup:**
- Use `@tanstack/react-query` in mobile too
- Same query keys structure
- Same cache strategies
- Same mutation patterns

### 8. **State Management Consistency**

**Both platforms:**
- React Query for server state
- Context API for global app state
- Local state for component state
- Same state structure where applicable

---

## 🏗️ Architecture Recommendations

### Project Structure

**Important:** Mobile app will be in a **separate directory/repository** from the web app.

```
/path/to/
├── edusentrix-web-nextjs/      # Web app (existing, separate repo)
│   ├── src/
│   ├── docs/
│   └── ...
│
└── edusentrix-mobile/          # Mobile app (new, separate repo)
    ├── app/                    # Expo Router app directory
    │   ├── (auth)/            # Auth screens
    │   ├── (tabs)/            # Bottom tab navigation
    │   │   ├── index.tsx      # Dashboard
    │   │   ├── students.tsx
    │   │   ├── teachers.tsx
    │   │   └── ...
    │   └── (drawer)/          # Drawer navigation
    ├── components/
    │   ├── ui/                # Shared UI components
    │   ├── admin/             # Admin-specific components
    │   ├── parent/            # Parent-specific components
    │   └── student/           # Student-specific components
    ├── hooks/                 # Custom hooks
    ├── lib/
    │   ├── api/               # API client (mirror web structure)
    │   ├── auth/              # Auth utilities
    │   └── design-tokens/     # Import from shared package
    ├── constants/             # App constants
    └── types/                 # TypeScript types (shared with web)
```

**Shared Design Tokens Options:**

Since repositories are separate, choose one of these approaches:

#### Option 1: NPM Package (Recommended)
```
@edusentrix/design-tokens/      # Separate npm package/repo
├── src/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   └── index.ts
├── package.json
└── tsconfig.json

# Both web and mobile install via npm:
npm install @edusentrix/design-tokens
```

#### Option 2: Git Submodule
```
# In mobile repo:
git submodule add <design-tokens-repo-url> lib/design-tokens

# Both repos reference same submodule
```

#### Option 3: Manual Sync (Simple but less ideal)
```
# Extract tokens to JSON/TypeScript files
# Manually copy to mobile repo when updated
# Use version tags or commit hashes to track versions
```

### Technology Stack

**Mobile:**
- **Framework:** Expo (React Native)
- **Navigation:** Expo Router (file-based routing)
- **UI Library:** React Native Paper or NativeBase (or custom with styled-components)
- **State Management:** TanStack Query (React Query)
- **Styling:** styled-components or NativeWind (Tailwind for React Native)
- **Auth:** Clerk React Native SDK
- **API:** Axios or fetch with shared API client
- **Forms:** React Hook Form (same as web)
- **Animations:** React Native Reanimated (for premium feel)

### Shared Code Strategy (Separate Repositories)

**What to Share:**
- ✅ TypeScript types/interfaces
- ✅ API client utilities (structure, not implementation)
- ✅ Validation schemas (Zod)
- ✅ Constants (roles, statuses, etc.)
- ✅ Design tokens
- ✅ Business logic utilities
- ✅ API endpoint definitions

**What NOT to Share:**
- ❌ React components (different platforms)
- ❌ Navigation logic (different patterns)
- ❌ Platform-specific code
- ❌ Implementation details

**How to Share (Separate Repos):**

#### Option 1: NPM Packages (Recommended)
Create separate npm packages for shared code:

```
@edusentrix/design-tokens       # Design system tokens
@edusentrix/shared-types        # TypeScript types/interfaces
@edusentrix/api-contracts       # API schemas, endpoints, types
@edusentrix/validation          # Zod schemas
```

**Pros:**
- Version control via npm
- Easy to update both repos
- Type-safe imports
- Can publish to private npm registry

**Cons:**
- Requires npm package setup
- Need to publish updates

#### Option 2: Git Submodules
Share code via git submodules:

```
# In mobile repo:
git submodule add <shared-types-repo> lib/shared-types
git submodule add <design-tokens-repo> lib/design-tokens
```

**Pros:**
- Direct git integration
- Easy to track versions
- No npm registry needed

**Cons:**
- Submodule management overhead
- Need to update submodules manually

#### Option 3: Manual Copy with Documentation
Manually copy shared code and document versions:

```
# Document in README:
# - Types version: commit abc123
# - Design tokens version: commit def456
# - Last synced: 2024-01-15
```

**Pros:**
- Simplest setup
- No additional tooling

**Cons:**
- Manual sync required
- Easy to get out of sync
- No automatic version tracking

#### Option 4: Shared Git Repository (Monorepo Alternative)
Create a third repo for shared code, both repos reference it:

```
edusentrix-shared/              # Separate shared repo
├── design-tokens/
├── types/
├── api-contracts/
└── validation/

# Both web and mobile reference via git subtree or submodule
```

**Recommended Approach:**
- **Design Tokens:** NPM package (`@edusentrix/design-tokens`)
- **Types:** NPM package (`@edusentrix/shared-types`) or Git submodule
- **API Contracts:** NPM package (`@edusentrix/api-contracts`)
- **Validation Schemas:** Include in types package or separate package

---

## 📐 Implementation Checklist

### Phase 1: Design System Setup (Separate Repos)
- [ ] Create shared design tokens package/repo (`@edusentrix/design-tokens`)
- [ ] Extract colors from web `globals.css` → design tokens package
- [ ] Define typography scale → design tokens package
- [ ] Define spacing scale → design tokens package
- [ ] Publish design tokens package (private npm or git)
- [ ] Install design tokens in web repo (update imports)
- [ ] Install design tokens in mobile repo
- [ ] Create component style guide document
- [ ] Document design decisions and sync process

### Phase 2: Mobile App Foundation
- [ ] Set up Expo project
- [ ] Configure Clerk authentication
- [ ] Set up React Query
- [ ] Create API client (mirror web structure)
- [ ] Set up navigation (Expo Router)
- [ ] Create base UI components (Button, Card, Input, etc.)

### Phase 3: Feature Implementation
- [ ] Implement role-based routing
- [ ] Build parent/student full features
- [ ] Build admin streamlined features
- [ ] Build teacher streamlined features
- [ ] Implement push notifications
- [ ] Add offline support (if needed)

### Phase 4: Polish & Consistency
- [ ] Match web visual style exactly
- [ ] Ensure animations match web
- [ ] Test on iOS and Android
- [ ] Performance optimization
- [ ] Accessibility audit

---

## 🎯 Key Principles

1. **Mobile-First for Parents/Students:** Full feature parity for end-users
2. **Desktop-First for Admins:** Mobile is complementary, not replacement
3. **Visual Consistency:** Same premium feel, adapted for touch interfaces
4. **Code Reuse:** Share types, APIs, business logic where possible
5. **Performance:** Optimize for mobile constraints (network, battery, screen size)
6. **Offline Support:** Consider offline capabilities for critical features (view-only)

---

## 📝 Notes

### Separate Repository Considerations

- **Design Token Sync:** Establish a clear process for syncing design tokens between repos
- **Type Safety:** Ensure TypeScript types stay in sync (use shared package or document versions)
- **API Contracts:** Document API endpoints and ensure mobile uses same endpoints as web
- **Version Tracking:** Use semantic versioning for shared packages
- **Update Process:** Document how to update shared code (design tokens, types, etc.)

### Mobile-Specific Considerations

- **Push Notifications:** Essential for mobile - use Expo Notifications
- **Deep Linking:** Support deep links for navigation from notifications
- **Biometric Auth:** Add fingerprint/face ID for quick access
- **Offline Mode:** Cache essential data for offline viewing
- **App Store:** Plan for iOS App Store and Google Play Store submissions
- **Analytics:** Integrate analytics (Firebase Analytics or similar)
- **Crash Reporting:** Set up crash reporting (Sentry or similar)

### Sync Strategy Recommendations

1. **Design Tokens:** Update in shared package, publish, then update both repos
2. **Types:** Update in shared package, publish, then update both repos
3. **API Changes:** Update API contracts package, update both repos
4. **Documentation:** Keep a changelog for shared packages
5. **Testing:** Test design token changes in both repos before publishing

---

**Last Updated:** [Current Date]
**Status:** Planning Phase
