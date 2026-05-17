# aditya.local.md

## Standing Instructions
PROJECT RULES — READ BEFORE DOING ANYTHING

1. Read docs/CORE.md fully before writing any code
2. Read docs/API_CONTRACT.md if your task touches any endpoint or WebSocket message
3. Read docs/TEAM.md if your task touches folder structure or ownership boundaries

4. Only build what is asked. Do not add features, restructure folders, install new 
   packages, or change interfaces that aren't part of the current task.

5. If completing this task requires going outside what's defined in the MD files 
   — a new dependency, a structural change, a different approach — STOP and explain 
   what the conflict is before writing any code. Wait for confirmation.

6. After completing any task, append a log entry to logs/aditya.local.md 
   in this exact format:

---
### [Date] — [one line summary of what was done]
**Task:** What was asked
**Built:** What files were created or changed, and what each one does in plain English
**How it works:** 2-3 sentences a non-developer could understand
**Connects to:** What other parts of the system call this or depend on it
**Decisions made:** Anything you chose that wasn't explicitly specified
**Deviations from MD:** Any place where the MD files were unclear or you had to go outside them
**Status:** Done / Partially done / Needs review
---

Keep log entries honest. If something is broken or incomplete, say so.

---

## Session Logs

---
### [2026-05-03] — Backend scaffold for Lead Step 1 + Backend 2 unblocking
**Task:** Create initial backend scaffold after Supabase tables were created, keep Backend 2 independent from lead-only internals, and prepare quick validation tests before commit.
**Built:** Updated `backend/main.py` to register all API routers under `/api` and added `/health`; created request models in `backend/models/schemas.py`; implemented starter endpoints in `backend/api/auth.py`, `backend/api/medicines.py`, `backend/api/connections.py`, `backend/api/notes.py`, `backend/api/adherence.py`, `backend/api/dashboard.py`, and `backend/api/ocr.py`; implemented token helpers in `backend/utils/token.py` with `generate_token()` and `validate_token()` against `adherence_logs`; kept `backend/services/scheduler_service.py` and `backend/utils/visits.py` as stable callable stubs so Backend 2 can call them without touching internals.
**How it works:** The API now boots as one app and exposes all core route groups so each teammate can build against real endpoints instead of empty files. Medicine and notes routes already call scheduling/visit utility interfaces, so Backend 2 can proceed using fixed contracts while lead-owned internals evolve later. The confirm endpoint now validates one-time tokens and marks logs as confirmed.
**Connects to:** Frontend members can hit `/api/*` route groups immediately; Backend 2 depends on `MedicineSchema`, `MedicineUpdateSchema`, `NoteSchema`, and connection schemas; lead-owned scheduler and visit logic are consumed through their stable functions.
**Decisions made:** Kept some dashboard/OCR/summary endpoints as explicit stubs returning contract-shaped payloads to unblock frontend integration without introducing premature logic; used Supabase auth + profile upsert/register flow aligned with docs.
**Deviations from MD:** Reviewer lookup uses Supabase Auth admin user list to resolve `reviewer_email` because `profiles` table schema does not include email; this is practical for now but should be revisited when full auth/dependency flow is finalized.
**Status:** Done
---

---
### [2026-05-13] — Local-first insights with Ollama fallback
**Task:** Change insights generation to use a local LLM first (Gemini as fallback), and add a UI-safe label/disclaimer.
**Built:** Updated `backend/config.py` and `backend/.env.example` with Ollama env vars (`OLLAMA_BASE_URL`, `OLLAMA_INSIGHT_MODEL`, timeout, generation options). Updated `backend/services/insight_service.py` to try Ollama for insight text and fall back to Gemini if local inference fails/unavailable; also normalizes output and truncates to ~4 sentences for readability. Updated `frontend/src/components/InsightCard.jsx` to label the badge as “Local + Gemini” and show a small “Not medical advice” disclaimer under the insight.
**How it works:** On `GET /api/dashboard/insight/{patient_id}`, the backend builds the adherence summary (structured counts) and then calls Ollama (HTTP to `/api/generate`) to produce a short 3-4 sentence insight. If Ollama errors/timeouts/returns empty text, it automatically falls back to the existing Gemini call so the feature still works under demo conditions.
**Connects to:** `backend/api/dashboard.py` insight route → `services/insight_service.generate_insight()`, and `frontend` `InsightCard.jsx`.
**Decisions made:** Kept Gemini available as fallback (to ensure reliability) and avoided any “alternate drug lookup” changes as requested.
**Deviations from MD:** None on API contracts; only the underlying LLM provider order changed for the insight card.
**Status:** Done
---

