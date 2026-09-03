"""
Consumer Health Guide extraction.

This module is intentionally separate from field_structuring.py: those six
fields are *mandatory legal declarations* under PCR 2011, evaluated for
compliance. Everything here is *consumer-facing informational* content
(ingredients, allergens, rough nutrition read) pulled from the same OCR
blocks on a best-effort basis. It is NOT a compliance check and carries no
rule_reference / penalty_clause — it's shown to help a shopper understand
what's in the product, not to evaluate the seller.
"""

import re
from typing import Any, Dict, List, Optional

# Common allergens declared on Indian packaged food labels (FSSAI-aligned superset).
# Matched as whole words/phrases against the extracted ingredients text.
_ALLERGEN_PATTERNS: List[tuple] = [
    ("milk", re.compile(r"\b(milk|milk\s*solids|milk\s*powder|dairy|casein|whey|lactose|ghee|butter|cream|cheese)\b", re.IGNORECASE)),
    ("egg", re.compile(r"\begg[s]?\b", re.IGNORECASE)),
    ("peanut", re.compile(r"\bpeanut[s]?\b", re.IGNORECASE)),
    ("tree nuts", re.compile(r"\b(almond|cashew|walnut|pistachio|hazelnut|tree\s*nuts?)\b", re.IGNORECASE)),
    ("soy", re.compile(r"\bsoy(a|bean)?\b", re.IGNORECASE)),
    ("wheat / gluten", re.compile(r"\b(wheat|gluten|maida|barley|rye)\b", re.IGNORECASE)),
    ("fish", re.compile(r"\bfish\b", re.IGNORECASE)),
    ("shellfish", re.compile(r"\b(shellfish|prawn|shrimp|crab|lobster)\b", re.IGNORECASE)),
    ("sesame", re.compile(r"\bsesame|til\b", re.IGNORECASE)),
    ("mustard", re.compile(r"\bmustard\b", re.IGNORECASE)),
]

# Keyword-based dietary/health flags, purely heuristic — surfaced as neutral
# notes ("contains X"), never a pass/fail judgement.
_HEALTH_FLAG_PATTERNS: List[tuple] = [
    ("added_sugar", "Contains added sugar", re.compile(r"\b(sugar|sucrose|glucose|fructose|dextrose|corn\s*syrup|invert\s*sugar)\b", re.IGNORECASE)),
    ("trans_fat", "May contain trans fat (hydrogenated / vanaspati oil)", re.compile(r"\b(hydrogenated|vanaspati|partially\s*hydrogenated)\b", re.IGNORECASE)),
    ("palm_oil", "Contains palm oil", re.compile(r"\bpalm\s*oil\b", re.IGNORECASE)),
    ("preservatives", "Contains preservatives", re.compile(r"\b(preservative|sodium\s*benzoate|potassium\s*sorbate|sulphite|sulfite|ins\s*\d{3})\b", re.IGNORECASE)),
    ("artificial_color", "Contains artificial colour/flavour", re.compile(r"\b(artificial\s*(colou?r|flavou?r)|synthetic\s*(colou?r|flavou?r))\b", re.IGNORECASE)),
    ("msg", "Contains MSG (monosodium glutamate)", re.compile(r"\b(msg|monosodium\s*glutamate)\b", re.IGNORECASE)),
    ("high_sodium", "Sodium / salt content mentioned — check nutrition panel", re.compile(r"\b(sodium|excess\s*salt)\b", re.IGNORECASE)),
]

_VEG_NONVEG_PATTERN = re.compile(r"\b(vegetarian|veg\b|non[\s\-]?vegetarian|non[\s\-]?veg\b)", re.IGNORECASE)

_INGREDIENTS_HEADER = re.compile(r"ingredients?\s*[:\-]?\s*(.*)", re.IGNORECASE)

# Nutrition facts: nutrient name -> regex capturing a numeric value + unit.
_NUTRIENT_PATTERNS: Dict[str, re.Pattern] = {
    "energy_kcal": re.compile(r"energy[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*k?cal", re.IGNORECASE),
    "protein_g": re.compile(r"protein[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*g\b", re.IGNORECASE),
    "carbohydrate_g": re.compile(r"carbohydrate[s]?[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*g\b", re.IGNORECASE),
    "total_sugar_g": re.compile(r"(?:total\s*)?sugars?[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*g\b", re.IGNORECASE),
    "total_fat_g": re.compile(r"(?:total\s*)?fat[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*g\b", re.IGNORECASE),
    "saturated_fat_g": re.compile(r"saturated\s*fat[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*g\b", re.IGNORECASE),
    "sodium_mg": re.compile(r"sodium[\s\:]*([0-9]+(?:\.[0-9]+)?)\s*mg\b", re.IGNORECASE),
}


