# Task 2 — Critical voice call testing guide

## Prerequisites

1. SQL already run: `docs/sql/add_call_logs.sql`
2. `backend/.env`:
   ```env
   CALL_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+16814056121
   ```
   (E.164, **no spaces**)
3. Demo patient in Supabase:
   ```sql
   UPDATE profiles SET phone = '+91XXXXXXXXXX' WHERE id = '<patient-uuid>';
   ```
   Twilio trial: verify this number in the Twilio console.
4. At least one medicine with `is_critical = true` for that patient.
5. Install dependency:
   ```bash
   cd backend && pip install twilio==9.4.0
   ```

Restart backend after `.env` changes.

---

## Swagger

URL: http://127.0.0.1:8000/docs

Look for tag **reminders**:

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/reminders/critical-call/{patient_id}/{medicine_id}` | Doctor Bearer token only |

### Steps

1. `POST /api/auth/login` as a **doctor** → copy `access_token`
2. Click **Authorize** → `Bearer <token>`
3. `POST /api/reminders/critical-call/{patient_id}/{medicine_id}`
   - `patient_id` = patient UUID
   - `medicine_id` = critical medicine UUID

### Expected response (success)

```json
{
  "status": "success",
  "message": "Critical medication call placed",
  "message_text": "नमस्ते ... | Hello ...",
  "call_sid": "CAxxxxxxxx",
  "patient_id": "...",
  "medicine_id": "..."
}
```

Phone should ring with Hindi then English (Polly.Aditi).

### Trial account: "press any key / press a digit" before your message

On **Twilio trial** outbound calls, Twilio often plays a disclaimer first, e.g.
*"You have a trial account… press any digit to hear the message."*

**Press a digit (1–9)** and stay on the line — then you should hear the Hindi + English reminder.

To remove that disclaimer, upgrade the Twilio account.

### Wrong audio / not our script?

1. **Preview TwiML** (doctor JWT):  
   `GET /api/reminders/critical-call/twiml-preview/{patient_id}/{medicine_id}`  
   You should see two `<Say voice="Polly.Aditi">` blocks (hi-IN then en-IN).

2. **Twilio Console** → Phone Numbers → your number → **Voice configuration**  
   Clear any old **TwiML Bin / Studio / webhook** on "A call comes in" if you were testing inbound — outbound API uses inline TwiML from our backend, but remove tutorial bins to avoid confusion.

3. Check backend logs for `Critical call TwiML patient=...` — confirms what was sent.

4. **Twilio Console** → Monitor → Logs → Calls → click the call SID → **TwilioML** tab shows what ran.

### Expected failures

| Response | Cause |
|----------|--------|
| 403 | Not logged in as doctor |
| 400 `Medicine is not marked as critical` | `is_critical` is false |
| 400 `Medicine not found for this patient` | Wrong IDs |
| `status: failed` + phone message | `profiles.phone` missing or not E.164 |
| `status: failed` + CALL_PROVIDER | `CALL_PROVIDER` still `none` |

### Verify in Supabase

```sql
SELECT * FROM call_logs ORDER BY called_at DESC LIMIT 5;
```

---

## Automatic path (30 min after reminder)

1. Ensure medicine is `is_critical = true`
2. As doctor: `POST /api/testing/send_reminder/{medicine_id}` (tag **testing**)
3. **Do not** confirm the email dose
4. Wait **30 minutes** (or temporarily set `CRITICAL_MISS_GRACE_MINUTES` lower in code for dev)
5. Patient phone rings; new `call_logs` row

If patient confirms via email before 30 min → **no call**.

---

## Regression (Task 1 + email)

After Task 2, re-check:

- `POST /api/testing/send_reminder/{medicine_id}` still sends email
- Non-critical medicines: email only, no call after 30 min
- Critical + confirmed dose: no call after 30 min
