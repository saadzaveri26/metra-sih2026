import tempfile
from pathlib import Path

from repository import (
    dashboard_summary,
    entity_history,
    get_scan,
    persist_scan,
    search_scans,
)


def _payload(status="COMPLIANT", manufacturer="ABC FOODS PVT LTD"):
    return {
        "structured_fields": {
            "manufacturer": {"value": manufacturer},
            "net_quantity": {"value": "500 g"},
        },
        "compliance_summary": {
            "overall_status": status,
            "total_fields_checked": 6,
            "compliant_count": 6 if status == "COMPLIANT" else 3,
            "violations_count": 0 if status != "NON_COMPLIANT" else 2,
            "review_count": 1 if status == "NEEDS_REVIEW" else 0,
        },
        "compliance_results": {},
    }


def test_persist_search_and_history():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        db = Path(tmp) / "t.db"
        evid = Path(tmp) / "ev"

        a = persist_scan(
            _payload("NON_COMPLIANT"),
            product_name="Britannia Marie",
            seller_name="Kirana Mart",
            db_path=db,
            evidence_dir=evid,
        )
        persist_scan(
            _payload("COMPLIANT", manufacturer="XYZ PHARMA LTD"),
            product_name="Paracetamol 500",
            seller_name="City Medicals",
            db_path=db,
            evidence_dir=evid,
        )
        persist_scan(
            _payload("NEEDS_REVIEW"),
            product_name="Britannia Good Day",
            seller_name="Kirana Mart",
            db_path=db,
            evidence_dir=evid,
        )

        assert a["id"].startswith("INS-")
        loaded = get_scan(a["id"], db_path=db)
        assert loaded is not None
        assert loaded["seller_name"] == "Kirana Mart"
        assert loaded["payload"]["id"] == a["id"]

        by_seller = search_scans(seller="kirana", db_path=db)
        assert by_seller["total"] == 2

        by_status = search_scans(status="COMPLIANT", db_path=db)
        assert by_status["total"] == 1
        assert by_status["items"][0]["product_name"] == "Paracetamol 500"

        by_q = search_scans(q="Marie", db_path=db)
        assert by_q["total"] == 1

        hist = entity_history(seller="Kirana Mart", db_path=db)
        assert hist["entity_type"] == "seller"
        assert hist["total_scans"] == 2
        assert hist["violations_count"] == 1
        assert hist["review_count"] == 1

        dash = dashboard_summary(db_path=db)
        assert dash["scanned_today"] == 3
        assert dash["open_cases"] == 2
        assert dash["high_risk_queue"] == 1
        assert len(dash["recent"]) == 3


if __name__ == "__main__":
    test_persist_search_and_history()
    print("repository tests passed")
