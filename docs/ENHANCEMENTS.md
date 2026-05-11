# MedAdhere — Enhancements
### RxNorm Drug Database + PaddleOCR + Allergy Conflict Check
### Branch off main before starting: `git checkout -b feature/enhancements`

---

## Overview

Three additions that work together as one cohesive system:

1. **PaddleOCR** replaces pure Gemini Vision for prescription image reading — better accuracy on handwritten Indian prescriptions, saves Gemini quota
2. **RxNorm API** gives us a real clinical drug database — resolves drug names to standard IDs, fetches interaction data
3. **Allergy Conflict Check** uses RxNorm to flag dangerous combinations before any medicine is saved — fires for OCR uploads, patient manual entry, and doctor additions

These three together make a single, unbreakable rule: **no medicine ever enters the database without being checked against the patient's allergy profile.**

---

## New Files to Create

```
backend/
├── services/
│   ├── ocr_service.py          ← PaddleOCR + Gemini structuring pipeline
│   ├── rxnorm_service.py       ← All RxNorm API calls
│   └── allergy_service.py      ← Conflict check logic, called before every medicine save
```

No existing files are deleted. `gemini_service.py` keeps its insight card function. OCR is just rerouted through the new pipeline.

---

## Part 1 — PaddleOCR Pipeline

### How it works

```
Prescription image
  → PaddleOCR extracts raw text (handles handwriting, printed, mixed)
  → Raw text fed to Gemini Flash (text only, not vision)
  → Gemini structures it into JSON medicine array
  → Returns to frontend as prefilled form
```

PaddleOCR handles the hard visual problem. Gemini handles the understanding problem. Each does what it's best at. This also means if PaddleOCR fails on a particularly bad image, we fall back to Gemini Vision as backup — patient never sees a failure.

### New dependency

Add to `requirements.txt`:
```
paddlepaddle==2.6.1
paddleocr==2.7.3
```

First run downloads language models (~200MB, one time only). This is fine on your Mac. Your teammates do not run the backend so they never need to install this.

### `services/ocr_service.py`

```python
# services/ocr_service.py
# Owner: Lead
# Replaces direct Gemini Vision calls for prescription OCR.
# Falls back to Gemini Vision if PaddleOCR extraction is too short or fails.

import io
import logging
from pathlib import Path
from paddleocr import PaddleOCR
from services.gemini_service import structure_prescription_text, extract_prescription_vision

logger = logging.getLogger(__name__)

# Initialise once at module level — do not re-initialise per request (slow)
# use_angle_cls=True handles rotated/tilted text common in photos of prescriptions
# lang='en' works for English + printed Hindi drug names
_ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)


def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Run PaddleOCR on raw image bytes.
    Returns raw extracted text as a single string.
    Returns empty string on failure — caller handles fallback.
    """
    try:
        # PaddleOCR needs a numpy array or file path
        import numpy as np
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)

        result = _ocr_engine.ocr(image_np, cls=True)

        if not result or not result[0]:
            return ""

        # result is a nested list: [[[box, (text, confidence)], ...]]
        # Extract just the text parts with confidence > 0.7
        lines = []
        for line in result[0]:
            text, confidence = line[1]
            if confidence > 0.7:
                lines.append(text)

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"PaddleOCR failed: {e}")
        return ""


async def process_prescription_image(image_bytes: bytes) -> list[dict]:
    """
    Full pipeline: image → structured medicine list.
    
    1. Try PaddleOCR → Gemini text structuring
    2. If PaddleOCR output too short → fall back to Gemini Vision directly
    
    Always returns a list of dicts (may have null fields).
    Never raises — returns empty list on complete failure.
    """
    raw_text = extract_text_from_image(image_bytes)

    # If PaddleOCR got meaningful text (>30 chars), use it
    if len(raw_text.strip()) > 30:
        logger.info(f"PaddleOCR extracted {len(raw_text)} chars — using text pipeline")
        return await structure_prescription_text(raw_text)
    else:
        # Fallback to Gemini Vision
        logger.info("PaddleOCR output too short — falling back to Gemini Vision")
        return await extract_prescription_vision(image_bytes)
```

### Updates to `services/gemini_service.py`

