# EduSentrix R2 Storage Migration Audit

Audit date: 2026-10-04. Scope: repository-wide discovery of every upload, storage, download, delete, generated-file, and import path. **No production code was changed. UploadThing was not removed. R2 was not implemented. Nothing was committed.**

Assumption from the product owner: there are currently no real production users or uploads. This audit does **not** treat that as proven. A read-only production URL scan is still required before Tuesday (see §15).

## Executive Summary

| Metric | Count |
|---|---|
| Total classified file flows | 42 |
| UploadThing flows (active write/read) | 19 |
| Local permanent-storage flows | 1 (`public/uploads/parent-documents/...`) |
| Temporary local / in-memory generated flows | 14 |
| Public-or-semi-public asset flows | 6 |
| Private asset flows | 16 |
| Generated-file flows (PDF/CSV/XLSX, streamed) | 13 |
| Legacy / unused provider surfaces | 4 |
| NEEDS_REVIEW flows | 8 |
| P0 demo blockers | 6 |

**CLEAN CUTOVER: YES**, if and only if a read-only production scan finds no persisted `utfs.io` / `ufs.sh` / `uploadthing` / `res.cloudinary.com` / `/uploads/` URLs. Dual-write and an UploadThing compatibility layer are not required for the demo. Historical object migration is not required if that scan is empty.

If the scan finds leftover URLs, keep a **read-only leftover renderer** (display existing URLs as-is) and still do a clean write cutover to R2. Do not build a dual-write layer.

### P0 demo blockers

1. Authenticated parent document upload writes to **container-local** `public/uploads/...` and persists a public static URL. Docker disk is ephemeral; the file is world-readable with no auth.
2. Academic-calendar covers persist **data URLs** (`data:image/...`) into MongoDB. That is not object storage and will blow up document size.
3. Almost every private document (admissions, student records, teacher contracts, expense receipts, assignments, schemes) is stored as a **permanent public UploadThing URL**. Anyone with the URL can open it.
4. Host allowlists hard-code UploadThing (`next.config.ts` image hosts, `scheme-import-gate.ts` SSRF allowlist). R2 will fail image/PDF fetch until those change.
5. Cloudinary signed-upload route is still live (`POST /api/uploads/sign`) even though no current UI calls it.
6. `public/uploads/` is not gitignored. At least one local parent-document PDF already exists on disk in this workspace.

### Fastest safe Tuesday plan

Replace the UploadThing client/server adapters with one R2 helper. Keep the same 16 FileRouter endpoint names as logical upload kinds. Persist **object key + display metadata**, not a permanent signed URL. Stream generated PDFs as today (do not put them on R2 for the demo). Kill the local parent-document write and the calendar data-URL uploader in the same deploy.

---

## 1. Current Storage Architecture

```
Browser
  -> useUploadThing / uploadFiles (most school UI)
  -> POST /api/uploadthing  (Clerk-gated except public admissions)
  -> UploadThing hosted object (utfs.io / ufs.sh)
  -> onUploadComplete returns { url, key, name, size, type, customId }
  -> MongoDB stores the public URL (rarely the key)

Exceptions:
  Parent logged-in document upload -> fs.writeFile(public/uploads/...) -> Mongo fileUrl=/uploads/...
  Academic calendar cover -> FileReader data URL -> Mongo coverImageUrl
  Leo lesson illustration -> UTApi.uploadFiles / uploadFilesFromUrl (server)
  Scheme import download -> fetch(public URL) then UTApi.getFileUrls fallback
  Cloudinary -> POST /api/uploads/sign still signs uploads; no current UI caller
  Generated PDFs/CSV -> built in memory, returned as HTTP attachment
  Email compose attachments -> base64 in the request, not stored as objects
  Library import -> CSV text stored on LibraryImportJob, then cleared
```

**Source of truth today is a public URL string**, not a storage key. Only `LessonResource.uploadThingKey`, `SchemeImportJob.fileKey`, `LibraryBook.coverImageKey`, `ExamQuestion.attachments.uploadKey`, and `Message.attachments.key` even have a key field. Most models store only `fileUrl` / `photoUrl` / `url`.

**Production `autoIndex` is unrelated.** UploadThing objects live off-cluster. Mongo only stores URLs.

**Demo policy:** `src/lib/demo/action-policy.ts` denies `uploadthing/upload` and simulates `uploadthing/deleteFiles`. Demo sandboxes cannot create real UploadThing objects.

---

## 2. UploadThing Inventory

### Packages and route

| Item | Location |
|---|---|
| `uploadthing` `^7.7.4` | `package.json` |
| `@uploadthing/react` `^7.3.3` | `package.json` |
| Route handler | [`src/app/api/uploadthing/route.ts`](../src/app/api/uploadthing/route.ts) |
| File router | [`src/lib/uploadthing/core.ts`](../src/lib/uploadthing/core.ts) (16 endpoints) |
| React helpers | [`src/lib/uploadthing/react.ts`](../src/lib/uploadthing/react.ts) |
| Delete adapter | [`src/lib/uploadthing/delete.ts`](../src/lib/uploadthing/delete.ts) |
| Client error helper | [`src/lib/uploadthing/client-errors.ts`](../src/lib/uploadthing/client-errors.ts) |
| Server UTApi uploads | [`src/lib/uploads/lesson-illustration-upload.ts`](../src/lib/uploads/lesson-illustration-upload.ts) |
| Server UTApi re-download | [`src/lib/schemes/scheme-import-download.ts`](../src/lib/schemes/scheme-import-download.ts) |
| Middleware allowlist | [`src/middleware.ts`](../src/middleware.ts) lines 69 and 151 (`/api/uploadthing`) |

Auth token: `UPLOADTHING_TOKEN` (runtime secret). The route passes it explicitly. Legacy docs still mention `UPLOADTHING_SECRET` / `UPLOADTHING_APP_ID`; those are **not read by current code**.

### Shared middleware (authenticated endpoints)

[`getUploaderContext`](../src/lib/uploadthing/core.ts) + [`buildMetadata`](../src/lib/uploadthing/core.ts):

- Clerk session required.
- Canonical user + membership school resolution.
- Feature gate `DOCUMENTS_STORAGE` except platform operators, onboarding, and profile/branding folders.
- Usage limit `maxStorageBytes`.
- Demo policy deny.
- Custom UploadThing id: `{schoolSlug}/{folder}/{timestamp}-{index}-{sanitizedFileName}` (max 220 chars). This is a **display/custom id**, not a tenant-safe object key. School slug is derived from school name and can collide.
- `onUploadComplete` tracks `uploaded_assets` / `uploaded_bytes` and returns `{ url: file.ufsUrl \|\| file.url, key, name, size, type, customId, schoolSlug, folder }`.
- **The returned URL is treated as permanent** by every client.

