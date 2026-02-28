# Schedule Settings Specification v1.0

## 1. Overview

This spec defines configurable school schedule settings that support:

1. **Per-day start/end time overrides** — Some schools have different hours on different days (e.g., early dismissal on Fridays).
2. **Per-grade period count and duration overrides** — Different grade levels may have different schedules (e.g., primary vs secondary).
3. **Timetable creation integration** — Class timetable editor uses resolved settings for the class's grade and day when adding slots.

---

## 2. Data Model

### 2.1 School-wide defaults (existing)

- `schoolStartTime` — Default start time (HH:MM)
- `schoolEndTime` — Default end time (HH:MM)
- `periodDuration` — Default period length in minutes
- `periodsPerDay` — Default number of teaching periods
- `periodSlots` — Optional explicit period slots (auto-generated if absent)
- `breaks` — Break periods (base times; overrides apply per day/grade)

### 2.2 Break per-day overrides

```ts
breakDailyOverrides: Array<{
  dayOfWeek: number;   // 0-6
  breakName: string;   // matches IBreakPeriod.name (e.g., "Short Break", "Lunch")
  startTime?: string;  // HH:MM, overrides for this day
  endTime?: string;    // HH:MM, overrides for this day
}>
```

**Use cases:**
- Earlier lunch on Friday: `{ dayOfWeek: 5, breakName: "Lunch", startTime: "11:30", endTime: "12:00" }`
- Shorter short break on Wednesday: `{ dayOfWeek: 3, breakName: "Short Break", startTime: "10:00", endTime: "10:15" }`

### 2.3 Break per-grade overrides

```ts
breakGradeOverrides: Array<{
  gradeId: ObjectId;
  breakName: string;   // matches IBreakPeriod.name
  startTime?: string;  // HH:MM, overrides for this grade
  endTime?: string;    // HH:MM, overrides for this grade
}>
```

**Use cases:**
- Secondary has later lunch: `{ gradeId: "...", breakName: "Lunch", startTime: "12:30", endTime: "13:30" }`
- Kindergarten has earlier short break: `{ gradeId: "...", breakName: "Short Break", startTime: "09:45", endTime: "10:00" }`

### 2.4 Per-day overrides

```ts
dailyScheduleOverrides: Array<{
  dayOfWeek: number;  // 0-6 (Sunday-Saturday)
  startTime?: string;  // HH:MM, overrides schoolStartTime for this day
  endTime?: string;    // HH:MM, overrides schoolEndTime for this day
}>
```

**Use cases:**
- Friday early dismissal: `{ dayOfWeek: 5, endTime: "13:00" }`
- Wednesday late start (staff meeting): `{ dayOfWeek: 3, startTime: "09:00" }`

### 2.5 Per-grade overrides

```ts
gradeScheduleOverrides: Array<{
  gradeId: ObjectId;
  periodsPerDay?: number;   // Override for this grade
  periodDuration?: number;  // Override for this grade (minutes)
  periodSlots?: IPeriodSlot[];  // Explicit slots for this grade
}>
```

**Use cases:**
- Primary grades (1–6): 7 periods × 35 min
- Secondary grades (7–12): 8 periods × 40 min
- Kindergarten: 5 periods × 30 min

### 2.6 Assembly per-day overrides

```ts
assemblyDailyOverrides: Array<{
  dayOfWeek: number;   // 0-6
  startTime?: string;  // HH:MM, overrides assembly start for this day
  duration?: number;   // minutes, overrides assembly duration for this day
}>
```

**Use cases:**
- Shorter assembly on Friday: `{ dayOfWeek: 5, duration: 15 }`
- Later assembly on Wednesday (staff meeting): `{ dayOfWeek: 3, startTime: "08:00" }`

### 2.7 Assembly per-grade overrides

```ts
assemblyGradeOverrides: Array<{
  gradeId: ObjectId;
  startTime?: string;  // HH:MM, overrides assembly start for this grade
  duration?: number;   // minutes, overrides assembly duration for this grade
}>
```

**Use cases:**
- Kindergarten: later, shorter assembly `{ gradeId: "...", startTime: "08:00", duration: 15 }`
- Secondary: standard assembly time, no override needed

---

## 3. Resolution Logic

### 3.1 `getResolvedScheduleSettings(settings, gradeId?, dayOfWeek?)`

Returns effective values for a given context:

| Field | Resolution order |
|-------|------------------|
| `startTime` | daily override for dayOfWeek → school-wide default |
| `endTime` | daily override for dayOfWeek → school-wide default |
| `periodsPerDay` | grade override for gradeId → school-wide default |
| `periodDuration` | grade override for gradeId → school-wide default |
| `periodSlots` | grade override for gradeId → school-wide default → generate from resolved start/duration/count |

### 3.2 Break resolution: `getResolvedBreaks(settings, gradeId?, dayOfWeek?)`

Returns effective break periods for a given day and grade. For each base break, applies per-day override (if day and breakName match) then per-grade override (if grade and breakName match). Grade override wins over day override.

### 3.3 Assembly resolution: `getResolvedAssembly(settings, gradeId?, dayOfWeek?)`

Returns effective assembly for a given day and grade, or `null` if assembly does not occur on that day:

| Field | Resolution order |
|-------|------------------|
| `startTime` | grade override for gradeId → daily override for dayOfWeek → assembly.startTime |
| `duration` | grade override for gradeId → daily override for dayOfWeek → assembly.duration |

Assembly applies only when `dayOfWeek` is in `assembly.days`.

### 3.4 Period slot generation

When `periodSlots` is not explicitly set, generate from:
- Resolved `startTime`, `periodDuration`, `periodsPerDay`
- School-wide `breaks` (breaks apply to all contexts)
- Assembly (if applicable for the day)

---

## 4. Timetable Creation Integration

### 4.1 Class timetable editor

- **Input**: `classId`, `className`, `gradeId`
- **When adding a slot** for a specific day:
  - Call `getResolvedScheduleSettings(settings, gradeId, dayOfWeek)`
  - Use resolved `periodSlots` (or generated) as period options for the period dropdown
- **Result**: Period options reflect the correct schedule for that class's grade and that specific day

### 4.2 Master timetable views

- Teacher/student/parent views use resolved settings when displaying timetables
- Each class's slots are created with times that align with its grade's schedule
- Day-specific overrides affect which periods exist on that day (e.g., fewer periods on early-dismissal days)

---

## 5. Migration Path

### 5.1 Backward compatibility

- **Existing schools**: No overrides → behavior identical to today (school-wide defaults only)
- **New fields**: `dailyScheduleOverrides` and `gradeScheduleOverrides` default to `[]`
- **No breaking changes**: All existing API consumers continue to work

### 5.2 Adoption steps

1. Deploy schema + API + resolution logic
2. Settings UI: Add expandable sections for per-day and per-grade overrides
3. Class timetable editor: Pass `gradeId` and `dayOfWeek`, use resolved settings
4. Optional: Add migration script to convert school-wide settings to grade-level overrides if desired (not required)

### 5.3 Data migration

- **None required** — New fields are additive; existing documents work without them
- MongoDB: Fields omitted from documents are treated as empty arrays

---

## 6. API Contract

### PATCH /api/admin/settings

**Request body** (additive):

```json
{
  "dailyScheduleOverrides": [
    { "dayOfWeek": 5, "endTime": "13:00" }
  ],
  "gradeScheduleOverrides": [
    {
      "gradeId": "<ObjectId>",
      "periodsPerDay": 7,
      "periodDuration": 35
    }
  ]
}
```

**Response**: Full settings object including new fields.

---

## 7. UI Requirements

### 7.1 Daily Schedule tab — Per-day overrides

- Expandable section: "Per-day overrides"
- List existing overrides (day name, start/end if set)
- "Add override" → select day (Mon–Sat), optional start time, optional end time
- Remove override button per row

### 7.2 Daily Schedule tab — Per-grade overrides

- Expandable section: "Per-grade overrides"
- List existing overrides (grade name, periods, duration)
- "Add override" → select grade, optional periods per day, optional period duration
- Remove override button per row

---

## 8. File Reference

| File | Purpose |
|------|---------|
| `src/models/SchoolSettings.ts` | Schema: dailyScheduleOverrides, gradeScheduleOverrides |
| `src/lib/timetable/scheduleSettings.ts` | `getResolvedScheduleSettings()` |
| `src/app/api/admin/settings/route.ts` | PATCH accepts and persists new fields |
| `src/app/(app)/admin/settings/page.tsx` | UI for per-day and per-grade overrides |
| `src/hooks/admin/useSchoolSettings.ts` | DTO types include new fields |
| `src/components/admin/classes/detail/ClassTimetableEditor.tsx` | Uses resolved settings with gradeId, dayOfWeek |
| `src/lib/timetable/scheduleSettings.ts` | `getResolvedAssembly()`, `getResolvedBreaks()` for overrides |
