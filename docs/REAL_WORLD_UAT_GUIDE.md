# EduSentrix Real-World UAT Guide

Generated from the current codebase on 2026-04-09.

## Purpose

This guide is a role-by-role, real-world test checklist for EduSentrix. It is meant to help you test the app like an actual school would use it, from school enrollment through operations, teaching, finance, parent usage, and student usage.

Each test item includes:

- what to do
- the expected result
- the role linkage where the workflow continues in another role

## Roles Covered

- Public school applicant
- Platform admin
- School admin
- Billing owner
- Bursar / finance delegate
- Teacher
- Parent
- Student
- Staff invitation / staff access sanity checks

## Recommended Test Data Setup

- 1 fresh school application that has not been approved yet
- 1 legacy school where billing owner has not been handed off yet
- 1 newer school where billing owner is separate from school admin
- at least 2 academic periods
- at least 3 grades and 3 class groups
- at least 3 teachers
- at least 10 students across multiple classes
- at least 4 parents linked to wards
- at least 1 bursar and 1 finance delegate invite target
- fee structures for at least 2 terms
- at least 1 school with payment setup not started
- at least 1 school with `awaiting_billing_owner`
- at least 1 school with `details_submitted`
- at least 1 school with `pending_provisioning`
- at least 1 school with `review_required`
- at least 1 school with `provisioned`

## High-Risk Areas To Watch

- Parent online payment is only available when the school payment rail is fully provisioned.
- Billing-owner handoff changes what school admins can see and edit.
- Subscription state affects admin, teacher, and parent access surfaces.
- Teacher attendance, assignments, grades, and calendars all feed downstream parent or student views.
- Some platform sidebar items appear to be present in navigation without matching page implementations in this repo. Treat navigation integrity as a test item.
- The `staff` role exists in the domain model, but this repo does not currently expose a dedicated `/staff` app shell.
- Student timetable depends on a timetable role-view feature flag.

## Cross-Role Flows

Use these as end-to-end sweeps after role-specific testing.

| Flow ID | Start | End | What To Validate | Expected Result |
| --- | --- | --- | --- | --- |
| XR-01 | Public applicant | Platform admin -> School admin | School application approval pipeline | Approved application creates or links a school, creates school-admin access, sends invite, and leads into onboarding. |
| XR-02 | School admin | Parent | Student and guardian setup | Students created by admin appear as wards for linked parents, with correct names, classes, and finance context. |
| XR-03 | School admin | Teacher | Teacher onboarding | Teacher invite acceptance creates a usable teacher account with assigned class or subject context. |
| XR-04 | School admin / Billing owner | Parent | Payment-readiness chain | Parent sees offline payment copy until the school is provisioned, then sees online checkout actions when eligible invoices exist. |
| XR-05 | Teacher | Parent | Attendance downstream | Teacher-marked attendance appears in parent attendance views and, when enabled, drives guardian notifications. |
| XR-06 | Teacher | Student -> Parent | Assignment lifecycle | Published assignments become visible to students; submissions and grading feed student detail and parent academic visibility. |
| XR-07 | Teacher | Student -> Parent | Gradebook/results chain | Teacher-entered grades surface in student results and parent academic progress or reports. |
| XR-08 | School admin | Teacher -> Parent -> Student | Academic calendar publishing | Published calendars and events become visible to role-specific calendar views with correct audience scoping. |
| XR-09 | School admin / Bursar | Finance views | Fees and transactions | Invoices, recorded payments, and checkout payments appear consistently in fee summaries, transactions, and reconciliation surfaces. |
| XR-10 | Platform admin | Admin -> Teacher -> Parent | Subscription status handling | Trial shows banners; suspended or cancelled status blocks app surfaces with overlay instead of partial breakage. |
| XR-11 | Billing owner | School admin / Finance delegate | Access handoff | School admin retains control until invite acceptance, then becomes read-only for payout details after handoff is accepted. |
| XR-12 | Teacher | School admin | Escalations and student detail | Teacher escalations and behaviour-related actions should be traceable from student-centric admin views and logs. |

## Public School Applicant

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| APP-01 | Submit a complete school application from `/enroll`. | Submission succeeds with no server error, and the application is visible to platform admin as pending. | Platform admin |
| APP-02 | Submit with invalid or missing admin email, school name, or phone. | Validation blocks submission or returns a clear error message instead of silently failing. | None |
| APP-03 | Submit two applications with very similar school names. | Platform team can still distinguish applications clearly in list and detail views. | Platform admin |
| APP-04 | Verify acknowledgement or confirmation after application submission. | Applicant gets a clear success state and is not left unsure whether the application was created. | None |
| APP-05 | After approval, follow the invite or sign-in path as the new school admin. | The invited admin lands in onboarding or the correct dashboard path instead of a dead end. | School admin |

