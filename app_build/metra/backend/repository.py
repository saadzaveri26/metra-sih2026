"""SQLite inspection repository — persist, search, and entity history."""

from __future__ import annotations

import io
import json
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from PIL import Image as PILImage

DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_DB_PATH = DATA_DIR / "metra.db"
EVIDENCE_DIR = DATA_DIR / "evidence"

SCAN_ID_PATTERN = re.compile(r"^INS-\d{8}-[A-F0-9]{6}$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@contextmanager
def _connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                product_name TEXT NOT NULL DEFAULT '',
                seller_name TEXT NOT NULL DEFAULT '',
                is_imported INTEGER NOT NULL DEFAULT 0,
                overall_status TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                violations_count INTEGER NOT NULL DEFAULT 0,
                review_count INTEGER NOT NULL DEFAULT 0,
                compliant_count INTEGER NOT NULL DEFAULT 0,
                manufacturer TEXT,
                evidence_path TEXT,
                payload TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scans_seller ON scans(seller_name COLLATE NOCASE)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scans_product ON scans(product_name COLLATE NOCASE)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(overall_status)"
        )


def generate_scan_id(when: Optional[datetime] = None) -> str:
    when = when or datetime.now(timezone.utc)
    return f"INS-{when.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def _score(summary: Dict[str, Any]) -> int:
    total = max(int(summary.get("total_fields_checked") or 1), 1)
    return round(int(summary.get("compliant_count") or 0) / total * 100)


def save_evidence(scan_id: str, image_bytes: bytes, evidence_dir: Path = EVIDENCE_DIR) -> str:
    evidence_dir.mkdir(parents=True, exist_ok=True)
    img = PILImage.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    elif img.mode == "L":
        img = img.convert("RGB")
    w, h = img.size
    longest = max(w, h)
    if longest > 1600:
        scale = 1600 / longest
        img = img.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))),
            PILImage.Resampling.LANCZOS,
        )
    rel = f"{scan_id}.jpg"
    dest = evidence_dir / rel
    img.save(dest, format="JPEG", quality=85)
    return str(dest)


def persist_scan(
    payload: Dict[str, Any],
    *,
    product_name: str = "",
    seller_name: str = "",
    is_imported: bool = False,
    image_bytes: Optional[bytes] = None,
    db_path: Path = DEFAULT_DB_PATH,
    evidence_dir: Path = EVIDENCE_DIR,
) -> Dict[str, Any]:
    init_db(db_path)
    summary = payload.get("compliance_summary") or {}
    structured = payload.get("structured_fields") or {}
    manufacturer = ((structured.get("manufacturer") or {}).get("value")) or None
    product = (product_name or "").strip() or (manufacturer or "Unknown product")
    seller = (seller_name or "").strip() or "Unknown seller"
    scan_id = generate_scan_id()
    created_at = _now_iso()
    evidence_path = None
    if image_bytes:
        try:
            evidence_path = save_evidence(scan_id, image_bytes, evidence_dir)
        except Exception:
            evidence_path = None

    record_payload = {
        **payload,
        "id": scan_id,
        "product_name": product,
        "seller_name": seller,
        "is_imported": is_imported,
        "created_at": created_at,
    }

    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO scans (
                id, created_at, product_name, seller_name, is_imported,
                overall_status, score, violations_count, review_count,
                compliant_count, manufacturer, evidence_path, payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                scan_id,
                created_at,
                product,
                seller,
                1 if is_imported else 0,
                summary.get("overall_status") or "NEEDS_REVIEW",
                _score(summary),
                int(summary.get("violations_count") or 0),
                int(summary.get("review_count") or 0),
                int(summary.get("compliant_count") or 0),
                manufacturer,
                evidence_path,
                json.dumps(record_payload),
            ),
        )

    return get_scan(scan_id, db_path=db_path)  # type: ignore[return-value]


def _summary_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "product_name": row["product_name"],
        "seller_name": row["seller_name"],
        "is_imported": bool(row["is_imported"]),
        "overall_status": row["overall_status"],
        "score": row["score"],
        "violations_count": row["violations_count"],
        "review_count": row["review_count"],
        "compliant_count": row["compliant_count"],
        "manufacturer": row["manufacturer"],
        "has_evidence": bool(row["evidence_path"]),
    }


