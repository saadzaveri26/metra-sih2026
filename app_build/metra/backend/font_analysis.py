"""Font size / readability checks against Legal Metrology (PC) Rules, 2011 Rule 7.

Physical millimetres are estimated from bounding-box pixel height and DPI.
EXIF DPI is used when present; otherwise a documented assumed DPI is applied so
officers can treat borderline readings as review items, not automatic fines.
"""

from __future__ import annotations

import math
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image


# Rule 7: letters on a printed principal display panel must be at least 1 mm.
LETTER_MIN_HEIGHT_MM = 1.0

# Fields whose statutory numerals (qty, price, date) are judged against Table I.
NUMERAL_FIELDS = {"net_quantity", "mrp", "manufacture_date"}

# Phone-photo fallback when EXIF has no resolution tag.
ASSUMED_DPI = 150.0

FIELD_ORDER = [
    "manufacturer",
    "net_quantity",
    "mrp",
    "country_of_origin",
    "manufacture_date",
    "consumer_care",
]


def bbox_height_px(box: Optional[List]) -> Optional[float]:
    """Average vertical-edge length of a 4-point OCR polygon (pixels)."""
    if not box or len(box) < 2:
        return None
    try:
        pts = [(float(p[0]), float(p[1])) for p in box]
    except (TypeError, ValueError, IndexError):
        return None
    if len(pts) >= 4:
        left = math.dist(pts[0], pts[3])
        right = math.dist(pts[1], pts[2])
        return (left + right) / 2.0
    ys = [p[1] for p in pts]
    return max(ys) - min(ys)


def extract_dpi(image_bytes: Optional[bytes]) -> Tuple[float, str]:
    """Return (dpi, source) where source is 'exif' or 'assumed'."""
    if image_bytes:
        try:
            img = Image.open(BytesIO(image_bytes))
            dpi = img.info.get("dpi")
            if dpi:
                x = float(dpi[0] if isinstance(dpi, (tuple, list)) else dpi)
                if x >= 36:
                    return x, "exif"
            res = img.info.get("resolution")
            if res:
                x = float(res[0] if isinstance(res, (tuple, list)) else res)
                if x >= 36:
                    return x, "exif"
        except Exception:
            pass
    return ASSUMED_DPI, "assumed"


def numeral_min_height_mm(pdp_area_cm2: float) -> float:
    """Rule 7 Table I — minimum numeral height for printed declarations."""
    if pdp_area_cm2 <= 100:
        return 1.0
    if pdp_area_cm2 <= 500:
        return 2.0
    if pdp_area_cm2 <= 2500:
        return 4.0
    return 6.0


def px_to_mm(px: float, dpi: float) -> float:
    return (px / dpi) * 25.4


def _verdict(height_mm: float, required_mm: float) -> Tuple[str, str]:
    """Font findings are separate from missing-declaration verdicts.

    DPI is often estimated, so only a large shortfall is treated as a hard
    violation; smaller shortfalls are NEEDS_REVIEW for officer confirmation.
    """
    if height_mm + 1e-6 >= required_mm:
        return (
            "COMPLIANT",
            f"Measured text height {height_mm:.2f} mm meets the {required_mm:.1f} mm minimum.",
        )
    if height_mm < required_mm * 0.5:
        return (
            "NON_COMPLIANT",
            f"Measured text height {height_mm:.2f} mm is well below the {required_mm:.1f} mm "
            "Rule 7 minimum (under 50% of required size).",
        )
    return (
        "NEEDS_REVIEW",
        f"Measured text height {height_mm:.2f} mm is below the {required_mm:.1f} mm Rule 7 "
        "minimum. Confirm physical size on the package — DPI may be estimated.",
    )


def analyze_font_sizes(
    structured_fields: Dict[str, Dict[str, Any]],
    image_width: int,
    image_height: int,
    image_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    dpi, dpi_source = extract_dpi(image_bytes)
    width_cm = (image_width / dpi) * 2.54
    height_cm = (image_height / dpi) * 2.54
    pdp_area_cm2 = round(width_cm * height_cm, 2)
    num_min = numeral_min_height_mm(pdp_area_cm2)

    fields: Dict[str, Dict[str, Any]] = {}
    violations = 0
    reviews = 0

    for name in FIELD_ORDER:
        src = structured_fields.get(name) or {}
        box = src.get("bounding_box")
        pixel_h = bbox_height_px(box)
        required = num_min if name in NUMERAL_FIELDS else LETTER_MIN_HEIGHT_MM

        if pixel_h is None or pixel_h <= 0:
            fields[name] = {
                "status": "NOT_MEASURED",
                "pixel_height": None,
                "height_mm": None,
                "min_required_mm": required,
                "rule_reference": "Rule 7, Table I",
                "findings": (
                    "No matched text region — font size not measured. "
                    "This is not a missing-declaration finding."
                ),
            }
            continue

        height_mm = round(px_to_mm(pixel_h, dpi), 2)
        status, findings = _verdict(height_mm, required)
        if status == "NON_COMPLIANT":
            violations += 1
        elif status == "NEEDS_REVIEW":
            reviews += 1

        fields[name] = {
            "status": status,
            "pixel_height": round(pixel_h, 1),
            "height_mm": height_mm,
            "min_required_mm": required,
            "rule_reference": "Rule 7, Table I",
            "findings": findings,
        }

    return {
        "dpi": round(dpi, 1),
        "dpi_source": dpi_source,
        "image_width": image_width,
        "image_height": image_height,
        "pdp_area_cm2": pdp_area_cm2,
        "numeral_min_height_mm": num_min,
        "letter_min_height_mm": LETTER_MIN_HEIGHT_MM,
        "rule_reference": "Rule 7, Table I (Legal Metrology (Packaged Commodities) Rules, 2011)",
        "rule_description": (
            "Height of letters must be at least 1 mm. Height of numerals on the "
            "principal display panel must meet Table I minima for printed declarations."
        ),
        "violations_count": violations,
        "review_count": reviews,
        "fields": fields,
    }