## Platform Admin

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| PA-01 | Open platform overview dashboard. | Revenue, school counts, pilot counts, and recent sync runs load without broken cards. | None |
| PA-02 | Open applications list, filter by status, type, query, and date range. | Metrics and list content stay consistent with the selected filters. | Public applicant |
| PA-03 | Open an application drawer or detail and approve it. | Application moves to approved, school is created or linked, school-admin access is provisioned, and subscription defaults are created. | School admin |
| PA-04 | Reject an application with a note. | Application moves to rejected with traceable audit context and no partial-school side effects. | Public applicant |
| PA-05 | Re-approve or revisit a previously rejected or reviewed application where supported. | State transitions remain coherent and do not create duplicate schools or duplicate admins. | School admin |
| PA-06 | Open platform schools list and use search and queue filters. | Schools can be triaged by payment setup state, readiness, and risk. | Billing owner / School admin |
| PA-07 | Open a school detail page with payment setup review required. | Platform admin can inspect masked bank data, billing-owner info, review reason, and Paystack error context. | Billing owner |
| PA-08 | Approve a school payment setup review and then send another one back with a reason. | Approval returns the school to normal submission flow; send-back preserves a clear reason visible to the school side. | Billing owner / School admin |
| PA-09 | Open platform billing and update platform payout destinations using the verification challenge flow. | Sensitive payout changes require the challenge step and audit correctly. | None |
| PA-10 | Test platform school-fee policy controls and school subscription controls. | Platform fee policy and subscription updates persist and affect the targeted school only. | School admin / Parent |
| PA-11 | Run pilot closeout generation, then approve and reject runs. | Runs remain pending until explicitly reviewed; decisions are recorded clearly. | None |
| PA-12 | Open provider sync, usage, cost, revenue, events, and tiers pages. | Billing operations pages load usable data and actions work without corrupting other billing records. | None |
| PA-13 | Click every platform sidebar item. | Every visible item should either resolve to a real page or be removed from navigation. This repo currently suggests dead-link risk for several items. | None |

## School Admin

### Onboarding, Setup, And Access

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| SA-01 | Start onboarding after platform approval. | School admin lands in the launch wizard and can progress through profile, school details, payment setup, and curriculum. | Platform admin |
| SA-02 | Complete onboarding with self-managed payment setup. | School is activated, onboarding completes, and payment setup status reflects submitted or provisioned progress correctly. | Billing owner / Parent |
| SA-03 | Complete onboarding by inviting a billing owner instead of self-managing. | School continues onboarding, payment setup moves to `awaiting_billing_owner`, and invite metadata is preserved. | Billing owner |
| SA-04 | For a legacy school, open `/admin/settings/payment-setup` from admin settings. | The entry appears when the admin still controls setup and does not disappear into an undiscoverable state. | Billing owner |
| SA-05 | After handing off to a different billing owner and that invite is accepted, revisit payment setup as school admin. | School admin sees status and readiness only, with payout details hidden and edit actions removed. | Billing owner |

### People, Invitations, And Records

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| SA-06 | Create a student from the dashboard quick action. | Student record is created successfully and appears in students list and student detail views. | Parent |
| SA-07 | Create a teacher from the dashboard quick action. | Teacher record is created or invitation is sent successfully, depending on the flow. | Teacher |
| SA-08 | Create class groups from dashboard or class flows. | New classes appear in relevant academic, timetable, and teacher-assignment surfaces. | Teacher / Student |
| SA-09 | Create an academic period. | The period becomes available for reporting, fees, and academic filters. | Teacher / Parent / Student |
| SA-10 | Invite teacher, staff, parent, bursar, school admin, and billing owner roles where applicable. | Invitations create clean pending records with correct role labels and resend or revoke support. | Teacher / Parent / Bursar / Billing owner / Staff |
| SA-11 | Open invitation management, filter, resend, revoke, delete, and export CSV. | Invitation state changes are reflected accurately and exports match visible records. | All invited roles |
| SA-12 | Open a student detail page and visit overview, academics, fees, behaviour, relationships, activity, and insights tabs. | Student-centric data loads consistently across tabs without partial or contradictory state. | Parent / Teacher |
| SA-13 | Verify guardian linkage and relationships on student detail. | Parents linked to the student are displayed correctly, and the same child appears in parent ward views. | Parent |