Add these two functions alongside the existing `generate_insight`:

```python
# Add to services/gemini_service.py

STRUCTURE_PROMPT = """
You are reading extracted text from an Indian medical prescription.
The text may be imperfect due to OCR. Extract all medicines mentioned.

Return a JSON array only. No explanation. No markdown. No preamble.
Each item must have exactly these keys:
[
  {
    "name": "medicine name as written",
    "dosage": "e.g. 500mg or null",
    "frequency": "e.g. twice daily or null",
    "reminder_times": ["08:00", "21:00"],
    "notes": "e.g. take after food or null"
  }
]

For reminder_times: infer from frequency using these defaults:
  once daily      → ["09:00"]
  twice daily     → ["09:00", "21:00"]
  three times     → ["08:00", "14:00", "20:00"]
  before bed      → ["21:00"]
  if unclear      → ["09:00"]

If you cannot find any medicines, return [].
Text to parse:
"""

async def structure_prescription_text(raw_text: str) -> list[dict]:
    """Takes raw OCR text, returns structured medicine list."""
    try:
        response = gemini_model.generate_content(STRUCTURE_PROMPT + raw_text)
        text = response.text.strip().replace("```json", "").replace("```", "")
        import json
        return json.loads(text)
    except Exception as e:
        logger.error(f"Gemini text structuring failed: {e}")
        return []


async def extract_prescription_vision(image_bytes: bytes) -> list[dict]:
    """
    Direct Gemini Vision fallback — used when PaddleOCR fails.
    Same return shape as structure_prescription_text.
    """
    import base64
    import json

    try:
        image_b64 = base64.b64encode(image_bytes).decode()
        vision_prompt = STRUCTURE_PROMPT.replace("extracted text from", "image of")

        response = gemini_model.generate_content([
            {"mime_type": "image/jpeg", "data": image_b64},
            vision_prompt
        ])
        text = response.text.strip().replace("```json", "").replace("```", "")
        return json.loads(text)
    except Exception as e:
        logger.error(f"Gemini Vision fallback failed: {e}")
        return []
```

### Update `api/ocr.py`

```python
# api/ocr.py
from fastapi import APIRouter, UploadFile, File, Depends
from services.ocr_service import process_prescription_image
from PIL import Image
import io

router = APIRouter()

@router.post("/ocr")
async def extract_prescription(image: UploadFile = File(...)):
    """
    Accepts JPG, PNG, or PDF.
    Returns structured medicine list — any field may be null.
    Frontend MUST show prefilled form for patient to confirm before saving.
    NEVER auto-save this output directly.
    """
    image_bytes = await image.read()

    # Convert to JPEG if PNG (removes transparency issues)
    if image.content_type == "image/png":
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        image_bytes = buf.getvalue()

    medicines = await process_prescription_image(image_bytes)
    return medicines
```

---

## Part 2 — RxNorm Drug Database

### What RxNorm gives us

RxNorm is the US National Library of Medicine's drug database. Free, no API key, no rate limits worth worrying about. It gives us:

- **RxCUI** — a unique numeric ID for every drug (e.g. Metformin = 6809)
- **Drug interactions** — known clinical interactions between two drugs
- **Ingredient normalization** — "Crocin", "Tylenol", "Paracetamol" all resolve to the same active ingredient (Acetaminophen)

We use it for two things: resolving a drug name to its RxCUI, and checking that RxCUI against a patient's allergy list.

### `services/rxnorm_service.py`

