# MedAdhere — Pitch source document

Use this as raw material for slides, a spoken script, and judge Q&A. It is written for a **critical-path demo** (email adherence, doctor view, AI insight, connections, family reviewer). **Prescription OCR** is a product USP in the long doc set but is **not** assumed for your live demo unless you choose to show image upload.

---

## One-sentence pitch

We built a **three-sided medication adherence system**: the patient gets a simple email and one tap to confirm a dose—no app, no login on that step—while their **doctor** sees adherence patterns and an **AI-written clinical summary**, and **family** can follow along read-only from another city.

---

## The problem (why judges care)

- Elderly patients forget doses; nagging apps often go unused.
- Adult children worry but only hear fragments on the phone.
- Doctors have **no structured view of what happened between visits**—only what the patient remembers in the room.

Most “reminder apps” optimize for **one** user. Real care involves **three**: patient, clinician, and trusted family.

---

## Our solution (what you built)

A web app with **two account types** in the database—**patient** and **doctor**—plus **reviewers**: those are still patient accounts, granted **read-only** access to another patient’s dashboard through an explicit connection.

**Patient experience**

- Dashboard shows **today’s medicines** with per–time-slot status (taken, pending, missed), a **streak**, weekly adherence, connected doctors, and a short **visit / activity** picture.
- Reminders are driven by **scheduled times** stored per medicine. When a slot fires, the backend creates an **adherence log** with a **one-time token** and sends an **HTML email** with a single confirmation button.
- The link hits the backend **public** confirm route; the backend marks the dose confirmed and redirects to a **public** frontend page—**no login wall** on that path. That design is deliberate for older users.

**Doctor experience**

- Doctors **request** connection to a patient (search by email, send request, patient accepts). Same pattern keeps the flow auditable and consent-based.
- Doctor dashboard lists **connected patients** with **weekly adherence %** and a **needs attention** style signal when someone is falling below a threshold.
- Opening a patient shows **allergies**, **current medicines**, **visit timeline** (prescription and doctor-note events), **async notes** with the patient, and—loaded separately with a spinner—an **AI insight card** summarizing roughly the last month of adherence behavior in plain language for the doctor—not treatment orders, pattern description.

**Family / reviewer experience**

- A patient can invite another patient account (e.g. a daughter) as a **reviewer** through the same request/accept flow.
- The reviewer sees a **read-only** view: same kind of adherence picture and timeline visibility appropriate for trust, without editing medicines or impersonating the doctor.

---

## The four USPs (how you talk about them in the demo)

1. **One-click email adherence** — Judge sees: real email, real link, confirm page, data updates. This is your **hero moment**. Emphasize: no login on confirm.
2. **AI insight for the doctor** — Judge sees: open patient profile, short wait, readable paragraph tied to **their** adherence data, not generic fluff. Emphasize: AI speaks **to the clinician**, not as a chatbot nagging the patient.
3. **Full patient profile for the connected doctor** — Medicines, allergies, timeline of meaningful events, notes thread. Emphasize: **continuity between visits**.
4. **Prescription OCR (optional in your demo)** — Image → structured fields → user confirms before save. If you skip it, say: “We extract from photos with Gemini; tonight I’m showing the live adherence and doctor loop.”

---

## Technical story (credible, not a dump)

**Stack**

- **Frontend:** React, Vite, Tailwind—fast UI for dashboards and elderly-friendly layouts.
- **Backend:** FastAPI on Python 3.11.x—REST API, strict contract with the frontend, Bearer auth on protected routes.
- **Data & auth:** Supabase (Postgres + Auth). Profiles and all clinical/adherence tables live in Postgres.
- **Scheduler:** APScheduler **inside** the API process—cron-style jobs per medicine time. On **server start**, active medicines are **re-scheduled** from the database so deploys don’t silently drop reminders.
- **Email:** Resend (or equivalent) with an HTML template; confirmation URLs point at the **backend** confirm endpoint, which redirects to the **frontend** result page.
- **AI:** Google Gemini—vision path for OCR when you show it; **text** path for the doctor insight, fed a **structured adherence summary** built in code so the model doesn’t have to guess numbers.