def search_scans(
    *,
    q: str = "",
    product: str = "",
    seller: str = "",
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    limit: int = 50,
    offset: int = 0,
    db_path: Path = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    clauses: List[str] = ["1=1"]
    params: List[Any] = []

    if q.strip():
        like = f"%{q.strip()}%"
        clauses.append(
            "(id LIKE ? OR product_name LIKE ? COLLATE NOCASE "
            "OR seller_name LIKE ? COLLATE NOCASE OR IFNULL(manufacturer,'') LIKE ? COLLATE NOCASE)"
        )
        params.extend([like, like, like, like])
    if product.strip():
        clauses.append("product_name LIKE ? COLLATE NOCASE")
        params.append(f"%{product.strip()}%")
    if seller.strip():
        clauses.append("seller_name LIKE ? COLLATE NOCASE")
        params.append(f"%{seller.strip()}%")
    if status.strip():
        clauses.append("overall_status = ?")
        params.append(status.strip().upper())
    if date_from.strip():
        clauses.append("substr(created_at, 1, 10) >= ?")
        params.append(date_from.strip()[:10])
    if date_to.strip():
        clauses.append("substr(created_at, 1, 10) <= ?")
        params.append(date_to.strip()[:10])

    where = " AND ".join(clauses)
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    with _connect(db_path) as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM scans WHERE {where}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT * FROM scans
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_summary_row(r) for r in rows],
    }


