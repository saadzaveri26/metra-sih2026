import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = Path(__file__).resolve().parent / "data"
MOCK_LISTINGS_PATH = DATA_DIR / "mock_listings.json"

# P6: Cache mock listings in memory to avoid re-reading from disk per request
_MOCK_LISTINGS_CACHE: Optional[List[Dict[str, Any]]] = None


def load_mock_listings(path: Path = MOCK_LISTINGS_PATH) -> List[Dict[str, Any]]:
    global _MOCK_LISTINGS_CACHE
    if _MOCK_LISTINGS_CACHE is not None:
        return _MOCK_LISTINGS_CACHE
    if not path.is_file():
        return []
    with open(path, "r", encoding="utf-8") as f:
        _MOCK_LISTINGS_CACHE = json.load(f)
    return _MOCK_LISTINGS_CACHE


def find_mock_listing(
    *,
    product_name: str = "",
    barcode: str = "",
    listings: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    if listings is None:
        listings = load_mock_listings()

    clean_barcode = barcode.strip()
    clean_name = product_name.strip().lower()

    if clean_barcode:
        for item in listings:
            if item.get("barcode") == clean_barcode:
                return item

    if clean_name:
        # 1. Exact or alias match
        for item in listings:
            if item.get("product_name", "").lower() == clean_name:
                return item
            for alias in item.get("aliases", []):
                if alias.lower() in clean_name or clean_name in alias.lower():
                    return item

        # 2. Substring search in product name
        for item in listings:
            p_lower = item.get("product_name", "").lower()
            if any(word in p_lower for word in clean_name.split() if len(word) > 3):
                return item

    # B5 fix: Do NOT fall back to an unrelated listing — return None
    return None


def _extract_numeric_value(val: str) -> Optional[float]:
    nums = re.findall(r"\d+(?:\.\d+)?", val)
    return float(nums[0]) if nums else None


def _clean_str(s: Optional[str]) -> str:
    if not s:
        return ""
    # Normalize spaces and punctuation
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s\.\,\₹]", "", s)).strip().lower()


def compare_physical_vs_online(
    physical_fields: Dict[str, Any],
    online_listing: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compares physical packaging declarations from a scan against an online e-commerce listing.
    Flags mismatches under E-Commerce Legal Metrology guidelines.
    """
    online_decls = online_listing.get("declarations", {})
    results: Dict[str, Dict[str, Any]] = {}

    field_rules = {
        "manufacturer": "Rule 6(1)(a) & E-Commerce Disclosure Rules",
        "net_quantity": "Rule 6(1)(c) & Rule 11 (Standard Metric Quantity)",
        "mrp": "Rule 6(1)(e) (Price Discrepancy & E-Commerce Transparency)",
        "country_of_origin": "Rule 6(10) (Mandatory E-Commerce Origin Disclosure)",
        "manufacture_date": "Rule 6(1)(d) (Freshness & Packaging Date)",
        "consumer_care": "Rule 6(1)(f) (Grievance Redressal Cell)",
    }

    match_count = 0
    mismatch_count = 0

    for field, rule_ref in field_rules.items():
        p_item = physical_fields.get(field) or {}
        p_val = (
            (p_item.get("officer_override") or {}).get("value")
            if p_item.get("officer_override")
            else p_item.get("value")
        )
        o_val = online_decls.get(field)

        if not p_val and not o_val:
            status = "MATCH"
            details = "Neither physical nor online listing declares this field."
            match_count += 1
        elif not p_val:
            status = "MISSING_PHYSICAL"
            details = f"Field is declared on e-commerce listing ('{o_val}'), but missing on physical packaging."
            mismatch_count += 1
        elif not o_val:
            status = "MISSING_ONLINE"
            details = f"Declared on physical packaging ('{p_val}'), but omitted from online e-commerce listing."
            mismatch_count += 1
        else:
            # Comparison heuristics
            if field == "mrp":
                p_num = _extract_numeric_value(str(p_val))
                o_num = _extract_numeric_value(str(o_val))
                if p_num is not None and o_num is not None and abs(p_num - o_num) > 0.01:
                    status = "MISMATCH"
                    details = (
                        f"Price Discrepancy: Physical label states MRP ₹{p_num:.2f}, "
                        f"whereas online listing claims ₹{o_num:.2f}."
                    )
                    mismatch_count += 1
                else:
                    status = "MATCH"
                    details = f"MRP is consistent between physical packaging and e-commerce portal (₹{p_num or p_val})."
                    match_count += 1

            elif field == "net_quantity":
                p_num = _extract_numeric_value(str(p_val))
                o_num = _extract_numeric_value(str(o_val))
                if p_num is not None and o_num is not None and abs(p_num - o_num) > 0.01:
                    status = "MISMATCH"
                    details = f"Quantity Discrepancy: Physical packaging declares '{p_val}', while online listing advertises '{o_val}'."
                    mismatch_count += 1
                else:
                    status = "MATCH"
                    details = f"Net quantity corresponds accurately ('{p_val}')."
                    match_count += 1

            elif field == "country_of_origin":
                p_c = _clean_str(str(p_val))
                o_c = _clean_str(str(o_val))
                if p_c != o_c and (p_c not in o_c and o_c not in p_c):
                    status = "MISMATCH"
                    details = f"Country of Origin Discrepancy: Packaging declares '{p_val}', but online listing states '{o_val}'."
                    mismatch_count += 1
                else:
                    status = "MATCH"
                    details = f"Country of origin matches ('{p_val}')."
                    match_count += 1

            else:
                # Text substring matching
                p_c = _clean_str(str(p_val))
                o_c = _clean_str(str(o_val))
                # Check significant token overlap
                p_tokens = set(p_c.split())
                o_tokens = set(o_c.split())
                overlap = len(p_tokens & o_tokens)
                if overlap > 0 or p_c in o_c or o_c in p_c:
                    status = "MATCH"
                    details = f"Declaration details are concordant."
                    match_count += 1
                else:
                    status = "MISMATCH"
                    details = f"Physical declaration ('{p_val}') differs from online declaration ('{o_val}')."
                    mismatch_count += 1

        results[field] = {
            "field": field,
            "status": status,
            "physical_value": p_val,
            "online_value": o_val,
            "rule_reference": rule_ref,
            "details": details,
        }

    overall_status = "COMPLIANT" if mismatch_count == 0 else "MISMATCH_DETECTED"

    return {
        "overall_status": overall_status,
        "is_concordant": mismatch_count == 0,
        "match_count": match_count,
        "mismatch_count": mismatch_count,
        "total_fields": len(field_rules),
        "fields": results,
    }
