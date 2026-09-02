import sys
from field_structuring import extract_structured_fields

def test_field_structuring():
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
    
    print("Testing field structuring results:")
    for k, v in structured.items():
        val_str = str(v['value']).encode('ascii', 'replace').decode('ascii')
        print(f"[{k}] => value: {val_str}, confidence: {v['confidence']}, source_index: {v['source_block_index']}")
        assert v["value"] is not None, f"Expected {k} to be detected"
        assert v["source_block_index"] is not None, f"Expected source_block_index for {k}"
        assert v["bounding_box"] is not None, f"Expected bounding_box for {k}"

    assert structured["manufacturer"]["source_block_index"] == 0
    assert structured["net_quantity"]["source_block_index"] == 1
    assert structured["mrp"]["source_block_index"] == 2
    assert structured["country_of_origin"]["source_block_index"] == 3
    assert structured["manufacture_date"]["source_block_index"] == 4
    assert structured["consumer_care"]["source_block_index"] == 5

    print("\nAll structured fields and source block links validated successfully!")

if __name__ == "__main__":
    test_field_structuring()