### FileRouter endpoints

| Endpoint | Types / max | Folder | Extra auth | UI callers |
|---|---|---|---|---|
| `studentAvatar` | image 8MB x1 | `students/avatars` | membership | `ImageUploader`, `StudentDetailAvatar`, `useUploadFile` |
| `teacherAvatar` | image 8MB x1 | `teachers/avatars` | membership | `ImageUploader`, `TeacherDetailAvatar`, `useUploadFile` |
| `parentAvatar` | image 8MB x1 | `parents/avatars` | membership | `ImageUploader`, `useUploadFile` |
| `schoolAdminAvatar` | image 8MB x1 | `school-admins/avatars` | membership | `ImageUploader`, `useUploadFile` |
| `staffAvatar` | image 8MB x1 | `staff/avatars` | membership | `ImageUploader` |
| `bursarAvatar` | image 8MB x1 | `bursars/avatars` | membership | `ImageUploader`, InviteBursarModal |
| `schoolBrandImage` | image 8MB x1 | `school/branding` | admin/platform only | School identity, LaunchWizard, **also Store products** |
| `libraryBookCover` | image 8MB x1 | `library/covers` | `canUploadLibraryBookCover` | `LibraryBookCoverUpload` |
| `teacherDocument` | pdf/image/video/office 8–64MB | `documents/teachers` | membership + storage feature | `DocumentUploader` category `teachers`; **scheme import also uses this endpoint** |
| `studentRecordDocument` | same as teacher | `documents/students` | membership + storage feature | `UploadStudentDocumentModal` |
| `expenseReceipt` | pdf/image 8MB | `documents/expenses` | membership + storage feature | `DocumentUploader` category containing `expense`/`receipt` |
| `assignmentAttachment` | pdf/image/office 8–16MB | `assignments/attachments` | membership + storage feature | `ResourcesStep` (lesson resources); DocumentUploader `assignment` |
| `submissionAttachment` | same | `submissions/attachments` | membership + storage feature | student assignment page |
| `lessonIllustration` | image 8MB | `lessons/illustrations` | membership + storage feature | `LessonBlockEditors`; plus server `UTApi` from Leo |
| `noticeAttachment` | pdf/image/doc 8MB | `notices` | membership + storage feature | DocumentUploader category `notice` |
| `admissionDocument` | pdf/image/doc 8–16MB | `admissions/documents` or `students/parent-documents` | **no Clerk**; token/cycle | `PublicDocumentUploader` |

`admissionDocument` accepts exactly one of: supplemental request token, student parent-document token, applicant tracker token, or `schoolId+cycleSlug` for a published cycle. `userId` is stored as `"public"`. Storage limit is still checked.

### Client wrappers

- [`src/components/upload/ImageUploader.tsx`](../src/components/upload/ImageUploader.tsx) — maps `subjectRole` → avatar/branding endpoint.
- [`src/components/upload/DocumentUploader.tsx`](../src/components/upload/DocumentUploader.tsx) — maps `category` string → document endpoint. Default is `teacherDocument`.
- [`src/hooks/useUploadFile.ts`](../src/hooks/useUploadFile.ts) — same avatar mapping; returns `{ url, publicId: key }`.
- [`src/components/schemes/SchemeImportDocumentUploader.tsx`](../src/components/schemes/SchemeImportDocumentUploader.tsx) — hard-coded `teacherDocument`.
- [`src/components/admissions/public/PublicDocumentUploader.tsx`](../src/components/admissions/public/PublicDocumentUploader.tsx) — `admissionDocument`.

### Delete

[`deleteUploadThingFile`](../src/lib/uploadthing/delete.ts) extracts `/f/{key}` from the URL and calls `UTApi.deleteFiles(key)`. If the stored value is a local `/uploads/...` path or a data URL, delete returns `false` and the object is left behind (or never existed).

### URL assumptions (must change)

| File | Assumption |
|---|---|
| `src/lib/uploads/provider.ts` | `utfs.io`, `ufs.sh`, `uploadthing` → provider uploadthing |
| `src/lib/schemes/scheme-import-gate.ts` | only those hosts are trusted for server-side fetch |
| `src/components/lessons/TeachingSlideView.tsx` | `url.includes("utfs.io")` means "this is an image" |
| `next.config.ts` | Next/Image allowlist: `res.cloudinary.com`, `utfs.io`, `**.ufs.sh`, `ufs.sh`, Clerk |
| Tests | `tests/student-content-renderer.test.ts`, `tests/content-block-normalizer.test.ts` use `https://utfs.io/f/abc.png` |

---

## 3. Local Filesystem Inventory

| Path / writer | Classification | Notes |
|---|---|---|
| [`src/app/api/parent/documents/upload/route.ts`](../src/app/api/parent/documents/upload/route.ts) `writeFile(public/uploads/parent-documents/{schoolId}/{uuid}-{name})` | **PERMANENT_BUG** | Only runtime permanent disk write in `src/`. Persists `/uploads/parent-documents/...`. 8MB. MIME allowlist. Parent+ward auth on **upload only**. GET is a static public file. |
| Workspace file `public/uploads/parent-documents/<schoolId>/<uuid>-view-….pdf` | **PERMANENT_BUG** | At least one file already exists on disk. Directory is **not** in `.gitignore`. |
| [`src/app/api/docs/[...path]/route.ts`](../src/app/api/docs/[...path]/route.ts) `readFile(content/docs\|tasks/*.md)` | **BUILD_ASSET** | Serves in-repo markdown. Path-traversal guarded. Not user uploads. |
| PDF generators reading `public/logo/edusentrix-logo*.png` | **BUILD_ASSET** | Bundled brand mark embedded into PDFs. |
| `scripts/*.ts` / `scripts/generate-env-inventory-pdf.mjs` writeFile | **TEST_ONLY** / operator scripts | Write JSON/PDF next to the script. Not a runtime path. |
| `os.tmpdir` / `/tmp` in `src/` | none found | No runtime temp-dir writers. |
| Academic calendar `FileReader.readAsDataURL` | **PERMANENT_BUG** (not disk, but persisted blob) | See F22. |