def entity_history(
    *,
    product: str = "",
    seller: str = "",
    db_path: Path = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    if not product.strip() and not seller.strip():
        raise ValueError("Provide product or seller")
    kind = "seller" if seller.strip() else "product"
    name = seller.strip() if seller.strip() else product.strip()
    result = search_scans(
        product=product if kind == "product" else "",
        seller=seller if kind == "seller" else "",
        limit=200,
        offset=0,
        db_path=db_path,
    )
    items = result["items"]
    violations = sum(1 for i in items if i["overall_status"] == "NON_COMPLIANT")
    reviews = sum(1 for i in items if i["overall_status"] == "NEEDS_REVIEW")
    compliant = sum(1 for i in items if i["overall_status"] == "COMPLIANT")
    return {
        "entity_type": kind,
        "entity_name": name,
        "total_scans": result["total"],
        "compliant_count": compliant,
        "review_count": reviews,
        "violations_count": violations,
        "items": items,
    }


def seller_compliance_history(
    seller_name: str,
    db_path: Path = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    """
    Aggregates historical inspection records per seller into an objective, auditable Trust Score.
    Uses explicit, statutory-aligned weights:
      - Base Score: 100
      - Recency multiplier:
          <=30d: 1.0, 31-90d: 0.75, 91-180d: 0.50, >180d: 0.25
      - Violation deduction: 8 pts * recency
      - Repeat clause surcharge: 15 pts * (repeat_count - 1) * max_recency (escalatory under s.36(1))
      - Review deduction: 3 pts * recency
      - Compliant scan bonus: +4 pts (capped at +20 pts)
    """
    init_db(db_path)
    seller = seller_name.strip()
    if not seller:
        raise ValueError("Seller name is required")

    now = datetime.now(timezone.utc)

    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, product_name, seller_name, overall_status, score,
                   violations_count, review_count, compliant_count, payload
            FROM scans
            WHERE seller_name = ? COLLATE NOCASE
            ORDER BY created_at ASC
            """,
            (seller,),
        ).fetchall()

    def _recency_weight(created_iso: str) -> float:
        try:
            dt = datetime.fromisoformat(created_iso.replace("Z", "+00:00"))
            days = max((now - dt).days, 0)
        except Exception:
            days = 0
        if days <= 30:
            return 1.0
        elif days <= 90:
            return 0.75
        elif days <= 180:
            return 0.50
        return 0.25

    total_scans = len(rows)
    compliant_count = sum(1 for r in rows if r["overall_status"] == "COMPLIANT")
    review_count = sum(1 for r in rows if r["overall_status"] == "NEEDS_REVIEW")
    violations_count = sum(1 for r in rows if r["overall_status"] == "NON_COMPLIANT")

    violations_list: List[Dict[str, Any]] = []
    clause_counts: Dict[str, int] = {}
    clause_max_recency: Dict[str, float] = {}
    monthly_map: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        created_at = r["created_at"]
        month_key = str(created_at)[:7]
        if month_key not in monthly_map:
            monthly_map[month_key] = {
                "month": month_key,
                "total_scans": 0,
                "violations": 0,
                "compliant": 0,
                "review": 0,
            }
        monthly_map[month_key]["total_scans"] += 1
        if r["overall_status"] == "NON_COMPLIANT":
            monthly_map[month_key]["violations"] += 1
        elif r["overall_status"] == "COMPLIANT":
            monthly_map[month_key]["compliant"] += 1
        else:
            monthly_map[month_key]["review"] += 1

        recency_w = _recency_weight(created_at)
        try:
            payload = json.loads(r["payload"])
        except Exception:
            payload = {}

        results = payload.get("compliance_results") or {}
        for field, res in results.items():
            if res.get("status") == "NON_COMPLIANT":
                clause = res.get("rule_reference") or "PCR Rule Violation"
                count_so_far = clause_counts.get(clause, 0) + 1
                clause_counts[clause] = count_so_far
                clause_max_recency[clause] = max(clause_max_recency.get(clause, 0.0), recency_w)

                violations_list.append({
                    "scan_id": r["id"],
                    "date": created_at,
                    "product_name": r["product_name"],
                    "field": field,
                    "rule_reference": clause,
                    "rule_description": res.get("rule_description", ""),
                    "findings": res.get("findings", ""),
                    "penalty_clause": res.get("penalty_clause", ""),
                    "is_repeat": count_so_far > 1,
                    "repeat_count": count_so_far,
                    "recency_weight": recency_w,
                })

    base_deductions = sum(8.0 * v["recency_weight"] for v in violations_list)
    repeat_surcharge = sum(
        15.0 * (count - 1) * clause_max_recency.get(clause, 1.0)
        for clause, count in clause_counts.items()
        if count > 1
    )
    review_deductions = sum(
        3.0 * _recency_weight(r["created_at"])
        for r in rows
        if r["overall_status"] == "NEEDS_REVIEW"
    )
    compliant_credit = min(compliant_count * 4.0, 20.0)

    raw_score = 100.0 - base_deductions - repeat_surcharge - review_deductions + compliant_credit
    trust_score = round(max(0.0, min(100.0, raw_score)))

    if trust_score >= 80:
        risk_level = "LOW_RISK"
        risk_label = "Low Risk · Trustworthy"
    elif trust_score >= 50:
        risk_level = "MODERATE_RISK"
        risk_label = "Moderate Risk · Monitoring Advised"
    else:
        risk_level = "HIGH_RISK"
        risk_label = "High Risk · Escalated Repeat Offender"

    sorted_months = [monthly_map[k] for k in sorted(monthly_map.keys())]
    chronological_violations = list(reversed(violations_list))

    repeat_clauses = [
        {"rule_reference": clause, "times_violated": count}
        for clause, count in clause_counts.items()
        if count > 1
    ]

    return {
        "seller_name": seller,
        "trust_score": trust_score,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "total_scans": total_scans,
        "compliant_count": compliant_count,
        "review_count": review_count,
        "violations_count": violations_count,
        "repeat_violation_count": sum(c - 1 for c in clause_counts.values() if c > 1),
        "repeat_clauses": repeat_clauses,
        "score_breakdown": {
            "base_score": 100,
            "base_violation_deductions": round(base_deductions, 1),
            "repeat_violation_surcharge": round(repeat_surcharge, 1),
            "review_deductions": round(review_deductions, 1),
            "compliant_credits": round(compliant_credit, 1),
        },
        "monthly_trend": sorted_months,
        "chronological_violations": chronological_violations,
    }


def get_scan(scan_id: str, db_path: Path = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    if not isinstance(scan_id, str) or not SCAN_ID_PATTERN.match(scan_id):
        return None
    init_db(db_path)
    with _connect(db_path) as conn:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
    if not row:
        return None
    payload = json.loads(row["payload"])
    summary = _summary_row(row)
    return {**summary, "payload": payload}


def evidence_file(scan_id: str, db_path: Path = DEFAULT_DB_PATH) -> Optional[Path]:
    if not isinstance(scan_id, str) or not SCAN_ID_PATTERN.match(scan_id):
        return None
    init_db(db_path)
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT evidence_path FROM scans WHERE id = ?", (scan_id,)
        ).fetchone()
    if not row or not row["evidence_path"]:
        return None
    path = Path(row["evidence_path"]).resolve()
    evidence_root = EVIDENCE_DIR.resolve()
    if path.is_file() and path.is_relative_to(evidence_root):
        return path
    return None



def dashboard_summary(db_path: Path = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _connect(db_path) as conn:
        scanned_today = conn.execute(
            "SELECT COUNT(*) FROM scans WHERE substr(created_at, 1, 10) = ?",
            (today,),
        ).fetchone()[0]
        open_cases = conn.execute(
            "SELECT COUNT(*) FROM scans WHERE overall_status IN ('NON_COMPLIANT', 'NEEDS_REVIEW')"
        ).fetchone()[0]
        high_risk = conn.execute(
            "SELECT COUNT(*) FROM scans WHERE overall_status = 'NON_COMPLIANT'"
        ).fetchone()[0]
        recent = conn.execute(
            "SELECT * FROM scans ORDER BY created_at DESC LIMIT 5"
        ).fetchall()
    return {
        "scanned_today": scanned_today,
        "open_cases": open_cases,
        "high_risk_queue": high_risk,
        "recent": [_summary_row(r) for r in recent],
    }


def list_sellers_with_risk(db_path: Path = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    """B4: Returns all sellers with aggregated risk metrics for the Risk Queue page."""
    init_db(db_path)
    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT seller_name,
                   COUNT(*) as total_scans,
                   SUM(CASE WHEN overall_status = 'NON_COMPLIANT' THEN 1 ELSE 0 END) as violations,
                   SUM(CASE WHEN overall_status = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as reviews,
                   SUM(CASE WHEN overall_status = 'COMPLIANT' THEN 1 ELSE 0 END) as compliant,
                   MAX(created_at) as last_scan
            FROM scans
            GROUP BY seller_name COLLATE NOCASE
            ORDER BY violations DESC, reviews DESC
            """
        ).fetchall()

    sellers = []
    for r in rows:
        total = max(r["total_scans"], 1)
        violations = r["violations"]
        reviews = r["reviews"]
        # Simple risk score: higher = worse
        risk_score = round(min(100, (violations * 15 + reviews * 5) / total * 10))
        if risk_score >= 60:
            risk_level = "critical"
        elif risk_score >= 30:
            risk_level = "elevated"
        else:
            risk_level = "routine"
        sellers.append({
            "seller_name": r["seller_name"],
            "total_scans": r["total_scans"],
            "violations": violations,
            "reviews": reviews,
            "compliant": r["compliant"],
            "last_scan": r["last_scan"],
            "risk_score": risk_score,
            "risk_level": risk_level,
        })
    return sellers


def update_scan_override(
    scan_id: str,
    field: str,
    value: str,
    reason: str = "",
    db_path: Path = DEFAULT_DB_PATH,
) -> Optional[Dict[str, Any]]:
    if not isinstance(scan_id, str) or not SCAN_ID_PATTERN.match(scan_id):
        return None
    init_db(db_path)
    with _connect(db_path) as conn:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload"])
        structured_fields = payload.get("structured_fields") or {}
        officer_overrides = payload.get("officer_overrides") or {}

        orig_val = (structured_fields.get(field) or {}).get("value")
        override_entry = {
            "value": value,
            "original_ai_value": orig_val,
            "updated_at": _now_iso(),
            "reason": reason or "Officer manual verification/correction",
            "is_authoritative": True,
        }
        officer_overrides[field] = override_entry
        if field in structured_fields:
            structured_fields[field]["officer_override"] = override_entry
        else:
            structured_fields[field] = {
                "value": None,
                "confidence": 1.0,
                "raw_match": None,
                "source_block_index": None,
                "bounding_box": None,
                "officer_override": override_entry,
            }

        payload["officer_overrides"] = officer_overrides
        payload["structured_fields"] = structured_fields

        # Re-run rule engine with officer overrides
        from rules_engine import evaluate_compliance
        compliance = evaluate_compliance(
            structured_fields,
            is_imported=bool(row["is_imported"]),
            officer_overrides=officer_overrides,
        )
        payload["compliance_summary"] = compliance["compliance_summary"]
        payload["compliance_results"] = compliance["compliance_results"]

        summary = compliance["compliance_summary"]
        score = _score(summary)
        conn.execute(
            """
            UPDATE scans
            SET overall_status = ?,
                score = ?,
                violations_count = ?,
                review_count = ?,
                compliant_count = ?,
                payload = ?
            WHERE id = ?
            """,
            (
                summary.get("overall_status", "NEEDS_REVIEW"),
                score,
                int(summary.get("violations_count") or 0),
                int(summary.get("review_count") or 0),
                int(summary.get("compliant_count") or 0),
                json.dumps(payload),
                scan_id,
            ),
        )

    return get_scan(scan_id, db_path=db_path)

