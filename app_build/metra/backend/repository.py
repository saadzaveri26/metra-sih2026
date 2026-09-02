"""SQLite inspection repository — persist, search, and entity history."""

from __future__ import annotations

import io
import json
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


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@contextmanager
def _connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
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


def get_scan(scan_id: str, db_path: Path = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with _connect(db_path) as conn:
        row = conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
    if not row:
        return None
    payload = json.loads(row["payload"])
    summary = _summary_row(row)
    return {**summary, "payload": payload}


def evidence_file(scan_id: str, db_path: Path = DEFAULT_DB_PATH) -> Optional[Path]:
    init_db(db_path)
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT evidence_path FROM scans WHERE id = ?", (scan_id,)
        ).fetchone()
    if not row or not row["evidence_path"]:
        return None
    path = Path(row["evidence_path"])
    return path if path.is_file() else None


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