No other `fs.writeFile` / `writeFileSync` / `createWriteStream` in `src/` besides the parent-document route.

---

## 4. Other Storage Providers / Legacy Config

| Provider | Status | Evidence |
|---|---|---|
| **Cloudinary** (`cloudinary` `^2.8.0`) | Legacy, still wired | [`src/lib/cloudinary.ts`](../src/lib/cloudinary.ts), [`src/lib/uploads/delete.ts`](../src/lib/uploads/delete.ts), [`src/app/api/uploads/sign/route.ts`](../src/app/api/uploads/sign/route.ts). Env: `CLOUDINARY_*`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. **No current UI caller of `/api/uploads/sign`.** |
| `next-cloudinary` `^6.17.5` | Unused | In `package.json`. Zero `CldImage` / `next-cloudinary` imports in `src/`. |
| [`src/lib/cloudinary-url.ts`](../src/lib/cloudinary-url.ts) `buildAvatarUrl` | Unused | No imports. |
| AWS SDK | Transitive (SES/SSO via other packages) | Not used for object storage. |
| Vercel Blob / S3 / R2 / Supabase / Firebase / MinIO / GCS / Azure / Dropbox | None in app code | — |
| Clerk image CDN | Identity avatars | `img.clerk.com` / `images.clerk.dev` in `next.config.ts`. Copied onto `User.avatarUrl` at session bootstrap. Not EduSentrix-owned storage. |
| Spec-only `PROPOSAL_STORAGE_PROVIDER=local` | Docs only | `docs/edusentrix_platform_admin_proposal_center_spec.md`. Not read by code. Proposal PDFs are generated in memory. |

---

## 5. Database File Metadata Inventory

Models store **public URLs** unless noted.

| Model | Field(s) | What it stores | Key? | Visibility field? | Lifecycle? |
|---|---|---|---|---|---|
| `User` | `avatarUrl` | Clerk or UploadThing URL | no | no | replaced on profile save; school purge harvests |
| `Student` | `photoUrl` | public image URL | no | no | replaced; old file deleted on student PATCH |
| `Student.enrollmentDocuments[]` | `fileUrl`, name, mime, size | copied from admissions | no | no | kept after provision |
| `Student.recordDocuments[]` | `fileUrl`, mime, size, type | staff or parent uploads | no | no | deleted via admin documents route |
| `Guardian` | `photoUrl` | public image URL | no | no | no object delete on guardian edit |
| `School` | `logo` | public image URL | no | no | purge harvests |
| `Teacher.qualifications[]` | `documentUrl` | optional URL | no | no | **NEEDS_REVIEW** (legacy field) |
| `TeacherDocument` | `fileUrl`, mime, size | teacher HR docs | no | no | delete route removes UT object |
| `LibraryBook` | `coverImageUrl`, `coverImageKey` | URL + optional key | yes | no | replace does not clearly delete old cover |
| `LibraryImportJob` | `fileUrl`, `csvText` | `fileUrl` unused; CSV lives in Mongo then cleared | n/a | n/a | csvText removed after job |
| `SchemeImportJob` | `fileUrl`, `fileKey` | UT URL + key | yes | no | cancelled job deletes UT file |
| `LessonResource` | `fileUrl`, `uploadThingKey`, visibility | file or link | yes | `visibility` enum | delete removes UT file |
| `LessonFlashcard` | `imageUrl` | URL | no | no | NEEDS_REVIEW |
| `Homework` / `Submission` | `attachments[].url` | public URL | no | no | no object delete on assignment delete |
| `Notice` | `attachments[].url` | public URL | no | no | no object delete found |
| `JournalEntry` | `attachments[].url` | public URL | no | no | no object delete found |
| `Message` | `attachments[]` url/key/customId | public URL + optional key | optional | no | no object delete found |
| `AdmissionApplication` | `applicant.photoUrl`, `documents[].fileUrl` | public URLs | no | no | rollback deletes on failed submit |
| `SchoolExpense.receipts[]` | `url` | public URL | no | no | no object delete found |
| `Payment.attachments[]` | string URLs | public URL | no | no | NEEDS_REVIEW |
| `FinancialTransaction.attachments[]` | url/name | public URL | no | no | NEEDS_REVIEW |
| `ExamQuestion` / `QuestionBankItem` | `attachments[].url`, `uploadKey` | public URL + optional key | optional | no | NEEDS_REVIEW (how uploaded) |
| `StoreProduct` | `imageUrl` | public URL (uploaded via **schoolBrandImage**) | no | no | no object delete found |
| `AcademicCalendarEvent` | `coverImageUrl` | **data URL or URL** | no | no | P0 |
| `CommunityPoll` / `PollTemplate` | `imageUrl`, `coverImageUrl` | URL | no | no | NEEDS_REVIEW |
| `FundraisingCampaign` / `Update` | `coverImageUrl`, `attachments[]` | URL strings | no | no | NEEDS_REVIEW |
| `StudentReportCard` | `pdfUrl` | unused write path | no | released flag on card | **never assigned** in `src/` |
| `ProposalBranding` | `logoUrl` | URL | no | platform | NEEDS_REVIEW |
| `EmailMessage` | `attachments[].storageKey`, top-level `storageKey` | metadata for generated/inbound mail | optional | sensitivity fields | not an EduSentrix object store today |
| `UsageEvent` / `UsageMetric` / `ServiceCostEntry` | `provider: "uploadthing"` | billing | n/a | n/a | rename later |

No model stores `bucket`, `etag`, `checksum`, or an access-level enum except `LessonResource.visibility`.

---

## 6. Upload Flows

See §11 and the classification table in this section. Upload authorization is Clerk + membership for authenticated FileRouter endpoints; token/cycle for `admissionDocument`; parent session for the local parent-document route; none for calendar data URLs beyond the admin page.

### Classification table

Every flow has exactly one class.

