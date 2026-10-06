# Demo presentation guide

Live sales walkthrough for [https://demo.tryedusentrix.app](https://demo.tryedusentrix.app). The demo uses a Lighthouse sandbox pool (`DemoSandbox` schools), not a single named production school. Presentation data is tagged `presentation-demo-v1` and must only be written to MongoDB database **`edusentrix-demo`**.

Do not run this seed against production. Do not run flagship `--clean`. Do not wipe Snow Leopard or untagged records.

## School and cast

| Role | Person | Notes |
| --- | --- | --- |
| School | Lighthouse Preparatory School, Accra | Sandbox school from the flagship pool |
| Admin | Mrs. Ama Boateng | Flagship `admin@lighthouseprep.demo.tryedusentrix.app` is renamed off Kwame Mensah |
| Student | Kwame Mensah | JHS 2A, admission `PRES-S0001`, ~17 classmates |
| Parent | Akosua Mensah | Mother, linked through a real Guardian row |
| Teacher | Mr. Daniel Owusu | Mathematics, assigned to JHS 2A, with a `Teacher` row |

## Outstanding balance

Kwame’s Term 1 invoice is **GHS 850** outstanding, produced by the fee engine (one invoice, multiple line items, allocated payments). Admin finance and parent fees must show the same records.

Attendance for Kwame is derived (~95% present-or-late over 20 homeroom days: 18 present, 1 late, 1 absent). It is not a hardcoded percentage field.

## Idle timeout (Coolify)

Code default is **90 minutes** (`DEMO_IDLE_TIMEOUT_MINUTES`). `.env.example` matches that.

On Coolify for `demo.tryedusentrix.app`, set:

```bash
DEMO_IDLE_TIMEOUT_MINUTES=90
```

A deployed `DEMO_IDLE_TIMEOUT_MINUTES=5` still wins over the code default. Do not change non-demo session security.

## Seed and reset

From a machine pointed at the demo Mongo URI, with `MONGO_DB_NAME` / `DEMO_MONGO_DB_NAME` resolving to `edusentrix-demo`:

```bash
npm run seed:demo-presentation
npm run seed:demo-presentation:reset
```

Reset deletes only `presentation-demo-v1` records on `DemoSandbox` schools, then reseeds. It never wipes the whole database.

If the resolved database name is not exactly `edusentrix-demo` (or contains `prod`), the script aborts:

```text
REFUSED: Presentation demo seeding can only run against edusentrix-demo.
Current database: <name>
```

## Persona switching

The demo cookie (`edusentrix_demo_session`) stays stable. `POST /api/demo/switch-persona` replaces `DemoSession.activePersonaRole` / `activePersonaUserId`. The banner in the app layout covers `/admin`, `/teacher`, and `/parent`. Redirects stay `/admin`, `/teacher`, `/parent`. The switch API is 404 outside demo mode.

## Routes to open during the walkthrough

- Admin: `/admin`, `/admin/students`, student overview, `/admin/fees` or invoices
- Parent: `/parent`, `/parent/fees`, `/parent/reports`, `/parent/attendance`, `/parent/messages`
- Teacher: `/teacher`, `/teacher/homeroom/timetable`, `/teacher/lesson-notes`, `/teacher/gradebook` or marks, `/teacher/communication/notices`

## 17-step live flow

1. Open `https://demo.tryedusentrix.app` and start a demo session.
2. Confirm the banner shows School Admin and that session idle time is 90 minutes (unless Coolify still has `5`).
3. You should be Mrs. Ama Boateng on `/admin`.
4. Open Students and find **Kwame Mensah** in **JHS 2A**.
5. Open Kwame’s overview: class, homeroom teacher (Mr. Owusu), and guardians include Akosua.
6. Open academics / report card and show the **released** Term 1 report (Mathematics is strong).
7. Open fees for Kwame and show **GHS 850** outstanding on the Term 1 invoice.
8. Open attendance and scan the derived history (one absence, one late).
9. Use the banner to switch to **Parent**. You should land on `/parent` as Akosua Mensah; the Admin/Parent/Teacher buttons must still work.
10. From the parent dashboard, open Kwame and confirm the same outstanding **GHS 850**.
11. Open the parent report card: released official results, not draft internals.
12. Open notices or messages: PTM, mid-term break, outstanding fees, exam schedule (in-app only; no email/SMS).
13. Switch to **Teacher**. You should land on `/teacher` as Mr. Daniel Owusu (not `/dashboard` without a banner).
14. Open the class timetable: conflict-free weekly Mathematics periods for JHS 2A.
15. Open the Mathematics scheme / approved lesson note on algebraic expressions.
16. Open the gradebook or marks for JHS 2A Mathematics and point back to Kwame.
17. Switch to **Admin** again and recap: one student, one family, one teacher, the same GHS 850, without sending real email, SMS, or Paystack charges.

## Out of scope

- Flagship `--clean` / full sandbox rebuild
- In-app demo reset UI (CLI only)
- Production Clerk/auth changes
- Real outbound communications or payments
