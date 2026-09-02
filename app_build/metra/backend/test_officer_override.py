import tempfile
from pathlib import Path
from repository import init_db, persist_scan, get_scan, update_scan_override
from rules_engine import evaluate_compliance
from report_generator import build_pdf, build_docx


def test_officer_override_workflow():
    # Initial scan with missing net_quantity (NON_COMPLIANT)
    structured_fields = {
        "manufacturer": {
            "value": "BRITANNIA INDUSTRIES LTD",
            "confidence": 0.95,
            "raw_match": "BRITANNIA INDUSTRIES LTD",
            "source_block_index": 0,
            "bounding_box": [[10, 10], [100, 10], [100, 30], [10, 30]],
        },
        "net_quantity": {
            "value": None,
            "confidence": 0.0,
            "raw_match": None,
            "source_block_index": None,
            "bounding_box": None,
        },
        "mrp": {
            "value": "₹45.00",
            "confidence": 0.92,
            "raw_match": "MRP Rs 45.00 incl of all taxes",
            "source_block_index": 1,
            "bounding_box": [[10, 40], [100, 40], [100, 60], [10, 60]],
        },
        "country_of_origin": {
            "value": "India",
            "confidence": 0.90,
            "raw_match": "Made in India",
            "source_block_index": 2,
            "bounding_box": [[10, 70], [100, 70], [100, 90], [10, 90]],
        },
        "manufacture_date": {
            "value": "08/2026",
            "confidence": 0.91,
            "raw_match": "Mfg Date: 08/2026",
            "source_block_index": 3,
            "bounding_box": [[10, 100], [100, 100], [100, 120], [10, 120]],
        },
        "consumer_care": {
            "value": "care@britannia.co.in",
            "confidence": 0.93,
            "raw_match": "care@britannia.co.in",
            "source_block_index": 4,
            "bounding_box": [[10, 130], [100, 130], [100, 150], [10, 150]],
        },
    }

    eval_initial = evaluate_compliance(structured_fields, is_imported=False)
    assert eval_initial["compliance_summary"]["overall_status"] == "NON_COMPLIANT"
    assert eval_initial["compliance_results"]["net_quantity"]["status"] == "NON_COMPLIANT"

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_override.db"
        evidence_dir = Path(tmpdir) / "evidence"

        saved = persist_scan(
            {
                "compliance_summary": eval_initial["compliance_summary"],
                "compliance_results": eval_initial["compliance_results"],
                "structured_fields": structured_fields,
            },
            product_name="Good Day Biscuits",
            seller_name="Britannia Store",
            db_path=db_path,
            evidence_dir=evidence_dir,
        )
        scan_id = saved["id"]
        assert scan_id.startswith("INS-")

        # Officer manually overrides net_quantity to "500 g"
        updated = update_scan_override(
            scan_id,
            field="net_quantity",
            value="500 g",
            reason="Distorted label visually verified by inspecting officer",
            db_path=db_path,
        )

        assert updated is not None
        payload = updated["payload"]
        assert payload["officer_overrides"]["net_quantity"]["value"] == "500 g"
        assert payload["officer_overrides"]["net_quantity"]["original_ai_value"] is None
        assert payload["officer_overrides"]["net_quantity"]["is_authoritative"] is True
        assert "officer_override" in payload["structured_fields"]["net_quantity"]

        # Compliance status must now be COMPLIANT because net_quantity was resolved
        assert payload["compliance_summary"]["overall_status"] == "COMPLIANT"
        assert payload["compliance_results"]["net_quantity"]["status"] == "COMPLIANT"
        assert payload["compliance_results"]["net_quantity"]["is_overridden"] is True
        assert "Officer Manual Override" in payload["compliance_results"]["net_quantity"]["findings"]

        # Verify PDF and DOCX reports generate with the override
        pdf_bytes = build_pdf(payload)
        assert len(pdf_bytes) > 1000
        docx_bytes = build_docx(payload)
        assert len(docx_bytes) > 1000

    print("test_officer_override_workflow passed successfully!")


if __name__ == "__main__":
    test_officer_override_workflow()
