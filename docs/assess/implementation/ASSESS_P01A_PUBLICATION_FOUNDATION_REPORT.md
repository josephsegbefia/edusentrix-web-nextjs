# EduSentrix Assess — ASSESS-P01A
## Immutable Assessment Publication Foundation Implementation Report

**Date:** 2026-10-15 (Africa/Accra)
**Status:** Implemented bounded slice; ready for independent review
**Branch:** `feat/assess-rea-foundation`
**Repository:** `edusentrix-web-nextjs`

## 1. Authorization record

The product owner explicitly approved the following decisions on 2026-10-15 through ChatGPT, as relayed in the ASSESS-P01A implementation instruction:

- **R02A-PD-001:** Core retains ordinary examinations, marks, grading and report cards; advanced immutable publication belongs to Premium.
- **R02A-PD-002:** Mutable examination authoring records remain intact and immutable, versioned publication snapshots are added separately.
- **R02A-PD-003:** Explicitly non-reporting definitions may omit canonical plan/item binding; score-bearing definitions require existing canonical plan/item binding.

Only these three decisions were updated in `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`. This records product-owner authorization only; it does not represent independent security approval, production approval or release approval.

## 2. Implemented scope

The slice adds an immutable definition-version boundary around approved `ExamPaper`, `ExamPaperSection` and `ExamQuestion` records. `QuestionBankItem` reuse remains represented through the source question's existing `questionBankItemId`; publication snapshots the resolved `ExamQuestion` content and does not retain a mutable runtime dependency on the bank item.

Implemented behavior:

- school-scoped definition identity and source-paper references;
- ordered section and question snapshots;
- question options, sub-questions, marks, expected answers, marking guides and explanations;
- private resource manifest entries with structural source-reference validation;
- deterministic canonical serialization and SHA-256 content hashes;
- version numbering, supersession references and same-content concurrent idempotency;
- legal lifecycle vocabulary and immutable published/superseded/archived content protection;
- author, reviewer and publisher attribution;
- explicit `none` versus `score_bearing` result binding;
- school-admin-only publication, retrieval and version-history routes;
- dedicated `assessment.premium_publication` entitlement; and
- no candidate attempts, CBT, OMR, marking submissions, canonical score writes or report-card writes.

## 3. Changed files

Application files added or changed by this slice:

- `src/models/AssessmentDefinitionVersion.ts`
- `src/lib/assess/assessment-definition-service.ts`
- `src/lib/subscriptions/assess-premium.ts`
- `src/lib/subscriptions/feature-keys.ts`
- `src/lib/subscriptions/plan-entitlements.ts`
- `src/app/api/admin/assess/definitions/route.ts`
- `src/app/api/admin/assess/definitions/[definitionId]/route.ts`
- `src/app/api/admin/assess/definitions/[definitionId]/versions/route.ts`
- `tests/assessment-publication-foundation.test.ts`
- `tests/subscription.plan-map.test.ts`
- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md`
- `docs/assess/implementation/ASSESS_P01A_PUBLICATION_FOUNDATION_REPORT.md`

Pre-existing working-tree changes were preserved and are not attributed to this slice.

## 4. Domain and API contracts

### 4.1 Persistence contract

`AssessmentDefinitionVersion` stores:

- `schoolId`, `definitionKey`, `sourceExamPaperId` and `version`;
- `supersedesVersionId` and lifecycle `status`;
- source academic, grade, class-group and subject context;
- `sections[]`, each containing ordered immutable question snapshots;
- `scoring` with maximum marks and raw-mark policy;
- `resultBinding`, optional `assessmentPlanId` and optional `assessmentItemId`;
- `resourceManifest[]`, all marked private;
- `contentHash` and `contentHashAlgorithm`; and
- author/reviewer/publisher attribution and lifecycle timestamps.

The model has additive indexes for `(schoolId, definitionKey, version)`, `(schoolId, definitionKey, contentHash)`, source-paper history and school/status retrieval. Published content rejects direct document saves and non-lifecycle update operators. Supersession is limited to lifecycle fields.

### 4.2 Publication operation

`POST /api/admin/assess/definitions`

Request fields:

- `examPaperId`
- `resultBinding: "none" | "score_bearing"`
- `assessmentPlanId` and `assessmentItemId` when score-bearing

The source paper must be approved, printed or completed and must contain reviewer attribution. Snapshot assembly is school-filtered and rejects missing questions, invalid section references, marks mismatches, missing/invalid resource references and invalid score-bearing academic bindings.

### 4.3 Retrieval operations

- `GET /api/admin/assess/definitions/[definitionId]` retrieves one school-scoped immutable definition for an authenticated school administrator.
- `GET /api/admin/assess/definitions?sourceExamPaperId=...` lists version history metadata.
- `GET /api/admin/assess/definitions/[definitionId]/versions` lists the source paper's version history metadata.

The full retrieval route is not public and is admin-authorized. The serializer defaults to excluding expected answers, marking guides, correct-option flags and private resource manifests; the current admin route explicitly opts into private content for authorized administrative retrieval.

## 5. Academic binding and Core compatibility

Non-reporting publication stores `resultBinding: "none"` and no plan/item references.

Score-bearing publication requires school-scoped `AssessmentPlan` and `AssessmentItem` records, an active/locked plan, an active item, matching plan ownership, period, grade, subject, class-group and maximum-mark context. The operation only stores the binding snapshot; it does not create `AssessmentScore`, `SubjectResult`, `ReportCardRun` or `StudentReportCard` records.

Existing Core examination authoring, approval, mark entry, grading and report-card paths were not changed.

## 6. Entitlement and security verification

The new canonical key is:

`FEATURE_KEYS.ASSESSMENT_PREMIUM_PUBLICATION = "assessment.premium_publication"`

Plan mapping is explicit: Pilot, Starter and Growth are `NO`; Enterprise is `YES`. The publication helper also requires both subscription enforcement switches to be enabled, an Enterprise plan, a mutation-allowed access mode and the dedicated feature key. When the existing global subscription gates are disabled, Premium publication fails closed rather than inheriting the repository's compatibility-mode “allow all” behavior.

Server-side routes require active school-admin context. All definition reads and writes include `schoolId`. The service separately verifies actor school, role and Premium entitlement. No client-provided school identity is trusted.

Answer keys, marking guides, correct-option flags and resource references are persisted only in school-scoped snapshots. No candidate route was added. The non-private serializer projection excludes sensitive fields.

### Security limitations

The current authoring attachment model provides URL/upload-key references but no provider-backed ownership lookup or source digest. The publication manifest therefore records `integrityAlgorithm: "sha256"`, `integrityStatus: "unverified"` and no digest. This slice validates structural references and keeps them private; provider existence, byte-level digest verification, retention and deletion policy remain required follow-up controls. Independent security review is not complete.

## 7. Persistence, index, compatibility and rollback review

Review outcome: safe for additive local implementation, with release deployment still gated.

- **Migration:** no backfill, source-record rewrite or migration script was added. New versions are created only on explicit publication.
- **Index rollout:** indexes are declared on the new model. Development/test auto-indexing and explicit isolated-test index creation were used. Production index creation was not run.
- **Compatibility:** existing authoring records remain mutable and authoritative for future publication only. Published definitions contain copied content and do not resolve source records at retrieval time. New API routes are additive and separate from Core routes.
- **Rollback:** disable the new routes/capability before any production rollout. Existing Core records remain intact. The new collection can be preserved read-only for investigation; dropping it would destroy Premium publication history and was not performed.
- **Partial publication:** unique definition/version and content-hash indexes plus bounded retry prevent duplicate same-content versions under concurrent local publication. A future production rollout still needs operational index-build and failure-recovery evidence.

## 8. Test evidence

Executed against disposable `mongodb-memory-server` databases only:

- `node --test --import tsx tests/assessment-publication-foundation.test.ts` — **8 passed, 0 failed**.
- `npm run test:subscriptions` — **154 passed, 0 failed**.
- focused Core academic regression tests — **38 passed, 0 failed**.
- targeted ESLint for all changed TypeScript/model/service/route/test files — **passed**.
- `npm run build` — compiled and generated routes successfully, but the build unexpectedly connected to the persistent `edusentrix-dev` MongoDB through `.env.local` during static page generation. This build result is not treated as disposable-database evidence or release approval.

The build connection was subsequently traced to the platform proposal server pages, which called `connectToDatabase()` without a `force-dynamic` declaration while Next performed static generation. ASSESS-P01A1 adds route-level dynamic declarations and a central build-phase database refusal; the historical build result above remains invalid as disposable-database evidence.

Coverage includes:

- immutable snapshot behavior after source edits;
- stable hashes and same-content concurrent idempotency;
- version creation and supersession;
- illegal lifecycle transitions and direct published-content mutation;
- School A/School B isolation;
- unauthorized publication and missing Premium entitlement;
- missing/invalid resource references;
- non-reporting and score-bearing binding rules; and
- absence of canonical score/report-card writes.

Repository-wide `npx --no-install tsc --noEmit` remains **failed** on pre-existing unrelated errors across `.next` validators, scripts, legacy pages, APIs and older tests. No ASSESS-P01A-specific error was reported by the filtered output. This is not a repository-wide typecheck pass.

## 9. Unresolved issues and boundaries

- Independent security review is still required for resource ownership, provider integrity, retention/deletion and production exposure policy.
- Production index rollout and rollback execution were not performed.
- The historical build verification touched persistent development MongoDB despite the database-safety constraint; no intentional database mutation or operational command was performed, but zero database activity cannot be claimed for that build process. ASSESS-P01A1 corrects the triggering path and adds a regression guard. Subsequent feature tests used disposable MongoDB only.
- Subscription plan data already persisted in external databases may require a separately approved plan-feature synchronization; no direct subscription-data inspection was performed.
- Candidate-safe delivery projections are prepared at serializer level but candidate delivery itself is outside P01A.
- No attempt, CBT, paper packet, OMR, marking, moderation, score handoff or report-card implementation is included.

## 10. Recommended next slice

Independent review of this bounded publication foundation, followed by the approved next slice for paper packet identity and reconciliation only after its product/security decisions and resource policy are recorded. Do not treat local tests as deployment, provider, browser, signed-in user or school-pilot evidence.

No commits, pushes, deployments, production operations or persistent school database access were performed.
