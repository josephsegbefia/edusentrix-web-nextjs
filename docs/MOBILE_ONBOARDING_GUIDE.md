# EduSentrix Mobile App - User Onboarding Guide

This document outlines the complete onboarding flows for Parents, Teachers, and Students on the EduSentrix mobile app. Use this as the reference for implementing authentication and user flows in the separate Expo/React Native mobile project.

---

## Table of Contents

1. [Authentication Overview](#authentication-overview)
2. [Parent Onboarding Flow](#parent-onboarding-flow)
3. [Teacher Onboarding Flow](#teacher-onboarding-flow)
4. [Student Onboarding Flow](#student-onboarding-flow)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Mobile Implementation Guide](#mobile-implementation-guide)
7. [Error Handling](#error-handling)

---

## Authentication Overview

### Technology Stack

- **Authentication Provider**: Clerk (https://clerk.com)
- **Mobile SDK**: `@clerk/clerk-expo`
- **API Authentication**: Bearer token via Clerk session

### How Authentication Works

```
Mobile App → Clerk SDK → Get Session Token → API Request with Bearer Token → Backend Validates
```

### Setup in Expo

```bash
# Install Clerk Expo SDK
npx expo install @clerk/clerk-expo expo-secure-store
```

```typescript
// app/_layout.tsx (or App.tsx)
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        {/* Your app content */}
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

### Making Authenticated API Calls

```typescript
import { useAuth } from '@clerk/clerk-expo';

const API_BASE_URL = 'https://your-edusentrix-domain.com';

export function useApiClient() {
  const { getToken } = useAuth();

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  };

  return { fetchWithAuth };
}
```

---

## Parent Onboarding Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARENT ONBOARDING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ADMIN ACTION (Web App)                                                   │
│     └── Admin goes to Student Profile → Guardians Tab                       │
│         └── Clicks "Add Guardian"                                            │
│             └── Enters parent info (name, email, phone, relationship)        │
│                 └── System creates:                                          │
│                     • User record (with email, no clerkUserId yet)           │
│                     • Guardian relationship to student                       │
│                     • Clerk invitation (magic link sent to email)            │
│                     • Invitation record for tracking                         │
│                                                                              │
│  2. EMAIL RECEIVED                                                           │
│     └── Parent receives email: "You've been invited to EduSentrix"          │
│         └── Email contains:                                                  │
│             • School name                                                    │
│             • Link to set up account                                         │
│                                                                              │
│  3. ACCOUNT ACTIVATION (Web Browser)                                         │
│     └── Parent clicks link → Opens web browser                              │
│         └── Redirected to Clerk sign-up page                                │
│             └── Parent sets password                                         │
│                 └── Clerk creates user → Links clerkUserId to User record   │
│                     └── Account activated!                                   │
│                                                                              │
│  4. MOBILE APP ACCESS                                                        │
│     └── Parent downloads EduSentrix mobile app                              │
│         └── Opens app → Sign In screen                                      │
│             └── Enters email + password                                      │
│                 └── Clerk authenticates → Session created                    │
│                     └── App fetches /api/me → Gets role: "parent"           │
│                         └── App navigates to Parent Dashboard               │
│                             └── Fetches /api/parent/wards → Shows children  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Parent API Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/me` | GET | Get current user profile | ✅ Available |
| `/api/parent/dashboard` | GET | Parent dashboard with wards summary | ✅ Available |
| `/api/parent/wards` | GET | List all wards (children) | ✅ Available |
| `/api/parent/wards/[id]` | GET | Get specific ward details | ✅ Available |
| `/api/parent/wards/[id]/academics` | GET | Ward's academic data | ✅ Available |
| `/api/parent/wards/[id]/fees/summary` | GET | Ward's fees summary | ✅ Available |

### Mobile Screens Required

1. **Sign In Screen** - Email + Password login via Clerk
2. **Parent Dashboard** - Overview of all wards with quick stats
3. **Ward List Screen** - List of children with photos and status
4. **Ward Detail Screen** - Individual child's full information
5. **Ward Academics Tab** - Grades, subjects, teacher comments
6. **Ward Fees Tab** - Outstanding fees, payment history

### Sample API Responses

#### GET /api/parent/dashboard
```json
{
  "success": true,
  "data": {
    "wards": [
      {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "firstName": "John",
        "lastName": "Doe",
        "photoUrl": "https://res.cloudinary.com/...",
        "classGroup": "JHS 1A",
        "classGroupId": "507f1f77bcf86cd799439022",
        "admissionNo": "STU001",
        "status": "active",
        "relationship": "father",
        "isPrimary": true,
        "feeStatus": "partial",
        "outstandingAmount": 500.00
      }
    ],
    "summary": {
      "totalWards": 2,
      "totalOutstanding": 1200.00,
      "upcomingPayments": 3
    }
  }
}
```

#### GET /api/parent/wards/[id]
```json
{
  "success": true,
  "data": {
    "student": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "middleName": "Michael",
      "name": "John Michael Doe",
      "photoUrl": "https://res.cloudinary.com/...",
      "status": "active",
      "classGroup": "JHS 1A",
      "classGroupId": "507f1f77bcf86cd799439022",
      "grade": "JHS 1",
      "admissionNo": "STU001",
      "dateOfBirth": "2012-05-15T00:00:00.000Z",
      "gender": "male",
      "relationship": "father",
      "isPrimary": true
    },
    "fees": {
      "totalBilled": 2500.00,
      "totalPaid": 2000.00,
      "outstanding": 500.00,
      "pendingInvoices": 1,
      "status": "owing"
    }
  }
}
```

---

## Teacher Onboarding Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEACHER ONBOARDING FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ADMIN ACTION (Web App)                                                   │
│     └── Admin goes to Teachers → Invite Teacher                             │
│         └── Enters teacher info (name, email, subjects, classes)            │
│             └── System creates:                                              │
│                 • Invitation record (pending)                                │
│                 • Clerk invitation (magic link sent to email)               │
│                                                                              │
│  2. EMAIL RECEIVED                                                           │
│     └── Teacher receives email: "You've been invited as a Teacher"          │
│         └── Email contains:                                                  │
│             • School name                                                    │
│             • Role: Teacher                                                  │
│             • Setup link                                                     │
│                                                                              │
│  3. ACCOUNT ACTIVATION (Web Browser)                                         │
│     └── Teacher clicks link → Opens web browser                             │
│         └── Redirected to Clerk sign-up page                                │
│             └── Teacher sets password                                        │
│                 └── Redirected to /auth/callback                            │
│                     └── System creates:                                      │
│                         • User record with clerkUserId                       │
│                         • Teacher record                                     │
│                         • UserMembership with teacher role                  │
│                         • TeacherAssignments (classes/subjects)             │
│                                                                              │
│  4. MOBILE APP ACCESS                                                        │
│     └── Teacher downloads EduSentrix mobile app                             │
│         └── Opens app → Sign In screen                                      │
│             └── Enters email + password                                      │
│                 └── Clerk authenticates → Session created                    │
│                     └── App fetches /api/me → Gets role: "teacher"          │
│                         └── App navigates to Teacher Dashboard              │
│                             └── Fetches /api/teacher/me → Gets assignments  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Teacher API Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/me` | GET | Get current user profile | ✅ Available |
| `/api/teacher/me` | GET | Get teacher profile with assignments | ✅ Available |
| `/api/teacher/dashboard` | GET | Teacher dashboard | ✅ Available |
| `/api/teacher/classes` | GET | Teacher's assigned classes | ✅ Available |
| `/api/teacher/students/[classGroupId]` | GET | Students in a class | ✅ Available |
| `/api/teacher/attendance/homeroom` | GET/POST | Homeroom attendance | ✅ Available |
| `/api/teacher/attendance/period` | GET/POST | Period attendance | ✅ Available |
| `/api/teacher/gradebook/[classGroupId]/[subjectId]` | GET | Gradebook data | ✅ Available |
| `/api/teacher/gradebook/[classGroupId]/[subjectId]/record` | POST | Record grades | ✅ Available |
| `/api/teacher/lesson-notes` | GET/POST | Lesson notes | ✅ Available |
| `/api/teacher/studio/assignments` | GET/POST | Assignments | ✅ Available |

### Mobile Screens Required

1. **Sign In Screen** - Email + Password login via Clerk
2. **Teacher Dashboard** - Today's schedule, quick stats, pending tasks
3. **Classes Screen** - List of assigned classes
4. **Class Detail Screen** - Students in class, actions
5. **Attendance Screen** - Mark homeroom/period attendance
6. **Gradebook Screen** - Enter and view grades
7. **Lesson Notes Screen** - Create and manage lesson notes

---

## Student Onboarding Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STUDENT ONBOARDING FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OPTION A: Student Created with Email (Self-Service)                        │
│  ─────────────────────────────────────────────────────                      │
│  1. ADMIN ACTION                                                             │
│     └── Admin creates student with email address                            │
│         └── System can optionally send invitation                           │
│                                                                              │
│  2. STUDENT ACTIVATION (Similar to Parent/Teacher)                          │
│     └── Student receives email → Sets password                              │
│         └── Downloads mobile app → Signs in                                 │
│             └── Gets role: "student" → Student Dashboard                    │
│                                                                              │
│  OPTION B: Student Account via Parent (Preferred for Younger Students)      │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Parent signs in to mobile app                                           │
│  2. Parent views ward's academic data, fees, etc.                           │
│  3. Student does not have separate mobile access                            │
│     (Parent manages all interactions)                                        │
│                                                                              │
│  OPTION C: Student Portal Link (Web-Based)                                  │
│  ─────────────────────────────────────────────                              │
│  1. Student accesses web portal                                             │
│  2. Uses student ID + DOB or PIN for authentication                         │
│  3. Simpler auth for younger students                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Student API Endpoints (To Be Created)

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/me` | GET | Get current user profile | ✅ Available |
| `/api/student/dashboard` | GET | Student dashboard | ❌ To be created |
| `/api/student/academics` | GET | Student's academic data | ❌ To be created |
| `/api/student/fees/summary` | GET | Student's fees summary | ❌ To be created |
| `/api/student/timetable` | GET | Student's timetable | ❌ To be created |
| `/api/student/assignments` | GET | Assignments for student | ✅ Available |

**Note**: Student endpoints follow the same pattern as parent endpoints but access data for the authenticated student only (no need to specify student ID).

---

## API Endpoints Reference

### Base URL
```
Production: https://your-edusentrix-domain.com/api
Development: http://localhost:3000/api
```

### Headers Required
```
Authorization: Bearer <clerk_session_token>
Content-Type: application/json
```

### Common Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE" // Optional
}
```

### Complete Endpoint List

#### Authentication (No Bearer Token Needed - Handled by Clerk)
| Endpoint | Method | Description |
|----------|--------|-------------|
| Clerk SDK | - | Sign In, Sign Up, Sign Out |

#### User Profile (All Roles)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/me` | GET | Get current user profile with role |

#### Parent Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parent/dashboard` | GET | Dashboard with wards summary |
| `/api/parent/wards` | GET | List all wards |
| `/api/parent/wards/[id]` | GET | Ward details |
| `/api/parent/wards/[id]/academics` | GET | Ward academics |
| `/api/parent/wards/[id]/fees/summary` | GET | Ward fees summary |

#### Teacher Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/teacher/me` | GET | Teacher profile with context |
| `/api/teacher/dashboard` | GET | Dashboard with stats |
| `/api/teacher/classes` | GET | Assigned classes |
| `/api/teacher/students/[classGroupId]` | GET | Students in class |
| `/api/teacher/attendance/homeroom` | GET | Today's homeroom attendance |
| `/api/teacher/attendance/homeroom` | POST | Record homeroom attendance |
| `/api/teacher/attendance/homeroom/[date]` | GET | Specific date attendance |
| `/api/teacher/attendance/period` | GET | Period attendance |
| `/api/teacher/attendance/period` | POST | Record period attendance |
| `/api/teacher/gradebook/[classGroupId]/[subjectId]` | GET | Gradebook data |
| `/api/teacher/gradebook/[classGroupId]/[subjectId]/record` | POST | Record grades |
| `/api/teacher/lesson-notes` | GET | List lesson notes |
| `/api/teacher/lesson-notes` | POST | Create lesson note |
| `/api/teacher/lesson-notes/[id]` | PATCH | Update lesson note |
| `/api/teacher/lesson-notes/[id]` | DELETE | Delete lesson note |
| `/api/teacher/studio/assignments` | GET | List assignments |
| `/api/teacher/studio/assignments` | POST | Create assignment |
| `/api/teacher/notices` | GET | List notices |
| `/api/teacher/notices` | POST | Create notice |

#### Academic Periods (All Roles)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/periods/get-current` | GET | Get current academic period |

---

## Mobile Implementation Guide

### Project Structure (Expo Router)

```
app/
├── _layout.tsx           # Root layout with ClerkProvider
├── (auth)/
│   ├── _layout.tsx       # Auth stack layout
│   ├── sign-in.tsx       # Sign in screen
│   └── sign-up.tsx       # Sign up screen (if needed)
├── (app)/
│   ├── _layout.tsx       # Authenticated layout (redirects if not signed in)
│   ├── (tabs)/
│   │   ├── _layout.tsx   # Tab navigator
│   │   ├── index.tsx     # Dashboard (role-based)
│   │   ├── academics.tsx # Academics tab
│   │   ├── fees.tsx      # Fees tab
│   │   └── profile.tsx   # Profile & settings
│   ├── parent/
│   │   ├── wards/
│   │   │   ├── index.tsx     # Wards list
│   │   │   └── [id].tsx      # Ward detail
│   │   └── ...
│   ├── teacher/
│   │   ├── classes/
│   │   │   ├── index.tsx     # Classes list
│   │   │   └── [id].tsx      # Class detail
│   │   ├── attendance/
│   │   │   └── index.tsx     # Attendance marking
│   │   └── ...
│   └── student/
│       └── ...
└── hooks/
    ├── useApiClient.ts   # API client hook
    ├── useUser.ts        # User data hook
    └── queries/
        ├── useParentDashboard.ts
        ├── useParentWards.ts
        └── ...
```

### Role-Based Navigation

```typescript
// app/(app)/_layout.tsx
import { useUser } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { isSignedIn, user } = useUser();

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  // Get role from user metadata or /api/me
  const role = user?.publicMetadata?.role as string;

  return <Stack />;
}

// Determine initial route based on role
function getInitialRoute(role: string) {
  switch (role) {
    case 'parent':
      return '/parent/dashboard';
    case 'teacher':
      return '/teacher/dashboard';
    case 'student':
      return '/student/dashboard';
    default:
      return '/';
  }
}
```

### React Query Setup

```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: 2,
    },
  },
});
```

### Example: Parent Dashboard Query

```typescript
// hooks/queries/useParentDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../useApiClient';

interface Ward {
  id: string;
  name: string;
  photoUrl: string | null;
  classGroup: string;
  feeStatus: 'clear' | 'partial' | 'owing';
  outstandingAmount: number;
}

interface DashboardData {
  wards: Ward[];
  summary: {
    totalWards: number;
    totalOutstanding: number;
    upcomingPayments: number;
  };
}

export function useParentDashboard() {
  const { fetchWithAuth } = useApiClient();

  return useQuery<DashboardData>({
    queryKey: ['parent', 'dashboard'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/parent/dashboard');
      return response.data;
    },
  });
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response data |
| 400 | Bad Request | Show validation error |
| 401 | Unauthorized | Redirect to sign-in |
| 403 | Forbidden | Show permission denied |
| 404 | Not Found | Show not found message |
| 500 | Server Error | Show generic error, retry |

### Error Handling Pattern

```typescript
// hooks/useApiClient.ts
export function useApiClient() {
  const { getToken, signOut } = useAuth();
  const router = useRouter();

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle auth errors
    if (response.status === 401) {
      await signOut();
      router.replace('/sign-in');
      throw new Error('Session expired');
    }

    // Handle forbidden
    if (response.status === 403) {
      throw new Error('You do not have permission to access this resource');
    }

    // Handle other errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  };

  return { fetchWithAuth };
}
```

### Offline Support

```typescript
// Check network status
import NetInfo from '@react-native-community/netinfo';

// In your query client setup
import { onlineManager } from '@tanstack/react-query';

onlineManager.setEventListener(setOnline => {
  return NetInfo.addEventListener(state => {
    setOnline(!!state.isConnected);
  });
});
```

---

## Summary

### What's Ready Now

1. ✅ **Parent endpoints** - Dashboard, wards list, ward details, academics, fees summary
2. ✅ **Teacher endpoints** - All teacher features (attendance, gradebook, assignments, etc.)
3. ✅ **Authentication** - Clerk integration with invitation flow
4. ✅ **Parent invitation** - Automatic Clerk invitation when guardian is added

### What Needs to Be Created for Mobile

1. **Student endpoints** - `/api/student/*` routes (similar pattern to parent)
2. **Push notifications** - Real-time alerts for new grades, fees due, etc.
3. **Offline sync** - Queue mutations when offline

### Quick Start for Mobile Dev

1. Set up Expo project with Clerk
2. Configure API base URL
3. Implement sign-in flow with Clerk SDK
4. Fetch `/api/me` to get user role
5. Navigate to role-specific screens
6. Use React Query for data fetching
7. Implement screens based on role

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Ready for Mobile Development
