"""Build image overlays for matched fields, weak nearest-candidate blocks,
and edge annotations when a mandatory declaration has no OCR region.

Missing declarations previously had nothing to draw. This module always
returns a region for NON_COMPLIANT / NEEDS_REVIEW fields.
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple

FIELD_ORDER = [
    "manufacturer",
    "net_quantity",
    "mrp",
    "country_of_origin",
    "manufacture_date",
    "consumer_care",
]

_HINTS: Dict[str, re.Pattern] = {
    "manufacturer": re.compile(
        r"(?:ltd|pvt|limited|llp|industries|foods|pharma|packer|importer|"
        r"mfg|mfd|pkd|marketed|plot|road|nagar|address)",
        re.IGNORECASE,
    ),
    "net_quantity": re.compile(
        r"(?:net|qty|wt|weight|volume|kg|\bg\b|gm|ml|\bl\b|n\.?\s*w)",
        re.IGNORECASE,
    ),
    "mrp": re.compile(r"(?:mrp|m\.r\.p|₹|rs\.?|inr|price|incl|tax)", re.IGNORECASE),
    "country_of_origin": re.compile(
        r"(?:origin|made\s*in|product\s*of|india|china|usa|import)",
        re.IGNORECASE,
    ),
    "manufacture_date": re.compile(
        r"(?:mfd|mfg|pkd|packed|date|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|"
        r"\b20[0-9]{2}\b|\b[0-9]{1,2}[/\-][0-9]{1,2})",
        re.IGNORECASE,
    ),
    "consumer_care": re.compile(
        r"(?:care|helpline|toll|email|@|1800|\+?91|feedback|complaint|phone|contact)",
        re.IGNORECASE,
    ),
}


def _centroid(box: List) -> Optional[Tuple[float, float]]:
    try:
        xs = [float(p[0]) for p in box]
        ys = [float(p[1]) for p in box]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    except (TypeError, ValueError, ZeroDivisionError, IndexError):
        return None


def _dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _edge_box(image_w: int, image_h: int, slot: int, total: int) -> List[List[float]]:
    """Synthetic chip on the right edge for fields with no OCR region."""
    w = max(float(image_w), 1.0)
    h = max(float(image_h), 1.0)
    chip_w = w * 0.28
    chip_h = min(h * 0.09, h / max(total, 1) * 0.85)
    gap = chip_h * 0.25
    x0 = w - chip_w - w * 0.02
    y0 = h * 0.04 + slot * (chip_h + gap)
    x1 = w - w * 0.02
    y1 = y0 + chip_h
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]


def _score_candidate(field: str, text: str, box: List, cluster: Optional[Tuple[float, float]]) -> float:
    pattern = _HINTS.get(field)
    if not pattern or not pattern.search(text or ""):
        return 0.0
    score = 1.0
    c = _centroid(box)
    if cluster and c:
        # Prefer leftover text near other declarations (label cluster).
        score += 1.0 / (1.0 + _dist(c, cluster) / 200.0)
    return score


def _cluster_centroid(structured_fields: Dict[str, Dict[str, Any]]) -> Optional[Tuple[float, float]]:
    points = []
    for data in structured_fields.values():
        box = data.get("bounding_box") if data else None
        c = _centroid(box) if box else None
        if c:
            points.append(c)
    if not points:
        return None
    return (
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
    )


def build_region_overlays(
    blocks: List[Dict[str, Any]],
    structured_fields: Dict[str, Dict[str, Any]],
    compliance_results: Dict[str, Dict[str, Any]],
    image_width: int,
    image_height: int,
) -> List[Dict[str, Any]]:
    used: Set[int] = set()
    for data in structured_fields.values():
        idx = data.get("source_block_index") if data else None
        if isinstance(idx, int):
            used.add(idx)

    cluster = _cluster_centroid(structured_fields)
    overlays: List[Dict[str, Any]] = []
    missing_slot = 0
    missing_total = sum(
        1
        for f in FIELD_ORDER
        if (compliance_results.get(f) or {}).get("status") in ("NON_COMPLIANT", "NEEDS_REVIEW")
        and not (structured_fields.get(f) or {}).get("bounding_box")
        and not (compliance_results.get(f) or {}).get("bounding_box")
    )

    for field in FIELD_ORDER:
        result = compliance_results.get(field) or {}
        src = structured_fields.get(field) or {}
        bbox = result.get("bounding_box") or src.get("bounding_box")
        status = result.get("status") or "NEEDS_REVIEW"
        rule_ref = result.get("rule_reference") or ""
        findings = result.get("findings") or ""

        if bbox:
            overlays.append(
                {
                    "field": field,
                    "status": status,
                    "kind": "matched",
                    "bounding_box": bbox,
                    "rule_reference": rule_ref,
                    "findings": findings,
                }
            )
            continue

        # Optional domestic origin with no text: nothing to highlight.
        if status == "COMPLIANT":
            continue

        best_i = None
        best_score = 0.0
        for i, block in enumerate(blocks):
            if i in used:
                continue
            text = str(block.get("text") or "")
            box = block.get("bounding_box")
            if not box:
                continue
            score = _score_candidate(field, text, box, cluster)
            if score > best_score:
                best_score = score
                best_i = i

        if best_i is not None:
            block = blocks[best_i]
            used.add(best_i)
            raw = str(block.get("text") or "")
            overlays.append(
                {
                    "field": field,
                    "status": status,
                    "kind": "candidate",
                    "bounding_box": block.get("bounding_box"),
                    "rule_reference": rule_ref,
                    "findings": (
                        f"Declaration not matched by the extractor. Nearest OCR candidate: '{raw}'. "
                        + findings
                    ),
                }
            )
            continue

        overlays.append(
            {
                "field": field,
                "status": status,
                "kind": "missing",
                "bounding_box": _edge_box(
                    image_width, image_height, missing_slot, max(missing_total, 1)
                ),
                "rule_reference": rule_ref,
                "findings": (
                    "No image region matched this declaration. "
                    + findings
                ),
            }
        )
        missing_slot += 1

    return overlays