| ID | Domain | Roles | Feature | Provider today | Class | Demo | Complexity |
|---|---|---|---|---|---|---|---|
| F01 | Identity | admin/teacher | Student photo | UploadThing `studentAvatar` | MIGRATE_TO_R2_PRIVATE | P0 | LOW |
| F02 | Identity | admin | Teacher photo | UploadThing `teacherAvatar` | MIGRATE_TO_R2_PRIVATE | P0 | LOW |
| F03 | Identity | admin | Parent/guardian photo | UploadThing `parentAvatar` | MIGRATE_TO_R2_PRIVATE | P1 | LOW |
| F04 | Identity | self/admin | School-admin / staff / bursar photo | UploadThing avatar endpoints | MIGRATE_TO_R2_PRIVATE | P1 | LOW |
| F05 | Branding | school_admin | School logo | UploadThing `schoolBrandImage` | MIGRATE_TO_R2_PUBLIC | P0 | LOW |
| F06 | Store | admin | Product image | UploadThing **schoolBrandImage** (reuse) | MIGRATE_TO_R2_PUBLIC | P1 | LOW |
| F07 | Library | admin/librarian | Book cover | UploadThing `libraryBookCover` | MIGRATE_TO_R2_PUBLIC | P1 | LOW |
| F08 | HR | admin | Teacher documents | UploadThing `teacherDocument` | MIGRATE_TO_R2_PRIVATE | P0 | MEDIUM |
| F09 | Students | admin | Student record documents | UploadThing `studentRecordDocument` | MIGRATE_TO_R2_PRIVATE | P0 | MEDIUM |
| F10 | Admissions | public applicant | Application documents + photo | UploadThing `admissionDocument` | MIGRATE_TO_R2_PRIVATE | P0 | MEDIUM |
| F11 | Students | public parent (token) | Requested parent document | UploadThing `admissionDocument` folder `students/parent-documents` | MIGRATE_TO_R2_PRIVATE | P0 | MEDIUM |
| F12 | Students | logged-in parent | Requested parent document | **Local `public/uploads`** | MIGRATE_TO_R2_PRIVATE | P0 | MEDIUM |
| F13 | Finance | admin/bursar | Expense receipts | UploadThing `expenseReceipt` | MIGRATE_TO_R2_PRIVATE | P1 | LOW |
| F14 | Academics | teacher | Assignment attachments | UploadThing `assignmentAttachment` | MIGRATE_TO_R2_PRIVATE | P1 | MEDIUM |
| F15 | Academics | student | Submission attachments | UploadThing `submissionAttachment` | MIGRATE_TO_R2_PRIVATE | P1 | MEDIUM |
| F16 | Academics | teacher | Lesson resources / illustrations | UT client + `UTApi` | MIGRATE_TO_R2_PRIVATE | P1 | MEDIUM |
| F17 | Academics | teacher | Notice attachments | UploadThing `noticeAttachment` | MIGRATE_TO_R2_PRIVATE | P2 | LOW |
| F18 | Schemes | admin/teacher | Scheme import source file | UploadThing `teacherDocument` | MIGRATE_TO_R2_PRIVATE | P1 | MEDIUM |
| F19 | Calendar | admin | Event cover | **Data URL in Mongo** | MIGRATE_TO_R2_PUBLIC | P0 | LOW |
| F20 | Cloudinary | any authenticated | `POST /api/uploads/sign` | Cloudinary | REMOVE_LEGACY_STORAGE | P0 | LOW |
| F21 | Generated | many | Report/receipt/exam/export PDFs+CSV | In-memory HTTP | KEEP_TEMPORARY_LOCAL | P0 | LOW |
| F22 | Imports | admin | Student/teacher CSV/XLSX | In-memory formData | KEEP_TEMPORARY_LOCAL | P1 | LOW |
| F23 | Imports | admin | Library CSV | Mongo `csvText` then clear | KEEP_TEMPORARY_LOCAL | P2 | LOW |
| F24 | Email | platform/school | Compose attachments | Base64 on the wire | KEEP_TEMPORARY_LOCAL | P2 | LOW |
| F25 | Docs | any | `/api/docs` markdown | Repo files | KEEP_BUNDLED_STATIC | P2 | LOW |
| F26 | Brand | system | `public/logo/*` | Bundled | KEEP_BUNDLED_STATIC | P0 | LOW |
| F27 | Identity | Clerk | `img.clerk.com` avatars | Clerk CDN | KEEP_BUNDLED_STATIC | P1 | LOW |
| F28 | Legacy pkg | — | `next-cloudinary`, `cloudinary-url.ts` | unused | REMOVE_LEGACY_STORAGE | P2 | LOW |
| F29 | Scripts | operators | script writeFile JSON/PDF | local repo | KEEP_TEMPORARY_LOCAL | P2 | LOW |
| F30 | Finance | admin/parent | Payment / ledger attachments | URL strings | NEEDS_REVIEW | P2 | MEDIUM |
| F31 | Exams | admin/teacher | Question attachments | URL + optional uploadKey | NEEDS_REVIEW | P1 | MEDIUM |
| F32 | Comms | teacher | Journal / message attachments | URL (+ optional key) | NEEDS_REVIEW | P2 | MEDIUM |
| F33 | Community | admin | Poll / fundraising images | URL strings | NEEDS_REVIEW | P2 | MEDIUM |
| F34 | Platform | growth | Proposal branding logo | URL | NEEDS_REVIEW | P2 | LOW |
| F35 | Reports | — | `StudentReportCard.pdfUrl` | unused | NEEDS_REVIEW | P2 | LOW |
| F36 | Email | system | `EmailMessage.storageKey` | unused as object store | NEEDS_REVIEW | P2 | LOW |
| F37 | HR | admin | `Teacher.qualifications.documentUrl` | optional URL | NEEDS_REVIEW | P2 | LOW |
| F38 | Lessons | teacher | `LessonFlashcard.imageUrl` | URL | NEEDS_REVIEW | P2 | LOW |
| F39 | Billing | platform | UploadThing usage/cost sync | metadata only | REMOVE_LEGACY_STORAGE (rename later) | P2 | LOW |
| F40 | Demo | demo runtime | Demo policy blocks UT upload | n/a | KEEP_TEMPORARY_LOCAL | P1 | LOW |
| F41 | Supplies | admin | `imageUrl` display | URL | NEEDS_REVIEW | P2 | LOW |
| F42 | Onboarding | school_admin | Launch wizard logo | UploadThing `schoolBrandImage` | MIGRATE_TO_R2_PUBLIC | P0 | LOW |

Proposed R2 visibility, keys, and access for the migrate rows are in §12–§13.

---

## 7. Download / Preview / Access Flows

