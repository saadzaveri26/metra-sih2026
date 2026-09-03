from health_guide import build_health_guide


def _block(text, confidence=0.9):
    return {"text": text, "confidence": confidence, "bounding_box": []}


def test_empty_blocks_returns_empty_shape():
    result = build_health_guide([])
    assert result["ingredients_text"] is None
    assert result["allergens"] == []
    assert result["health_flags"] == []
    assert result["nutrition_facts"] == {}
    assert "disclaimer" in result


def test_ingredients_and_allergens_extracted():
    blocks = [
        _block("Britannia Marie Gold Biscuits"),
        _block("Ingredients: Wheat Flour (Maida), Sugar, Edible Vegetable Oil (Palm Oil)"),
        _block("Milk Solids, Salt, Raising Agents, Emulsifiers, Artificial Flavour"),
        _block("MRP Rs. 30.00"),
    ]
    result = build_health_guide(blocks)
    assert "Wheat Flour" in result["ingredients_text"]
    assert "milk" in result["allergens"]
    assert "wheat / gluten" in result["allergens"]
    codes = [f["code"] for f in result["health_flags"]]
    assert "added_sugar" in codes
    assert "palm_oil" in codes
    assert "artificial_color" in codes


def test_ingredient_extraction_stops_at_nutrition_panel():
    blocks = [
        _block("Ingredients: Rice, Salt, Spices"),
        _block("Energy 100 kcal"),
        _block("Protein 2 g"),
    ]
    result = build_health_guide(blocks)
    assert "Energy" not in result["ingredients_text"]
    assert "kcal" not in result["ingredients_text"]


def test_nutrition_facts_parsed():
    blocks = [
        _block("Energy 450 kcal"),
        _block("Protein 7.5 g"),
        _block("Total Fat 14 g"),
        _block("Sugars 18 g"),
        _block("Sodium 350 mg"),
    ]
    result = build_health_guide(blocks)
    facts = result["nutrition_facts"]
    assert facts["energy_kcal"] == 450.0
    assert facts["protein_g"] == 7.5
    assert facts["total_fat_g"] == 14.0
    assert facts["total_sugar_g"] == 18.0
    assert facts["sodium_mg"] == 350.0


def test_veg_status_detected():
    blocks = [_block("Some Product"), _block("Vegetarian")]
    result = build_health_guide(blocks)
    assert result["veg_status"] == "Vegetarian"

    blocks_nonveg = [_block("Some Product"), _block("Non-Vegetarian")]
    result_nonveg = build_health_guide(blocks_nonveg)
    assert result_nonveg["veg_status"] == "Non-Vegetarian"


def test_no_ingredients_line_returns_none():
    blocks = [_block("MRP Rs. 20.00"), _block("Net Wt. 100g")]
    result = build_health_guide(blocks)
    assert result["ingredients_text"] is None
    assert result["allergens"] == []