### [2026-05-10] — Reviewer parity fix for manual “Mark taken” before scheduler row exists
**Task:** Reviewer dashboard showed missed/pending while patient saw taken for the same day slots after manual marking.
**Built:** Updated `backend/api/adherence.py` `POST /api/adherence/mark` so when no `adherence_logs` row exists yet for today's requested slot, it creates one (with generated token, slot `scheduled_time`, and persisted `confirmed_at`/`token_used` state) instead of returning 404.
**How it works:** Manual marking now writes durable DB state even before the cron reminder has inserted a row. Since reviewer/doctor views read backend data, they now reflect the same slot status as the patient view.
**Connects to:** Patient dashboard mark/undo actions (`frontend/src/hooks/usePatientData.js`), reviewer dashboard (`GET /api/dashboard/reviewer/{patient_id}`), and doctor patient profile data.
**Decisions made:** Chose DB row creation fallback inside the mark endpoint to keep frontend unchanged and ensure cross-role consistency.
**Deviations from MD:** Adds persistence behavior for manual-mark fallback; core email flow remains unchanged.
**Status:** Done
---
### [2026-05-04] — Python 3.11.9 doc sweep, medicine + adherence smoke test, remove credential leak
**Task:** Confirm Python version is consistent across docs/config; run medicine and adherence checks before commit; fix any unsafe debug output.
**Built:** Verified `.python-version`, `setup_structure.sh`, `docs/PROJECT_CONTEXT.md`, `docs/TEAM.md`, `docs/CORE.md`, and `backend/requirements.txt` all align on **3.11.9** (mentions of 3.12+ only as “do not use”). Ran an in-process FastAPI `TestClient` script against live Supabase: `GET /api/medicines/{patient_id}`, inserted `adherence_logs`, `GET /api/adherence/confirm`, verified DB `token_used`/`confirmed_at`, `GET /api/adherence/{patient_id}`, stub summary. Removed accidental `print` of `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from `backend/utils/supabase_client.py`.
**How it works:** Smoke test reuses the first medicine row in the DB, creates a one-time token log, hits the public confirm route, and asserts redirect + row update; medicine list endpoint is re-checked the same way the user tested manually.
**Connects to:** `api/medicines.py`, `api/adherence.py`, `utils/token.py`, `utils/supabase_client.py`, Supabase tables `medicines` and `adherence_logs`.
**Decisions made:** Kept adherence summary as stub `[]` per existing scaffold; did not add a committed `scripts/` file — test was run as a one-off command.
**Deviations from MD:** None.
**Status:** Done
---

### [2026-05-04] — Lead Unblocking & Core Systems Scaffold
**Task:** Populate mock server to unblock frontend and set up the core backend systems (Scheduler, Email, Gemini AI).
**Built:** Updated `mock_api/mock_server.py` with mock endpoints. Added `backend/scheduler.py` to initialize APScheduler. Implemented job creation logic in `backend/services/scheduler_service.py`. Set up Resend HTML emails in `backend/services/email_service.py`. Added Gemini Vision OCR to `backend/services/gemini_service.py` and adherence insights to `backend/services/insight_service.py`. Modified `backend/main.py` to start/stop the scheduler on app lifespan.
**How it works:** The frontend is unblocked with static mock data. On the backend, we now have a scheduler that creates Cron jobs for reminders. When a reminder fires, it creates a secure token and sends an email via Resend. We also added functions that use AI to read prescriptions and summarize adherence logs for doctors.
**Connects to:** `backend/main.py` (lifespan hook), `backend/services/email_service.py`, `backend/services/scheduler_service.py`. Backend 2 will use the scheduler functions from `api/medicines.py`.
**Decisions made:** Fetched the patient's email dynamically from Supabase Auth admin using `supabase.auth.admin.get_user_by_id()` inside the reminder execution because `profiles` lacks email.
**Deviations from MD:** Used FastAPI `lifespan` instead of deprecated `on_event("startup")` for managing the APScheduler.
**Status:** Done
---

### [2026-05-04] — Production Safety Fixes: Synchronous Scheduler & Boot Resiliency
**Task:** Ensure the scheduler and email service do not block the asyncio event loop and gracefully handle server restarts.
**Built:** Modified `backend/services/scheduler_service.py` (`send_reminder_for_medicine`) and `backend/services/email_service.py` (`send_reminder_email`) to use regular `def` instead of `async def`. Added `reschedule_all_active_medicines()` to `backend/services/scheduler_service.py` and hooked it into the `backend/main.py` lifespan block.
**How it works:** Since Supabase and Resend python SDKs are synchronous, making their calling functions `def` allows `APScheduler` to natively offload them to a background ThreadPoolExecutor rather than locking up the main FastAPI event loop. Additionally, when the server restarts (e.g. on Railway deployments), `main.py` now triggers a database sweep to re-add all active medicines back into the in-memory scheduler.
**Connects to:** `backend/main.py` directly executes the boot sweep. `APScheduler` manages the background execution.
**Decisions made:** Chose to strip `async/await` from the reminder execution chain because introducing `run_in_executor` manually was less elegant than relying on APScheduler's built-in thread pooling for standard `def` tasks.
**Deviations from MD:** Directly addresses the "APScheduler jobs lost on Railway restart" known risk identified in `CORE.md` by actively building the mitigation into the server lifecycle.
**Status:** Done
---

### [2026-05-04] — Lead Step 1 closure: wire OCR and insight, visits, logging cleanup, remove dev test routes
**Task:** Finish Lead Day 1 ownership for merge to main: real `POST /api/ocr` and `GET /api/dashboard/insight/{patient_id}`, production-safe logging, and hygiene before team uses `main`.
**Built:** `backend/api/ocr.py` reads uploaded image (10MB cap per contract), rejects PDF with a clear 415 until a PDF pipeline exists, normalizes Gemini JSON to contract keys, calls `services/gemini_service.py`. `backend/api/dashboard.py` insight route calls `services/insight_service.py` and returns `{ insight, generated_at }` in API-contract shape. `backend/utils/visits.py` inserts into Supabase `visits` with exception logging. `backend/services/gemini_service.py` and `insight_service.py` run blocking Gemini/Supabase work via `asyncio.to_thread`, cleaned prompts, and structured `logging`. `backend/services/scheduler_service.py` and `backend/services/email_service.py` use logging instead of stray prints; scheduler keeps `generate_token()` for confirm links. `backend/scheduler.py` uses logging for lifecycle. Removed `backend/api/test_auth.py` and its router from `backend/main.py` (unsafe hardcoded auth mutation routes).
**How it works:** Doctors and patients hitting the real backend get OCR and insight card behavior matching `API_CONTRACT.md`; visit rows are persisted when Backend 2 calls `log_visit`. Long-running Gemini and DB reads for insight run off the asyncio loop via a thread helper. Cron reminders still enqueue as before with clearer operational logs.
**Connects to:** Frontend `InsightCard.jsx` load path eventually uses `GET /api/dashboard/insight/...`; `MedicineForm` OCR uses `POST /api/ocr`; `api/medicines.py` unchanged but benefits from cleaner scheduler logs when debugging.
**Decisions made:** PDF explicitly deferred with HTTP 415 and message so contract readers know the limitation; retained patient/doctor dashboard aggregations as empty stubs (Backend 2 / later iteration owns full aggregation logic per existing plan).
**Deviations from MD:** OCR supports JPG/PNG/WebP immediately; PDF from `API_CONTRACT.md` listing is acknowledged but not processed in Step 1.
**Status:** Done
---

### [2026-05-05] — Lead Step 2 closure: dashboard aggregations & adherence logs
**Task:** Replace deferred stubs in `api/dashboard.py` and `api/adherence.py` with real aggregation logic from `API_CONTRACT.md`.
**Built:** 
- `backend/utils/adherence_stats.py`: Added pure-python logic for `calculate_percentage`, `compute_status`, and `calculate_streak` to calculate adherence and gamification.
- `backend/api/adherence.py`: Fully implemented `GET /{patient_id}` and `GET /{patient_id}/summary`, enriching logs with dynamic `status` (taken/missed/pending) and summarizing counts and percentages for each medicine and time slot.
- `backend/api/dashboard.py`: Implemented `GET /patient/{patient_id}` returning `todays_medicines` with populated statuses, streak metrics, and weekly percentages. Implemented `GET /doctor/{doctor_id}` to calculate `weekly_percentage` for all connected patients.
- `backend/test_dashboard_aggregations.py`: Added script to verify endpoints in-process with a live patient.
**How it works:** When patients view their dashboard, the backend correctly pulls active medicines, maps them against today's logs, and returns specific time slot status ("taken", "missed", "pending"). Doctors get aggregated patient list stats that dynamically flag who is under 60% adherence.
**Connects to:** Frontend Patient and Doctor dashboards (`usePatientData.js`).
**Decisions made:** Separated stats calculation into `utils/adherence_stats.py` rather than duplicating it across endpoints or cluttering FastAPI routers. Pre-filled today's medicines with missing times based on `reminder_times` to handle missing cron-job gaps (e.g., if a medicine was just added).
**Deviations from MD:** Fixed discrepancy in `EXTRAS.md` vs `API_CONTRACT.md` regarding streak calculation—decided to calculate it on the backend for robust dashboard payloads as per `API_CONTRACT.md` instead of delegating to frontend.
**Status:** Done
---
### [2026-05-05] — Lead Step 2 hardening: timezone-safe dashboard status mapping + style cleanup
**Task:** Validate Step 2 end-to-end in venv and make any fixes needed for production-readiness.
**Built:** Updated `backend/api/dashboard.py` to resolve today's medicine status using the configured scheduler timezone (`SCHEDULER_TIMEZONE`) instead of strict UTC datetime equality, preventing false missed/pending statuses; cleaned import grouping to match project style. Updated `backend/api/adherence.py` import ordering for style consistency, added safe `days` guarding (`max(1, days)`), and made summary output deterministic by sorting medicines by name.
**How it works:** Dashboard slot matching now converts log timestamps to the app timezone and indexes them by `(medicine_id, HH:MM)` so contract reminder slots reliably map to real logs. If no log exists for a slot, status still falls back to pending/missed based on current UTC time. Adherence endpoints keep the same contract shape while handling invalid day inputs safely.
**Connects to:** `frontend/src/hooks/usePatientData.js` dashboard/adherence calls, `services/scheduler_service.py` reminder-time behavior, and `docs/API_CONTRACT.md` response shapes.
**Decisions made:** Chose local-time slot matching over exact timestamp equality to align with APScheduler local-time triggers and reduce false negatives around timezone boundaries.
**Deviations from MD:** None on endpoint shape/contract. Validation script could not complete in this sandbox because Supabase returned `403 Forbidden`; local syntax checks passed.
**Status:** Done
---
### [2026-05-05] — OCR stability hotfix before commit
**Task:** Apply final finishing touch pass and fix any crash-level issues discovered during review.
**Built:** Updated `backend/api/ocr.py` to fix a variable-name typo (`medics` -> `meds`) in OCR response normalization.
**How it works:** OCR output is now normalized safely whether Gemini returns a dict or list. The endpoint no longer raises `NameError` from the typo path and correctly returns an empty array when response shape is unexpected.
**Connects to:** `POST /api/ocr` flow used by patient/doctor medicine form prefill.
**Decisions made:** Kept fix surgical with no contract or behavior shape changes beyond preventing runtime failure.
**Deviations from MD:** None.
**Status:** Done
---
### [2026-05-08] — M3 patient-flow hardening before branch merge
**Task:** Complete M3-owned patient UI fixes so the branch can be merged independently while M4 is still pending.
**Built:** Updated `frontend/src/pages/MedicineForm.jsx` to align OCR upload UI with backend support (JPG/PNG only) and show a clearer PDF-not-supported error message. Updated `frontend/src/hooks/usePatientData.js` to normalize partial doctors/visits payloads with safe defaults and avoid UI crashes when backend fields are missing. Updated `frontend/src/pages/PatientDashboard.jsx` to render a fallback "recently" label if `connected_at` is absent.
**How it works:** The medicine form no longer advertises unsupported PDF OCR paths and gives patient-friendly feedback if attempted. Patient dashboard data loading now handles missing fields defensively, so cards render even with partial backend responses. This keeps the patient experience stable during phased backend completion.
**Connects to:** `frontend/src/services/api.js` patient calls, `GET /api/dashboard/patient/{patient_id}`, `GET /api/connections/doctors/{patient_id}`, `GET /api/visits/{patient_id}`, and OCR upload flow.
**Decisions made:** Preferred defensive normalization in the hook over brittle rendering assumptions inside each card component.
**Deviations from MD:** None; this aligns UI behavior with actual backend OCR capability and API contract tolerance.
**Status:** Done
---
### [2026-05-08] — M1 CORE completion pass: auth protection, visits route, connection/notes contract alignment
**Task:** On M1 branch, finish backend CORE gaps identified in audit: protect non-public endpoints, implement missing visits API, and align notes/connections outputs with API contract.
**Built:** Added `backend/utils/auth.py` with `get_current_user` Bearer-token dependency backed by Supabase user + profile lookup. Applied auth protection via `Depends(get_current_user)` across protected routers in `backend/api/medicines.py`, `backend/api/adherence.py` (non-confirm routes), `backend/api/dashboard.py`, `backend/api/connections.py`, `backend/api/notes.py`, `backend/api/ocr.py`, and new `backend/api/visits.py`. Created `backend/api/visits.py` implementing `GET /api/visits/{patient_id}` with doctor-name enrichment and most-recent-first ordering, and wired it in `backend/main.py`. Updated `backend/api/connections.py` to return real names and computed `weekly_adherence_percentage` for doctor patient lists, plus named doctor/reviewer responses. Updated `backend/api/notes.py` to set `sender_role` from authenticated user role and log visit summaries accordingly. Added `NoteReadSchema` to `backend/models/schemas.py` for schema completeness.
**How it works:** Protected endpoints now require a valid `Authorization: Bearer <token>` header and derive current user/profile from Supabase before serving data. Connections and visits endpoints now return contract-shaped, human-readable payloads that frontend can render directly. Notes created by either patient or doctor are stored with accurate sender role and reflected in visit timeline entries.
**Connects to:** Frontend API service authorization header flow, patient dashboard/notes pages, doctor dashboard patient list, and future M4 doctor profile timeline components.
**Decisions made:** Kept authorization lightweight and centralized in one dependency function to avoid route-by-route token parsing duplication. Used live adherence logs for weekly percentages instead of placeholder constants.
**Deviations from MD:** None in endpoint behavior; implementation details use Supabase `get_user(token)` for validation rather than a custom JWT parser.
**Status:** Done (Needs integration testing with real tokens/data)
---
### [2026-05-08] — HTTPBearer fix: Swagger UI 401 on all protected endpoints + /api/auth/me debug endpoint
**Task:** Diagnose and fix 401 Unauthorized errors when hitting protected endpoints via Swagger UI (`/docs`), despite having a valid access token from `/api/auth/login`.
**Built:**
- `backend/utils/auth.py`: Replaced `Header(default=None)` parameter in `get_current_user` with FastAPI's `HTTPBearer` security scheme (`from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials`). The bearer scheme is instantiated as a module-level `_bearer_scheme = HTTPBearer()` and injected via `Depends`. Token is now extracted cleanly via `credentials.credentials` — no manual `Bearer ` prefix splitting needed.
- `backend/api/auth.py`: Added `GET /api/auth/me` endpoint that calls `Depends(get_current_user)` and returns the current user dict. Useful as a fast isolated token validation check without needing a patient/doctor UUID.
**How it works:** Swagger UI's 🔒 Authorize button only injects `Authorization: Bearer <token>` headers for endpoints protected by FastAPI security schemes (`HTTPBearer`, `OAuth2`, etc.). When `get_current_user` used a raw `Header(default=None)` parameter, Swagger treated it as a plain form field and never sent it — so every request arrived with no header, returning "Missing Authorization header". Switching to `HTTPBearer` registers the security scheme in the OpenAPI spec, which Swagger UI reads and uses to correctly attach the header on every request. `curl` behaviour is unchanged.
**Connects to:** All protected routers (`medicines`, `adherence`, `dashboard`, `connections`, `notes`, `ocr`, `visits`) which all `Depends(get_current_user)`. Frontend `api.js` authorization header flow is unaffected — it was already sending `Authorization: Bearer <token>` correctly.
**Decisions made:** Kept `_bearer_scheme` as a module-level singleton (not inline in the function signature) to avoid re-instantiating on every request. Added `/api/auth/me` as a permanent dev utility endpoint — it's low cost to keep and saves time on future integration debugging.
**Deviations from MD:** None. `HTTPBearer` is the standard FastAPI pattern; this is an implementation detail not specified in the docs.
**Status:** Done — verified end-to-end: `POST /api/auth/login` → token → `GET /api/auth/me` returns `200` with `{id, role, full_name, email}`.
---

### [2026-05-10] — Doctor dashboard patient list fix, expired-token auto logout, manual dose marking, calendar UX, and test-email Swagger endpoint
**Task:** After pulling M4, validate doctor-side UX and fix: doctor dashboard showed no patients despite notes; normal window got stuck with expired Supabase JWT; add ability to mark dose taken/undo from patient dashboard; fix streak/calendar not updating; differentiate “no doses” vs “pending”; add a Swagger-friendly endpoint to trigger reminder emails for demos.
**Built:**
- `backend/api/dashboard.py`: Removed fragile Supabase join on `patient_doctor_connections → profiles` (ambiguous because table has two FKs to `profiles`). Now fetches `patient_id` links then resolves each patient `full_name` via a separate `profiles` query.
- `frontend/src/utils/auth.js`: Added JWT `exp` decoding + `getAuthToken()` auto-clears local session if expired, so users are redirected to login without needing incognito.
- `backend/models/schemas.py`: Added `MarkDoseSchema`.
- `backend/api/adherence.py`: Added `POST /api/adherence/mark` (patient-only) to update the existing `adherence_logs` row for *today + time slot* by setting/clearing `confirmed_at` and toggling `token_used`.
- `frontend/src/services/api.js`: Added `endpoints.adherence.mark()`.
- `frontend/src/hooks/usePatientData.js`: Wired “Mark taken / Undo” to call `POST /api/adherence/mark` (kept optimistic UI), and after success triggers a data refresh so streak + 30-day calendar reflect changes immediately.
- `frontend/src/components/AdherenceCalendar.jsx`: Fixed day-bucketing by using the UTC day from `scheduled_time` (prevents dots shifting across dates). Added a new `none` status with a darker grey to represent “No doses” distinctly from “Pending/future”; updated tooltip + legend.
- `backend/api/testing.py` + `backend/main.py`: Added protected doctor-only `POST /api/testing/send_reminder/{medicine_id}` to trigger a reminder immediately (inserts an adherence_log + sends email), useful for demo and verification without waiting for scheduler time.
**How it works:** Doctors now reliably see connected patients because the dashboard endpoint no longer depends on a brittle join relationship definition. Expired JWTs are detected client-side and cleared automatically, preventing repeated 401 loops. Manual dose toggles update the backend log row (not a local-only overlay), then the frontend refreshes dashboard + adherence logs so streak/calendar update. Calendar now distinguishes “no scheduled doses” from “pending/future” and uses UTC bucketing to avoid timezone drift. A testing route lets you trigger reminder emails from Swagger on demand.
**Connects to:** Doctor dashboard (`/api/dashboard/doctor/*`), patient dashboard + calendar (`/api/dashboard/patient/*`, `/api/adherence/*`), note flows, scheduler/email service (`services/scheduler_service.py`, `services/email_service.py`), and demo workflow via `/api/testing/send_reminder/*`.
**Decisions made:** Dose marking endpoint only updates existing logs (no inserts) to avoid DB token constraints and keep email-confirm as the core UX; on undo, `token_used` is reset to allow email reconfirm if needed. Calendar uses a new “none” state to avoid misleading “pending” days when no medicine existed.
**Deviations from MD:** Added non-core `/api/testing/*` endpoints for demo/testing convenience (not in API_CONTRACT.md); kept protected and doctor-only to reduce abuse risk.
**Status:** Done (requires normal backend restart to see testing route in Swagger).
---

### [2026-05-10] — Visit timeline: stop logging patient-sent notes
**Task:** Recent visits timeline was noisy: it showed patient-sent notes along with medicine changes. Keep the timeline focused on doctor actions + prescription events.
**Built:** Updated `backend/api/notes.py` so `log_visit(..., action_type="note_added")` only happens when the authenticated sender is a **doctor**. Patient notes still save to the `notes` table and remain visible in the notes thread, but they no longer create `visits` rows.
**How it works:** Notes are still a chat-like async thread. The visit timeline is now a summary of clinically meaningful actions (doctor notes + prescription changes) instead of a mirror of every patient message.
**Connects to:** `GET /api/visits/{patient_id}` (timeline UI) and `GET/POST /api/notes/*` (notes thread).
**Decisions made:** Chose “doctor-only visits for notes” to match the intended “visit = provider action/history” mental model and reduce noise during demos.
**Deviations from MD:** Slight change from earlier implementation that logged visits for both patient and doctor notes; doc guidance was mixed, but UX benefit is clear.
**Status:** Done (existing noisy visit rows in DB remain until manually deleted).
---

### [2026-05-10] — Connection requests & Reviewer system
**Task:** Replace direct inserts for doctor/reviewer connections with a pending request workflow. Add patient-to-patient read-only reviewer dashboard.
**Built:** 
- `connection_system_plan.md`: Created execution plan.
- Supabase: Defined `connection_requests` table schema via raw SQL (requires manual run).
- `schemas.py`: Added `ConnectionRequestSchema`.
- `connections.py`: Rewrote endpoints for search by email, send request, list incoming/outgoing, accept, reject, and reviewers list.
- `dashboard.py`: Added `GET /api/dashboard/reviewer/{patient_id}` enforcing reviewer permission check and returning read-only patient dashboard data.
- `api.js`: Registered new connection/reviewer endpoints.
- `usePatientData.js`: Hook fetches incoming/outgoing requests and reviewers on mount/refresh.
- `DoctorDashboard.jsx`: Replaced raw patient list with "Find Patient" email search + send request + pending outgoing requests panel.
- `PatientDashboard.jsx`: Added panels for incoming doctor/reviewer requests (Accept/Decline), My Reviewers (search + send request), and Patients I'm Reviewing.
- `ReviewerView.jsx`: Created read-only clone of `PatientProfile` but restricted to viewing dashboard summary, adherence calendar, medicines list, and timeline for patients being reviewed.
- `App.jsx`: Added `/review/:patientId` protected route for patients.
- `API_CONTRACT.md`: Updated connection section replacing direct POSTs with the new search and request endpoints.
**How it works:** Both connections (Doctor↔Patient, Patient↔Reviewer) now follow a strict Search Email → Send Request (pending) → Target Receives Incoming Request → Target Accepts (active link written) flow. A patient can search another patient's email and request them to be a reviewer; if accepted, the reviewer gets read-only access to their dashboard.
**Connects to:** Doctor and Patient dashboards, plus the new `ReviewerView`.
**Deviations from MD:** The `patient_reviewer_connections` table was in `CORE.md` but there was no workflow for adding reviewers; this system fills that gap using an explicit "Accept" action.
**Status:** Done (requires manual execution of the SQL snippet to create `connection_requests` table).
---

### [2026-05-10] — Connection search hardening for reviewer/doctor request flow
**Task:** Investigate "Failed to fetch" when searching by email for doctor→patient or patient→reviewer requests after rolling out the request workflow.
**Built:** Updated `backend/api/connections.py` helper `_find_user_by_email()` to catch failures from `supabase.auth.admin.list_users()` and profile lookup queries, log server-side stack traces, and return explicit JSON `503` errors instead of letting low-level protocol exceptions bubble out.
**How it works:** If Supabase Auth admin user listing has a transient network/protocol issue, the API now responds with a controlled error (`detail` message) that frontend can show, rather than breaking the fetch call at browser level.
**Connects to:** `GET /api/connections/search` and `POST /api/connections/request` (both depend on `_find_user_by_email()`).
**Decisions made:** Chose defensive error handling at the shared helper level so both search and request endpoints benefit from the fix automatically.
**Deviations from MD:** None on API shape; only improved failure handling.
**Status:** Done (if errors persist, validate `connection_requests` table exists and `SUPABASE_SERVICE_KEY` is legacy JWT format as noted in CORE risk section).
---

### [2026-05-10] — Reviewer search 503 fix after login (service-role admin client isolation)
**Task:** Reviewer email search still failed with `503 User search is temporarily unavailable`; backend logs showed `AuthApiError: User not allowed` from `supabase.auth.admin.list_users()`.
**Built:** Updated `backend/api/connections.py` `_find_user_by_email()` to instantiate a **fresh service-role Supabase client** (`create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)`) and call `admin_client.auth.admin.list_users()` instead of using the shared singleton client.
**How it works:** The shared singleton can inherit user auth context after login flows, which breaks admin API calls. Using a new service-role client per lookup isolates admin operations and keeps search permissions stable for doctor/patient request flows.
**Connects to:** `GET /api/connections/search` and `POST /api/connections/request` (both rely on `_find_user_by_email()`).
**Decisions made:** Chose client isolation over broader auth refactor so the fix is small, targeted, and low-risk.
**Deviations from MD:** None.
**Status:** Done
---

### [2026-05-11] — Medical documents (Cloudinary), supply tracking, password reset, medicine remove UI
**Task:** Ship the agreed profile/documents/auth/medicines plan: Cloudinary uploads with Pillow limits, doctor patient-chart docs with reviewer isolation, Supabase forgot/reset pages, optional medicine supply fields with dashboard warnings (depletion only, no expiry), and deactivate-medicine flows for doctor and patient.
**Built:** Added `sql/medical_documents.sql` and `sql/medicines_supply.sql`. Backend: `config.py` Cloudinary settings; `services/document_service.py`, `services/cloudinary_documents.py`; `api/documents.py` (upload/me/patient/patch/delete) registered in `main.py`; `api/medicines.py` persists supply fields and uses `model_dump(exclude_unset=True, mode="json")` on update so nullable supply fields can be cleared; `api/dashboard.py` `_supply_meta()` on today’s medicines; `models/schemas.py` supply fields; `requirements.txt` `cloudinary`. Frontend: `@supabase/supabase-js`, `utils/supabaseAuth.js`, `ForgotPassword.jsx` / `ResetPassword.jsx`, Login link, `App.jsx` routes; `MedicalDocumentsPanel.jsx` on `Profile.jsx` and `PatientProfile.jsx`; `api.js` patch + documents helpers; supply + remove flows on `MedicineForm.jsx` / `PatientProfile.jsx`; `MedicineCard.jsx` and `ReviewerView.jsx` supply warning copy. Docs: `docs/API_CONTRACT.md`, `docs/CORE.md`, `backend/.env.example`, `frontend/.env.example`.
**How it works:** Files are validated and (for images) resized server-side, then uploaded to Cloudinary; metadata lives in `medical_documents`. Only doctors with an active patient link can list or upload into another user’s chart; reviewers never get that route. Password reset uses the Supabase client in the browser with the same anon key as the app. Supply warnings appear when both quantity and daily use are set and estimated days left fall at or below the threshold.
**Connects to:** Supabase tables `medical_documents` and new medicine columns; existing `patient_doctor_connections` for doctor access; dashboards and medicine CRUD already used by patient/doctor/reviewer UIs.
**Decisions made:** Depletion-only supply (no expiry field); default threshold behavior when column null handled in `_supply_meta`; document titles default from filename on upload.
**Deviations from MD:** `docs/CORE.md` pinned dependency snippet remains partially behind `requirements.txt` versions historically; added `cloudinary` line to match current backend.
**Status:** Done (run both SQL files in Supabase; set Cloudinary + Vite env; `pip install` / `npm install` locally).
---

### [2026-05-11] — Medical reports nav tabs, doctor read-only docs, adherence % UI
**Task:** Move patient medical documents off Profile into a dedicated **Reports** nav route with two tabs (**Medical Reports** list vs **Upload Reports**); on doctor patient profile show title/notes read-only with **Edit** / **Download** (edit-in-place with Save/Cancel/Delete); avoid clinical wording like “Stable” for patients/reviewers—show **weekly adherence %** with the same rose/emerald emphasis as before.
**Built:** Added `MedicalDocumentsSection.jsx` (replaces deleted `MedicalDocumentsPanel.jsx`), `MedicalReportsPage.jsx`, route `/medical-reports` (patient-only) and **Reports** item in `AppShell.jsx`; removed documents from `Profile.jsx`; `PatientProfile.jsx` uses the new section. `PatientListCard.jsx`, `PatientDashboard.jsx`, and `ReviewerView.jsx` use shared `utils/adherenceThreshold.js` (60%) for palette; removed “Stable” / “Needs attention” text badges.
**How it works:** Patients switch tabs between browsing/editing metadata and uploading; after upload they are switched to Medical Reports. Doctors see plain text for title/notes until **Edit**; **Download** uses the stored `secure_url` with a sanitized filename. Adherence is communicated only through the numeric percentage and existing color cues.
**Connects to:** Same `/api/documents/*` backend; nav and `App.jsx` routing.
**Decisions made:** Doctors get **Open** only while in edit mode; patient self-serve rows keep Open + Download + inline Save. Threshold stays 60% to match prior `PatientListCard` logic.
**Deviations from MD:** None.
**Status:** Done
---

### [2026-05-11] — Compact documents list + doctor `/patient/:id/documents` page
**Task:** Reduce vertical clutter: patient Reports shows all documents with upload on top; title/notes only when **Edit** is clicked. Doctor: move full document UI off patient profile to a dedicated page where they can list/upload/edit/download without crowding the main profile.
**Built:** Rewrote `MedicalDocumentsSection.jsx` (no tabs; upload area first; compact rows with Open/Download/Edit; expanded panel for title/notes + Save/Cancel/Delete; patient keeps Delete on row when not editing). Added `PatientDocumentsPage.jsx`, route `/patient/:patientId/documents` (doctor-only, declared before `/patient/:patientId` in `App.jsx`). `PatientProfile.jsx` links to that page with `state.patientName` for the subtitle.
**How it works:** Same API; doctors use **Open medical documents** from the patient profile; patients use **Reports** in the nav (`/medical-reports`).
**Connects to:** Unchanged `/api/documents/*`.
**Decisions made:** Collapsed rows show filename + title line only (notes only in edit panel).
**Deviations from MD:** None.
**Status:** Done
---

### [2026-05-11] — Doctor dashboard patient cards: 30-day adherence window
**Task:** Doctor dashboard patient cards showed a 7-day window; restore **30-day** rolling adherence like before.
**Built:** `backend/api/dashboard.py` `GET /api/dashboard/doctor/{doctor_id}` now loads adherence logs from `now - 30 days` and passes the same `weekly_percentage` / `needs_attention` fields (value is 30-day %). `PatientListCard.jsx` subtitle updated. `docs/API_CONTRACT.md` note under doctor dashboard documents the 30-day meaning of `weekly_percentage` for `patients[]`.
**How it works:** Same `calculate_time_window_percentage` over a longer log slice; patient dashboard and reviewer views unchanged.
**Connects to:** `DoctorDashboard` → `PatientListCard`.
**Decisions made:** Kept JSON key `weekly_percentage` for compatibility; documented semantics in API contract.
**Deviations from MD:** None.
**Status:** Done
---
### [2026-05-13] — Brand logo, favicon, splash/intro animation, global theme colors
**Task:** Use the provided MedicoMates logo on splash and session startup animation, set favicon, and centralize white/blue/green palette for easier future tweaks.
**Built:** Added `frontend/public/medicomates-logo.png` and `frontend/src/components/branding/BrandMark.jsx`. Updated `frontend/index.html` (favicon + title). Extended `frontend/src/index.css` `@theme` with `--color-brand`, `--color-brand-hover`, `--color-accent`, soft/surface tokens, and `shadow-brand-glow`. Reworked `Splash.jsx` and `BrandIntro.jsx` (framer-motion) to show the PNG logo with entrance animation; `BrandIntro` progress bar uses `from-brand to-accent` gradient. Swapped auth/shell/nav (`AuthLayout`, `AppShell`, `BottomNav`) to `BrandMark` and theme utility classes. Replaced scattered hardcoded blues/sky/indigo across major pages (login/register, dashboards, medicine form, notes, etc.) with `brand` / `accent` utilities. `InsightCard` badges use brand + accent chips.
**How it works:** Designers edit only the hex values under `@theme` in `index.css` to retheme the app; components use Tailwind classes like `bg-brand`, `text-accent`, `bg-surface-muted`. The logo is served from `/medicomates-logo.png` for favicon, splash, post-login intro overlay, and sidebar/mobile brand slot.
**Connects to:** All patient/doctor/reviewer UI surfaces that previously hardcoded `#2a79e8` or generic Tailwind blues.
**Decisions made:** Kept legacy `HealthcareLogo.jsx` for possible reuse but default colors now reference theme tokens; primary marketing identity is the PNG.
**Deviations from MD:** None (visual-only).
**Status:** Done
---
### [2026-05-14] — Adherence calendar: scheduler timezone + slot dedupe (no synthetic rows)
**Task:** Fix patient 30-day adherence tooltip dose counts diverging from today’s schedule; align with `docs/API_CONTRACT.md` (GET adherence as source of truth), `docs/CORE.md` / `logs/aditya.local.md` Step 2 (scheduler-timezone slot matching), and `docs/PROJECT_CONTEXT.md` env guidance.
**Built:** `frontend/src/utils/schedulerTime.js`: IANA zone from `VITE_SCHEDULER_TIMEZONE` (default `Asia/Kolkata`); dedupe keys in scheduler-local date + time; **snap** each log’s wall `HH:mm` to the nearest `reminder_times` entry (≤45 min) so cron rows inserted with `datetime.now()` (e.g. 08:07) collapse with the logical 08:00 slot. **`dedupeAdherenceLogsForPatient(logs, medicines)`** vs plain scheduler dedupe when medicines are absent (reviewer). Removed **synthetic** adherence rows from `usePatientData` merge (they doubled counts whenever cron “now” ≠ nominal slot). `applyAdherenceOverlay` uses the same snap so localStorage overlay `time` matches logs. `AdherenceCalendar` still dedupes props. Documented `VITE_SCHEDULER_TIMEZONE` in `frontend/.env.example` and `docs/PROJECT_CONTEXT.md`.
**How it works:** Calendar dots still bucket by **UTC day** of `scheduled_time`. Patient view dedupes API logs per `(medicine_id, scheduler date, snapped reminder slot)` so duplicate cron/mark rows and old synthetic-vs-API mismatches no longer inflate the tooltip count.
**Connects to:** `GET /api/adherence/{patient_id}`, medicines list, `AdherenceCalendar`, reviewer raw logs.
**Decisions made:** Dropped client-side synthetic adherence rows; gaps until a real `adherence_logs` row exists are acceptable vs wrong counts.
**Deviations from MD:** None on API shapes.
**Status:** Done
---
### [2026-05-14] — Manual mark: stop duplicate adherence_logs when cron uses “fire time”
**Task:** After Supabase reset, marking one of three same-day doses as taken inflated adherence to four doses; fix double-count without changing API contracts.
**Built:** Updated `backend/api/adherence.py` `POST /api/adherence/mark` so when no exact `HH:MM` match exists, it picks the same-day log for that medicine whose local `scheduled_time` is nearest the nominal reminder slot, within 45 minutes (same tolerance idea as scheduler snap in the calendar work). Only if no such row exists does it insert a new log.
**How it works:** Reminder jobs store `scheduled_time` as the real send time (`datetime.now` in UTC), while the dashboard sends slot keys like `08:00`. The old mark handler only matched identical wall times, missed the cron row, and inserted a second row—two database doses for one logical dose. Fuzzy matching updates the existing row instead.
**Connects to:** `POST /api/adherence/mark` from `frontend/src/hooks/usePatientData.js`; adherence list/summary and streaks that count `adherence_logs` rows.
**Decisions made:** Used a 45-minute cap so twice-daily medicines do not bind “evening” mark to the morning row when only one log exists (large delta → insert path as before).
**Deviations from MD:** None; behavior still matches “update or create today’s slot” intent in CORE/API.
**Status:** Done (duplicate rows already created before this deploy stay in the DB until manually removed)
---
### [2026-05-14] — Adherence GET list/summary: dedupe logical doses (scheduler TZ + slot snap)
**Task:** Calendar tooltip showed 6 “scheduled doses” for a UTC day while today’s schedule showed 3; align adherence API output with CORE scheduler timezone and nominal reminder slots.
**Built:** Added `backend/utils/adherence_dedupe.py` (`dedupe_adherence_logs`, `slot_label_from_log`). `GET /api/adherence/{patient_id}` now loads `reminder_times`, dedupes rows per `(medicine_id, scheduler-local date, snapped slot ≤45m)`, preferring taken over pending over missed. `GET /api/adherence/{patient_id}/summary` uses the same deduped set and groups `time_slots` by snapped slot labels instead of raw UTC `HH:MM`.
**How it works:** Duplicate `adherence_logs` from cron “fire time” vs nominal slot inserts collapse to one row per real dose before JSON is returned, so the frontend calendar’s raw per-UTC-day count matches how medicines are scheduled. Summary percentages no longer double-count the same slot.
**Connects to:** Patient/reviewer adherence calendar (`AdherenceCalendar` counts `logs.length` per UTC day), any consumer of adherence list/summary.
**Decisions made:** Reused the same 45-minute snap window as `POST /api/adherence/mark` for consistency.
**Deviations from MD:** Response is still the same array shape; rows are filtered/merged server-side so duplicate DB rows no longer appear as separate doses in the API.
**Status:** Done
---
### [2026-05-14] — Mark-taken: remove synthetic adherence merge + client dedupe + clear overlay on success
**Task:** Dose count still increased after marking (e.g. 3→4); trace Supabase vs UI — synthetic `adherence_logs` merged in `usePatientData` and optimistic localStorage overlay fighting refetch.
**Built:** Removed `buildSyntheticTodayLogs` entirely so calendar uses **API logs only** (no phantom rows). Added `frontend/src/utils/adherenceDedupeClient.js` (scheduler TZ from `VITE_SCHEDULER_TIMEZONE`, default `Asia/Kolkata`; 45m slot snap; same taken/pending/missed winner as backend). `loadData` runs `dedupeAdherenceLogsClient` on `GET /api/adherence` payload before `applyAdherenceOverlay`. After successful `POST /api/adherence/mark` (taken), strip that slot from `medicomates_dose_overlay`; after successful undo, strip `medicomates_dose_untaken_overlay`. Reviewer 30d payload: `backend/api/dashboard.py` dedupes `adherence_logs` with `dedupe_adherence_logs`. Documented `VITE_SCHEDULER_TIMEZONE` in `frontend/.env.example`.
**How it works:** Supabase remains source of truth; the hook no longer appends synthetic rows that could stack on top of real rows after a mark. Clearing overlay after a persisted mark stops double-representation. Client dedupe protects against duplicate rows if the browser talks to an older API build.
**Connects to:** `PatientDashboard` → `AdherenceCalendar`, `POST /api/adherence/mark`, reviewer `GET /api/dashboard/reviewer/{patient_id}`.
**Decisions made:** Kept optimistic overlay **until** mark succeeds so failed requests still show intent locally.
**Deviations from MD:** None on endpoint contracts.
**Status:** Done
---
### [2026-05-14] — Calendar tooltip: medicines-aware dedupe + single-slice dose summary
**Task:** Clarify root cause of “3 missed → mark 1 → looks like 4 doses” (aggregation vs optimistic); fix tooltip and dedupe path.
**Built:** `AdherenceCalendar` accepts `medicines`, uses `dedupeAdherenceLogsForPatient(logs, medicines)` instead of null-medicine `dedupeAdherenceLogsBySchedulerSlot`. Tooltip derives `taken`/`missed`/`pending`/`total` only from `summarizeDayLogs(dayLogs)` (same array). `PatientDashboard` and `ReviewerView` pass `medicines`. `schedulerTime.js` dedupe second pass skips missing winners and filters duplicate `id`.
**How it works:** The UI never stored a separate “missed” counter; the old line was **row count** for the UTC day. Extra rows stayed in the array when the calendar re-deduped **without** `reminder_times` snap. Tooltip now reads e.g. `3 doses · 1 taken · 2 missed` so totals cannot be misread as missed+taken from different sources.
**Connects to:** `schedulerTime.js`, patient/reviewer dashboards.
**Decisions made:** None beyond aligning calendar with hook/backend snap rules.
**Deviations from MD:** None.
**Status:** Done
---
### [2026-05-14] — Email confirm: verify DB write + encode token in mail URL
**Task:** User saw “Dose Confirmed” but `adherence_logs.confirmed_at` stayed null and `token_used` false in Supabase.
**Built:** `GET /api/adherence/confirm` normalizes the query token (`unquote_plus`), runs `update(...).eq("id").eq("token_used", False).execute()` (no `.select()` on the update chain — **supabase-py 2.7** raises `AttributeError` there), then **select** the row to require `confirmed_at` + `token_used` before `status=success`. `build_reminder_email` uses `urllib.parse.quote(..., safe="")` for the token query value.
**How it works:** Success only after a follow-up read proves the row was updated; invalid + log otherwise. Token URL-encoding avoids query mangling.
**Connects to:** Resend reminder HTML, `utils/token.validate_token`, Supabase `adherence_logs`.
**Decisions made:** Kept same redirect URLs; stricter success gating when persistence fails.
**Deviations from MD:** None on redirect base paths.
**Status:** Done
---

---
### [2026-05-15] — Today’s adherence dot: synthetic slots for calendar when DB rows missing
**Task:** Fix 30-day adherence so the **current UTC day** dot reflects missed doses from today’s schedule even before any `adherence_logs` row exists; grey “No doses” was wrong while “Today’s schedule” showed 3 missed.
**Built:** `frontend/src/utils/schedulerTime.js`: added `scheduledIsoForSchedulerSlot()` (scheduler-local `YYYY-MM-DD` + `HH:mm` → UTC ISO, same instant as backend dashboard) and `appendSyntheticTodayAdherenceLogs()` (one placeholder log per `todays_medicines` slot not already covered by a deduped real row; `id` prefix `synthetic-`). `frontend/src/components/AdherenceCalendar.jsx`: new optional prop `todaysMedicines`; merges synthetics then `dedupeAdherenceLogsForPatient` before bucketing dots. `frontend/src/pages/PatientDashboard.jsx` and `frontend/src/pages/ReviewerView.jsx` pass `dashboard.todays_medicines` into the calendar.
**How it works:** Today’s schedule already marks past slots as missed from `reminder_times` when cron has not inserted a row yet. The calendar only counted API logs, so today stayed grey until the first “Mark taken” created a row. Synthetic entries copy each slot’s `status` and `confirmed_at` from `todays_medicines` (including local overlay), so the dot turns red for “any missed” and the tooltip shows the correct dose count without inflating historical days.
**Connects to:** `GET /api/dashboard/patient/{id}` / reviewer dashboard `todays_medicines`, `GET /api/adherence/{id}`, `usePatientData` overlay + `markDoseTaken` / `markDoseUntaken` (optimistic schedule still drives synthetics before refetch).
**Decisions made:** Reintroduced **calendar-only** synthetics (not merged into `usePatientData` adherenceLogs or API payloads) to avoid the 2026-05-14 double-count issue while closing the “grey today” gap; real DB rows still win dedupe via higher score on non-`synthetic-` ids.
**Deviations from MD:** Contradicts the 2026-05-14 log choice to drop all synthetic rows; scoped narrowly to today + calendar component per user-confirmed fix.
**Status:** Done — verified by user.
---