### Academics And Operations

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| SA-14 | Create or edit grades, subjects, and class assignments. | Structures save cleanly and are available for teacher and student academic flows. | Teacher / Student |
| SA-15 | Configure curriculum and test both immediate and scheduled curriculum change paths. | Current curriculum or pending curriculum state is shown clearly and persisted correctly. | Teacher / Student |
| SA-16 | Build and publish an academic calendar, then add targeted and school-wide events. | Draft vs published rules hold, audience targeting works, and published events become visible downstream. | Teacher / Parent / Student |
| SA-17 | Create repeating events, non-teaching days, and weekend-spanning events. | Weekend-splitting and publish warnings behave correctly; no malformed occurrences are produced. | Teacher / Parent / Student |
| SA-18 | Open academic periods list and a specific period detail page. | Period summaries, related reports, and status context remain coherent. | Teacher / Parent / Student |
| SA-19 | Test promotions: create policy, run a cycle, review promote or repeat outcomes, and override where needed. | Promotion recommendations are reviewable before application and student placement changes are traceable. | Student / Parent |
| SA-20 | Open master timetable and verify the school can see timetable assignments. | Admin timetable data is usable and aligns with teacher or student timetable views when enabled. | Teacher / Student |

### Fees, Finance, Reports, And Community

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| SA-21 | Create fee structures and deactivate one. | Structures are append-only templates, can be deactivated safely, and feed invoice creation correctly. | Parent / Bursar |
| SA-22 | Create single invoices, bulk invoices, issue, cancel, export, and record payment. | Invoice totals, statuses, payments, outstanding amounts, and event timelines stay correct. | Parent / Bursar |
| SA-23 | Attempt invoice creation when period rules block the operation. | Admin gets a clear blocked state rather than silent failure. | None |
| SA-24 | Open overdue report and download the verified PDF. | Overdue exposure totals match visible rows and PDF generation completes successfully. | Bursar |
| SA-25 | Open finance center, transactions, expenses, disbursements, and reconciliation. | Overview KPIs align with downstream finance pages and drill-down links stay consistent. | Bursar |
| SA-26 | Record or review expenses, budgets, and disbursement flows. | Finance data is categorized correctly and linked to transaction ledgers where applicable. | Bursar |
| SA-27 | Open reports, change reporting windows, export CSVs, and generate Leo brief and PDF. | Report filters affect charts and exports consistently; recent export history is accurate. | Parent / Student / Teacher |
| SA-28 | Open documents and verify expiring documents, teacher documents, student documents, and report files. | Document dashboards populate cleanly and expiry-driven alerts are meaningful. | Teacher / Student |
| SA-29 | Create, publish, approve, reject, and export community polls. | Poll state transitions hold and only allowed edits remain possible once live. | Teacher / Community participants |
| SA-30 | Create, publish, pause, resume, close, share, and review fundraising campaigns and donations. | Campaign state, donation totals, exports, and finance traces remain consistent. | Finance / Donors |

### Settings, Features, And Subscription Behavior

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| SA-31 | Update school settings for schedule, attendance rules, working days, and teacher-studio flags. | Changes persist and downstream teacher or calendar behavior reflects them. | Teacher |
| SA-32 | Toggle attendance notifications by channel. | Teacher attendance pages respect enabled or disabled guardian notification settings. | Teacher / Parent |
| SA-33 | Toggle offline mode and test with teacher workflows later. | Offline-capable surfaces show sync messaging instead of failing silently. | Teacher |
| SA-34 | Open subscription and billing, start an upgrade flow, and verify checkout return handling. | Plan updates only apply after successful checkout; failure states are explicit. | Platform admin |
| SA-35 | Put the school in trial, suspended, and cancelled subscription states in a test environment. | Trial banner appears; suspended or cancelled state shows blocking overlay for admin, teacher, and parent roles. | Teacher / Parent |

