"""
RxNorm REST API — no API key. Single place for all RxNav calls.
Docs: https://rxnav.nlm.nih.gov/RxNormAPIs.html
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
TIMEOUT = 5.0


def _first_rxcui_from_id_group(data: dict[str, Any]) -> str | None:
    id_group = data.get("idGroup") or {}
    raw = id_group.get("rxnormId")
    if raw is None:
        return None
    if isinstance(raw, list):
        return str(raw[0]) if raw else None
    return str(raw)


async def get_rxcui(drug_name: str) -> str | None:
    """Resolve a drug name to RxCUI (approximate match)."""
    name = (drug_name or "").strip()
    if not name:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{RXNORM_BASE}/rxcui.json",
                params={"name": name, "search": 2},
            )
            response.raise_for_status()
            data = response.json()
        return _first_rxcui_from_id_group(data)
    except Exception as exc:
        logger.warning("RxNorm get_rxcui failed for %r: %s", drug_name, exc)
        return None


def _pair_rxcuis(pair: dict[str, Any]) -> tuple[str | None, str | None]:
    concepts = pair.get("interactionConcept") or []
    if len(concepts) < 2:
        return None, None
    try:
        a = (concepts[0].get("minConceptItem") or {}).get("rxcui")
        b = (concepts[1].get("minConceptItem") or {}).get("rxcui")
        return (str(a) if a is not None else None, str(b) if b is not None else None)
    except (TypeError, KeyError, IndexError):
        return None, None


async def get_drug_interactions(rxcui_list: list[str]) -> list[dict[str, Any]]:
    """Return known interaction pairs for the given RxCUIs (deduplicated)."""
    cleaned = []
    seen: set[str] = set()
    for x in rxcui_list:
        if not x:
            continue
        s = str(x).strip()
        if s and s not in seen:
            seen.add(s)
            cleaned.append(s)
    if len(cleaned) < 2:
        return []

    try:
        rxcuis_param = "+".join(cleaned)
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{RXNORM_BASE}/interaction/list.json",
                params={"rxcuis": rxcuis_param},
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("RxNorm interaction check failed: %s", exc)
        return []

    out: list[dict[str, Any]] = []
    full_list = data.get("fullInteractionTypeGroup") or []

    for group in full_list:
        for interaction_type in group.get("fullInteractionType") or []:
            for pair in interaction_type.get("interactionPair") or []:
                concepts = pair.get("interactionConcept") or []
                if len(concepts) < 2:
                    continue
                try:
                    n1 = (concepts[0].get("minConceptItem") or {}).get("name") or "Drug A"
                    n2 = (concepts[1].get("minConceptItem") or {}).get("name") or "Drug B"
                except (TypeError, KeyError, IndexError):
                    continue
                rxcui1, rxcui2 = _pair_rxcuis(pair)
                sev = (pair.get("severity") or "moderate")
                if isinstance(sev, str):
                    sev = sev.lower()
                else:
                    sev = "moderate"
                out.append(
                    {
                        "drug1": n1,
                        "drug2": n2,
                        "description": pair.get("description") or "Potential interaction detected",
                        "severity": sev,
                        "rxcui1": rxcui1,
                        "rxcui2": rxcui2,
                    }
                )
    return out


async def get_drug_info(rxcui: str) -> dict[str, Any] | None:
    """Ingredients (tty IN) for allergy string matching."""
    if not rxcui:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(f"{RXNORM_BASE}/rxcui/{rxcui}/allrelated.json")
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("RxNorm get_drug_info failed for rxcui %s: %s", rxcui, exc)
        return None

    concepts = (data.get("allRelatedGroup") or {}).get("conceptGroup") or []
    ingredients: list[str] = []
    for group in concepts:
        if group.get("tty") != "IN":
            continue
        for concept in group.get("conceptProperties") or []:
            name = concept.get("name")
            if name:
                ingredients.append(str(name).lower())

    return {"rxcui": str(rxcui), "ingredients": ingredients}