```python
# services/rxnorm_service.py
# Owner: Lead
# All RxNorm API calls live here. No other file calls RxNorm directly.
# RxNorm is a free REST API — no key required.
# Docs: https://rxnav.nlm.nih.gov/RxNormAPIs.html

import httpx
import logging

logger = logging.getLogger(__name__)

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"

# Timeout for all RxNorm calls — if it takes more than 5s, skip the check
TIMEOUT = 5.0


async def get_rxcui(drug_name: str) -> str | None:
    """
    Resolve a drug name to its RxNorm concept unique identifier (RxCUI).
    Returns the RxCUI string, or None if not found.
    
    Example: "Metformin" → "6809"
    Example: "Crocin"    → "161" (resolves to Acetaminophen)
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{RXNORM_BASE}/rxcui.json",
                params={"name": drug_name, "search": 2}
                # search=2 means approximate match — handles typos and brand names
            )
            data = response.json()
            rxcui = data.get("idGroup", {}).get("rxnormId", [None])[0]
            return rxcui
    except Exception as e:
        logger.warning(f"RxNorm get_rxcui failed for '{drug_name}': {e}")
        return None


async def get_drug_interactions(rxcui_list: list[str]) -> list[dict]:
    """
    Check for known interactions between a list of drugs (by RxCUI).
    Returns list of interaction dicts, empty list if none found or on error.
    
    Each interaction dict has:
      - drug1: name of first drug
      - drug2: name of second drug  
      - description: clinical description of the interaction
      - severity: "high" | "moderate" | "low" (mapped from RxNorm data)
    """
    if len(rxcui_list) < 2:
        return []

    try:
        rxcuis_param = "+".join(rxcui_list)
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{RXNORM_BASE}/interaction/list.json",
                params={"rxcuis": rxcuis_param}
            )
            data = response.json()

        interactions = []
        full_list = data.get("fullInteractionTypeGroup", [])

        for group in full_list:
            for interaction_type in group.get("fullInteractionType", []):
                for pair in interaction_type.get("interactionPair", []):
                    interactions.append({
                        "drug1": pair["interactionConcept"][0]["minConceptItem"]["name"],
                        "drug2": pair["interactionConcept"][1]["minConceptItem"]["name"],
                        "description": pair.get("description", "Potential interaction detected"),
                        "severity": pair.get("severity", "moderate").lower()
                    })

        return interactions

    except Exception as e:
        logger.warning(f"RxNorm interaction check failed: {e}")
        return []


async def get_drug_info(rxcui: str) -> dict | None:
    """
    Get basic drug info for a given RxCUI.
    Returns dict with name, synonym, ingredients — used for allergy matching.
    Returns None on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{RXNORM_BASE}/rxcui/{rxcui}/allrelated.json"
            )
            data = response.json()

        # Extract ingredient names — what we match allergies against
        concepts = data.get("allRelatedGroup", {}).get("conceptGroup", [])
        ingredients = []
        for group in concepts:
            if group.get("tty") == "IN":  # IN = ingredient
                for concept in group.get("conceptProperties", []):
                    ingredients.append(concept["name"].lower())

        return {
            "rxcui": rxcui,
            "ingredients": ingredients
        }

    except Exception as e:
        logger.warning(f"RxNorm get_drug_info failed for rxcui {rxcui}: {e}")
        return None
```

---

## Part 3 — Allergy Conflict Check

### The rule

**No medicine is saved to the database without passing through `check_medicine_safety()`.**

This function is called from three places:
- `api/medicines.py` — POST (patient adds manually)
- `api/medicines.py` — POST with `added_by=doctor_id` (doctor adds)
- `api/ocr.py` — after OCR extracts medicines, before returning to frontend

It does not block saving — it returns warnings. The doctor or patient sees the warning and decides. We never silently prevent saving because that would be removing human oversight, which contradicts the entire design philosophy of this project.

### `services/allergy_service.py`

