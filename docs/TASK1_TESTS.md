# Task 1 — `is_critical` testing guide

Run these **in order** after applying code changes. Task 2 voice-call code is **not** included yet.

---

## 0. Supabase SQL (required before API/UI tests)

In **Supabase → SQL Editor**, run:

1. `docs/sql/add_medicine_is_critical.sql` — **required for Task 1**
2. `docs/sql/add_call_logs.sql` — **optional now** (Task 2 table; safe to run early)

**Expect:** Both run without error. Existing `medicines` rows get `is_critical = false` automatically.

Verify Task 1 column:

```sql
SELECT id, name, is_critical FROM medicines LIMIT 5;
```

**Expect:** Column exists; values are `false` for old rows.

---

## 1. Automated schema tests (no database)

From project root:

```bash
cd backend
python test_medicine_is_critical.py
```

**Expect:**

```
  OK  test_medicine_schema_default_is_critical_false
  OK  test_medicine_schema_accepts_true
  OK  test_medicine_update_schema_optional_is_critical
  OK  test_medicine_schema_serializes_is_critical_in_json_mode

All 4 tests passed.
```

---

## 2. Backend smoke (server must be running)

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Open Swagger: http://127.0.0.1:8000/docs

### 2a. Health

`GET /health`

**Expect:** `{"status":"ok"}`

### 2b. Login

`POST /api/auth/login` with a patient or doctor account.

Copy `access_token` → Swagger **Authorize** → `Bearer <token>`.

### 2c. Add medicine with `is_critical: true`

`POST /api/medicines` body (adjust `patient_id`):

```json
{
  "patient_id": "<your-patient-uuid>",
  "name": "Test Critical Med",
  "dosage": "5mg",
  "frequency": "once daily",
  "reminder_times": ["08:00"],
  "is_critical": true
}
```

**Expect:** `200` with `"message": "Medicine added and reminders scheduled"` and an `id`.

**If column missing in DB:** `500` or PostgREST error mentioning `is_critical` → run Step 0 SQL.

### 2d. List medicines

`GET /api/medicines/{patient_id}`

**Expect:** New entry includes `"is_critical": true`.

### 2e. Update to non-critical

`PUT /api/medicines/{medicine_id}`

```json
{
  "patient_id": "<same-patient-uuid>",
  "is_critical": false
}
```

**Expect:** `200` with `"Medicine updated and reminders rescheduled"`.

`GET` again → `"is_critical": false`.

### 2f. Regression — email reminder still works

As **doctor**, `POST /api/testing/send_reminder/{medicine_id}` (any active medicine).

**Expect:** `200` `{"status":"ok",...}` and reminder email in inbox (unchanged from before Task 1).

---

## 3. Frontend UI

```bash
cd frontend
npm run dev
```

1. Log in as patient (or doctor → patient profile → Add Medicine).
2. Open **Add Medicine** or **Edit Medicine**.
3. Find checkbox **Critical Medication** (rose-tinted section above Supply).
4. Check it → Save.
5. Edit same medicine → checkbox should stay checked.

**Expect:** Save succeeds; no console errors. Other form fields unchanged.

---

## 4. Twilio env (Task 2 prep only — no calls yet)

In `backend/.env` (placeholders already added):

```env
CALL_PROVIDER=none
TWILIO_ACCOUNT_SID=<your sid>
TWILIO_AUTH_TOKEN=<your token>
TWILIO_PHONE_NUMBER=<your Twilio number, E.164 e.g. +1...>
```

**For Task 1:** leave `CALL_PROVIDER=none`. Backend should start normally.

**When Task 2 code ships:** set `CALL_PROVIDER=twilio` and fill the three Twilio values.

Restart backend after editing `.env`.

---

## Quick checklist

| Step | Pass criteria |
|------|----------------|
| SQL `add_medicine_is_critical.sql` | Column on `medicines` |
| `python test_medicine_is_critical.py` | 4/4 passed |
| POST medicine `is_critical: true` | 200 + id |
| GET medicines | Field present |
| PUT toggle false | Persists |
| Test reminder email | Still sends |
| UI checkbox | Saves and reloads on edit |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API error on `is_critical` | Run `docs/sql/add_medicine_is_critical.sql` |
| Checkbox saves but GET shows `false` | Confirm SQL ran; hard-refresh; check correct `patient_id` |
| `call_logs` errors before Task 2 code | Table is optional until Task 2; running `add_call_logs.sql` early is fine |
