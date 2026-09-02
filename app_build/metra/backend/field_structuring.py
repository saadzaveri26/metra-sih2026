import re
from typing import Any, Dict, List, Optional


def extract_structured_fields(blocks: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Extracts Legal Metrology mandatory declaration fields from raw OCR blocks.

    Structured Fields:
    1. manufacturer: Name and address of manufacturer/packer/importer
    2. net_quantity: Net quantity declaration (weight, volume, measure, or count)
    3. mrp: Maximum Retail Price (inclusive of all taxes)
    4. country_of_origin: Country of origin / manufacture
    5. manufacture_date: Month and year (or date) of manufacture / packaging
    6. consumer_care: Consumer helpline, email, address, or contact details
    """

    fields: Dict[str, Dict[str, Any]] = {
        "manufacturer": {
            "value": None,
            "confidence": None,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
        "net_quantity": {
            "value": None,
            "confidence": None,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
        "mrp": {
            "value": None,
            "confidence": None,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
        "country_of_origin": {
            "value": None,
            "confidence": None,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
        "manufacture_date": {
            "value": None,
            "confidence": None,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
        "consumer_care": {
            "value": None,
            "confidence": None,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
    }

    if not blocks:
        return fields

    # Candidates list per field: (combined_score, value, raw_text, block_index, bbox)
    candidates: Dict[str, List[tuple]] = {k: [] for k in fields}

    # Date regex patterns
    date_strict = re.compile(
        r'(?:mfd\.?|mfg\.?|date\s*of\s*(?:mfg\.?|mfd|packaging|pkd)|pkd\.?|packed|manufactured|packaging\s*date)[\s\:\.\-]*([0-9]{1,2}[\/\-\.\s][0-9]{1,2}[\/\-\.\s][0-9]{2,4}|[0-9]{1,2}[\/\-\.][0-9]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\.\-\/]*[0-9]{2,4}|[0-9]{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{2,4})',
        re.IGNORECASE,
    )
    date_loose = re.compile(
        r'\b([0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})\b'
    )

    # Manufacturer patterns (explicitly requiring 'by/for' or corporate/address keywords to avoid confusion with PKD/MFD date lines)
    mfg_by_keywords = re.compile(
        r'(?:mfd\.?\s*by|mfg\.?\s*by|manufactured\s*by|packed\s*by|pkd\.?\s*by|marketed\s*by|mktd\.?\s*by|imported\s*by|custom\s*packaged\s*by|processor\s*by)\s*[:\s\-\.]*(.+)',
        re.IGNORECASE,
    )
    mfg_address_indicators = re.compile(
        r'(?:pvt\.?\s*ltd\.?|limited|llp|inc\.?|industries|foods|pharma|works|plot\s*no|khasra|road|street|estate|ind\.\s*area|nagar|industrial\s*area)',
        re.IGNORECASE,
    )

    # Net quantity patterns
    qty_strict = re.compile(
        r'(?:net\s*(?:qty|quantity|wt\.?|weight|vol\.?|volume|contents?)|quantity|qty|n\.\s*w\.?|volume|wt\.?)[\s\:\.\-]*([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|gm|gms|grams|l|lt|ltr|litres?|ml|millilitres?|unit|units|n|nos|pieces|pcs|count|u))\b',
        re.IGNORECASE,
    )
    qty_loose = re.compile(
        r'\b([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|gm|gms|grams|l|lt|ltr|litres?|ml|millilitres?|unit|units|n|nos|pieces|pcs|count))\b',
        re.IGNORECASE,
    )

    # MRP patterns
    mrp_strict = re.compile(
        r'(?:m\.?r\.?p\.?|max(?:imum)?\s*retail\s*price|price)[\s\:\.\-\(]*(?:incl(?:usive)?\.?\s*(?:of)?\s*all\s*taxes)?[\s\:\.\-\)]*(?:₹|rs\.?|inr)?[\s\:]*([0-9]+(?:\.[0-9]{1,2})?)',
        re.IGNORECASE,
    )
    mrp_loose = re.compile(
        r'(?:₹|rs\.?|inr)[\s\:]*([0-9]+(?:\.[0-9]{1,2})?)',
        re.IGNORECASE,
    )

    # Country of origin patterns
    origin_strict = re.compile(
        r'(?:country\s*of\s*origin|made\s*in|product\s*of|origin\s*:)[\s\:\.\-]*([a-zA-Z\s]+)',
        re.IGNORECASE,
    )
    known_countries = [
        "india", "china", "usa", "united states", "united kingdom", "uk",
        "germany", "japan", "thailand", "vietnam", "indonesia", "malaysia",
        "bangladesh", "sri lanka", "italy", "france", "taiwan", "korea"
    ]

    # Consumer care patterns
    care_strict = re.compile(
        r'(?:customer\s*care|consumer\s*care|helpline|toll[\s\-]*free|care\s*cell|feedback|queries|complaints|reach\s*us)[\s\:\.\-]*([^\n\r]+)',
        re.IGNORECASE,
    )
    email_regex = re.compile(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)')
    phone_regex = re.compile(r'(\+?91[\-\s]?[0-9]{10}|1800[\-\s]?[0-9]{3}[\-\s]?[0-9]{3,4}|[0-9]{3,5}[\-\s][0-9]{6,8}|[0-9]{10})')

    for idx, block in enumerate(blocks):
        text = str(block.get("text", "")).strip()
        ocr_conf = float(block.get("confidence", 0.8))
        bbox = block.get("bounding_box", [])

        if not text:
            continue

        # 1. Manufacture Date check (prioritize date extraction before generic text)
        date_match = date_strict.search(text)
        if date_match:
            val = date_match.group(1).strip()
            score = round(min(1.0, ocr_conf * 0.98), 3)
            candidates["manufacture_date"].append((score, val, text, idx, bbox))
        elif any(k in text.lower() for k in ["mfd", "mfg", "pkd", "packed"]) and date_loose.search(text) and not ("mfd by" in text.lower() or "mfg by" in text.lower() or "pkd by" in text.lower()):
            d_match = date_loose.search(text)
            val = d_match.group(1).strip() if d_match else text
            score = round(min(1.0, ocr_conf * 0.88), 3)
            candidates["manufacture_date"].append((score, val, text, idx, bbox))

        # 2. Manufacturer check
        mfg_match = mfg_by_keywords.search(text)
        if mfg_match:
            extracted = mfg_match.group(1).strip()
            val = extracted if len(extracted) > 2 else text
            score = round(min(1.0, ocr_conf * 0.98), 3)
            candidates["manufacturer"].append((score, val, text, idx, bbox))
        elif mfg_address_indicators.search(text) and len(text) > 8 and not date_match:
            score = round(min(1.0, ocr_conf * 0.85), 3)
            candidates["manufacturer"].append((score, text, text, idx, bbox))

        # 3. Net Quantity check
        qty_match = qty_strict.search(text)
        if qty_match:
            val = qty_match.group(1).strip()
            score = round(min(1.0, ocr_conf * 0.98), 3)
            candidates["net_quantity"].append((score, val, text, idx, bbox))
        else:
            qty_l_match = qty_loose.search(text)
            if qty_l_match and not date_strict.search(text):
                val = qty_l_match.group(1).strip()
                score = round(min(1.0, ocr_conf * 0.82), 3)
                candidates["net_quantity"].append((score, val, text, idx, bbox))

        # 4. MRP check
        mrp_match = mrp_strict.search(text)
        if mrp_match:
            val = f"₹{mrp_match.group(1).strip()}" if mrp_match.group(1) else text
            score = round(min(1.0, ocr_conf * 0.99), 3)
            candidates["mrp"].append((score, val, text, idx, bbox))
        else:
            mrp_l_match = mrp_loose.search(text)
            if mrp_l_match and not date_loose.match(text):
                val = f"₹{mrp_l_match.group(1).strip()}"
                score = round(min(1.0, ocr_conf * 0.85), 3)
                candidates["mrp"].append((score, val, text, idx, bbox))

        # 5. Country of Origin check
        origin_match = origin_strict.search(text)
        if origin_match:
            val = origin_match.group(1).strip()
            score = round(min(1.0, ocr_conf * 0.98), 3)
            candidates["country_of_origin"].append((score, val, text, idx, bbox))
        else:
            text_lower = text.lower()
            for country in known_countries:
                if f"made in {country}" in text_lower or f"product of {country}" in text_lower or f"origin: {country}" in text_lower:
                    score = round(min(1.0, ocr_conf * 0.95), 3)
                    candidates["country_of_origin"].append((score, country.title(), text, idx, bbox))
                    break

        # 6. Consumer Care check
        care_match = care_strict.search(text)
        email_match = email_regex.search(text)
        phone_match = phone_regex.search(text)

        if care_match:
            val = care_match.group(1).strip() if len(care_match.group(1).strip()) > 3 else text
            score = round(min(1.0, ocr_conf * 0.97), 3)
            candidates["consumer_care"].append((score, val, text, idx, bbox))
        elif email_match or phone_match:
            contact_parts = []
            if phone_match:
                contact_parts.append(phone_match.group(1))
            if email_match:
                contact_parts.append(email_match.group(1))
            val = ", ".join(contact_parts) if contact_parts else text
            score = round(min(1.0, ocr_conf * 0.90), 3)
            candidates["consumer_care"].append((score, val, text, idx, bbox))

    # Pick top candidate for each structured field
    for field_name, cand_list in candidates.items():
        if cand_list:
            cand_list.sort(key=lambda x: x[0], reverse=True)
            top = cand_list[0]
            fields[field_name] = {
                "value": top[1],
                "confidence": top[0],
                "raw_match": top[2],
                "source_block_index": top[3],
                "bounding_box": top[4],
            }

    return fields
