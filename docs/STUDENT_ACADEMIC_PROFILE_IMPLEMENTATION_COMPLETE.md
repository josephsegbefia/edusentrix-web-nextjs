# Student Academic Profile — Implementation Complete

**Spec:** `STUDENT_ACADEMIC_PROFILE_SPEC.md` (Slices 0–21)  
**Status:** Shipped in codebase (2026-05-30)

Post-spec follow-ups (2026-05-30): parent multi-ward academics profile migration, snapshot-only parent report PDF download, `GET /api/student/results` retired (410).

---

## What shipped

| Slice | Deliverable |
|-------|-------------|
| 0 | `docs/STUDENT_ACADEMIC_PROFILE_DISCOVERY.md` |
| 1–2 | `student-academic-profile.ts`, builder shell, permissions |
| 3–6 | Report card, subject results, attendance, legacy fallback in `src/lib/academics/profile/` |
| 7–8 | Admin `academic-profile` + `breakdown` APIs |
| 9–10 | `useStudentAcademicProfile`, period selector |
| 11–18 | Admin tab UI (summary, report status, subjects, breakdown, attendance, comments, trends, Leo) |
| 19 | Parent ward profile API + `ParentWardAcademicsTab` |
| 20 | Student profile API + `/student/results` UI on academic-profile |
| 21 | Legacy DTO deprecation doc, compat wrappers, reduced legacy fetches |

### Post-spec follow-ups

| Item | Status |
|------|--------|
| `GET /api/parent/academics` | `buildParentWardsAcademicsSummary` (profile per ward) |
| Parent report download | Snapshot PDF only (`buildSnapshotReportCardPdf`) |
| Parent reports list | Released snapshots only |
| `GET /api/student/results` | HTTP **410 Gone** → `/api/student/academic-profile` |

---

## Primary entry points

### Types & builder

- `src/types/academics/student-academic-profile.ts`
- `src/lib/academics/profile/buildStudentAcademicProfileDTO.ts`
- `src/lib/academics/profile/build-parent-wards-academics-summary.ts` (multi-ward parent)

### APIs

| Role | Profile | Breakdown |
|------|---------|-----------|
| Admin | `/api/admin/students/[id]/academic-profile` | `.../breakdown` |
| Parent ward | `/api/parent/wards/[id]/academic-profile` | `.../breakdown` |
| Student | `/api/student/academic-profile` | `.../breakdown` |
| Parent all wards | `/api/parent/academics` | — |

### UI

- Admin: `StudentAcademicsTab` (student detail → Academics)
- Parent: `ParentWardAcademicsTab` (ward → Academics), `/parent/academics` (multi-ward)
- Student: `StudentResultsProfileClient` (`/student/results`)

### Legacy compat (do not extend)

- `docs/STUDENT_ACADEMIC_PROFILE_LEGACY_DTO_DEPRECATION.md`
- `buildLegacyStudentAcademicsDTO` — admin charts fallback only

---

## Verification

```bash
node --test --import tsx tests/student-academic-profile.*.test.ts
npm run build
```

---

## Remaining optional work

- [ ] Delete `buildStudentAcademicsDTO` when admin legacy API has zero consumers
- [ ] Parent reports UI copy if any references to “term report” PDFs

---

## Agent anti-drift (Slice 22)

Captured in `AGENTS.md` → **Student Academic Profile** module rules.