| Pattern | Where | Auth today | After R2 |
|---|---|---|---|
| Direct public URL in `<img>` / `<a href>` / Next/Image | avatars, logos, covers, documents, lessons (`TeachingSlideView`), store, library | **none** once URL is known | private: signed GET or proxy; public: CDN URL |
| Static `/uploads/parent-documents/...` | parent-uploaded files | **none** | must disappear |
| Authenticated PDF stream | parent report download, fee receipts, exam export, overdue/period/admin reports, schemes template, billing guide, proposals | role route | keep streaming; do not store |
| Server fetch of upload URL | scheme-import-download, report-card logo embed (`embedSchoolLogo` fetches `logoUrl`) | server | fetch via R2 SDK / signed GET |
| Email HTML images | `EMAIL_ASSET_ORIGIN` + bundled assets | public HTTPS | school logos need a stable public URL or be inlined |
| `/api/docs/[...path]` | content markdown | none | keep |
| Clerk CDN | default avatars | public | keep |

There is **no** authenticated file-proxy route for UploadThing objects today. Private documents are not actually private.

---

## 8. Delete / Replace / Cleanup Flows

| Trigger | Objects deleted? |
|---|---|
| Admin replace student photo | yes, previous `photoUrl` via `deleteUploadedFile` |
| Admin replace teacher avatar | yes, previous `User.avatarUrl` |
| Admin delete teacher document | yes |
| Admin delete student record document | yes |
| Teacher delete lesson resource | yes |
| Scheme import cancel | yes (`scheme-import-create`) |
| Failed admissions submit | yes, rollback of uploaded URLs |
| Failed public attach (token routes) | yes, rollback |
| `UploadRollbackManager` | yes, if used |
| School purge | harvests http(s) URLs that look like UT/Cloudinary, then `deleteUploadedFiles` |
| Assignment / notice / journal / message / expense / store / calendar replace | **usually metadata only** — objects can orphan |
| Parent local `/uploads` file | **never deleted from disk** |
| Data-URL calendar cover | nothing to delete in object storage |
| Cloudinary leftover | deleted only if credentials present and URL parses |

Demo `deleteFiles` is simulated (returns success without calling UT).

---

## 9. Generated Files / Reports / PDFs

All of these are **KEEP_TEMPORARY_LOCAL** for the demo. They are built synchronously (or in the request) and returned as `Content-Disposition` attachments. They are not written to disk or R2.

| Generator | Route / caller | Persist? |
|---|---|---|
| Snapshot report card | `GET /api/parent/reports/download` | no (`StudentReportCard.pdfUrl` unused) |
| Admin/period/overdue reports | `/api/admin/reports/[id]/pdf`, `/periods/[id]/report/pdf`, `/fees/overdue-report/pdf` | no |
| Client `GenerateSimpleReportModal` | browser `pdf-lib` | no |
| Fee receipts | admin + parent `/finance/receipts/.../download` | no |
| Subscription receipts | `/admin/subscription/invoices/[id]/receipt`, Paystack webhook email attach | in-memory attach |
| Learn receipt | `src/lib/learn/receipt-pdf.ts` | no |
| Exam paper / timetable | admin/teacher exam export routes | no |
| Scheme of learning PDF | admin schemes template + `generate-scheme-of-learning-pdf.ts` | no |
| Billing guide | admin + platform `billing-guide.pdf` | no |
| Proposal PDF | `/api/platform/proposals/[proposalId]/download` + send | in-memory |
| CSV/XLSX exports | students, teachers, invitations, admissions, finance, community, exams, bills | no |

Do **not** move these to R2 before Tuesday. They already work without object storage. Revisit later only if you need durable reprint of the exact bytes.

---

## 10. Imports / Source Files

| Import | Upload | Retained? | R2? |
|---|---|---|---|
| Scheme of learning (PDF/CSV/XLSX) | UploadThing `teacherDocument` → `SchemeImportJob.fileUrl/fileKey` | yes until cancel | **Yes, private** (F18). Server re-downloads via trusted-host fetch + `UTApi.getFileUrls`. |
| Scheme validate | `POST /api/admin/scheme-imports/validate` formData, 15MB | no, parsed in request | no |
| Student import | `POST /api/admin/students/import` formData CSV/XLSX | no | no |
| Teacher bulk-create | `POST /api/admin/teachers/bulk-create` formData | no | no |
| Library import | CSV text on `LibraryImportJob`, then cleared | not as a file | no |
| Admissions documents | UploadThing, then copied onto `Student.enrollmentDocuments` | yes | yes (F10) |
| Leo illustration | server UTApi from buffer/URL | yes on lesson | yes (F16) |

---

## 11. Security Findings

P0 before R2 cutover (not a rewrite — these must be designed into the new helper):

1. **IDOR via URL leakage.** UploadThing URLs are unguessable-ish but unauthenticated. Persist keys; never persist long-lived public URLs for private objects.
2. **Parent `/uploads` is guessable and public.** `{schoolId}` is an ObjectId; filename is `{uuid}-{sanitizedName}`. Still served as a static asset. Cut over in R2.1/R2.2.
3. **Admission public endpoint is correctly token-gated** but still produces a public UT URL. Keep token/Clerk checks **before** issuing a presign; do not make the bucket public.
4. **MIME/size:** FileRouter enforces type+size. Parent local route checks MIME + 8MB. Calendar data-URL path only checks `image/*` and size in the browser. Scheme import has a second size check. R2 must re-validate Content-Type and size on the server after upload (presign cannot be trusted alone).
5. **Filename sanitization exists** (`sanitizeFileName`, `safeFileName`) but customId uses school **slug from name**. Do not put user-supplied names or school names in R2 keys.
6. **Path traversal:** parent route uses `path.join` with a UUID prefix and sanitized name. `/api/docs` blocks `..`. Fine. Do not take object keys from the client.
7. **Cloudinary sign route** is an unused authenticated signer. Remove or disable in the same deploy so leftover Cloudinary credentials cannot be used to upload.
8. **Malicious PDF/image:** no AV/scanning. Acceptable for demo if types/sizes stay tight. Do not set `Content-Disposition: inline` for untrusted PDFs on a parent domain without a separate file host.
9. **Replace/delete authorization** is per-route and inconsistent. R2 delete must go through the same school-scoped routes; never accept a raw key from the client.
10. **Store products use `schoolBrandImage`**, which is admin-only — good — but they inherit the public branding folder. Give products their own prefix.

Non-P0: missing object delete on many collections (orphans); `UploadThing` customId collisions across similarly named schools; no checksum; billing provider name `uploadthing`.

---

## 12. Proposed R2 Architecture