## Billing Owner

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| BO-01 | Accept a billing-owner invite and land in payment setup. | Billing owner reaches `/admin/settings/payment-setup` directly with proper access. | School admin |
| BO-02 | Save bank, branch, account name, and account number details. | Payout details persist cleanly and masked account info shows in summary surfaces. | Parent |
| BO-03 | Edit payout details on a school that is not yet live. | Changes save without requiring payout-change approval flow intended for live schools. | Parent |
| BO-04 | Edit payout details on a school that is already live. | Setup may move into review-required flow or guarded approval flow rather than silently changing a live payout rail. | Platform admin / Parent |
| BO-05 | Start provisioning after payout details are complete. | Status moves to `pending_provisioning` or `provisioned`, and readiness messaging updates accordingly. | Parent / School admin |
| BO-06 | Test each payment-setup state: `not_started`, `awaiting_billing_owner`, `details_submitted`, `pending_provisioning`, `review_required`, `failed`, `provisioned`. | Labels, helper copy, and action availability match the underlying state accurately. | School admin / Parent |
| BO-07 | Invite a finance delegate and then remove that delegate. | Delegate invitation and removal work; only billing owner can manage this path. | Bursar / Finance delegate |
| BO-08 | Replace the billing owner with another person. | Current owner keeps control until replacement accepts; after acceptance, previous owner loses billing-owner authority. | School admin |
| BO-09 | Revisit payment setup after handoff is complete and verify school-admin visibility. | School admins see readiness only, not sensitive bank details. | School admin |
| BO-10 | Confirm parent checkout enablement once setup is fully provisioned. | Settings shows that parents can pay online and parent fee pages expose online checkout actions. | Parent |

## Bursar / Finance Delegate

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| BF-01 | Accept a bursar invitation and open `/bursar` or finance center. | User reaches finance surfaces instead of a broken or generic dashboard. | School admin |
| BF-02 | Review finance dashboard KPIs, recent transactions, fee stats, and reconciliation snapshot. | Overview cards align with detailed transaction and fees pages. | School admin |
| BF-03 | Open fees and payments, review outstanding balances, and record an offline payment. | Payment allocation updates invoice and fee summaries immediately and correctly. | Parent |
| BF-04 | Create or review expenses and confirm status progression. | Expense states, totals, and recent lists remain consistent across expenses and finance center. | School admin |
| BF-05 | Open transactions ledger and filter by direction, category, payment method, or reconciliation status. | Filters narrow the ledger correctly without hiding valid transactions unexpectedly. | None |
| BF-06 | Open a single transaction detail page and perform reconciliation actions such as match, dispute, ignore, or unmatch. | Reconciliation status updates cleanly and remains visible in both list and detail views. | School admin |
| BF-07 | Run reconciliation from the reconciliation console. | Run summary, unmatched counts, and alerts update without duplicating or losing matches. | School admin |
| BF-08 | Ingest or review reconciliation evidence and work through alert resolution. | Alerts stay actionable and resolved items exit the active-alert bucket. | None |
| BF-09 | Create teacher and vendor disbursements. | Disbursement records are created with correct recipient type, amounts, and approval state. | Teacher / Vendor |
| BF-10 | Test maker-checker approval rules on disbursements. | A different finance user is required where maker-checker applies; self-approval is blocked. | School admin |
| BF-11 | Reconcile a Paystack disbursement. | Transfer verification updates processor fee, total debit, and final status correctly. | None |
| BF-12 | If invited as finance delegate from payment setup, verify access boundaries. | Finance delegate can help manage setup but cannot perform billing-owner-only approval actions. | Billing owner |

## Teacher

### Access, Classes, And Core Teaching

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| T-01 | Accept a teacher invite and sign in. | Teacher reaches teacher dashboard with their school context and not a generic fallback route. | School admin |
| T-02 | Open classes and students pages. | Assigned classes and students are present, and links resolve to valid student or class context. | School admin |
| T-03 | Open gradebook and then a specific class-group/subject detail page. | Gradebook loads only where permission allows and supports entering or editing assessments. | Student / Parent |
| T-04 | Add or update gradebook scores for several students. | Save succeeds, gradebook reflects new scores, and downstream analytics or result views can use the data. | Student / Parent |
| T-05 | Open analytics and at-risk pages. | Completion, attendance, performance, and at-risk indicators load without contradiction. | School admin |