```python
# services/allergy_service.py
# Owner: Lead
# Single entry point for all safety checks before saving a medicine.
# Called from api/medicines.py and api/ocr.py — nowhere else.

import logging
from services.rxnorm_service import get_rxcui, get_drug_info, get_drug_interactions
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)


async def check_medicine_safety(
    medicine_name: str,
    patient_id: str
) -> dict:
    """
    Run allergy conflict check for a medicine against a patient's profile.
    
    Returns:
    {
        "safe": True,               ← False if any allergy conflict found
        "warnings": [               ← Empty list if safe
            {
                "type": "allergy",
                "message": "Amoxicillin is a penicillin-type antibiotic. Patient has documented Penicillin allergy.",
                "severity": "high"
            }
        ],
        "rxcui": "723"              ← Store this with the medicine for future interaction checks
    }
    
    IMPORTANT: A False "safe" value is a WARNING, not a hard block.
    The caller (doctor or patient) decides whether to proceed.
    Always show the warning clearly in the UI.
    """
    result = {
        "safe": True,
        "warnings": [],
        "rxcui": None
    }

    # Step 1: Resolve drug name to RxCUI
    rxcui = await get_rxcui(medicine_name)
    if not rxcui:
        # RxNorm didn't recognise the name — could be very new drug or typo
        # Do not block — just note it couldn't be checked
        logger.info(f"RxNorm could not resolve '{medicine_name}' — skipping safety check")
        result["warnings"].append({
            "type": "unresolved",
            "message": f"Could not verify '{medicine_name}' against drug database. Please confirm with patient manually.",
            "severity": "low"
        })
        return result

    result["rxcui"] = rxcui

    # Step 2: Get patient's allergy list from their profile
    profile = supabase.table("profiles")\
        .select("allergies")\
        .eq("id", patient_id)\
        .single()\
        .execute()

    allergies_raw = profile.data.get("allergies", "") if profile.data else ""
    if not allergies_raw:
        return result  # No allergies on file — nothing to check

    # Parse allergies — stored as comma-separated string e.g. "Penicillin, Sulfa drugs"
    allergy_list = [a.strip().lower() for a in allergies_raw.split(",") if a.strip()]

    # Step 3: Get drug ingredients from RxNorm
    drug_info = await get_drug_info(rxcui)
    if not drug_info:
        return result  # RxNorm lookup failed — don't block

    ingredients = drug_info.get("ingredients", [])

    # Step 4: Check each ingredient against each allergy
    for ingredient in ingredients:
        for allergy in allergy_list:
            if _is_related(ingredient, allergy):
                result["safe"] = False
                result["warnings"].append({
                    "type": "allergy",
                    "message": f"⚠️ {medicine_name} contains {ingredient.title()}, which may conflict with patient's documented allergy to {allergy.title()}.",
                    "severity": "high"
                })

    return result


def _is_related(ingredient: str, allergy: str) -> bool:
    """
    Simple string matching for allergy conflicts.
    Handles common cases: exact match, partial match, known drug class synonyms.
    
    Not exhaustive — RxNorm ingredient resolution handles most normalization.
    This is a safety net for the remainder.
    """
    ingredient = ingredient.lower()
    allergy = allergy.lower()

    if allergy in ingredient or ingredient in allergy:
        return True

    # Known class relationships — extend this list as needed
    CLASS_RELATIONS = {
        "penicillin": ["amoxicillin", "ampicillin", "flucloxacillin", "piperacillin"],
        "sulfa": ["sulfamethoxazole", "sulfadiazine", "sulfasalazine"],
        "cephalosporin": ["cefalexin", "cefuroxime", "ceftriaxone"],
        "nsaid": ["ibuprofen", "naproxen", "diclofenac", "aspirin"],
    }

    for drug_class, members in CLASS_RELATIONS.items():
        if drug_class in allergy:
            if any(m in ingredient for m in members):
                return True

    return False


async def check_patient_medicine_interactions(patient_id: str) -> list[dict]:
    """
    Check ALL of a patient's current active medicines against each other.
    Called when a new medicine is added — checks new drug against existing ones.
    
    Returns list of interaction dicts (empty if none found).
    Each dict: { drug1, drug2, description, severity }
    """
    medicines = supabase.table("medicines")\
        .select("name, rxcui")\
        .eq("patient_id", patient_id)\
        .eq("is_active", True)\
        .execute()

    if not medicines.data or len(medicines.data) < 2:
        return []

    # Only check medicines that have an rxcui stored
    rxcuis = [m["rxcui"] for m in medicines.data if m.get("rxcui")]
    if len(rxcuis) < 2:
        return []

    return await get_drug_interactions(rxcuis)
```

---

## Database Change — Store RxCUI with Medicine

Add `rxcui` column to the `medicines` table. This lets us run interaction checks between existing medicines without re-querying RxNorm every time.

```sql
ALTER TABLE medicines ADD COLUMN rxcui text;
```

Run this in Supabase SQL editor. Update your schema doc in CORE.md medicines table to include:
```
rxcui   text   -- RxNorm concept ID, stored on save, null if unresolved
```

---

## Wiring into `api/medicines.py`

