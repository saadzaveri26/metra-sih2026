import re
from typing import Any, Dict, Optional


def evaluate_compliance(
    structured_fields: Dict[str, Dict[str, Any]],
    is_imported: bool = False,
    officer_overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates extracted structured fields against Legal Metrology (Packaged Commodities) Rules, 2011.
    Supports officer manual overrides while preserving the original AI read.

    Returns:
        {
            "compliance_summary": {
                "overall_status": "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW",
                "total_fields_checked": int,
                "compliant_count": int,
                "violations_count": int,
                "review_count": int
            },
            "compliance_results": {
                "<field_name>": {
                    "status": "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW",
                    "rule_reference": str,
                    "rule_description": str,
                    "act_section": str,
                    "findings": str,
                    "penalty_clause": str,
                    "source_block_index": Optional[int],
                    "bounding_box": Optional[list],
                    "ai_value": Optional[str],
                    "effective_value": Optional[str],
                    "is_overridden": bool,
                    "officer_override": Optional[dict]
                }
            }
        }
    """
    results: Dict[str, Dict[str, Any]] = {}
    overrides = officer_overrides or {}

    penal_clause_s36 = (
        "Section 36(1), Legal Metrology Act, 2009: Fine up to ₹25,000 for 1st offence, "
        "up to ₹50,000 for 2nd offence, and up to ₹1,00,000 or imprisonment up to 1 year for subsequent offences."
    )

    def _get_field_data(name: str):
        src = structured_fields.get(name) or {}
        ai_val = src.get("value")
        ai_conf = src.get("confidence") or 0.0
        ai_raw = str(src.get("raw_match") or ai_val or "")
        
        override = overrides.get(name) or src.get("officer_override")
        is_overridden = bool(override and override.get("value") is not None and override.get("is_authoritative", True))
        
        effective_val = override.get("value") if is_overridden else ai_val
        effective_raw = override.get("value") if is_overridden else ai_raw
        effective_conf = 1.0 if is_overridden else ai_conf
        
        return src, ai_val, effective_val, effective_raw, effective_conf, is_overridden, override

    # -------------------------------------------------------------
    # 1. Manufacturer / Packer / Importer Name & Address (Rule 6(1)(a))
    # -------------------------------------------------------------
    mfg_src, mfg_ai, mfg_val, mfg_raw, mfg_conf, mfg_ovr, mfg_ovr_meta = _get_field_data("manufacturer")

    if not mfg_val:
        mfg_status = "NON_COMPLIANT"
        mfg_findings = "Missing manufacturer, packer, or importer declaration."
    elif mfg_conf < 0.60 or len(str(mfg_val).strip()) < 8:
        mfg_status = "NEEDS_REVIEW"
        mfg_findings = f"Detected address '{mfg_val}' may be incomplete or low confidence ({mfg_conf:.2f}). Officer verification recommended."
    else:
        mfg_status = "COMPLIANT"
        mfg_findings = f"Valid manufacturer/packer details: '{mfg_val}'."

    results["manufacturer"] = {
        "status": mfg_status,
        "rule_reference": "Rule 6(1)(a)",
        "rule_description": "Name and complete address of the manufacturer, packer, or importer is mandatory.",
        "act_section": "Section 36(1), Legal Metrology Act 2009",
        "findings": mfg_findings + (" (Verified via Officer Manual Override)" if mfg_ovr else ""),
        "penalty_clause": penal_clause_s36,
        "source_block_index": mfg_src.get("source_block_index"),
        "bounding_box": mfg_src.get("bounding_box"),
        "ai_value": mfg_ai,
        "effective_value": mfg_val,
        "is_overridden": mfg_ovr,
        "officer_override": mfg_ovr_meta if mfg_ovr else None,
    }

    # -------------------------------------------------------------
    # 2. Net Quantity (Rule 6(1)(c), Rule 11, Rule 12)
    # -------------------------------------------------------------
    qty_src, qty_ai, qty_val, qty_raw, qty_conf, qty_ovr, qty_ovr_meta = _get_field_data("net_quantity")

    standard_units = re.compile(r'^[0-9]+(?:\.[0-9]+)?\s*(?:g|kg|ml|l|N|m|cm|mm|sq\.\s*m|sq\.\s*cm|cu\.\s*m|cu\.\s*cm|units?)$', re.IGNORECASE)
    non_standard_units = re.compile(r'\b(?:gms|gm|kilo|liters|litres|doz|pcs|pieces)\b', re.IGNORECASE)

    if not qty_val:
        qty_status = "NON_COMPLIANT"
        qty_findings = "Missing net quantity declaration on the packaging."
    elif non_standard_units.search(str(qty_raw)):
        qty_status = "NON_COMPLIANT"
        qty_findings = f"Non-standard unit symbol detected in '{qty_raw}'. Use standard symbols (e.g. 'g' instead of 'gms')."
    elif not standard_units.match(str(qty_val).strip()):
        qty_status = "NEEDS_REVIEW"
        qty_findings = f"Quantity '{qty_val}' detected with non-conforming format. Verification recommended."
    else:
        qty_status = "COMPLIANT"
        qty_findings = f"Compliant net quantity declaration: '{qty_val}'."

    results["net_quantity"] = {
        "status": qty_status,
        "rule_reference": "Rule 6(1)(c) & Rule 11",
        "rule_description": "Net quantity declaration in standard SI units of weight, measure, or number is mandatory.",
        "act_section": "Section 36(1), Legal Metrology Act 2009",
        "findings": qty_findings + (" (Verified via Officer Manual Override)" if qty_ovr else ""),
        "penalty_clause": penal_clause_s36,
        "source_block_index": qty_src.get("source_block_index"),
        "bounding_box": qty_src.get("bounding_box"),
        "ai_value": qty_ai,
        "effective_value": qty_val,
        "is_overridden": qty_ovr,
        "officer_override": qty_ovr_meta if qty_ovr else None,
    }

    # -------------------------------------------------------------
    # 3. Maximum Retail Price (MRP) (Rule 6(1)(e))
    # -------------------------------------------------------------
    mrp_src, mrp_ai, mrp_val, mrp_raw, mrp_conf, mrp_ovr, mrp_ovr_meta = _get_field_data("mrp")
    mrp_raw_lower = str(mrp_raw).lower()

    if not mrp_val:
        mrp_status = "NON_COMPLIANT"
        mrp_findings = "Missing Maximum Retail Price (MRP) declaration."
    else:
        has_taxes_phrase = any(phrase in mrp_raw_lower for phrase in ["incl", "inclusive", "all taxes", "tax", "ird", "ind", "inc"])
        # F4 fix: If overridden, check the override value itself for tax phrasing
        # rather than blindly marking compliant
        if mrp_ovr:
            ovr_lower = str(mrp_ovr.get("value", "")).lower()
            has_taxes_phrase = has_taxes_phrase or any(
                phrase in ovr_lower for phrase in ["incl", "inclusive", "all taxes", "tax"]
            )
        if not has_taxes_phrase:
            mrp_status = "NON_COMPLIANT"
            mrp_findings = f"MRP '{mrp_val}' declared without explicit 'inclusive of all taxes' phrasing."
        else:
            mrp_status = "COMPLIANT"
            mrp_findings = f"Compliant MRP declaration: '{mrp_val}' (inclusive of all taxes)."

    results["mrp"] = {
        "status": mrp_status,
        "rule_reference": "Rule 6(1)(e)",
        "rule_description": "Maximum Retail Price (MRP) inclusive of all taxes is mandatory.",
        "act_section": "Section 36(1), Legal Metrology Act 2009",
        "findings": mrp_findings + (" (Verified via Officer Manual Override)" if mrp_ovr else ""),
        "penalty_clause": penal_clause_s36,
        "source_block_index": mrp_src.get("source_block_index"),
        "bounding_box": mrp_src.get("bounding_box"),
        "ai_value": mrp_ai,
        "effective_value": mrp_val,
        "is_overridden": mrp_ovr,
        "officer_override": mrp_ovr_meta if mrp_ovr else None,
    }

    # -------------------------------------------------------------
    # 4. Country of Origin (Rule 6(10) / Rule 6(1)(aa))
    # -------------------------------------------------------------
    org_src, org_ai, org_val, org_raw, org_conf, org_ovr, org_ovr_meta = _get_field_data("country_of_origin")

    if is_imported and not org_val:
        org_status = "NON_COMPLIANT"
        org_findings = "Imported commodity missing mandatory Country of Origin declaration."
    elif not org_val:
        org_status = "COMPLIANT"
        org_findings = "Domestic commodity; explicit country of origin declaration not strictly mandatory."
    else:
        org_status = "COMPLIANT"
        org_findings = f"Country of origin clearly declared as '{org_val}'."

    results["country_of_origin"] = {
        "status": org_status,
        "rule_reference": "Rule 6(10)",
        "rule_description": "Country of origin or manufacture is strictly mandatory for imported packages.",
        "act_section": "Section 36(1), Legal Metrology Act 2009",
        "findings": org_findings + (" (Verified via Officer Manual Override)" if org_ovr else ""),
        "penalty_clause": penal_clause_s36,
        "source_block_index": org_src.get("source_block_index"),
        "bounding_box": org_src.get("bounding_box"),
        "ai_value": org_ai,
        "effective_value": org_val,
        "is_overridden": org_ovr,
        "officer_override": org_ovr_meta if org_ovr else None,
    }

    # -------------------------------------------------------------
    # 5. Manufacture / Packaging Date (Rule 6(1)(d))
    # -------------------------------------------------------------
    date_src, date_ai, date_val, date_raw, date_conf, date_ovr, date_ovr_meta = _get_field_data("manufacture_date")

    if not date_val:
        date_status = "NON_COMPLIANT"
        date_findings = "Missing date/month and year of manufacture or packaging."
    else:
        date_status = "COMPLIANT"
        date_findings = f"Date of manufacture/packaging declared: '{date_val}'."

    results["manufacture_date"] = {
        "status": date_status,
        "rule_reference": "Rule 6(1)(d)",
        "rule_description": "Month and year of manufacture, packaging, or import is mandatory.",
        "act_section": "Section 36(1), Legal Metrology Act 2009",
        "findings": date_findings + (" (Verified via Officer Manual Override)" if date_ovr else ""),
        "penalty_clause": penal_clause_s36,
        "source_block_index": date_src.get("source_block_index"),
        "bounding_box": date_src.get("bounding_box"),
        "ai_value": date_ai,
        "effective_value": date_val,
        "is_overridden": date_ovr,
        "officer_override": date_ovr_meta if date_ovr else None,
    }

    # -------------------------------------------------------------
    # 6. Consumer Care Details (Rule 6(1)(f))
    # -------------------------------------------------------------
    care_src, care_ai, care_val, care_raw, care_conf, care_ovr, care_ovr_meta = _get_field_data("consumer_care")

    if not care_val:
        care_status = "NON_COMPLIANT"
        care_findings = "Missing consumer care helpline/contact details."
    elif care_conf < 0.60 and not care_ovr:
        care_status = "NEEDS_REVIEW"
        care_findings = f"Consumer care contact detected with low confidence ({care_conf:.2f}). Officer verification recommended."
    else:
        care_status = "COMPLIANT"
        care_findings = f"Consumer care contact details available: '{care_val}'."

    results["consumer_care"] = {
        "status": care_status,
        "rule_reference": "Rule 6(1)(f)",
        "rule_description": "Name, address, telephone number, and email address of person/cell for consumer grievances is mandatory.",
        "act_section": "Section 36(1), Legal Metrology Act 2009",
        "findings": care_findings + (" (Verified via Officer Manual Override)" if care_ovr else ""),
        "penalty_clause": penal_clause_s36,
        "source_block_index": care_src.get("source_block_index"),
        "bounding_box": care_src.get("bounding_box"),
        "ai_value": care_ai,
        "effective_value": care_val,
        "is_overridden": care_ovr,
        "officer_override": care_ovr_meta if care_ovr else None,
    }

    # -------------------------------------------------------------
    # Aggregate Summary
    # -------------------------------------------------------------
    compliant_count = sum(1 for r in results.values() if r["status"] == "COMPLIANT")
    violations_count = sum(1 for r in results.values() if r["status"] == "NON_COMPLIANT")
    review_count = sum(1 for r in results.values() if r["status"] == "NEEDS_REVIEW")
    total_fields = len(results)

    if violations_count > 0:
        overall_status = "NON_COMPLIANT"
    elif review_count > 0:
        overall_status = "NEEDS_REVIEW"
    else:
        overall_status = "COMPLIANT"

    summary = {
        "overall_status": overall_status,
        "total_fields_checked": total_fields,
        "compliant_count": compliant_count,
        "violations_count": violations_count,
        "review_count": review_count,
    }

    return {
        "compliance_summary": summary,
        "compliance_results": results,
    }
