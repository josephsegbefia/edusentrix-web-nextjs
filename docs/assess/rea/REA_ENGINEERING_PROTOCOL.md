# EduSentrix Assess — REA Engineering Protocol

**Status:** Proposed operating protocol  
**Owner:** Principal Engineering Architect / Product Owner approval required for binding product decisions  
**Repository:** `edusentrix-web-nextjs`  
**Branch observed:** `feat/assess-rea-foundation`  
**Established:** 2026-10-15

## Purpose and scope

This protocol defines how REA, ECC, Codex, ChatGPT, and product ownership work together for EduSentrix Assess. It applies before corrective implementation and to each approved Assess engineering slice. It is a workflow control document, not a duplicate roadmap or a production-readiness declaration.

## 1. Verified toolchain status

| Capability | Verified status | Boundary |
|---|---|---|
| REA MCP integration | Available in the active session | The `mcp__rea__*` namespace exposes artifact, binary, web, native, runtime-observation, call-path, comparison, and evidence-bundle tools. No REA target/session was opened for this setup task. |
| ECC plugin | Enabled as `ecc@ecc` in active Codex configuration; installed version `2.2.3` | The versioned cache and active skill catalog are present. Availability does not prove that every hook, MCP server, or skill has been exercised. |
| ECC hooks | Not enabled or trusted by this protocol | Review and trust hooks explicitly when needed. Do not enable the full hook set automatically. |
| ECC skills | The named Assess skills are available and their instructions were read for this protocol | Invoke only the skill relevant to the current slice. |
| Codex in Cursor | Not verified from this Codex session | Cursor-side behavior, rules, and tool wiring require separate verification in Cursor. |
| ChatGPT review | Available as an independent reasoning and reporting checkpoint | It is not a substitute for repository, provider, browser, or signed-in runtime evidence. |

The repository already contains REA Phase 0 reports under `docs/assess/rea/reports/`. At the time of setup, the working tree also contained pre-existing untracked `REA_00A_REPOSITORY_VERIFICATION.md` and `REA_00B_CAPABILITY_ENTITLEMENT_ARCHITECTURE.md`; this protocol does not claim ownership of or rewrite those files.

## 2. Tool and agent responsibilities

### REA

Use REA for permitted reference-system investigation, evidence collection, technical research, runtime observation, artifact comparison, reconstruction analysis, and evidence-bundle export. Record the target, access boundary, observation time, tool used, raw evidence location, and uncertainty. Do not bypass authentication, defeat controls, extract proprietary source code, or treat inferred private architecture as fact.

### ECC

Use ECC as the engineering workflow layer:

- architecture planning and durable decision capture;
- read-only change-impact analysis;
- RED/GREEN/refactor test discipline;
- security review;
- downstream regression planning and execution;
- verification and production-readiness review.

ECC guidance remains subordinate to approved product/security decisions and verified repository invariants. A green ECC check is evidence for its bounded check, not a release authorization.

### Codex in Cursor

Use the implementation environment for source inspection, repository-local edits, focused tests, local verification, and technical reporting. Before editing, trace actual imports, routes, server actions, models, authorization helpers, persistence, and consumers. Preserve unrelated changes and stop when the approved slice is complete.

### ChatGPT

Use ChatGPT for external research synthesis when authorized, architecture review, independent implementation assessment, evidence interpretation, and milestone recommendations. ChatGPT must distinguish repository evidence, REA observations, documented claims, inference, and unknowns. It must not convert static checks into signed-in, provider, browser, storage, or deployed-runtime proof.

### Product owner

The product owner approves important architectural changes, commercial entitlement decisions, customer-impacting behavior, migration strategy, and releases. Approval is explicit and recorded; silence is not approval.

## 3. Non-negotiable Assess architecture rules