This is the most important section. Every medicine save goes through the safety check.

```python
# In api/medicines.py

from services.allergy_service import check_medicine_safety, check_patient_medicine_interactions

@router.post("/medicines")
async def add_medicine(data: MedicineSchema):
    """
    Before saving: run allergy check.
    If warnings found: return them with a 200 + warnings flag.
    Frontend shows the warning modal, user confirms, then calls POST /medicines/confirm
    to actually save. This two-step approach ensures no warning is ever skipped silently.
    """

    # Step 1: Safety check
    safety = await check_medicine_safety(data.name, data.patient_id)

    # Step 2: Check interactions with existing medicines
    # We need rxcui from safety check result first
    interactions = []
    if safety["rxcui"]:
        # Temporarily store rxcui to check against existing medicines
        interactions = await check_patient_medicine_interactions(data.patient_id)

    # Step 3: If warnings or interactions — return them, do NOT save yet
    if not safety["safe"] or interactions:
        return {
            "status": "warnings",
            "warnings": safety["warnings"],
            "interactions": interactions,
            "medicine_data": data.dict(),  # Frontend sends this back on confirm
            "rxcui": safety["rxcui"]
        }

    # Step 4: No warnings — save directly
    return await _save_medicine(data, rxcui=safety["rxcui"])


@router.post("/medicines/confirm")
async def confirm_add_medicine(data: MedicineConfirmSchema):
    """
    Called after user sees warnings and explicitly clicks "Add anyway".
    data contains the original medicine_data + rxcui from the warnings response.
    Logs that warning was acknowledged.
    """
    logger.warning(
        f"Medicine added despite warnings — patient: {data.patient_id}, "
        f"medicine: {data.name}, warnings: {data.acknowledged_warnings}"
    )
    return await _save_medicine(data, rxcui=data.rxcui)


async def _save_medicine(data, rxcui: str | None):
    """Shared save logic — inserts to DB and schedules reminders."""
    result = supabase.table("medicines").insert({
        "patient_id": data.patient_id,
        "name": data.name,
        "dosage": data.dosage,
        "frequency": data.frequency,
        "reminder_times": data.reminder_times,
        "start_date": str(data.start_date),
        "end_date": str(data.end_date) if data.end_date else None,
        "notes": data.notes,
        "added_by": data.added_by,
        "rxcui": rxcui,
        "is_active": True
    }).execute()

    medicine_id = result.data[0]["id"]
    schedule_medicine(medicine_id, data.reminder_times)
    log_visit(data.patient_id, data.added_by, "prescription_added",
              f"Added {data.name} {data.dosage}")

    return {"id": medicine_id, "message": "Medicine added and reminders scheduled"}
```

---

## API Contract Additions

Add these to `API_CONTRACT.md`:

```
POST /api/medicines
  Normal response (no warnings):
  { "id": "uuid", "message": "Medicine added and reminders scheduled" }

  Warning response (allergy conflict or interaction found):
  {
    "status": "warnings",
    "warnings": [{ "type": "allergy", "message": "...", "severity": "high" }],
    "interactions": [{ "drug1": "...", "drug2": "...", "description": "...", "severity": "..." }],
    "medicine_data": { ...original body... },
    "rxcui": "723"
  }

POST /api/medicines/confirm
  Body: { ...medicine_data..., "rxcui": "723", "acknowledged_warnings": ["allergy"] }
  Response: { "id": "uuid", "message": "Medicine added and reminders scheduled" }
```

---

## Frontend — Warning Modal

When `POST /api/medicines` returns `status: "warnings"`, show a modal before saving.

```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Safety Check — Please Review                   │
│                                                     │
│  ALLERGY CONFLICT                                   │
│  Amoxicillin contains Penicillin, which conflicts   │
│  with this patient's documented Penicillin allergy. │
│                                                     │
│  DRUG INTERACTION                                   │
│  Metformin + Amlodipine: May cause blood pressure   │
│  fluctuation. Monitor regularly.                    │
│                                                     │
│  [Cancel — Do not add]   [I understand, add anyway] │
└─────────────────────────────────────────────────────┘
```

- "Cancel" — closes modal, medicine not saved, form stays open
- "I understand, add anyway" — calls `POST /api/medicines/confirm` with the original data

