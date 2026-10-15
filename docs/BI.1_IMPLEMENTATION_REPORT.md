# BI.1 Implementation Report

BI.1 establishes the shared AI import intelligence foundation. Teacher-specific curriculum reasoning, Student-specific grade/class intelligence, review UX redesign, and commit redesign remain deferred.

## Access model

`LEO_IMPORT_ASSIST` is an import capability, not the normal `hasAiLeoCopilot` subscription entitlement. It requires an authorized import action, supported runtime, configured provider, enabled platform flag, and no explicit privacy opt-out.

## Shared Leo boundary

`runLeoImportIntelligence` accepts a typed domain and task, bounded context, and a Zod response schema. Teacher and Student import adapters both use it. Provider-specific OpenAI code is isolated under Leo infrastructure.

## Schemas and safety

Structured action/proposal schemas reject unknown action types, unexpected fields, invalid row references, unknown opaque catalog keys, and MongoDB ObjectId-shaped values. AI never supplies a trusted database id.

## Privacy and bounded context

Shared helpers group unique vocabulary, anonymize row references, cap catalog/value counts, and exclude Student and unnecessary Teacher contact PII. Student regression coverage verifies representative names, DOB, admission numbers, guardian details, email, phone, and GES identifiers are absent.

## Versioning and compatibility

New drafts carry `importSchemaVersion: 2` and `analysisVersion: "v2"`. Existing drafts resolve to `compatible`, `reanalysis_required`, or `restart_required` without fabricating missing V2 state.

## Issues, actions, and natural language

Stable issue ids, resolution classes, resolution-source precedence, typed actions, pending natural-language resolutions, and “I understood…” formatting are implemented as shared contracts. Confirmation remains separate from interpretation.

## Active drafts and retry

Application-level enforcement identifies one unfinished draft per school/domain/initiating administrator. No unique index was added. Existing retry routes reuse retained parsed/file state and remain compatible with future shared retry orchestration.

## Persistence and DTOs

Existing import jobs persist additive V2 fields; no new collection is created. Shared serializers expose plain JSON review summaries, current issues, resolved counts, version compatibility, and Leo metadata.

## Provider independence

The current provider is OpenAI behind a Leo provider interface. Teacher and Student import code no longer imports `openai` or constructs `OpenAI` clients.