1. School OS Core retains basic examinations, classwork marks, exam marks, grading, subject results, and basic report cards.
2. Premium Assess adds advanced examination capabilities through independent product entitlements.
3. Both products use one canonical academic result engine.
4. No duplicate student, assessment-score, subject-result, or report-card authority may be introduced.
5. Existing production-facing School OS behavior must be preserved unless an approved decision explicitly changes it.
6. Security, tenant isolation, score integrity, and durable evidence take priority over implementation speed.
7. Passing unit tests alone never establishes production readiness.
8. Commercial entitlement changes require explicit product-owner approval and migration evidence.

## 4. REA research standard

Before implementing a major new Assess capability:

1. Identify suitable reference products and state why each is relevant.
2. Review applicable standards, public documentation, and legitimately accessible technical/workflow evidence.
3. Record each observation with source, access boundary, date, and evidence location.
4. Label inference separately from direct observation; mark unresolved items `unverified`.
5. Produce an original EduSentrix feature specification rather than copying proprietary implementation.
6. Define failure handling, authorization, tenant isolation, data retention, auditability, operational recovery, and acceptance criteria.

REA findings should answer a decision or acceptance question. Avoid research that cannot change a design, risk treatment, or verification plan.

## 5. Engineering lifecycle

For each approved slice:

1. Read the approved architecture and task contract.
2. Establish scope, baseline behavior, branch, working-tree state, and evidence boundary.
3. Map affected modules, consumers, routes, models, contracts, permissions, persistence, and tests.
4. Capture durable architectural choices and alternatives when a decision is difficult to reverse.
5. Write or adapt focused tests for the approved behavior. Confirm meaningful RED when applicable; a setup failure is not valid RED evidence.
6. Implement the smallest safe correction within the approved scope.
7. Confirm GREEN, coverage where meaningful, and required downstream regressions.
8. Conduct security review and reconcile planned versus actual change impact.
9. Record commands, exit codes, outputs, manual checks, limitations, and unresolved risks.
10. Stop for the agreed independent ChatGPT review milestone.
11. Obtain product-owner approval before commercial, architectural, migration, or release decisions.

Coverage is supporting evidence. It does not replace correctness, authorization testing, tenant-boundary testing, durability checks, or real-world verification.

## 6. Recommended ECC skill mapping

| Slice concern | Skill | Invoke when | Required output |
|---|---|---|---|
| Architectural choice | `ecc:architecture-decision-records` | A long-lived architecture, data, API, security, or process decision is made | Context, alternatives, decision, consequences, status, and owner |
| Blast radius | `ecc:change-impact` | A change crosses modules, data, auth, contracts, deployment, or rollback boundaries | Affected objects, evidence, verification, rollback/recovery, and `unverified` items |
| Test-first implementation | `ecc:tdd-workflow` | New behavior, bug fix, refactor, API, or component work begins | User journeys, RED/GREEN evidence, refactor result, coverage, and TDD evidence report |
| Application security | `ecc:security-review` | Auth, input, uploads, sensitive data, APIs, secrets, payments, or external providers are involved | Threat/checklist findings, tests, mitigations, and residual risks |
| Full local verification | `ecc:verification-loop` | A feature/refactor is complete or a PR/release review is requested | Build, types, lint, tests/coverage, security checks, diff review, and PASS/FAIL report |
| Downstream regression | `ecc:module-regression` | A module's observable behavior or a shared contract changes | Changed-module and downstream commands with exit-code evidence |
| Production readiness | `ecc:production-audit` | Launch, post-merge, pre-deploy, or “what breaks in production?” review is requested | Blockers, evidence checked, missing evidence, score/risk band, and next action |
| Mechanical session gate | `ecc:delivery-gate` | A host-supported delivery hook has been explicitly reviewed and trusted | Deterministic hook result only; never a substitute for engineering review |

For a typical Assess slice, use `change-impact` before implementation, `tdd-workflow` during implementation, `security-review` when sensitive boundaries are touched, `module-regression` after behavior changes, and `verification-loop` before the independent review. Use ADRs for durable decisions. Use `production-audit` only for a genuine readiness question. Treat `delivery-gate` as optional host hygiene and do not enable its hooks automatically.

## 7. Source-of-truth and conflict hierarchy

For Assess-specific work, precedence is:

