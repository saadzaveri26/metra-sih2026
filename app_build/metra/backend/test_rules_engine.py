from field_structuring import extract_structured_fields
from rules_engine import evaluate_compliance


def test_rules_engine_compliant():
    mock_blocks = [
        {
            "text": "BRITANNIA INDUSTRIES LTD, PLOT 12 INDUSTRIAL AREA",
            "confidence": 0.96,
            "bounding_box": [[10, 10], [200, 10], [200, 30], [10, 30]]
        },
        {
            "text": "NET WT: 500 g",
            "confidence": 0.98,
            "bounding_box": [[10, 40], [100, 40], [100, 60], [10, 60]]
        },
        {
            "text": "MRP Rs. 45.00 (INCL. OF ALL TAXES)",
            "confidence": 0.95,
            "bounding_box": [[10, 70], [180, 70], [180, 90], [10, 90]]
        },
        {
            "text": "Country of Origin: India",
            "confidence": 0.92,
            "bounding_box": [[10, 100], [150, 100], [150, 120], [10, 120]]
        },
        {
            "text": "PKD: 08/2026",
            "confidence": 0.94,
            "bounding_box": [[10, 130], [90, 130], [90, 150], [10, 150]]
        },
        {
            "text": "Customer Care: care@britannia.co.in | Toll Free: 1800-425-4444",
            "confidence": 0.97,
            "bounding_box": [[10, 160], [300, 160], [300, 180], [10, 180]]
        }
    ]

    structured = extract_structured_fields(mock_blocks)
    result = evaluate_compliance(structured, is_imported=False)

    summary = result["compliance_summary"]
    results = result["compliance_results"]

    print("--- Compliant Test Case ---")
    print(f"Overall Status: {summary['overall_status']}")
    print(f"Compliant: {summary['compliant_count']}/{summary['total_fields_checked']}")
    print(f"Violations: {summary['violations_count']}")

    assert summary["overall_status"] == "COMPLIANT"
    assert summary["violations_count"] == 0
    assert summary["compliant_count"] == 6


def test_rules_engine_violations():
    # Non-standard unit ("500 gms") and missing tax phrase on MRP ("MRP 45.00")
    mock_blocks = [
        {
            "text": "ABC FOODS",
            "confidence": 0.96,
            "bounding_box": [[10, 10], [200, 10], [200, 30], [10, 30]]
        },
        {
            "text": "NET WT: 500 gms",  # Prohibited unit under Rule 11
            "confidence": 0.98,
            "bounding_box": [[10, 40], [100, 40], [100, 60], [10, 60]]
        },
        {
            "text": "MRP Rs. 45.00",  # Missing "incl. of all taxes" under Rule 6(1)(e)
            "confidence": 0.95,
            "bounding_box": [[10, 70], [180, 70], [180, 90], [10, 90]]
        },
        {
            "text": "PKD: 08/2026",
            "confidence": 0.94,
            "bounding_box": [[10, 130], [90, 130], [90, 150], [10, 150]]
        }
    ]

    structured = extract_structured_fields(mock_blocks)
    result = evaluate_compliance(structured, is_imported=True)  # Imported + missing origin

    summary = result["compliance_summary"]
    results = result["compliance_results"]

    print("\n--- Violation Test Case ---")
    print(f"Overall Status: {summary['overall_status']}")
    print(f"Violations: {summary['violations_count']}")
    
    assert summary["overall_status"] == "NON_COMPLIANT"
    assert results["net_quantity"]["status"] == "NON_COMPLIANT"
    assert results["mrp"]["status"] == "NON_COMPLIANT"
    assert results["country_of_origin"]["status"] == "NON_COMPLIANT"
    assert results["consumer_care"]["status"] == "NON_COMPLIANT"

    print("All rules engine tests passed successfully!")


if __name__ == "__main__":
    test_rules_engine_compliant()
    test_rules_engine_violations()
