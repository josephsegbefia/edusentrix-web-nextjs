# TAO Testing Research Dossier

**Research cycle:** REA-R01A  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Evidence boundary:** Public TAO/OAT product pages, OAT-maintained GitHub repositories, TAO technical articles, and 1EdTech public standards pages. No TAO Cloud tenant, authenticated deployment, paid feature, private support material, or REA target was used.

## Executive assessment

TAO's differentiator is an open, standards-centered assessment architecture. Public OAT material describes a platform that authors and stores QTI items, assembles and delivers tests, processes responses, reports results, integrates through LTI, and supports extension through QTI custom interactions and platform plugins. The public source repositories make implementation structure inspectable, but they do not make every deployment configuration, hosted feature, operational guarantee, or current version behavior equivalent to the source tree.

For EduSentrix, TAO is most relevant as an interoperability and extensibility reference. QTI should inform an import/export boundary and a portable item representation; it should not replace EduSentrix's school-scoped canonical academic result engine. TAO source reuse is not automatically safe: the reviewed OAT repositories identify GPL-2.0 licensing, so any code reuse requires a separate license and distribution architecture review.

## Evidence classification

- **OAT/TAO-documented:** official product page, OAT GitHub README/source, or TAO Hub technical article.
- **1EdTech standard:** normative or standards-description evidence from 1EdTech.
- **Vendor-described:** product or marketing statement, not independent performance proof.
- **Inference:** EduSentrix design implication.
- **Version-bounded:** evidence tied to an older TAO article/version and not assumed current without confirmation.

## 1. Product architecture and interoperability

TAO's official public description positions it as an open-source e-testing platform for building, delivering, and sharing assessments. The OAT GitHub organization describes TAO as QTI- and LTI-based, with source access for customization. **Evidence:** OAT-documented/product-described. [OAT GitHub organization](https://github.com/oat-sa); [TAO official site](https://www.taotesting.com/).

TAO's current public product material describes authoring, item banks, test assembly, learner delivery, session management, live monitoring, scoring, results, reporting, QTI 2.2/3.0 import/export, and LTI integration. These are current product claims, not proof that every feature is present in the open-source package or available in every plan. **Evidence:** vendor-described. [TAO products](https://www.taotesting.com/products/); [TAO interoperability](https://www.taotesting.com/resources/interoperability/).