### Attendance, Journals, And Lesson Delivery

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| T-06 | Record homeroom attendance for a full class. | Attendance saves successfully and summary counts are correct. | Parent |
| T-07 | Record period attendance and compare with homeroom or history views. | Period attendance saves correctly and appears in history where expected. | Parent |
| T-08 | Turn guardian notifications off in school settings, then record absences. | Teacher sees clear messaging that attendance records will save without guardian notifications. | School admin / Parent |
| T-09 | Enable notifications and record late or absent students again. | Parent attendance and notification surfaces reflect the new records. | Parent |
| T-10 | Open class journal, save a draft, publish an entry, edit it, and delete another one. | Journal entries keep correct draft or published status and survive refresh. | School admin |
| T-11 | Test an offline-style save path for attendance, resources, or journal entries. | UI shows sync-later messaging instead of dropping the action silently. | School admin |
| T-12 | Open lesson notes and progress them through available states. | Draft, submitted, or published note states behave consistently. | School admin |

### Teacher Studio, Communication, And Intervention

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| T-13 | Create an assignment as draft, then publish it. | Students do not see the draft but do see the published item. | Student |
| T-14 | Create a quiz with timing or late-submission rules and publish it. | Student-facing behavior respects timing, locking, and submission-policy rules. | Student |
| T-15 | Archive an assignment or project. | Archived items are no longer treated as active classroom work. | Student |
| T-16 | Upload resources and edit or archive them. | Resource library updates cleanly and reflects changes after refresh. | Student |
| T-17 | Open submissions list and a specific submission, save a grade, and publish a grade. | Submission grading state is explicit and student feedback is retained. | Student / Parent |
| T-18 | Draft, publish, and archive notices. | Published notices are visible to allowed audiences; draft or archived notices are not. | Student |
| T-19 | If teacher publish permission is restricted, attempt to publish anyway. | UI should block publishing cleanly and keep draft creation available. | School admin |
| T-20 | Start a message thread with a parent or respond in an existing thread. | Messages send successfully and appear in the corresponding parent thread. | Parent |
| T-21 | Create an escalation and update its status through the available lifecycle. | Escalation status changes persist and remain traceable. | School admin |
| T-22 | Open teacher settings, adjust notification preferences and quiet hours, and send a test WhatsApp message if configured. | Settings persist correctly and test actions provide clear pass or failure feedback. | None |

## Parent

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| P-01 | Sign in as a parent with multiple linked wards. | Parent dashboard shows correct ward count, summaries, and quick actions. | School admin |
| P-02 | Open wards list and then each ward detail tab: overview, timetable, academics, fees, attendance. | Each ward page loads only that child’s data with no leakage across siblings. | School admin / Teacher |
| P-03 | Open academic progress and compare it to teacher-entered grades. | Performance summaries reflect the latest valid academic records. | Teacher |
| P-04 | Open attendance overview and compare recent records to teacher attendance actions. | Attendance by child and recent logs match recorded teacher attendance. | Teacher |
| P-05 | Open school calendar and verify event audience targeting. | Parent only sees events intended for the school or relevant child scope. | School admin |
| P-06 | Open reports and download available academic reports. | Available reports match the child and term context, and downloads complete successfully. | School admin / Teacher |
| P-07 | Open messages and reply to a teacher thread. | Reply appears in both parent and teacher messaging surfaces. | Teacher |
| P-08 | Open notifications, filter by type, mark single items read, then mark all read. | Notification counts and read states update accurately. | Teacher / School admin |
| P-09 | Open fees summary for a school that is not payment-ready. | Parent sees offline-payment guidance and no broken checkout action. | Billing owner / School admin |
| P-10 | Open fees summary for a payment-ready school with pending invoices. | Parent sees `Pay Now` or equivalent online payment actions for eligible invoices. | Billing owner |
| P-11 | Start checkout preview for one invoice and continue to Paystack. | Checkout preview shows invoice number, fees, payable amount, and redirects correctly. | Billing owner / Finance |
| P-12 | Return from checkout in success, pending, and failure states. | Parent sees accurate post-checkout banners and payment history or outstanding balances refresh correctly. | Finance |
| P-13 | Open payment history and filter by ward or year. | Historical payments are complete, correctly attributed, and consistent with fee balances. | Finance |
| P-14 | Test the same ward on a legacy school where online payments are not live. | Parent still has a coherent fees experience with no dead-end payment CTA. | Billing owner |
| P-15 | If timetable role views are enabled, open timetable for a ward. | Timetable reflects actual class scheduling; if feature is disabled, parent sees a clear unavailable state instead of empty noise. | School admin / Teacher |