def _extract_ingredients_text(blocks: List[Dict[str, Any]]) -> Optional[str]:
    """
    Finds the OCR block that starts the ingredients declaration and
    concatenates a few following blocks if the list clearly continues
    (common when a long ingredient list wraps across separate OCR lines).
    """
    for idx, block in enumerate(blocks):
        text = str(block.get("text", "")).strip()
        if not text:
            continue
        match = _INGREDIENTS_HEADER.match(text)
        if not match:
            continue

        collected = match.group(1).strip()
        # Ingredient lists commonly wrap across several separate OCR lines —
        # keep pulling in following blocks until we hit what looks like a
        # different declaration (nutrition panel, MRP, dates, etc.) or run
        # out of a reasonable lookahead window.
        lookahead = idx + 1
        while lookahead < len(blocks) and lookahead < idx + 5:
            next_text = str(blocks[lookahead].get("text", "")).strip()
            if re.match(
                r"(?i)^(nutrition|energy|protein|carbohydrate|total\s*fat|saturated\s*fat|sugars?|sodium|"
                r"net\s*(wt|qty)|mrp|mfd|mfg|pkd|best\s*before|use\s*by|batch|fssai|manufactured|marketed|"
                r"customer\s*care|consumer\s*care)",
                next_text,
            ):
                break
            if next_text:
                collected = f"{collected}, {next_text}" if collected else next_text
            lookahead += 1

        collected = collected.strip(" ,.:-")
        return collected if collected else None
    return None


def _detect_allergens(ingredients_text: str) -> List[str]:
    found = []
    for label, pattern in _ALLERGEN_PATTERNS:
        if pattern.search(ingredients_text):
            found.append(label)
    return found


def _detect_health_flags(ingredients_text: str) -> List[Dict[str, str]]:
    flags = []
    for code, label, pattern in _HEALTH_FLAG_PATTERNS:
        if pattern.search(ingredients_text):
            flags.append({"code": code, "label": label})
    return flags


def _detect_veg_status(blocks: List[Dict[str, Any]]) -> Optional[str]:
    for block in blocks:
        text = str(block.get("text", ""))
        match = _VEG_NONVEG_PATTERN.search(text)
        if match:
            token = match.group(0).lower().replace(" ", "").replace("-", "")
            return "Non-Vegetarian" if "non" in token else "Vegetarian"
    return None


def _extract_nutrition_facts(blocks: List[Dict[str, Any]]) -> Dict[str, float]:
    # Nutrition panels are often OCR'd as one block per line, so search the
    # whole joined text rather than block-by-block.
    joined = "\n".join(str(b.get("text", "")) for b in blocks)
    facts: Dict[str, float] = {}
    for nutrient, pattern in _NUTRIENT_PATTERNS.items():
        match = pattern.search(joined)
        if match:
            try:
                facts[nutrient] = float(match.group(1))
            except (ValueError, IndexError):
                continue
    return facts


def build_health_guide(blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Best-effort consumer health guide extracted from the same OCR blocks
    used for compliance checking. Returns None fields where nothing was
    confidently found — the frontend hides sections with no data rather
    than showing empty placeholders.
    """
    if not blocks:
        return {
            "ingredients_text": None,
            "ingredients_list": None,
            "allergens": [],
            "health_flags": [],
            "veg_status": None,
            "nutrition_facts": {},
            "disclaimer": (
                "Automated reading of label text for consumer awareness only. "
                "Not medical or dietary advice — always check the physical package."
            ),
        }

    ingredients_text = _extract_ingredients_text(blocks)
    allergens = _detect_allergens(ingredients_text) if ingredients_text else []
    health_flags = _detect_health_flags(ingredients_text) if ingredients_text else []
    veg_status = _detect_veg_status(blocks)
    nutrition_facts = _extract_nutrition_facts(blocks)

    ingredients_list = None
    if ingredients_text:
        ingredients_list = [
            part.strip(" .")
            for part in re.split(r",|;", ingredients_text)
            if part.strip(" .")
        ]

    return {
        "ingredients_text": ingredients_text,
        "ingredients_list": ingredients_list,
        "allergens": allergens,
        "health_flags": health_flags,
        "veg_status": veg_status,
        "nutrition_facts": nutrition_facts,
        "disclaimer": (
            "Automated reading of label text for consumer awareness only. "
            "Not medical or dietary advice — always check the physical package."
        ),
    }
