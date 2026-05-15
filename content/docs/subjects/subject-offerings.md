# Subject Offerings

Subject offerings are **curriculum-scoped** records that describe *what is taught* at your school: display name, code, stage, **grade band** (for example Basic, JHS, SHS), optional NaCCA lesson-note templates, and links to the underlying subject catalog where applicable. Class groups carry **`subjectOfferingIds`** so timetables, teacher assignments, and lesson notes resolve to the correct offering—not only a generic subject name.

Open **Subjects** from the admin sidebar at `/admin/subjects`.

## Why offerings matter

- **One subject, many offerings**: “Mathematics” can differ by level (JHS vs SHS) or pathway; each offering can have its own code, templates, and assigned classes.
- **Bulk work from grades**: From a **grade** overview, you can assign offerings to every class in that grade. The picker shows offerings for that grade’s **band** only (for example JHS 1–3 see JHS-band offerings). If nothing is set up yet, the list is empty until you create or import offerings.
- **Teachers map to offerings**: Where configured, teacher assignments align with the offering a class actually takes, keeping homeroom and subject teaching consistent.

## Typical workflows

### 1. Set up from curriculum templates

Use **setup from curriculum** (or equivalent) on the Subjects / offerings screen to seed offerings from your school’s curriculum templates (for example Ghana Basic). Review names, codes, and bands, then activate or adjust as needed.

### 2. Create a custom offering

When you need an offering that templates do not cover:

1. Open the **custom offering** flow (from Subjects or from the grade bulk-assign modal when the list is empty).
2. Enter **display name**, **code**, **stage**, **grade band**, and any optional metadata (templates, description).
3. Save, then **assign to class groups** (per class or in bulk from the grade page).

### 3. Assign offerings to classes

- **Per class**: From class detail or subject flows, attach the offerings that class should take.
- **Bulk by grade**: On the grade detail page, use **assign subject offerings** to push the same set of offerings to all classes in that grade. Offerings are filtered by the grade’s band; you can allow edge cases where the API supports incompatible placement when explicitly requested.

### 4. Assign teachers

From an offering’s detail (or teacher flows), map teachers to the offering for the classes they teach. Homeroom assignments stay separate where your school uses them.

## Relationship to “Subjects”

Legacy **Subject** rows may still exist for catalog and reporting. **Offerings** are the operational layer classes and timetables use. Prefer configuring classes with **subject offerings**; use generic subject management when you are maintaining the master list or older data.

## Related

- [Managing Subjects](./managing-subjects.md) — catalog-style subject list and detail pages
- [Managing Class Groups](../class-groups/managing-class-groups.md) — class structure and student placement
- [Teacher Assignments](../teachers/teacher-assignments.md) — how staff link to classes and subjects