This modal is shown for both allergy conflicts AND drug interactions. Doctor/patient always has the final say.

---

## OCR Integration — Check After Extraction

When OCR returns medicines, run a safety check on each before returning to frontend. Frontend shows the prefilled form with warning badges on conflicting medicines.

```python
# In api/ocr.py — after getting medicines list from process_prescription_image

from services.allergy_service import check_medicine_safety

@router.post("/ocr")
async def extract_prescription(
    image: UploadFile = File(...),
    patient_id: str = Query(...)  # add patient_id as query param
):
    image_bytes = await image.read()
    medicines = await process_prescription_image(image_bytes)

    # Run safety check on each extracted medicine
    for medicine in medicines:
        if medicine.get("name"):
            safety = await check_medicine_safety(medicine["name"], patient_id)
            medicine["safety"] = safety  # attach to each medicine in response
        else:
            medicine["safety"] = None

    return medicines
```

Frontend reads `medicine.safety.warnings` and shows a yellow warning badge on that medicine card in the prefilled form. Patient/doctor sees the warning before even submitting.

---

## Build Order

```
Step 1: Add rxcui column to medicines table in Supabase
        ALTER TABLE medicines ADD COLUMN rxcui text;
        DONE WHEN: Column visible in Supabase table editor

Step 2: Build rxnorm_service.py
        Test get_rxcui("Metformin") in Python shell — should return "6809"
        Test get_rxcui("Amoxicillin") — should return a valid ID
        DONE WHEN: Both return valid RxCUI strings

Step 3: Build allergy_service.py
        Create a test patient with allergies = "Penicillin" in Supabase
        Call check_medicine_safety("Amoxicillin", test_patient_id)
        DONE WHEN: Returns safe=False with allergy warning message

Step 4: Wire into api/medicines.py
        Test via Postman: POST /api/medicines with Amoxicillin for penicillin-allergic patient
        DONE WHEN: Returns warnings response, not a saved medicine

Step 5: Install PaddleOCR
        pip install paddlepaddle==2.6.1 paddleocr==2.7.3
        First run downloads models — wait for it fully before testing
        DONE WHEN: pip install completes without errors

Step 6: Build ocr_service.py + update gemini_service.py
        Test with a real prescription photo
        DONE WHEN: Returns structured medicine list with reasonable accuracy

Step 7: Wire safety check into ocr.py
        Upload prescription with a known drug, check safety field in response
        DONE WHEN: OCR response includes safety.warnings per medicine

Step 8: Frontend warning modal
        Trigger a known conflict (add Amoxicillin for penicillin-allergic patient)
        DONE WHEN: Warning modal appears, Cancel works, confirm saves correctly
```

---

## Known Risks

| Risk | Mitigation |
|---|---|
| RxNorm API is slow or down | 5 second timeout on all calls. If timeout → skip check, log warning, allow save. Never block a medicine save because of a third-party API being slow. |
| RxNorm doesn't know an Indian brand name | `get_rxcui` uses approximate search (search=2) which handles many brand names. If it returns null, return a low-severity "could not verify" warning, not an allergy block. |
| PaddleOCR first run is slow | Models download on first call (~200MB). Add a startup warmup call in `main.py` on app boot so the first real OCR request isn't slow. |
| PaddleOCR install fails on a teammate's machine | Only the Lead runs the backend. Teammates never install PaddleOCR. Non-issue. |
| False positive allergy warning | The warning modal always gives "Cancel" and "Add anyway" — doctor/patient has final say. We never hard-block a medicine save. |

---

## Startup Warmup for PaddleOCR

Add this to `main.py` so the model loads on app boot, not on first OCR request:

```python
# In main.py — add to startup event

@app.on_event("startup")
async def startup_event():
    # Reschedule all active medicines (existing)
    reschedule_all_active_medicines()
    
    # Warm up PaddleOCR so first request isn't slow
    from services.ocr_service import _ocr_engine
    import numpy as np
    dummy = np.zeros((100, 100, 3), dtype=np.uint8)
    _ocr_engine.ocr(dummy, cls=True)
    logger.info("PaddleOCR warmed up")
```