**Security posture (for Q&A)**

- Protected routes expect a **Supabase JWT**; the public exception is **email confirm**, by design.
- Production hardening includes tightening **who may read which patient’s data** when using a service-role server client—worth mentioning as “we know the checklist” if a judge is technical.

---

## Demo flow you can rehearse (critical path only)

**Order suggestion — about three to four minutes of story**

1. **Patient dashboard** — Today’s doses, one taken, one pending; mention streak or week % in one line.
2. **Email** — Second device or projector: “Yes, I took it.” Land on **success** confirm page. Refresh or show patient view: that slot **taken**.
3. **Doctor** — Patient appears in list with **weekly %**; open profile: medicines, timeline, notes (one send/receive if you have time).
4. **AI insight** — Wait for spinner; read **one** sentence aloud that matches what they saw on the calendar (e.g. evening slips).
5. **Reviewer** — Log in as family; show **read-only** same patient’s adherence picture in one or two screens.

**If something fails live**

- Fall back to video or screenshots for email; **never** stall the story. Narrate the intended outcome and move on.

---

## What “done” means for your hackathon story

**Core demo-ready**

- Registration/login with roles; patient and doctor dashboards; connection **requests** and **accept**; reminders + email + **public** confirm; adherence history driving calendar/stats; doctor patient profile with notes and visits; **Gemini insight** on demand; **reviewer** read-only path; manual “mark taken” if you use it to save time on stage.

**Explicitly out of scope for your stated demo**

- **PDF OCR** and any “upload arbitrary scan” story unless you add it last-minute. **Image OCR** may still be in the product for others; you’re choosing not to lean on it in the pitch.

**Deployment narrative**

- Frontend (e.g. Vercel) + backend on a **long-lived host** (e.g. Railway) so the **scheduler** keeps running; env vars for Supabase, Gemini, Resend, `FRONTEND_URL`, `BACKEND_URL`, and **scheduler timezone** (e.g. Asia/Kolkata) so reminders fire at human times.

---

## Sound bites (memorize two or three)

- “Most apps remind **one** person. We align **patient, doctor, and family** on the same truth.”
- “Confirming a dose is **one tap in email**—we didn’t ask Grandma to find a password first.”
- “The model doesn’t replace the doctor; it **summarizes behavior** so the doctor can ask better questions in five minutes.”

---

## Glossary (for slides or appendix)

| Term | Meaning |
|------|--------|
| Adherence log | One scheduled dose instance: time sent, optional confirm time, one-time token for email link |
| Reviewer | Patient account with accepted read-only link to another patient |
| Visit timeline | Chronological clinical/admin events (e.g. prescription add/update, doctor notes)—not every chat message, depending on product tuning |
| Insight | Short Gemini-generated text from recent adherence stats, shown on doctor patient profile |

---

## File map (if a judge asks “where is X?”)

| Area | Where in repo |
|------|----------------|
| API entry, scheduler lifespan | `backend/main.py` |
| Email confirm, adherence APIs | `backend/api/adherence.py` |
| Patient/doctor/reviewer dashboards | `backend/api/dashboard.py` |
| Medicines CRUD + scheduler hooks | `backend/api/medicines.py` |
| Connections / requests | `backend/api/connections.py` |
| Notes | `backend/api/notes.py` |
| Visits list | `backend/api/visits.py` |
| OCR | `backend/api/ocr.py`, `backend/services/gemini_service.py` |
| Reminder jobs + resend | `backend/services/scheduler_service.py`, `backend/services/email_service.py` |
| AI insight | `backend/services/insight_service.py` |
| Patient UI | `frontend/src/pages/PatientDashboard.jsx`, `MedicineForm.jsx`, `ConfirmTaken.jsx` |
| Doctor UI | `frontend/src/pages/DoctorDashboard.jsx`, `PatientProfile.jsx`, `Notes.jsx` |
| Reviewer UI | `frontend/src/pages/ReviewerView.jsx` |
| API client | `frontend/src/services/api.js` |

---

*Generated as pitch source material; align numbers and screenshots with whatever you actually show on demo day.*
