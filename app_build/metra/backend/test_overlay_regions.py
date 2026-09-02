from overlay_regions import build_region_overlays


def _empty_field():
    return {
        "value": None,
        "confidence": None,
        "raw_match": None,
        "source_block_index": None,
        "bounding_box": None,
    }


def test_missing_field_gets_edge_annotation():
    blocks = [
        {
            "text": "BEST BEFORE SEE PACK",
            "confidence": 0.9,
            "bounding_box": [[10, 10], [80, 10], [80, 24], [10, 24]],
        }
    ]
    structured = {
        "manufacturer": _empty_field(),
        "net_quantity": _empty_field(),
        "mrp": _empty_field(),
        "country_of_origin": _empty_field(),
        "manufacture_date": _empty_field(),
        "consumer_care": _empty_field(),
    }
    compliance = {
        k: {
            "status": "NON_COMPLIANT",
            "rule_reference": "Rule x",
            "findings": "Missing.",
            "bounding_box": None,
        }
        for k in structured
    }
    # Domestic-style origin would be COMPLIANT; keep it non-compliant here.
    overlays = build_region_overlays(blocks, structured, compliance, 400, 300)
    kinds = {o["field"]: o["kind"] for o in overlays}
    assert kinds["mrp"] in ("candidate", "missing")
    assert any(o["kind"] == "missing" for o in overlays)
    missing = next(o for o in overlays if o["field"] == "mrp" and o["kind"] in ("candidate", "missing"))
    assert missing["bounding_box"]
    assert missing["rule_reference"] == "Rule x"


def test_weak_candidate_preferred_over_edge():
    blocks = [
        {
            "text": "Rs. 99 only",
            "confidence": 0.8,
            "bounding_box": [[20, 80], [120, 80], [120, 100], [20, 100]],
        }
    ]
    structured = {k: _empty_field() for k in [
        "manufacturer", "net_quantity", "mrp", "country_of_origin",
        "manufacture_date", "consumer_care",
    ]}
    compliance = {
        "manufacturer": {"status": "NON_COMPLIANT", "rule_reference": "R", "findings": "x", "bounding_box": None},
        "net_quantity": {"status": "NON_COMPLIANT", "rule_reference": "R", "findings": "x", "bounding_box": None},
        "mrp": {"status": "NON_COMPLIANT", "rule_reference": "Rule 6(1)(e)", "findings": "Missing MRP.", "bounding_box": None},
        "country_of_origin": {"status": "COMPLIANT", "rule_reference": "R", "findings": "domestic", "bounding_box": None},
        "manufacture_date": {"status": "NON_COMPLIANT", "rule_reference": "R", "findings": "x", "bounding_box": None},
        "consumer_care": {"status": "NON_COMPLIANT", "rule_reference": "R", "findings": "x", "bounding_box": None},
    }
    overlays = build_region_overlays(blocks, structured, compliance, 400, 300)
    mrp = next(o for o in overlays if o["field"] == "mrp")
    assert mrp["kind"] == "candidate"
    assert mrp["bounding_box"] == blocks[0]["bounding_box"]
    # Compliant origin without a box must not get a missing chip.
    assert not any(o["field"] == "country_of_origin" for o in overlays)


def test_matched_field_uses_existing_box():
    box = [[5, 5], [50, 5], [50, 20], [5, 20]]
    structured = {k: _empty_field() for k in [
        "manufacturer", "net_quantity", "mrp", "country_of_origin",
        "manufacture_date", "consumer_care",
    ]}
    structured["net_quantity"] = {
        "value": "500 g",
        "confidence": 0.9,
        "raw_match": "NET 500 g",
        "source_block_index": 0,
        "bounding_box": box,
    }
    compliance = {
        k: {"status": "NON_COMPLIANT", "rule_reference": "R", "findings": "x", "bounding_box": None}
        for k in structured
    }
    compliance["net_quantity"] = {
        "status": "COMPLIANT",
        "rule_reference": "Rule 6(1)(c)",
        "findings": "ok",
        "bounding_box": box,
    }
    overlays = build_region_overlays([], structured, compliance, 200, 200)
    qty = next(o for o in overlays if o["field"] == "net_quantity")
    assert qty["kind"] == "matched"
    assert qty["bounding_box"] == box


if __name__ == "__main__":
    test_missing_field_gets_edge_annotation()
    test_weak_candidate_preferred_over_edge()
    test_matched_field_uses_existing_box()
    print("overlay region tests passed")