Use **one private R2 bucket** as the only permanent object store. The browser asks an authenticated EduSentrix route for a **short-lived presigned PUT** (or, for the few server-generated images like Leo illustrations, the server PUTs the bytes). Mongo stores `{ storageProvider: "r2", storageKey, fileName, mimeType, sizeBytes, visibility }`. Download: the app checks school/role/token, then returns a **short-lived signed GET** (60–300s) or streams the object through an authenticated route. **Do not** persist the signed URL.

Server upload is safer for: Leo illustrations, scheme-import re-processing (download then parse), PDF logo embedding, and any file already on the server. Presigned PUT is better for the existing browser dropzones (avatars, documents, admissions) so the Next server does not buffer 16–64MB.

Public objects (school logo, store product image, library cover, calendar cover): same private bucket, `visibility: "public"` metadata, and a **separate public hostname** (`R2_PUBLIC_BASE_URL`) only if you enable a public bucket prefix or a Cloudflare Worker that serves those prefixes. For Tuesday, it is safer to **sign even public images** (or proxy them) than to open a public bucket. School logos needed inside PDFs can be fetched server-side with the R2 SDK.

Do not put student documents, admissions files, receipts, assignments, or schemes on a public prefix.

---

## 13. Proposed Object Key Strategy

Deterministic, tenant-first, no user path segments:

```
schools/{schoolId}/avatars/students/{studentId}/{assetId}.{ext}
schools/{schoolId}/avatars/users/{userId}/{assetId}.{ext}
schools/{schoolId}/branding/logo/{assetId}.{ext}
schools/{schoolId}/store/products/{productId}/{assetId}.{ext}
schools/{schoolId}/library/covers/{bookId}/{assetId}.{ext}
schools/{schoolId}/calendar/events/{eventId}/{assetId}.{ext}
schools/{schoolId}/teachers/{teacherId}/documents/{documentId}/{assetId}.{ext}
schools/{schoolId}/students/{studentId}/records/{documentId}/{assetId}.{ext}
schools/{schoolId}/students/{studentId}/parent-documents/{requestId}/{assetId}.{ext}
schools/{schoolId}/admissions/{applicationId-or-cycleId}/{requirementId}/{assetId}.{ext}
schools/{schoolId}/finance/expenses/{expenseId}/{assetId}.{ext}
schools/{schoolId}/assignments/{homeworkId}/{assetId}.{ext}
schools/{schoolId}/submissions/{submissionId}/{assetId}.{ext}
schools/{schoolId}/lessons/{lessonId}/resources/{resourceId}/{assetId}.{ext}
schools/{schoolId}/lessons/{lessonId}/illustrations/{assetId}.{ext}
schools/{schoolId}/notices/{noticeId}/{assetId}.{ext}
schools/{schoolId}/schemes/imports/{jobId}/{assetId}.{ext}
```

Rules:

- `{assetId}` is a server-generated UUID. Never the original filename.
- Store the original filename only in Mongo (`fileName`).
- Reject any key that does not start with `schools/{activeSchoolId}/` for that request.
- Replacement writes a new `{assetId}` then deletes the old key. Do not overwrite in place until delete is proven.
- No PII, tokens, or school names in the key.

---

## 14. Environment Variables

### Current (do not print values)

| Variable | Used by | Kind |
|---|---|---|
| `UPLOADTHING_TOKEN` | `/api/uploadthing`, platform settings “configured” flag | runtime secret |
| `UPLOADTHING_COST_PER_GB_MINOR` | `provider-sync.ts` | runtime, optional |
| `CLOUDINARY_CLOUD_NAME` | sign, delete, `cloudinary.ts` | runtime |
| `CLOUDINARY_API_KEY` | sign, delete, `cloudinary.ts` | runtime secret |
| `CLOUDINARY_API_SECRET` / `CLOUDINARY_API_SECRET_KEY` | sign, delete, `cloudinary.ts` | runtime secret |
| `CLOUDINARY_URL` | present in local env; not read by app code | leftover |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | unused `cloudinary-url.ts` | public leftover |
| `EMAIL_ASSET_ORIGIN` / `APP_URL` | email image origin | public-ish runtime |
| `UPLOADTHING_SECRET` / `UPLOADTHING_APP_ID` | docs only | unused |

`.env.example` does **not** currently list UploadThing or Cloudinary. README still documents both.

### Proposed R2 (follow existing `SCREAMING_SNAKE` runtime style)

| Variable | Kind | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | runtime secret-adjacent | not `NEXT_PUBLIC` |
| `R2_ACCESS_KEY_ID` | runtime secret | |
| `R2_SECRET_ACCESS_KEY` | runtime secret | |
| `R2_BUCKET` | runtime | |
| `R2_ENDPOINT` | runtime | `https://<account>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_BASE_URL` | runtime, optional | only if a public prefix is justified |
| `R2_SIGNED_URL_TTL_SECONDS` | runtime, optional | default 120 |

No R2 secrets in `NEXT_PUBLIC_*`. Next/Image, if used, needs a public hostname in `next.config.ts` — that hostname is not a secret.

After cutover, remove `UPLOADTHING_*` and Cloudinary vars from production once the leftover-URL scan is empty.

---

## 15. Clean Cutover Decision

**CLEAN CUTOVER: YES**

Meaning for this repo:

- One deploy switches every **write** path to R2.
- No dual-write.
- No UploadThing compatibility wrapper in new uploads.
- No historical object copy if production has no uploaded URLs.
- Generated PDFs stay request-scoped.
- Clerk avatars stay on Clerk.
- Bundled logos stay in `public/logo`.

Preconditions (do these as read-only queries, not in this audit):

```
db.students.find({ $or: [
  { photoUrl: /utfs|ufs\.sh|uploadthing|cloudinary|\/uploads\// },
  { "recordDocuments.fileUrl": /utfs|ufs\.sh|uploadthing|cloudinary|\/uploads\// }
]}, { _id: 1 }).limit(5)
```

Repeat for `users.avatarUrl`, `schools.logo`, `teacherdocument`, `admissionapplications`, `lessonresources`, `schemeimportjobs`, `homework`, `submissions`, `notices`, `schoolexpenses`, `librarybooks`, `storeproducts`, `academiccalendarevents`.

If any rows exist: display leftover URLs as-is until those records are re-uploaded; still write new files only to R2.

Demo/seed: demo scripts use `DEMO-…` invoice numbers and do not appear to seed UploadThing URLs. Tests use `https://utfs.io/f/abc.png` fixtures — update those in R2.5. The on-disk `public/uploads/parent-documents/...` file is local workspace residue, not seed code.

---

