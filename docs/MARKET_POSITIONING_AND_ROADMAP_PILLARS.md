# EduSentrix — Market positioning & roadmap pillars

**Audience:** Private basic schools, SHS, and international schools in Ghana  
**Product:** EduSentrix web app (multi-tenant school OS)  
**Companion:** Mobile app (`jedi-app`, separate repo — review in progress)  
**Last updated:** 2026-04-09  

---

## Positioning (one sentence)

EduSentrix is the **Ghana-native school operations and fee rail**—with **curriculum-aware academics and parent-facing clarity**—so private basic, SHS, and international schools run enrollment-to-cash-to-classroom on one system without importing a foreign SIS wholesale.

## Who we optimize for

| Segment | What “winning” looks like |
|--------|---------------------------|
| **Private basic** | Low-friction fees, trusted balances/receipts, simple class and student setup, strong parent comms. One head often wears many hats—onboarding must be short. |
| **SHS** | Clear terms/semesters, credible **progression and results** storytelling toward national exams (WAEC-facing clarity), stronger **student** self-service over time. |
| **International (in Ghana)** | Curriculum labels and reporting language that match **Cambridge / IB / British** expectations; polished **reports and calendar**; fee and audit clarity for demanding parents. |

International schools here still pay and comply in the **local context**—a **GHS-first fee core** with room to grow (e.g. multi-currency later) is aligned with reality.

---

## Product pillars (mapped to the app today)

These are the strategic buckets; each is already represented in the codebase (routes are indicative—use the live nav as source of truth).

1. **Money that schools can defend**  
   School-side fees, invoices, recording payments, expenses, financial center, reconciliation, disbursements, subscription/billing, and **payment setup** (billing owner path). This is the wedge for Ghana private schools.

2. **Structure that scales from Primary 1 to SHS**  
   Grades, class groups, subjects, curriculum settings, academic calendar, periods, promotions, timetable—so basic and SHS can share one product without duplicate code paths.

3. **Teaching and learning that teachers actually use**  
   Teacher Studio (assignments, quizzes, resources, rubrics, submissions), gradebook, lesson notes, journals, attendance—aligned to how private schools market “quality.”

4. **Trust with families**  
   Parent wards, fees, payments, attendance, academics, messages/notifications; student assignments, results, timetable (where enabled), notices. International segments lean hard on this pillar.

5. **Platform operations (you + growth)**  
   Platform admin: schools, applications, billing/usage/tiers—how you onboard and retain schools at scale.

6. **Governance of sensitive money**  
   Billing owner / bursar / finance delegate boundaries and payment setup—critical for proprietors and auditors as you move upmarket.

---

## Roadmap pillars (prioritized, not a feature list)

### Near term (defend the wedge)

- Harden **end-to-end fee journeys** (invoice → pay → record → parent truth) for **GHS** and real Paystack behaviour (test vs live clarity).  
- **SHS narrative**: term/semester results and admin/parent/student surfaces tell one consistent story (even before exotic exam integrations).  
- **International polish**: curriculum-facing labels, report exports, and calendar/report card expectations—pick one international profile and make it exemplary.  
- Close gaps that break trust: **role boundaries**, audit visibility on money, and **student** parity where older learners expect it (e.g. comms and clarity on work/results).

### Medium term (deepen moat)

- Deeper **registrar** story: transcripts, graduation rules, optional subject streams—only where schools will pay for compliance and time saved.  
- **Integrations** that Ghana and international parents expect next: messaging channels, accounting exports, webhooks—after core workflows are boringly reliable.  
- Optional **operational** modules (transport, library, health) only when a paying cohort demands them—avoid diluting the fee + academics core.

---

## Must-haves vs nice-to-haves (Ghana launch)

Use this for scope review: **must-haves** defend the wedge; **nice-to-haves** follow paying segments or post-wedge reliability.

### Must-haves (ship and defend in Ghana)

**Product / trust**

- **Fee truth end-to-end**: invoice → Paystack/offline record → parent sees the same numbers → audit trail.  
- **Role boundaries**: school admin vs bursar vs billing owner; no silent access to payout data.  
- **Stable core journeys** for admin, teacher, parent (and student where you promise it): login, class context, fees, key academics surfaces.  
- **Curriculum / stage honesty**: NaCCA vs international profiles—labels, reports, and calendars must not contradict the school’s marketed programme.  
- **Data resilience**: backups, export of critical records (at least students + money), supportable incident response.

**Ghana reality**

- **GHS-first** money UX; **Paystack test vs live** clarity for schools and internal ops.  
- **Clear SHS story**: terms, progression, results surfaces aligned (even if WAEC registration stays manual).  
- **International-in-Ghana**: at least one **reference** international profile polished for demos and pilots—not necessarily every standard on day one.

**Go-to-market**

- **Onboarding playbooks** (school + billing owner + first fee run).  
- **Support & escalation** when money or access breaks.

### Nice-to-haves (after the wedge is boring, or pilots demand)

- Deep **registrar** (transcripts, graduation rules, optional streams) beyond what parents already accept.  
- **Integration marketplace** (webhooks, accounting exports, messaging providers) once core workflows are trusted.  
- **Operational modules** (transport, library, cafeteria, multi-campus) as optional products—not blocking launch.  
- **Enterprise LMS** extras: LTI, proctoring, granular competency engines—**segment-driven** (often international or exam-heavy SHS).  
- **Full HR/payroll** as system of record—usually **later** or **partner** in Ghana unless you target large groups.

