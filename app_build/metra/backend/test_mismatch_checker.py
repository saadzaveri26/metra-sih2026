from mismatch_checker import (
    compare_physical_vs_online,
    find_mock_listing,
    load_mock_listings,
)


def test_mock_listings_loaded():
    listings = load_mock_listings()
    assert len(listings) >= 5, f"Expected at least 5 listings, got {len(listings)}"
    print(f"Loaded {len(listings)} mock listings.")


def test_mrp_mismatch_detection():
    # Good Day Butter Cookies: Online listing has MRP 35.00, physical label has 45.00
    listing = find_mock_listing(product_name="Good Day Butter Cookies")
    assert listing is not None
    assert listing["id"] == "LIST-001"

    physical_fields = {
        "manufacturer": {"value": "Britannia Industries Ltd, Bangalore"},
        "net_quantity": {"value": "500 g"},
        "mrp": {"value": "₹45.00 (incl. of all taxes)"},
        "country_of_origin": {"value": "India"},
        "manufacture_date": {"value": "08/2026"},
        "consumer_care": {"value": "care@britannia.co.in"},
    }

    result = compare_physical_vs_online(physical_fields, listing)
    assert not result["is_concordant"]
    assert result["mismatch_count"] >= 1
    assert result["fields"]["mrp"]["status"] == "MISMATCH"
    assert "Price Discrepancy" in result["fields"]["mrp"]["details"]
    assert result["fields"]["net_quantity"]["status"] == "MATCH"
    assert result["fields"]["country_of_origin"]["status"] == "MATCH"
    print("test_mrp_mismatch_detection passed.")


def test_origin_mismatch_detection():
    # Fortune Sunlite: Online claims India, physical says imported / Ukraine
    listing = find_mock_listing(product_name="Fortune Sunlite Refined Sunflower Oil")
    assert listing is not None

    physical_fields = {
        "manufacturer": {"value": "Adani Wilmar Limited, Ahmedabad"},
        "net_quantity": {"value": "1 L"},
        "mrp": {"value": "₹165.00"},
        "country_of_origin": {"value": "Ukraine"},
        "manufacture_date": {"value": "07/2026"},
        "consumer_care": {"value": "customercare@adaniwilmar.in"},
    }

    result = compare_physical_vs_online(physical_fields, listing)
    assert not result["is_concordant"]
    assert result["fields"]["country_of_origin"]["status"] == "MISMATCH"
    assert result["fields"]["mrp"]["status"] == "MATCH"
    print("test_origin_mismatch_detection passed.")


def test_concordant_matching_product():
    # Tata Salt: Exact match
    listing = find_mock_listing(product_name="Tata Salt")
    assert listing is not None

    physical_fields = {
        "manufacturer": {"value": "Tata Consumer Products Ltd, Kolkata 700020"},
        "net_quantity": {"value": "1 kg"},
        "mrp": {"value": "₹28.00 (incl. of all taxes)"},
        "country_of_origin": {"value": "India"},
        "manufacture_date": {"value": "08/2026"},
        "consumer_care": {"value": "care@tataconsumer.com | 1800-108-4488"},
    }

    result = compare_physical_vs_online(physical_fields, listing)
    assert result["is_concordant"]
    assert result["mismatch_count"] == 0
    assert result["overall_status"] == "COMPLIANT"
    print("test_concordant_matching_product passed.")


if __name__ == "__main__":
    test_mock_listings_loaded()
    test_mrp_mismatch_detection()
    test_origin_mismatch_detection()
    test_concordant_matching_product()
    print("All mismatch checker tests passed successfully!")
