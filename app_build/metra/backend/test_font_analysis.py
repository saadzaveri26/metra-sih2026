from font_analysis import analyze_font_sizes, numeral_min_height_mm, px_to_mm


def test_table_i_thresholds():
    assert numeral_min_height_mm(80) == 1.0
    assert numeral_min_height_mm(100) == 1.0
    assert numeral_min_height_mm(250) == 2.0
    assert numeral_min_height_mm(1200) == 4.0
    assert numeral_min_height_mm(3000) == 6.0


def test_font_compliant_and_separate_from_missing():
    # 20 px at 150 DPI ≈ 3.39 mm — above 1 mm letter min and 2 mm numeral min
    # for a ~11.3 x 16.9 cm frame (≈191 cm² → 2 mm numerals).
    structured = {
        "manufacturer": {
            "value": "ABC FOODS PVT LTD",
            "bounding_box": [[10, 10], [200, 10], [200, 30], [10, 30]],
        },
        "net_quantity": {
            "value": "500 g",
            "bounding_box": [[10, 40], [100, 40], [100, 60], [10, 60]],
        },
        "mrp": {
            "value": "₹45",
            "bounding_box": [[10, 70], [180, 70], [180, 90], [10, 90]],
        },
        "country_of_origin": {"value": None, "bounding_box": None},
        "manufacture_date": {
            "value": "08/2026",
            "bounding_box": [[10, 130], [90, 130], [90, 150], [10, 150]],
        },
        "consumer_care": {"value": None, "bounding_box": None},
    }

    result = analyze_font_sizes(structured, image_width=800, image_height=1200)
    assert result["dpi_source"] == "assumed"
    assert result["fields"]["net_quantity"]["status"] == "COMPLIANT"
    assert result["fields"]["manufacturer"]["status"] == "COMPLIANT"
    # Missing declarations are NOT_MEASURED, not a font violation.
    assert result["fields"]["consumer_care"]["status"] == "NOT_MEASURED"
    assert result["fields"]["country_of_origin"]["status"] == "NOT_MEASURED"
    assert result["violations_count"] == 0


def test_font_too_small_is_flagged():
    # 4 px at 150 DPI ≈ 0.68 mm — under 50% of 2 mm numeral minimum.
    structured = {
        "manufacturer": {"value": None, "bounding_box": None},
        "net_quantity": {
            "value": "500 g",
            "bounding_box": [[10, 40], [80, 40], [80, 44], [10, 44]],
        },
        "mrp": {"value": None, "bounding_box": None},
        "country_of_origin": {"value": None, "bounding_box": None},
        "manufacture_date": {"value": None, "bounding_box": None},
        "consumer_care": {"value": None, "bounding_box": None},
    }
    result = analyze_font_sizes(structured, image_width=800, image_height=1200)
    qty = result["fields"]["net_quantity"]
    assert qty["height_mm"] < qty["min_required_mm"] * 0.5
    assert qty["status"] == "NON_COMPLIANT"
    assert result["violations_count"] == 1
    assert result["fields"]["mrp"]["status"] == "NOT_MEASURED"


def test_px_to_mm():
    assert abs(px_to_mm(150, 150) - 25.4) < 0.01


if __name__ == "__main__":
    test_table_i_thresholds()
    test_font_compliant_and_separate_from_missing()
    test_font_too_small_is_flagged()
    test_px_to_mm()
    print("font analysis tests passed")
