# Inspera Assessment Research Dossier

**Research cycle:** REA-R01A  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Evidence boundary:** Public Inspera product and Help Center documentation only. No Inspera tenant, paid environment, authenticated API, browser session, or REA target was used.

## Executive assessment

Inspera presents assessment as a governed chain rather than as a quiz form: authors create reusable question content; planners assemble and configure a test event; candidates receive a controlled delivery; monitor/invigilator roles manage live exceptions; graders and committees produce marks; and moderation confirms quality before results are treated as final. The public documentation supports this workflow model, but it does not expose Inspera's private persistence, transaction, queue, or infrastructure design.

The most important lessons for EduSentrix are lifecycle explicitness, candidate-level exception handling, observable save/submission health, role-specific operational controls, and the separation of delivery, marking, and moderation. These should feed the existing canonical `AssessmentItem` -> `AssessmentScore` -> `SubjectResult` -> report-card path; they should not create a second result authority.

## Evidence classification

- **Vendor-documented:** behavior described in an Inspera Help Center or API policy page.
- **Vendor-described:** capability claimed on Inspera's public product page; useful for scope, not proof of implementation details or service levels.
- **Inference:** an EduSentrix design implication derived from the documented behavior.
- **Unverified:** not established by public evidence reviewed in this cycle.

## 1. Authoring, item banks, and assessment construction

### Findings

