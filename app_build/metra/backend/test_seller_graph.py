import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from repository import init_db, persist_scan, seller_compliance_history


def test_seller_trust_score_calculation():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_seller.db"
        evidence_dir = Path(tmpdir) / "evidence"
        init_db(db_path)

        now = datetime.now(timezone.utc)
        recent_date = (now - timedelta(days=5)).isoformat()
        old_date = (now - timedelta(days=120)).isoformat()

        # Scan 1: Violation in Rule 6(1)(c) (Net Quantity) - recent
        persist_scan(
            {
                "created_at": recent_date,
                "compliance_summary": {
                    "overall_status": "NON_COMPLIANT",
                    "total_fields_checked": 6,
                    "compliant_count": 5,
                    "violations_count": 1,
                    "review_count": 0,
                },
                "compliance_results": {
                    "net_quantity": {
                        "status": "NON_COMPLIANT",
                        "rule_reference": "Rule 6(1)(c) & Rule 11",
                        "rule_description": "Net quantity declaration in standard units is mandatory.",
                        "findings": "Missing net quantity declaration.",
                        "penalty_clause": "Section 36(1) fine up to ₹25,000",
                    }
                },
            },
            product_name="Corn Flakes",
            seller_name="Apex Retail Pvt Ltd",
            db_path=db_path,
            evidence_dir=evidence_dir,
        )

        # Scan 2: Repeat violation in Rule 6(1)(c) (Net Quantity) - also recent
        persist_scan(
            {
                "created_at": recent_date,
                "compliance_summary": {
                    "overall_status": "NON_COMPLIANT",
                    "total_fields_checked": 6,
                    "compliant_count": 4,
                    "violations_count": 2,
                    "review_count": 0,
                },
                "compliance_results": {
                    "net_quantity": {
                        "status": "NON_COMPLIANT",
                        "rule_reference": "Rule 6(1)(c) & Rule 11",
                        "rule_description": "Net quantity declaration in standard units is mandatory.",
                        "findings": "Non-standard unit 'gms' used.",
                        "penalty_clause": "Section 36(1) fine up to ₹50,000 for 2nd offence",
                    },
                    "mrp": {
                        "status": "NON_COMPLIANT",
                        "rule_reference": "Rule 6(1)(e)",
                        "rule_description": "MRP inclusive of all taxes is mandatory.",
                        "findings": "Missing inclusive of all taxes phrase.",
                        "penalty_clause": "Section 36(1) fine up to ₹25,000",
                    },
                },
            },
            product_name="Rolled Oats",
            seller_name="Apex Retail Pvt Ltd",
            db_path=db_path,
            evidence_dir=evidence_dir,
        )

        # Scan 3: Compliant scan
        persist_scan(
            {
                "created_at": old_date,
                "compliance_summary": {
                    "overall_status": "COMPLIANT",
                    "total_fields_checked": 6,
                    "compliant_count": 6,
                    "violations_count": 0,
                    "review_count": 0,
                },
                "compliance_results": {},
            },
            product_name="Honey 500g",
            seller_name="Apex Retail Pvt Ltd",
            db_path=db_path,
            evidence_dir=evidence_dir,
        )

        history = seller_compliance_history("Apex Retail Pvt Ltd", db_path=db_path)

        assert history["seller_name"] == "Apex Retail Pvt Ltd"
        assert history["total_scans"] == 3
        assert history["violations_count"] == 2
        assert history["compliant_count"] == 1
        assert history["repeat_violation_count"] == 1

        # Check repeat clause identification
        assert len(history["repeat_clauses"]) == 1
        assert history["repeat_clauses"][0]["rule_reference"] == "Rule 6(1)(c) & Rule 11"
        assert history["repeat_clauses"][0]["times_violated"] == 2

        # Check trust score deductions:
        # Base: 3 violations in recent days: 3 * 8 = 24 pts
        # Repeat: 1 repeat * 15 = 15 pts
        # Compliant credit: 1 * 4 = 4 pts
        # Raw score: 100 - 24 - 15 + 4 = 65
        assert history["trust_score"] == 65
        assert history["risk_level"] == "MODERATE_RISK"
        assert len(history["chronological_violations"]) == 3
        assert len(history["monthly_trend"]) >= 1

        print("test_seller_trust_score_calculation passed successfully!")


if __name__ == "__main__":
    test_seller_trust_score_calculation()
