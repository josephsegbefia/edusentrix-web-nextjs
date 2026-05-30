# Student Academic Profile — Legacy DTO Deprecation (Slice 21)

The legacy **`StudentAcademicsDTO`** (`src/types/admin/student-academics.ts`) and **`buildStudentAcademicsDTO`** exist for CA/exam-shaped rows and older admin surfaces. New work must use **`StudentAcademicProfileDTO`** and **`buildStudentAcademicProfileDTO`**.

## Successor

| Concern | Use instead |
|--------|-------------|
| Types | `src/types/academics/student-academic-profile.ts` |
| Builder | `src/lib/academics/profile/buildStudentAcademicProfileDTO.ts` |
| Admin API | `GET /api/admin/students/[id]/academic-profile` |
| Parent ward | `GET /api/parent/wards/[id]/academic-profile` |
| Student | `GET /api/student/academic-profile` |
| Parent multi-ward | `GET /api/parent/academics` → `buildParentWardsAcademicsSummary` |
| Compatibility map | `mapStudentAcademicProfileToLegacyDTO` |
| Explicit legacy build | `buildLegacyStudentAcademicsDTO` (admin fallback only) |

Registry: `src/lib/academics/legacy-student-academics-deprecation.ts`.

## Consumer inventory

| Consumer | Status | Notes |
|----------|--------|-------|
| `buildStudentAcademicsDTO.ts` | **Retained** | Do not extend. |
| `GET /api/admin/students/[id]/academics` | **Compat** | Legacy DTO + deprecation header; admin tab uses profile first. |
| `GET /api/parent/wards/[id]/academics` | **Profile-first** | Maps profile → legacy DTO for ward overview. |
| `GET /api/parent/academics` | **Profile-first** | `buildParentWardsAcademicsSummary`. |
| `GET /api/student/results` | **Removed (410)** | Use `/api/student/academic-profile`. |
| `GET /api/parent/reports/download` | **Snapshot only** | `buildSnapshotReportCardPdf`; no legacy DTO PDF. |
| `GET /api/parent/reports` | **Snapshot list** | Released report cards only. |
| `useStudentAcademics` / admin tab | **Reduced** | Skipped when profile is sufficient. |
| `/student/results` UI | **Migrated** | `StudentResultsProfileClient`. |
| Parent ward academics tab | **Migrated** | `ParentWardAcademicsTab`. |

## Rules for agents

1. **Do not** add fields or business logic to `buildStudentAcademicsDTO`.
2. **Do** add profile fields in `profile/` builders and `student-academic-profile.ts`.
3. **Do** use `buildLegacyStudentAcademicsDTO` only for documented admin compat.
4. **Do not** break parent report download — snapshot path only.

## Removal checklist

- [x] Migrate `/api/parent/academics` to profile summaries
- [x] Remove legacy PDF branch in parent report download
- [x] Retire `GET /api/student/results` (410)
- [ ] Remove admin dual-fetch when trends always hydrate on profile
- [ ] Delete `buildStudentAcademicsDTO` when zero consumers remain