---

## Deep dives (scope themes)

Expanded notes for roadmap and sales conversations.

### Transport

Routes, vehicles, stops, rider lists, parent notifications (sometimes GPS). Common in larger urban private schools; high **safety + ops** expectations. Usually **not a v1 must-have** unless early paying schools insist. Phase **lite** (roster + notices) before fleet/GPS. **Risk:** large support surface; link transport fees to the **fee core** only after money is rock solid.

### Library

Catalog, circulation, fines, inventory. Many Ghana schools are small; “library” is often informal. **Rarely** a national launch must-have unless accreditation demands it. **Nice-to-have:** reading lists / resources in Teacher Studio, or a simple **asset list**, before full circulation.

### Cafeteria

Menus, ordering, dietary flags, POS, prepayment. Uptake varies; some schools outsource meals. **Not** a broad launch must-have. **Nice-to-have:** feedback channels you already have patterns for, or a **simple prepaid lunch fee** line item—plays to **fee** strength better than a full canteen OS early.

### Multi-campus

One legal school, many sites—shared branding, split timetables, consolidated or split billing. Relevant for growing chains (e.g. Accra/Kumasi). **Must-have** only if enterprise deals are in the first 12 months; otherwise **nice-to-have**. Touches **every** module—prefer an explicit **campus** dimension in the data model before bolting on.

### Payroll & HR (Ghana first)

Schools need attendance, leave, performance, contracts; **full payroll** adds PAYE, SSNIT, Tier 2/3, payslips, statutory filings. **Ghana reality:** payroll is sensitive; many schools use accountants, specialist payroll, or spreadsheets. **Full in-app payroll** is a **multi-year** product, not a side module.

- **v1:** Usually **no full payroll**. **HR-lite** is enough: staff records, roles, leave, attendance, documents—aligned with what you already lean toward.  
- **Later / nice-to-have:** Payroll engine or **certified integration** with a Ghana payroll provider.  
- **Positioning:** “We run **school operations**; payroll can **export** to your accountant or partner.”

### Prospect → applicant → enrolled CRM

International and premium private schools expect pipeline stages, tours, offers, deposits, enrolment contracts, re-enrolment. You have **platform applications**; many schools still use WhatsApp + forms. **Segment-dependent must-have:** credible funnel for **international** and **tier-1 private** becomes a **sales** requirement; **mass basic** may need a lighter funnel. **Practical v1:** structured pipeline + tasks + communication log + conversion to student record often beats a bloated CRM.

### LTI / deep integrations (Google Classroom, Teams, etc.)

Matters most to **international** schools and teachers already on Google/Microsoft. **Not a Ghana launch blocker** unless a lighthouse school requires it. **Nice-to-have path:** CSV export, calendar feeds, then LTI/OAuth when a segment pays for ongoing maintenance. Integrations are **long-term** engineering + support—ship with **named customers**.

### Proctoring / secure high-stakes exams

WAEC is **external**; the app supports **internal** assessments. Proctoring (locked browser, ID, AI invigilation) is **expensive** and **niche**—mostly international, university-style, or premium SHS internals. **Not** a broad Ghana must-have. **Nice-to-have:** strong quiz settings (time limits, question banks, attempt limits) first; **proctoring partners** later if revenue proves it.

### Competency (standards / mastery)

NaCCA and international frameworks differ; mastery gradebooks are a **curriculum product**. **Must-have:** **consistent grading + reporting** for the profiles you claim. **Nice-to-have:** granular competency tagging, skills passports—after **one** curriculum track is exemplary.

### Wellbeing (safeguarding, counselling, nurse)

International parents and accreditors increasingly want **structured safeguarding**; health modules carry consent and retention burden. **Ghana first:** pastoral care is often informal; **digital safeguarding** is an **upsell** to premium/international. **Must-have:** clear **escalation / incident** pathways if you expose child safety—keep them **defensible** and **auditable**. **Nice-to-have:** dedicated wellbeing module, nurse visits, counselling notes—phase with **legal review**.

---

## Mobile companion app (`jedi-app`)

Treat the mobile app as the **companion** to the wedge: fees visibility, notices, attendance, assignments—**not** every admin surface on day one. **Launch must-have** is **parity with what marketing promises** (e.g. parents can pay and see fees on mobile). Everything else is iterative.

---

## How this connects to testing

Use **`docs/REAL_WORLD_UAT_GUIDE.html`** (or your exported checklist) to prove each pillar in staging: at least one path per segment (basic vs SHS vs international profile) through **fees → classroom → parent → money truth**.

---

## What we are not trying to be (by design)

A full global “everything OS” (fleet transport, payroll, alumni CRM, LTI marketplace) in v1. Those belong on the roadmap **after** EduSentrix is the obvious choice for **fee integrity + daily school run** in Ghana’s private and international segment.

---

## One-line summary (review)

**Must-haves:** Fee integrity + roles + core school run + honest curriculum story + Ghana payment reality + credible path for SHS and at least one international profile.  
**Nice-to-haves:** Transport, library, cafeteria, multi-campus, full payroll, deep CRM, LTI, proctoring, competency depth, wellbeing suite—**prioritized by paying segment**, not by feature count.