1. Explicit user-approved product and security decisions.
2. Verified repository behavior and existing security/data-integrity invariants.
3. Approved Assess architecture decisions and task contracts.
4. Existing repository engineering instructions, including `AGENTS.md`.
5. Relevant ECC and REA skill guidance.

If sources conflict, stop and report the conflict. Do not silently weaken a security invariant, tenant boundary, canonical result authority, entitlement rule, or production behavior.

## 8. Security, reliability, and release gates

An Assess slice cannot be represented as complete while any applicable gate remains unresolved:

- server-side authentication and authorization are proven for every read/write boundary;
- every school-owned query and mutation has verified tenant scoping;
- student, assessment, score, result, and report-card identity boundaries are preserved across loading, retries, transitions, and historical access;
- score writes, locks, release state, correction paths, and idempotency are explicit and durable;
- uploads, private assets, provider calls, and generated evidence have validated access and failure handling;
- entitlement checks are consistent at page, API, server-action, and service boundaries;
- required tests cover success, error, boundary, replay, concurrency, and permission cases;
- affected downstream modules have executable regression evidence;
- deployment, migration, recovery, rollback, and compatibility conditions are documented where relevant;
- manual signed-in, browser, device, provider, storage, or deployed-runtime checks are explicitly listed and not misreported as automated passes.

## 9. Independent review checkpoints

Pause for independent ChatGPT review at these points:

1. **Architecture checkpoint:** before committing to a new Assess boundary, entitlement axis, result handoff, persistence model, or migration.
2. **Pre-implementation checkpoint:** after change-impact mapping and acceptance criteria, before production-source edits.
3. **Security checkpoint:** after security review for authentication, tenant isolation, score integrity, uploads, providers, or sensitive data.
4. **Pre-release checkpoint:** after verification and regression evidence, before product-owner release approval.

The review packet must include the approved scope, changed files, evidence index, test/command results, known limitations, open decisions, and exact manual checks still pending.

## 10. Repository change controls

- Documentation-only setup must not change application source, subscriptions, migrations, dependencies, global Codex/Cursor configuration, deployment state, or production data.
- Inspect `git status` before and after work; preserve unrelated user changes and identify pre-existing untracked files.
- Use focused edits and keep the protocol concise; do not duplicate the roadmap.
- Do not enable all ECC hooks. Review and trust only the specific hook behavior required by an approved workflow.
- Do not invoke REA against an external or protected target without an explicit target, permitted scope, and evidence plan.
- No commit or push is implied by document completion.

## 11. Report templates

### Research evidence record

```text
Question / decision:
Target and permitted scope:
Tool or source:
Observed evidence:
Inference (if any):
Unknowns / limitations:
Security and operational implications:
Resulting EduSentrix requirement:
Acceptance criteria:
Evidence artifact:
Reviewer / date:
```

### Engineering slice report

```text
Slice and approved scope:
Baseline behavior:
Affected modules and consumers:
Architecture / ADR references:
Tests: RED / GREEN / coverage:
Security review:
Regression commands and exit codes:
Verification commands and outcomes:
Manual checks pending:
Known risks and rollback/recovery:
Independent review decision:
Product-owner decision:
```

### Completion evidence rule

Every claim must identify its evidence type: `repository`, `REA observation`, `automated command`, `browser/device`, `provider/storage`, `deployed runtime`, `human approval`, `inference`, or `unverified`. Report the actual command and outcome; never invent PASS results or imply release readiness from incomplete evidence.

## 12. REA-00C readiness

The environment is ready to plan REA-00C1 from a tooling-availability perspective: the REA namespace is discoverable, ECC is enabled, the relevant skills are available, and the repository contains the preceding Phase 0 reports. This does not authorize REA-00C1 execution. REA-00C1 still requires its approved scope, target/evidence boundary, product-owner decisions identified in `REA_00B_CAPABILITY_ENTITLEMENT_ARCHITECTURE.md`, and the applicable security/change-impact plan.

This protocol setup stops here. REA-00C1 is not started automatically.