## 16. Demo-Ready Migration Batches

### Batch R2.1 — storage foundation

- Add `src/lib/storage/r2.ts` (presign PUT/GET, server put/delete, key builder, content-type allowlist).
- Add env vars. Do **not** add AWS SDK in this audit; implementation batch installs `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (or the Cloudflare R2 client) with explicit approval.
- Shared metadata type `{ storageProvider, storageKey, fileName, mimeType, sizeBytes, visibility }`.
- Files likely: new `src/lib/storage/*`, `.env.example`, `next.config.ts` image hosts.
- Validation: unit tests for key builder, sanitizer, trusted-host check.
- Rollback: unused if no callers yet. Risk: LOW.

### Batch R2.2 — private upload/download (P0 demo)

- Replace FileRouter endpoints used by avatars, branding, teacher/student docs, admissions, parent-document token + **logged-in parent local write**.
- New routes: `POST /api/uploads/presign` (auth + kind) and `GET /api/uploads/file` (auth + key) **or** return a signed GET.
- Delete `/api/parent/documents/upload` disk write; use the same private helper.
- Keep public admissions token checks.
- Files: `src/lib/uploadthing/core.ts` callers, `ImageUploader`, `DocumentUploader`, `PublicDocumentUploader`, parent upload route, admissions attach routes, student/teacher document APIs.
- Validation: upload avatar, teacher doc, student doc, admissions doc, parent token doc, parent session doc; confirm Mongo has keys not `utfs.io`; confirm `/uploads` is gone; confirm unsigned GET 403.
- Rollback: revert deploy; old UT still in env until R2.5. Risk: MEDIUM.

### Batch R2.3 — remaining UploadThing kinds + public images

- Library covers, store products, lesson illustrations (client + `UTApi`), scheme import download allowlist, notices, expenses, assignments/submissions, calendar ImageUpload → real upload.
- Files: library cover component, store page, `lesson-illustration-upload.ts`, `scheme-import-gate.ts` / `scheme-import-download.ts`, `ResourcesStep`, assignment/submit pages, academic-calendar page, `image-upload.tsx`.
- Validation: each kind uploads, list/preview works, scheme import still parses.
- Risk: MEDIUM.

### Batch R2.4 — generated files / local filesystem

- Confirm no remaining `public/uploads` writes.
- Gitignore `public/uploads/`.
- Do **not** move generated PDFs to R2.
- Optional: delete leftover workspace file under `public/uploads/`.
- Risk: LOW.

### Batch R2.5 — remove UploadThing / Cloudinary

- Delete `src/lib/uploadthing/**`, `/api/uploadthing`, `/api/uploads/sign`, Cloudinary helpers, unused `next-cloudinary`.
- Remove packages and env vars.
- Update middleware allowlist, platform settings “configured” flag, provider-sync `uploadthing` label (can stay as historical metric name).
- Update tests that hard-code `utfs.io`.
- Validation: `rg uploadthing utfs.io cloudinary` empty in `src/`; `npm test`; dry-run upload of each P0 kind on the demo deploy.
- Rollback: re-deploy previous image; UT account still exists until you disable it. Risk: LOW if R2.2–R2.3 already shipped.

Do not implement these batches in this audit.

---

## 17. Validation Plan

1. Read-only production URL scan (queries in §15).
2. After R2.1: key-builder unit tests; no production traffic change.
3. After R2.2: manual matrix — student photo, school logo, teacher PDF, admissions PDF, parent token upload, parent session upload. Check Mongo fields. Confirm old `/uploads` 404s. Confirm a raw R2 URL without signature fails.
4. After R2.3: library cover, store image, lesson illustration, scheme PDF import, assignment attach, calendar cover (must not be a `data:` URL).
5. After R2.5: grep gates in §19; `npm test`; demo walkthrough.
6. Confirm demo policy still blocks real uploads on the demo host, or writes only to a demo prefix.

---

## 18. Rollback Plan

- Keep UploadThing and Cloudinary accounts alive until Tuesday+1 after R2.5.
- Rollback = redeploy the previous Coolify image. Existing R2 objects can remain; they will be orphaned, which is acceptable with no production users.
- Do not delete the R2 bucket as the rollback step.
- If R2.2 is live and UT is already removed, rollback also requires restoring `UPLOADTHING_TOKEN`.

---

## 19. Completeness Evidence

| Gate | Evidence |
|---|---|
| Every UploadThing import | `rg` of `uploadthing` / `@uploadthing` / `useUploadThing` / `UTApi` / `createUploadthing` in `src/` + `tests/` + `package.json`. Core files: 4 under `src/lib/uploadthing/`, 1 route, 1 server upload helper, 1 scheme download, 10 UI/hook files, middleware, provider-sync, demo policy, billing. Docs (`UPLOADTHING_MIGRATION_PLAN.md`, README, subscription spec) are historical. |
| Every UploadThing route/config | Single route `src/app/api/uploadthing/route.ts`. 16 endpoints in `ourFileRouter`. |
| Every local filesystem write | 1 runtime write (`parent/documents/upload`). 4 script writers. 0 `os.tmpdir` writers in `src/`. |
| Every `/uploads` path | Only the parent-document route writes/reads that prefix. One on-disk file under `public/uploads/parent-documents/`. |
| File URL model fields | Section 5 lists every `src/models` hit for `fileUrl`, `photoUrl`, `avatarUrl`, `logo`, `coverImage*`, `imageUrl`, `pdfUrl`, `attachments`, `receipts`, `storageKey`, `fileKey`, `uploadThingKey`, `uploadKey`. |
| Generated PDF/export paths | Section 9. All `pdf-lib` / `@react-pdf` hits in `src/` are streamed. |
| Import/upload source paths | Section 10. Four formData routes + scheme UT + library csvText. |
| Download/view paths | Section 7. |
| Delete/replace paths | Section 8. All `deleteUploadedFile(s)` call sites listed. |
| Storage env vars | Section 14. |
| Current providers | UploadThing (primary), Cloudinary (legacy delete/sign), Clerk CDN (avatars), local disk (parent docs), in-memory (generated). |
| Every flow classified | F01–F42. |
| P0 blockers identified | Executive summary. |

Approximate search counts (source, excluding `package-lock.json` and `node_modules`):

- UploadThing identifier hits in `src/`: ~40 files
- Filesystem write call sites: 5 (1 app + 4 scripts)
- Upload HTTP routes: 1 UT handler + 1 Cloudinary sign + 1 parent local + 4 formData imports + several “attach metadata” APIs
- File-serving routes: 1 static `/uploads` + 1 `/api/docs` + ~13 PDF/CSV download routes
- Model URL/key fields: 28 models in §5
- Generated-file flows: 13
- Storage env vars in use: 7 (+ 2 unused documented names)

---

## 20. Needs Review / Unknowns

1. **Production URL occupancy** — not scanned (no production data in this audit). Blocks the final “empty DB” confirmation.
2. **F30–F38** — URL fields exist; some UIs may paste a URL or reuse `DocumentUploader` with a generic category. Confirm before R2.3 whether exams, messages, journals, polls, fundraising, supplies, and proposal logos actually upload files today.
3. **Inbound email attachments** — `EmailMessage.attachments.storageKey` may be intended for a future object store. Not wired to UploadThing.
4. **Whether Coolify serves `public/uploads`** — Next does, so any file written there is public for the life of that container.
5. **64MB video on `teacherDocument` / `studentRecordDocument`** — presigned PUT is the right shape; do not buffer through the Next server.
6. **School slug in current customId** — not unique. Do not reuse as an R2 key.
7. **Billing metrics named `uploadthing`** — leave historical rows; change the writer in R2.5.
8. This workspace’s `public/uploads/...pdf` may contain a real student-looking filename. Treat as local residue; do not commit it.

---

End of audit. Implementation starts only after this document is accepted.

---

## Implementation note — R2.1 storage foundation (2026-10-04)

Additive only. UploadThing, Cloudinary, and the parent `public/uploads` writer were not removed. No production data was modified. No Cloudflare bucket was created.

### Production occupancy

Read-only scan of `edusentrix-prod` completed before this batch:

- TOTAL MATCHING DOCUMENTS 0
- UPLOADTHING 0 / CLOUDINARY 0 / LOCAL_UPLOAD 0 / DATA_URL 0
- Result: `CLEAN_CUTOVER_CONFIRMED`

### StoredAsset

New collection/model: `src/models/StoredAsset.ts`.

- Provider: `r2` only
- Unique `storageKey` via named index `unique_stored_asset_storage_key` (not field-level `unique`)
- Statuses: `pending` | `ready` | `deleted` | `failed`
- Visibility: `private` | `public` (EduSentrix gateway policy, not an R2 ACL)
- Soft-delete fields: `deletedAt`, `purgeAfter` (30 days)
- Optional `association { type, id }` so a domain id can attach later without renaming the R2 object
- Mongo never stores presigned PUT/GET URLs, R2 endpoints, or Cloudflare object URLs

### R2 env vars

Required: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`  
Optional: `R2_SIGNED_URL_TTL_SECONDS` (default 120)  
`R2_PUBLIC_BASE_URL` was **not** added. No `NEXT_PUBLIC_*` storage secrets.

Config is lazy (`getR2Config()`). Importing kinds/urls/key-builder does not require env.

### Asset gateway URL

`getStoredAssetUrl(assetId)` → `/api/storage/assets/{assetId}`

Routes:

- `POST /api/storage/uploads/presign` — Clerk + active school; returns `{ assetId, uploadUrl, headers, expiresInSeconds, assetUrl }`
- `POST /api/storage/uploads/complete` — HEAD R2, validate type/size/key, mark READY
- `GET /api/storage/assets/[assetId]` — READY only; public may be anonymous; private requires same-school actor; 302 to a short-lived signed GET

`/api/storage/assets` is middleware-public so the gateway can authorize public reads. Presign/complete stay Clerk-protected.

### Object keys

Server-generated only: `schools/{schoolId}/.../{uuid}.{ext}` or `schools/{schoolId}/pending/{kind}/{uuid}.{ext}`. No original filename, school name, or PII in the key.

### Soft-delete / recovery

`softDeleteAsset` sets `deleted` + `purgeAfter` and leaves the R2 object. `restoreAsset` requires `purgeAfter` in the future and a successful HEAD. `purgeAsset` exists internally and is not a client route. No Inngest purge job yet.

### Indexes

Schema indexes: unique storageKey, `{schoolId,status}`, `{schoolId,kind,createdAt}`, partial `{purgeAfter}` for deleted assets.

`scripts/ensure-stored-asset-indexes.ts` is dry-run by default. `--apply` creates missing StoredAsset indexes only, never drops, never modifies documents. **Not applied to production in R2.1.**

### Tests

`tests/storage/*` and `tests/regression/stored-asset-index-script.test.ts`. R2 is mocked. The `public/` write invariant allows exactly one documented exception: `src/app/api/parent/documents/upload/route.ts`.

### Remaining R2.2 work

- Migrate UploadThing UI callers
- Wire admission/parent token auth to the kind registry
- Replace the parent local-disk upload
- Remove the documented `public/uploads` exception
- Do not enable a public R2 bucket

## Appendix: R2 clean cutover (2026-10-04)

Write cutover completed on `infra/cloudflare-r2-storage`. Production occupancy was already empty. No dual-write. No historical object migration. No public R2 bucket. Nothing committed or pushed. Cloudflare CORS was documented only, not applied.

What changed after R2.1:

- Private reads are domain-scoped. Same-school membership is no longer enough for another user's staged or associated private file.
- `associateStoredAsset` plus `{ schoolId, association.type, association.id }` index.
- All active UI uploaders use `src/lib/storage/client/upload.ts` (presign → XHR PUT → complete) and persist `/api/storage/assets/{id}` only.
- Public admission/parent uploads use token-gated `/api/storage/public/uploads/{presign,complete}`.
- Parent documents use R2 `createReadyAssetFromBytes`. `public/uploads` residue was deleted; the write invariant is now strict.
- Leo illustrations use `putObject`. Scheme import reads via in-school StoredAsset `getObject`. Calendar covers reject `data:image/`. Deletes are internal URL soft-delete only.
- UploadThing and Cloudinary packages, routes, middleware allowlist, and Next image hosts were removed. Demo `storage.upload` stays **deny**. New billing writers use `storage`/`r2`; historical `uploadthing` rows stay.

NEEDS_REVIEW dispositions left as inspected: store products migrated to `store_product_image`; ProposalBranding.logoUrl, Teacher.qualifications.documentUrl, and EmailMessage.storageKey stay URL/external; unused Payment.attachments and StudentReportCard.pdfUrl left; placeholder exam/journal/message/poll/fundraising/flashcard/FinancialTransaction image fields left without invented UI.

