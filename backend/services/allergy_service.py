"""
Safety checks before saving a medicine: RxNorm resolution, allergy strings, drug–drug interactions.
Never hard-blocks saves — callers return warnings for human confirmation.
"""

from __future__ import annotations

import logging
import re

from services.rxnorm_service import get_drug_info, get_drug_interactions, get_rxcui
from utils.supabase_client import supabase

logger = logging.getLogger(__name__)

_ALLERGY_EMPTY = re.compile(
    r"^(none|n/?a|not provided|no known allergies|nil|unknown)\b",
    re.IGNORECASE,
)


def _allergies_meaningful(raw: str) -> bool:
    s = (raw or "").strip()
    if not s:
        return False
    return _ALLERGY_EMPTY.match(s) is None


def _is_related(ingredient: str, allergy: str) -> bool:
    ingredient = ingredient.lower()
    allergy = allergy.lower()

    if allergy in ingredient or ingredient in allergy:
        return True

    class_relations = {
        "penicillin": ["amoxicillin", "ampicillin", "flucloxacillin", "piperacillin"],
        "sulfa": ["sulfamethoxazole", "sulfadiazine", "sulfasalazine"],
        "cephalosporin": ["cefalexin", "cefuroxime", "ceftriaxone"],
        "nsaid": ["ibuprofen", "naproxen", "diclofenac", "aspirin"],
    }

    for drug_class, members in class_relations.items():
        if drug_class in allergy:
            if any(m in ingredient for m in members):
                return True

    return False


async def check_medicine_safety(medicine_name: str, patient_id: str) -> dict:
    result: dict = {"safe": True, "warnings": [], "rxcui": None}

    rxcui = await get_rxcui(medicine_name)
    if not rxcui:
        logger.info("RxNorm could not resolve %r — limited safety check", medicine_name)
        result["warnings"].append(
            {
                "type": "unresolved",
                "message": (
                    f"Could not verify {medicine_name!r} against the drug database. "
                    "Please confirm manually."
                ),
                "severity": "low",
            }
        )
        return result

    result["rxcui"] = rxcui

    try:
        profile = (
            supabase.table("profiles")
            .select("allergies")
            .eq("id", patient_id)
            .single()
            .execute()
        )
        allergies_raw = (profile.data or {}).get("allergies") or ""
    except Exception as exc:
        logger.warning("Could not load allergies for patient %s: %s", patient_id, exc)
        return result

    if not _allergies_meaningful(str(allergies_raw)):
        return result

    allergy_list = [
        a.strip().lower()
        for a in str(allergies_raw).split(",")
        if a.strip() and not _ALLERGY_EMPTY.match(a.strip())
    ]
    if not allergy_list:
        return result

    drug_info = await get_drug_info(rxcui)
    if not drug_info:
        return result

    ingredients = drug_info.get("ingredients") or []
    for ingredient in ingredients:
        for allergy in allergy_list:
            if _is_related(ingredient, allergy):
                result["safe"] = False
                result["warnings"].append(
                    {
                        "type": "allergy",
                        "message": (
                            f"{medicine_name} may relate to {ingredient.title()}, "
                            f"which can conflict with the patient's documented allergy to {allergy.title()}."
                        ),
                        "severity": "high",
                    }
                )

    return result


def _interactions_involving_new(
    new_rxcui: str, interactions: list[dict]
) -> list[dict]:
    """Keep only pairs that include the newly added drug."""
    out = []
    for row in interactions:
        a, b = row.get("rxcui1"), row.get("rxcui2")
        if a and b and (a == new_rxcui or b == new_rxcui):
            out.append(row)
    if out:
        return out
    # If RxNav omitted rxcui on pairs, avoid hiding interactions — return full list.
    if interactions and all(not row.get("rxcui1") or not row.get("rxcui2") for row in interactions):
        return interactions
    return out


async def check_new_medicine_interactions(patient_id: str, new_rxcui: str | None) -> list[dict]:
    """
    Compare a proposed new RxCUI against the patient's active medicines (by stored RxCUI).
    Only returns interaction rows that involve new_rxcui when RxCUIs are present on the pair.
    """
    if not new_rxcui:
        return []

    try:
        medicines = (
            supabase.table("medicines")
            .select("rxcui")
            .eq("patient_id", patient_id)
            .eq("is_active", True)
            .execute()
        )
        rows = medicines.data or []
    except Exception as exc:
        logger.warning("Could not load medicines for interaction check: %s", exc)
        return []

    existing = [str(m["rxcui"]) for m in rows if m.get("rxcui")]
    combined: list[str] = []
    seen: set[str] = set()
    for x in existing + [str(new_rxcui)]:
        if x and x not in seen:
            seen.add(x)
            combined.append(x)

    if len(combined) < 2:
        return []

    all_pairs = await get_drug_interactions(combined)
    return _interactions_involving_new(str(new_rxcui), all_pairs)