1. Inspera documents question creation both inside a question set and independently. Its public Help Center lists 24 question types, divided into automatically marked, manually marked, and non-scoring types. The same article documents common authoring controls such as marks, mark schemes, illustrations, PDF panels, and labels. **Evidence:** vendor-documented. [How to create a question](https://support.inspera.com/hc/en-us/articles/360038890492-How-to-create-a-question).

2. Inspera describes reusable item banks, tagging, multimedia, multiple delivery contexts, and collaborative grading as part of the product experience. **Evidence:** vendor-described. [Inspera Assessment product page](https://inspera.com/inspera-assessment/).

3. Test creation is a separate delivery operation. Inspera documents manual setup, templates, external-system imports, and APIs; test settings cover scheduling, security, exam day, post-test behavior, grading workflow, and contributors. **Evidence:** vendor-documented. [How to create a test](https://support.inspera.com/hc/en-us/articles/360029761952-How-to-create-a-test).

### EduSentrix implications

- Keep `ExamPaper`, `ExamPaperSection`, `ExamQuestion`, and `QuestionBankItem` as authoring concerns, but add explicit immutable publication/version boundaries before any digital delivery reuses them.
- Treat question type, response schema, mark scheme, media references, accommodations, and scoring rules as versioned content. A later author edit must not change an active candidate's delivery.
- Separate basic School OS exam-mark entry from advanced authoring, reusable banks, assembly, and delivery entitlements as required by REA-00B.

## 2. Assessment lifecycle and administration

### Findings

Inspera's public Monitor documentation exposes a candidate progress model including `Inactive`, `Dashboard`, `Ready`, `In Progress`, `Submitted`, `Paused`, `Blank submission`, and `Withdrawn`. Its test-level status documentation includes `Created`, `Scheduled`, `Active`, `Finished`, `Grading in progress`, and `Graded`. **Evidence:** vendor-documented. [Candidate progress in Monitor](https://support.inspera.com/hc/en-us/articles/360029788911-Candidate-progress-in-Monitor); [Monitor columns](https://support.inspera.com/hc/en-us/articles/360026204192-Columns-in-Monitor).

The documented roles are not interchangeable. Planners configure tests and candidates; invigilators supervise and perform constrained candidate actions; graders mark; and moderators quality-assure marks after final grading. **Evidence:** vendor-documented. [Invigilator role](https://support.inspera.com/hc/en-us/articles/360035487912-Role-description-Invigilator); [Committee Moderator role](https://support.inspera.com/hc/en-us/articles/360019933877-Role-description-Committee-Moderator); [Grading in an Assessment Path](https://support.inspera.com/hc/en-us/articles/10027695191709-Grading-in-Assessment-Path).

Candidate assignment can exist at assessment-path and individual-test levels, with explicit counts for assigned, unique, and unassigned candidates. **Evidence:** vendor-documented. [Manage candidates in an Assessment Path](https://support.inspera.com/hc/en-us/articles/35448012531357-Manage-candidates-in-an-Assessment-Path).

### EduSentrix implications

- Model the lifecycle as a state machine with server-side legal transitions and audit events, not as a boolean `published` flag.
- Distinguish test/event state from candidate-attempt state, and distinguish both from marking and result state.
- Make candidate assignment a durable snapshot. Removing a student from a roster later must not silently change an already-issued delivery.
- Preserve school, class group, subject, period, candidate, paper/version, and entitlement context on every transition.

## 3. Candidate delivery, timing, autosave, and exception handling

### Findings

Inspera documents a standard test end time, candidate-specific duration, individual end times, planned extra time, and incident extra time. The closing time can override an otherwise longer duration, and extra-time calculations have explicit rules. **Evidence:** vendor-documented. [Test duration and extra time](https://support.inspera.com/hc/en-us/articles/360041451112-Test-duration-and-extra-time); [Adding extra time to candidates](https://support.inspera.com/hc/en-us/articles/360029195771-Adding-extra-time-to-candidates).

The Monitor view exposes a `Submission saved` timestamp and warning status. Inspera states that candidates can continue working offline between test start and submission in the documented flow, and separately documents encrypted offline submission-file recovery. **Evidence:** vendor-documented. [Monitor candidates during a test](https://support.inspera.com/hc/en-us/articles/360055366852-Monitor-candidates-during-a-test); [Offline submission handling](https://support.inspera.com/hc/en-us/articles/360018405952-How-to-save-submission-as-file-and-upload-offline-submission).

Inspera documents resubmission after submission or test end, submission on behalf of a candidate, and restrictions once grades have been confirmed. It also documents a late-submission window with primary deadlines and test end times, while noting that the feature is Open Beta in the cited article and cannot be combined with auto submission. **Evidence:** vendor-documented and feature/version bounded. [Open for resubmission](https://support.inspera.com/hc/en-us/articles/360047371951-Open-for-resubmission); [Submit on behalf of a candidate](https://support.inspera.com/hc/en-us/articles/360024272611-Open-for-resubmission-and-submit-on-behalf-of-candidate); [Late submissions](https://support.inspera.com/hc/en-us/articles/5705860728349-Understanding-how-late-submission-work).

Inspera's release notes document an operational alert when auto-saving an essay answer encounters issues. **Evidence:** vendor-documented release-note evidence, not a guarantee of all failure modes. [2024 product updates](https://support.inspera.com/hc/en-us/articles/16712006600861-Product-updates-release-notes-2024).

### EduSentrix implications

- The CBT contract needs a server-authoritative deadline calculation with an immutable time-policy snapshot: scheduled window, duration, individual deadline, accommodations, incident adjustments, and timezone.
- Autosave must expose durable acknowledgement metadata, last successful save, pending local changes, retry state, and a recoverable offline/export path where the delivery mode permits it.
- Submission must be idempotent and preserve submitted revisions. Resubmission must be a privileged, audited transition that is unavailable after the configured lock/grade boundary.
- Treat save failure, network loss, candidate pause, timeout, late submission, blank submission, withdrawal, and operator submission as distinct events and outcomes. Do not collapse infrastructure failure into a learner score of zero.

## 4. Invigilation, integrity, and institutional controls

Inspera documents Monitor actions including attendance, flags, messages, spell-checker enablement, ID checks, extra time, and candidate status review. It limits extra-time authority by role, distinguishing observation from administrative intervention. **Evidence:** vendor-documented. [Monitor candidates](https://support.inspera.com/hc/en-us/articles/360055366852-Monitor-candidates-during-a-test); [Invigilator role](https://support.inspera.com/hc/en-us/articles/360035487912-Role-description-Invigilator).

The product page describes selectable delivery contexts, an Integrity Browser, and proctoring options. These are vendor-described product capabilities; the public pages reviewed do not establish the internal anti-cheating algorithms, evidence retention, false-positive behavior, or guarantees. **Evidence:** vendor-described; implementation details unverified. [Inspera Assessment](https://inspera.com/inspera-assessment/).

### EduSentrix implications

- Separate observation permissions from intervention permissions. An invigilator may see a candidate warning without being allowed to alter time or submit work.
- Make every intervention carry actor, reason, old value, new value, timestamp, candidate/attempt, and authorization evidence.
- For paper delivery, use the same institutional control concepts—attendance, room, invigilator assignment, incident log, candidate identity, and exception disposition—even though the response capture differs.

## 5. Marking, moderation, feedback, and analytics

Inspera documents collaborative grading, committee workflows, mark schemes/rubrics, explanations of grades, and a separate moderator role that begins after final grading has been confirmed. **Evidence:** vendor-documented/vendor-described. [Inspera Assessment](https://inspera.com/inspera-assessment/); [Committee Moderator role](https://support.inspera.com/hc/en-us/articles/360019933877-Role-description-Committee-Moderator); [Moderator workflow](https://support.inspera.com/hc/en-us/articles/360020607858-Moderator-workflow).

The public product page describes feedback at question or assessment level, including written, audio, and automated feedback. This is a product claim; the public evidence reviewed does not establish how feedback versions are persisted or how automated feedback is governed. **Evidence:** vendor-described; persistence and governance unverified.

Inspera's public API policy documents REST APIs for a subset of functionality including test-event creation/update, candidate and contributor assignment, result/response export after marking, and user management. Access requires Inspera-issued API keys or tokens, and the policy states the API surface evolves through release notes. **Evidence:** vendor-documented. [Inspera API policy](https://support.inspera.com/hc/en-us/articles/16192624197021-Inspera-API-policy).

### EduSentrix implications

- Marking should produce immutable, question-level evidence and correction events, then publish a finalized score input into the canonical academic engine.
- Moderation must not overwrite original marker evidence. It should record a decision, rationale, participants, and the version of the marks reviewed.
- Analytics should distinguish operational telemetry (save health, attendance, timing, incidents) from academic analytics (responses, item performance, finalized scores) and apply role/tenant/release policy to both.
- Any future integration API must be capability-scoped, idempotent, school-scoped, and explicit about whether it returns draft responses, marked results, or released results.

## 6. Accessibility

Inspera documents Text to Speech as a tenant-activated candidate aid, with candidate-controlled activation and language behavior, and records limitations for PDF panels and some interaction types. **Evidence:** vendor-documented. [Text to speech for candidate accessibility](https://support.inspera.com/hc/en-us/articles/360037981811-Text-to-speech-for-candidate-accessibility).

The newer Candidate Dashboard documentation describes landmarks, heading hierarchy, page titles, alt text, keyboard interaction work, and a stated goal of AAA/AA industry-standard compliance. The wording indicates an evolving product area; it is not an independent conformance certificate. **Evidence:** vendor-documented product direction; formal conformance unverified. [Candidate dashboard](https://support.inspera.com/hc/en-us/articles/13093340131357-Candidate-dashboard).

### EduSentrix implications

- Accessibility settings belong in the immutable delivery snapshot when they affect candidate interaction, while user preferences remain separately managed.
- Acceptance tests should cover keyboard-only completion, screen-reader landmarks, focus after navigation/errors, zoom/reflow, text-to-speech or equivalent, captions/transcripts for media, contrast, and accommodation-specific timing.
- Do not represent “WCAG/AAA compliant” from a checklist alone; require an independent accessibility audit and assistive-technology verification.

## 7. Inspera lifecycle model to borrow, not copy

The useful pattern is a set of coordinated state machines:

```text
Question draft -> reviewed/published question version
        -> assembled test draft -> scheduled -> active -> finished
Candidate assigned -> ready -> in_progress/paused -> submitted/blank/withdrawn
        -> marking -> graded -> moderation -> released/exported
```

This is an **inference from documented workflows**, not a claim about Inspera's private database model. EduSentrix should adopt the observable lifecycle separation while using its own domain names and canonical result engine.

## 8. Research limitations

- No authenticated Inspera tenant or product trial was accessed.
- No browser observation, network trace, API call, performance test, or failure injection was performed.
- Public documentation is vendor-controlled and may describe optional, tenant-activated, beta, or version-specific functionality.
- Private storage, transaction boundaries, queue semantics, cryptographic design, proctoring detection, and service-level guarantees remain unverified.

## Source inventory

All sources below were accessed/reviewed on 2026-10-15:

1. [Inspera Assessment product page](https://inspera.com/inspera-assessment/) — public product scope and vendor-described capabilities.
2. [How to create a question](https://support.inspera.com/hc/en-us/articles/360038890492-How-to-create-a-question) — question types and authoring controls.
3. [How to create a test](https://support.inspera.com/hc/en-us/articles/360029761952-How-to-create-a-test) — test setup and contributors.
4. [Candidate progress in Monitor](https://support.inspera.com/hc/en-us/articles/360029788911-Candidate-progress-in-Monitor) — candidate progress states.
5. [Monitor candidates](https://support.inspera.com/hc/en-us/articles/360055366852-Monitor-candidates-during-a-test) — save health and operational actions.
6. [Monitor columns](https://support.inspera.com/hc/en-us/articles/360026204192-Columns-in-Monitor) — test/candidate status fields.
7. [Test duration and extra time](https://support.inspera.com/hc/en-us/articles/360041451112-Test-duration-and-extra-time) — timing rules.
8. [Adding extra time](https://support.inspera.com/hc/en-us/articles/360029195771-Adding-extra-time-to-candidates) — planned/incident accommodations.
9. [Open for resubmission](https://support.inspera.com/hc/en-us/articles/360047371951-Open-for-resubmission) — resubmission restrictions and revisions.
10. [Offline submission handling](https://support.inspera.com/hc/en-us/articles/360018405952-How-to-save-submission-as-file-and-upload-offline-submission) — encrypted offline recovery flow.
11. [Committee Moderator role](https://support.inspera.com/hc/en-us/articles/360019933877-Role-description-Committee-Moderator) — moderation roles.
12. [Moderator workflow](https://support.inspera.com/hc/en-us/articles/360020607858-Moderator-workflow) — post-final-grading moderation.
13. [Inspera API policy](https://support.inspera.com/hc/en-us/articles/16192624197021-Inspera-API-policy) — documented integration surface.
14. [Text to speech](https://support.inspera.com/hc/en-us/articles/360037981811-Text-to-speech-for-candidate-accessibility) — accessibility feature and limitations.
15. [Candidate dashboard](https://support.inspera.com/hc/en-us/articles/13093340131357-Candidate-dashboard) — accessibility and candidate experience direction.
16. [2024 product updates](https://support.inspera.com/hc/en-us/articles/16712006600861-Product-updates-release-notes-2024) — documented autosave issue alert.

