from legal_corpus import get_assistant_engine


def test_legal_retrieval_and_answer_synthesis():
    engine = get_assistant_engine()

    test_cases = [
        (
            "Why is using 'gms' illegal for net quantity declaration?",
            "RULE_6_1_C",
            "Rule 6(1)(c)",
        ),
        (
            "What does the law say about declaring MRP inclusive of all taxes?",
            "RULE_6_1_E",
            "Rule 6(1)(e)",
        ),
        (
            "Is country of origin disclosure mandatory on e-commerce marketplaces like Amazon?",
            "RULE_6_10",
            "Rule 6(10)",
        ),
        (
            "What is the prescribed minimum font size or height of numerals on packaging?",
            "RULE_7",
            "Rule 7",
        ),
        (
            "What are the fines and imprisonment terms under Section 36 for non-standard packages?",
            "SECTION_36_1",
            "Section 36(1)",
        ),
        (
            "Why must the manufacturer and packer complete postal address be declared?",
            "RULE_6_1_A",
            "Rule 6(1)(a)",
        ),
    ]

    for question, expected_id, expected_citation in test_cases:
        response = engine.answer_query(question)
        primary = response["primary_clause"]
        assert (
            primary["id"] == expected_id
        ), f"Failed for '{question}': expected {expected_id}, got {primary['id']}"
        assert (
            expected_citation in response["answer"]
        ), f"Expected citation '{expected_citation}' in response"
        assert "Legal Reference:" in response["answer"]
        assert "Statutory Requirement:" in response["answer"]
        assert "Plain-Language Guidance for Officers:" in response["answer"]
        assert "Penal Sanction / Consequences:" in response["answer"]
        print(f"PASS: '{question[:45]}...' -> {primary['id']} ({primary['clause_ref']})")

    # Test with scan context grounding
    sample_scan_context = {
        "scan_id": "INS-20260902-A1B2C3",
        "product_name": "NutriChoice Biscuits",
        "compliance_results": {
            "mrp": {
                "status": "NON_COMPLIANT",
                "findings": "Missing 'inclusive of all taxes' qualifier on retail pack.",
                "rule_reference": "Rule 6(1)(e)",
            }
        },
    }

    ctx_response = engine.answer_query(
        "Why did the MRP check fail for this scan?",
        scan_context=sample_scan_context,
    )
    assert ctx_response["primary_clause"]["id"] == "RULE_6_1_E"
    assert "NutriChoice Biscuits" in ctx_response["answer"]
    assert "Missing 'inclusive of all taxes' qualifier" in ctx_response["answer"]
    print("PASS: Scan context grounding verified.")


if __name__ == "__main__":
    test_legal_retrieval_and_answer_synthesis()
    print("All legal assistant tests passed successfully!")