## Student

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| S-01 | Sign in as a student and open the dashboard. | Assignments, results, calendar, notices, and profile entry points load correctly. | Teacher / School admin |
| S-02 | Open assignments list after a teacher publishes work. | Published assignments appear; drafts remain hidden. | Teacher |
| S-03 | Open a specific assignment, save a submission, attach files if supported, and submit. | Submission state, timestamps, attempts, and attachment counts update correctly. | Teacher |
| S-04 | Complete a timed quiz and let a timer expire in one run. | Auto-submit and timer-lock behavior matches quiz settings. | Teacher |
| S-05 | Submit work after the due date under different late policies. | Reject, allow, or mark-late behavior matches the assignment configuration. | Teacher |
| S-06 | Reopen the assignment after teacher grading. | Student sees score, feedback, and final submission status clearly. | Teacher |
| S-07 | Open results and compare subject grades with teacher gradebook entries. | Student results match the latest published or valid grading data. | Teacher / Parent |
| S-08 | Open notices after teacher or school-admin publication. | Relevant notices appear; drafts or archived notices do not. | Teacher / School admin |
| S-09 | Open calendar and inspect school, grade, and class-scoped events. | Calendar occurrences respect audience scope and display clean detail views. | School admin |
| S-10 | Open timetable. | If role views are enabled, student timetable loads correctly; otherwise the app shows a clear disabled state. | School admin |
| S-11 | Open profile and verify identity and school-linked metadata. | Student profile resolves without missing-record errors. | School admin |
| S-12 | Re-test assignments, results, and notices after a period or curriculum change. | Student experience remains coherent after academic structure changes. | School admin / Teacher |

## Staff Invitation And Access Sanity Checks

The current repo includes `staff` as a role in invitations and auth mapping, but there is no dedicated staff app shell under `src/app/(app)/staff`.

| ID | Test | Expected Result | Linked Role |
| --- | --- | --- | --- |
| ST-01 | Send a staff invitation from admin invitations flow. | Invitation record is created with role `staff` and can be managed like other invites. | School admin |
| ST-02 | Accept a staff invitation and sign in. | Staff should not be stranded on a broken route; if no dedicated portal exists yet, this should be treated as a product gap. | School admin |
| ST-03 | Verify whether staff can access any intended surface through current auth rules. | Access behavior is explicit and safe, not accidental or inconsistent. | School admin |
| ST-04 | Record this as a release-readiness decision. | Either add a proper staff portal or intentionally constrain staff login until the surface exists. | Product / Engineering |

## Release-Readiness Sweeps

Run these after individual role tests pass.

| ID | Sweep | Expected Result |
| --- | --- | --- |
| RR-01 | Navigation sweep for every visible sidebar link in every role. | No visible link should resolve to a dead route or unexplained error state. |
| RR-02 | Permission sweep using the same school across admin, billing owner, bursar, teacher, parent, and student accounts. | Each role sees only its intended surfaces and data. |
| RR-03 | Subscription-state sweep across trial, active, suspended, and cancelled schools. | Trial banner and suspended overlay behavior is consistent across admin, teacher, and parent apps. |
| RR-04 | Data-consistency sweep after creating, editing, and deleting records from multiple roles. | Lists, detail pages, reports, and summaries converge on the same truth after refresh. |
| RR-05 | Messaging and notification sweep. | Actions that should notify or message downstream roles do so once, clearly, and without duplication. |
| RR-06 | Finance integrity sweep. | Invoice totals, payment totals, transaction ledgers, reconciliation state, and parent-facing balances remain consistent. |
| RR-07 | Payment-readiness sweep. | The same school moves cleanly through `not_started` -> `awaiting_billing_owner` -> `details_submitted` -> `pending_provisioning` -> `provisioned` or `review_required/failed` with correct UI at each step. |
| RR-08 | Mobile and desktop sanity sweep for every major role dashboard. | Major role surfaces remain usable and readable at common mobile and desktop breakpoints. |

## Suggested Pass / Fail Recording Format

For each item, record:

- account used
- school used
- exact route
- action performed
- actual result
- expected result
- screenshot or screen recording path
- severity if failed
- whether the bug is role-specific or cross-role

## Current Product Gaps Worth Explicitly Testing

- Platform sidebar currently appears to advertise routes such as `users`, `reconciliation`, `webhooks`, `emails`, `flags`, `audit`, and `settings` without corresponding page files in this repo. Confirm whether they should be hidden or implemented.
- Staff role does not currently have a dedicated app shell in this repo.
- Parent online payment availability depends entirely on successful school payment provisioning.
- Student timetable is feature-flagged and should be tested in both enabled and disabled conditions.

