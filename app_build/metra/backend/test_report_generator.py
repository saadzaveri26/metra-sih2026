from report_generator import build_docx, build_pdf


def _scan():
    return {
        "compliance_summary": {
            "overall_status": "NON_COMPLIANT",
            "total_fields_checked": 6,
            "compliant_count": 4,
            "violations_count": 2,
            "review_count": 0,
        },
        "structured_fields": {
            "manufacturer": {"value": "ABC FOODS PVT LTD"},
            "net_quantity": {"value": "500 g"},
            "mrp": {"value": None},
            "country_of_origin": {"value": "India"},
            "manufacture_date": {"value": "08/2026"},
            "consumer_care": {"value": None},
        },
        "compliance_results": {
            "manufacturer": {
                "status": "COMPLIANT",
                "rule_reference": "Rule 6(1)(a)",
                "findings": "ok",
            },
            "net_quantity": {
                "status": "COMPLIANT",
                "rule_reference": "Rule 6(1)(c)",
                "findings": "ok",
            },
            "mrp": {
                "status": "NON_COMPLIANT",
                "rule_reference": "Rule 6(1)(e)",
                "findings": "Missing MRP.",
            },
            "country_of_origin": {
                "status": "COMPLIANT",
                "rule_reference": "Rule 6(10)",
                "findings": "ok",
            },
            "manufacture_date": {
                "status": "COMPLIANT",
                "rule_reference": "Rule 6(1)(d)",
                "findings": "ok",
            },
            "consumer_care": {
                "status": "NON_COMPLIANT",
                "rule_reference": "Rule 6(1)(f)",
                "findings": "Missing care.",
            },
        },
        "font_analysis": {
            "dpi": 150,
            "dpi_source": "assumed",
            "violations_count": 0,
            "review_count": 0,
            "rule_description": "Rule 7 Table I",
            "fields": {
                "net_quantity": {
                    "status": "COMPLIANT",
                    "height_mm": 3.2,
                    "min_required_mm": 2.0,
                    "findings": "ok",
                }
            },
        },
    }


def test_pdf_and_docx_bytes():
    scan = _scan()
    pdf = build_pdf(scan)
    docx = build_docx(scan)
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 500
    assert docx[:2] == b"PK"
    assert len(docx) > 500


if __name__ == "__main__":
    test_pdf_and_docx_bytes()
    print("report generator tests passed")
