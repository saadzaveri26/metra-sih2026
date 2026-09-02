import re
from typing import Any, Dict, Optional


def evaluate_compliance(
    structured_fields: Dict[str, Dict[str, Any]],
    is_imported: bool = False
) -> Dict[str, Any]:
    """
    Evaluates extracted structured fields against Legal Metrology (Packaged Commodities) Rules, 2011.

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
                    "bounding_box": Optional[list]
                }
            }
        }
    """
    results: Dict[str, Dict[str, Any]] = {}

    penal_clause_s36 = (
        "Section 36(1), Legal Metrology Act, 2009: Fine up to ₹25,000 for 1st offence, "
        "up to ₹50,000 for 2nd offence, and up to ₹1,00,000 or imprisonment up to 1 year for subsequent offences."
    )

    # -------------------------------------------------------------
    # 1. Manufacturer / Packer / Importer Name & Address (Rule 6(1)(a))
    # -------------------------------------------------------------
    mfg = structured_fields.get("manufacturer", {})
    mfg_val = mfg.get("value")
    mfg_conf = mfg.get("confidence") or 0.0

    if not mfg_val:
        results["manufacturer"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 6(1)(a)",
            "rule_description": "Name and complete address of the manufacturer, packer, or importer is mandatory.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Missing manufacturer, packer, or importer declaration.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": mfg.get("source_block_index"),
            "bounding_box": mfg.get("bounding_box"),
        }
    elif mfg_conf < 0.60 or len(str(mfg_val).strip()) < 8:
        results["manufacturer"] = {
            "status": "NEEDS_REVIEW",
            "rule_reference": "Rule 6(1)(a)",
            "rule_description": "Name and complete address of the manufacturer, packer, or importer must be legible and complete.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Detected address '{mfg_val}' may be incomplete or low confidence ({mfg_conf:.2f}). Officer verification recommended.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": mfg.get("source_block_index"),
            "bounding_box": mfg.get("bounding_box"),
        }
    else:
        results["manufacturer"] = {
            "status": "COMPLIANT",
            "rule_reference": "Rule 6(1)(a)",
            "rule_description": "Name and complete address of the manufacturer, packer, or importer.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Valid manufacturer/packer details detected: '{mfg_val}'.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": mfg.get("source_block_index"),
            "bounding_box": mfg.get("bounding_box"),
        }

    # -------------------------------------------------------------
    # 2. Net Quantity (Rule 6(1)(c), Rule 11, Rule 12)
    # -------------------------------------------------------------
    qty = structured_fields.get("net_quantity", {})
    qty_val = qty.get("value")
    qty_raw = str(qty.get("raw_match") or "")

    standard_units = re.compile(r'^[0-9]+(?:\.[0-9]+)?\s*(?:g|kg|ml|l|N|m|cm|mm|sq\.\s*m|sq\.\s*cm|cu\.\s*m|cu\.\s*cm|units?)$', re.IGNORECASE)
    non_standard_units = re.compile(r'\b(?:gms|gm|kilo|liters|litres|doz|pcs|pieces)\b', re.IGNORECASE)

    if not qty_val:
        results["net_quantity"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 6(1)(c) & Rule 11",
            "rule_description": "Net quantity declaration in standard units of weight, measure, or number is mandatory.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Missing net quantity declaration on the packaging.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": qty.get("source_block_index"),
            "bounding_box": qty.get("bounding_box"),
        }
    elif non_standard_units.search(qty_raw):
        results["net_quantity"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 11 & Rule 12",
            "rule_description": "Net quantity must be declared using standard SI symbols (e.g., 'g', 'kg', 'ml', 'l', 'N'). Non-standard abbreviations (e.g. 'gms', 'kilos', 'litres') are prohibited.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Non-standard unit symbol detected in '{qty_raw}'. Use standard symbols (e.g. 'g' instead of 'gms').",
            "penalty_clause": penal_clause_s36,
            "source_block_index": qty.get("source_block_index"),
            "bounding_box": qty.get("bounding_box"),
        }
    elif not standard_units.match(str(qty_val).strip()):
        results["net_quantity"] = {
            "status": "NEEDS_REVIEW",
            "rule_reference": "Rule 6(1)(c)",
            "rule_description": "Net quantity declaration must clearly state number or metric measure.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Quantity '{qty_val}' detected with non-conforming format. Verification recommended.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": qty.get("source_block_index"),
            "bounding_box": qty.get("bounding_box"),
        }
    else:
        results["net_quantity"] = {
            "status": "COMPLIANT",
            "rule_reference": "Rule 6(1)(c) & Rule 11",
            "rule_description": "Net quantity declared in standard metric units or numbers.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Compliant net quantity declaration: '{qty_val}'.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": qty.get("source_block_index"),
            "bounding_box": qty.get("bounding_box"),
        }

    # -------------------------------------------------------------
    # 3. Maximum Retail Price (MRP) (Rule 6(1)(e))
    # -------------------------------------------------------------
    mrp = structured_fields.get("mrp", {})
    mrp_val = mrp.get("value")
    mrp_raw = str(mrp.get("raw_match") or "").lower()

    if not mrp_val:
        results["mrp"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 6(1)(e)",
            "rule_description": "Maximum Retail Price (MRP) inclusive of all taxes is mandatory.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Missing Maximum Retail Price (MRP) declaration.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": mrp.get("source_block_index"),
            "bounding_box": mrp.get("bounding_box"),
        }
    else:
        has_taxes_phrase = any(phrase in mrp_raw for phrase in ["incl", "inclusive", "all taxes", "tax"])
        if not has_taxes_phrase:
            results["mrp"] = {
                "status": "NON_COMPLIANT",
                "rule_reference": "Rule 6(1)(e)",
                "rule_description": "MRP must be declared with unambiguous 'inclusive of all taxes' or 'incl. of all taxes' statement.",
                "act_section": "Section 36(1), Legal Metrology Act 2009",
                "findings": f"MRP '{mrp_val}' declared without explicit 'inclusive of all taxes' phrasing.",
                "penalty_clause": penal_clause_s36,
                "source_block_index": mrp.get("source_block_index"),
                "bounding_box": mrp.get("bounding_box"),
            }
        else:
            results["mrp"] = {
                "status": "COMPLIANT",
                "rule_reference": "Rule 6(1)(e)",
                "rule_description": "Maximum Retail Price declared with statutory tax inclusion statement.",
                "act_section": "Section 36(1), Legal Metrology Act 2009",
                "findings": f"Compliant MRP declaration: '{mrp_val}' (inclusive of all taxes).",
                "penalty_clause": penal_clause_s36,
                "source_block_index": mrp.get("source_block_index"),
                "bounding_box": mrp.get("bounding_box"),
            }

    # -------------------------------------------------------------
    # 4. Country of Origin (Rule 6(10) / Rule 6(1)(aa))
    # -------------------------------------------------------------
    origin = structured_fields.get("country_of_origin", {})
    origin_val = origin.get("value")

    if is_imported and not origin_val:
        results["country_of_origin"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 6(10)",
            "rule_description": "Country of origin or manufacture is strictly mandatory for imported packages.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Imported commodity missing mandatory Country of Origin declaration.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": origin.get("source_block_index"),
            "bounding_box": origin.get("bounding_box"),
        }
    elif not origin_val:
        # For domestic goods, origin declaration is optional or implicit if manufacturer address is in India
        results["country_of_origin"] = {
            "status": "COMPLIANT",
            "rule_reference": "Rule 6(1)(aa) & Rule 6(10)",
            "rule_description": "Country of origin declaration (mandatory for imports, optional/implicit for domestic goods).",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Domestic commodity; explicit country of origin declaration not strictly mandatory.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": origin.get("source_block_index"),
            "bounding_box": origin.get("bounding_box"),
        }
    else:
        results["country_of_origin"] = {
            "status": "COMPLIANT",
            "rule_reference": "Rule 6(10)",
            "rule_description": "Country of origin or manufacture declared.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Country of origin clearly declared as '{origin_val}'.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": origin.get("source_block_index"),
            "bounding_box": origin.get("bounding_box"),
        }

    # -------------------------------------------------------------
    # 5. Manufacture / Packaging Date (Rule 6(1)(d))
    # -------------------------------------------------------------
    mfg_date = structured_fields.get("manufacture_date", {})
    mfg_date_val = mfg_date.get("value")

    if not mfg_date_val:
        results["manufacture_date"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 6(1)(d)",
            "rule_description": "Month and year of manufacture, packaging, or import is mandatory.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Missing date/month and year of manufacture or packaging.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": mfg_date.get("source_block_index"),
            "bounding_box": mfg_date.get("bounding_box"),
        }
    else:
        results["manufacture_date"] = {
            "status": "COMPLIANT",
            "rule_reference": "Rule 6(1)(d)",
            "rule_description": "Month and year of manufacture, packaging, or import declared.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Date of manufacture/packaging declared: '{mfg_date_val}'.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": mfg_date.get("source_block_index"),
            "bounding_box": mfg_date.get("bounding_box"),
        }

    # -------------------------------------------------------------
    # 6. Consumer Care Details (Rule 6(1)(f))
    # -------------------------------------------------------------
    care = structured_fields.get("consumer_care", {})
    care_val = care.get("value")
    care_conf = care.get("confidence") or 0.0

    if not care_val:
        results["consumer_care"] = {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule 6(1)(f)",
            "rule_description": "Name, address, telephone number, and email address of person/cell for consumer grievances is mandatory.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": "Missing consumer care helpline/contact details.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": care.get("source_block_index"),
            "bounding_box": care.get("bounding_box"),
        }
    elif care_conf < 0.60:
        results["consumer_care"] = {
            "status": "NEEDS_REVIEW",
            "rule_reference": "Rule 6(1)(f)",
            "rule_description": "Consumer care details must be legible and accessible.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Consumer care contact detected with low confidence ({care_conf:.2f}). Officer verification recommended.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": care.get("source_block_index"),
            "bounding_box": care.get("bounding_box"),
        }
    else:
        results["consumer_care"] = {
            "status": "COMPLIANT",
            "rule_reference": "Rule 6(1)(f)",
            "rule_description": "Consumer care helpline/email/address declared.",
            "act_section": "Section 36(1), Legal Metrology Act 2009",
            "findings": f"Consumer care contact details available: '{care_val}'.",
            "penalty_clause": penal_clause_s36,
            "source_block_index": care.get("source_block_index"),
            "bounding_box": care.get("bounding_box"),
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