1EdTech defines QTI as an exchange standard for item and test content and results across authoring tools, item banks, test construction tools, learning platforms, delivery systems, and scoring/analytics engines. The QTI specification page lists QTI 3.0.1 assessment item/test information models, QTI 3 results reporting and usage data, and conformance testing. **Evidence:** 1EdTech standards documentation. [QTI specification documents](https://www.1edtech.org/standards/qti/index).

### EduSentrix implications

- Implement QTI at an explicit boundary: import into a validated, school-scoped draft; export only approved, versioned content. Do not make raw QTI XML the internal authority for student scores or report cards.
- Record the QTI version, profile/feature subset, source package hash, importer version, validation result, and unsupported-feature decisions.
- Treat LTI as a possible launch/integration adapter, not as a substitute for EduSentrix identity, membership, school scope, or entitlement decisions.

## 2. Item authoring and question types

The OAT TAO Hub article states that TAO 2.5 used QTI 2.1 as its main item model and supported import/export of QTI items and packages, item creation and delivery, composite items, and a broad set of QTI interactions: choice, associate, order, match, inline choice, text entry, extended text, hottext, gap match, slider, media, hotspot, graphic interactions, and select point. It also documents rich content, MathJax-based math support, CSS customization, and QTI response processing. **Evidence:** version-bounded OAT technical documentation. [QTI in TAO](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI-in-TAO.md).

The same article records limitations and planned features for that version, including upload interaction and RubricBlock, and notes that PDF support was not fully reliable in the described implementation. Those limitations must not be generalized to current TAO Cloud or current TAO releases. **Evidence:** version-bounded and limitation evidence.

TAO's QTI item model separates item body, interactions, response declarations, outcomes, stylesheets, and rendering. Its QTI SDK README describes support targeting QTI 2.0, 2.1, and partial 2.2, a rule engine, custom operator hooks, rendering, and item/test sessions. **Evidence:** OAT repository documentation. [TAO QTI SDK](https://github.com/oat-sa/qti-sdk).

### EduSentrix implications

- Define a stable internal response/marking schema first, then map supported QTI interaction types into it.
- Store unsupported QTI constructs as an explicit import warning or blocked validation result; never silently degrade a scored item.
- Preserve portable content separately from local school metadata, entitlements, candidate accommodations, and canonical result provenance.
- Start with a deliberately small QTI profile for choice, text entry, extended text, matching/order, media, and graphics, then expand only with fixture and round-trip evidence.

## 3. Assessment assembly and delivery

The OAT `extension-tao-testqti` repository describes a QTI test extension and documents runner options such as review screens, mark-for-review, exit, section navigation, navigation warnings, and automatic pause before a section. It also documents REST API presence and result-variable transmission events, including asynchronous handling. **Evidence:** OAT repository documentation. [extension-tao-testqti README](https://github.com/oat-sa/extension-tao-testqti).

The same README exposes feature flags for concurrent-session timer restoration, maintaining delivery execution state after restart, and timeout/late-submission behavior. These are implementation clues and configuration surfaces in the public repository; they are not a guarantee that EduSentrix should reproduce the exact mechanism or that every hosted deployment enables them. **Evidence:** OAT repository documentation; architecture inference for EduSentrix.

TAO's LTI delivery-provider repository documents an LTI launch path for a delivered test, learner/instructor roles, attempt overrides, and delivery status return values. **Evidence:** OAT repository documentation. [TAO LTI delivery provider](https://github.com/oat-sa/extension-tao-ltideliveryprovider).

### EduSentrix implications

- Separate an assembled immutable delivery from the authoring bank. A delivery should pin test structure, item versions, scoring rules, resources, timer policy, navigation policy, and accessibility/accommodation policy.
- Model response persistence and result-variable transmission as durable, idempotent events or commands with retry/reconciliation behavior.
- Support review/flag-for-review as candidate UX state, not as a marking decision or score mutation.
- If LTI is later added, bind its launch to a pre-created, school-scoped delivery assignment and canonical student identity; do not accept a caller-supplied school or student as authority.

## 4. Scoring, results, and reporting

The OAT QTI-in-TAO article documents standard response templates, generalized response processing, composite-item score aggregation for supported standard templates, outcomes, and a QTI Player capable of processing imported valid response rules even where the authoring UI does not create all such rules. **Evidence:** version-bounded OAT technical documentation. [QTI in TAO](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI-in-TAO.md).

The QTI SDK repository describes item and test sessions and a rule engine, while the test extension documents asynchronous result-variable transmission events. **Evidence:** OAT repository documentation. [QTI SDK](https://github.com/oat-sa/qti-sdk); [extension-tao-testqti](https://github.com/oat-sa/extension-tao-testqti).

The public TAO product page describes scoring and reporting as part of the platform, but public material reviewed here does not establish TAO's exact result immutability, correction model, tenant isolation, or mapping into a school report-card system. **Evidence:** vendor-described; persistence and integration details unverified. [TAO products](https://www.taotesting.com/products/).

### EduSentrix implications

- QTI response processing may produce a delivery-local score, but the only academic result authority remains `AssessmentScore`/`SubjectResult` after provenance and lifecycle validation.
- Store raw response, response-processing outcome, human mark, moderation decision, and canonical score handoff as distinguishable evidence layers.
- Do not import a QTI result directly into a released report card. Require a validated mapping to an `AssessmentItem`, student, school, period, subject, and approved contribution policy.

## 5. Extensibility and custom interactions

TAO documents Portable Custom Interaction (PCI) support for extending QTI interactions. The technical article describes separate runtime and authoring hooks, a manifest, JavaScript modules, libraries, CSS, and a requirement that runtime/custom interaction code be isolated and loaded through the platform's module conventions. **Evidence:** OAT technical documentation. [TAO PCI/PIC guidance](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI/tao-pci-and-pic.md); [TAO PCI proposal](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI/tao-pci.md).

TAO's public repositories also expose extension packages, event observers, test-runner plugins, and configuration/feature flags. **Evidence:** OAT repository evidence. [TAO core](https://github.com/oat-sa/tao-core); [test-runner plugins](https://github.com/oat-sa/taohub-articles/blob/master/articles/Test%20Runner%20Plugins/test-runner-plugins.md).

### EduSentrix implications

- A custom interaction contract needs an authoring schema, preview renderer, delivery renderer, response serialization, validation, scoring semantics, accessibility statement, and version compatibility matrix.
- Custom interaction code must be treated as untrusted content at the school boundary: restrict dependencies, isolate execution, validate resources, and never allow it to mutate canonical scores directly.
- Prefer a plugin adapter boundary over embedding third-party runtime code into the core academic engine.

## 6. Licensing and reuse obligations

The reviewed OAT GitHub repositories expose GPL-2.0 license files or repository metadata, including `tao-core`, `extension-tao-testqti`, and `qti-sdk`. **Evidence:** repository license metadata. [tao-core](https://github.com/oat-sa/tao-core); [extension-tao-testqti](https://github.com/oat-sa/extension-tao-testqti); [qti-sdk](https://github.com/oat-sa/qti-sdk).

This is sufficient to establish a material licensing constraint, not to provide legal advice. Copying or linking GPL code into EduSentrix could create source-disclosure, derivative-work, notice, distribution, or architectural obligations depending on how it is used. TAO documentation, trademarks, sample assets, and hosted service terms may have separate restrictions.

**Recommendation:** do not copy TAO source into the Next.js application during an Assess slice. If QTI support is needed, first conduct a legal/license review, compare independent QTI libraries and service boundaries, preserve license notices, and decide whether a separately deployed GPL-compatible service is acceptable. Reuse of ideas, standards, and independently implemented interfaces is not the same as code reuse.

## 7. QTI version and conformance strategy

1EdTech's public page lists QTI 2.0, 2.1, 2.2, and 3.0 families and a conformance certification/validation program. **Evidence:** 1EdTech standards documentation. [QTI specification documents](https://www.1edtech.org/standards/qti/index).

TAO's older technical article is QTI 2.1-centered, while current TAO product pages advertise QTI 2.2 and QTI 3.0 import/export. This is a real version distinction, not a contradiction: the sources describe different product/documentation vintages. EduSentrix must not assume that a QTI 2.1 article proves current QTI 3 behavior.

### Proposed EduSentrix profile rules

- Declare the supported QTI version/profile per import/export endpoint.
- Validate package structure, XML/schema, resource references, response declarations, outcome processing, media, and accessibility metadata before persistence.
- Require round-trip fixtures for each supported interaction and scoring rule.
- Include source package hash, QTI version, profile, importer version, warnings, and conformance result in the audit record.
- Treat QTI conformance as interoperability evidence, not as proof of tenant authorization, candidate timing, secure delivery, or academic release correctness.

## 8. Research limitations

- No live TAO instance, TAO Cloud tenant, or authenticated delivery was observed.
- OAT technical articles include older version references; current product pages describe newer capabilities. Exact version mapping is not established here.
- Public source visibility does not prove hosted configuration, operational scale, security posture, uptime, or commercial entitlements.
- No QTI package was imported, rendered, round-tripped, or validated in this repository.
- No code from TAO or OAT was copied, installed, or executed.

## Source inventory

All sources below were accessed/reviewed on 2026-10-15:

1. [TAO official site](https://www.taotesting.com/) — public platform positioning.
2. [TAO products](https://www.taotesting.com/products/) — current product capability claims and QTI/LTI positioning.
3. [TAO interoperability](https://www.taotesting.com/resources/interoperability/) — standards/interoperability claims.
4. [OAT GitHub organization](https://github.com/oat-sa) — open-source organization and repository overview.
5. [TAO core](https://github.com/oat-sa/tao-core) — public core source and license metadata.
6. [extension-tao-testqti](https://github.com/oat-sa/extension-tao-testqti) — QTI test delivery, runner flags, REST/events.
7. [TAO QTI SDK](https://github.com/oat-sa/qti-sdk) — QTI model, rule engine, rendering, sessions, license metadata.
8. [QTI in TAO](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI-in-TAO.md) — QTI 2.1 interactions and response processing, version-bounded.
9. [TAO PCI/PIC guidance](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI/tao-pci-and-pic.md) — custom interaction architecture.
10. [TAO PCI proposal](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI/tao-pci.md) — extensibility proposal and implementation guidance.
11. [TAO LTI delivery provider](https://github.com/oat-sa/extension-tao-ltideliveryprovider) — LTI delivery launch and roles.
12. [Test-runner plugins](https://github.com/oat-sa/taohub-articles/blob/master/articles/Test%20Runner%20Plugins/test-runner-plugins.md) — plugin registration/events.
13. [1EdTech QTI specification documents](https://www.1edtech.org/standards/qti/index) — QTI versions, exchange scope, and conformance.

