from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

LEGAL_RULES_CORPUS: List[Dict[str, Any]] = [
    {
        "id": "RULE_6_1_A",
        "clause_ref": "Rule 6(1)(a)",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Name and Address of Manufacturer, Packer, or Importer",
        "statutory_text": (
            "Rule 6(1)(a) of the Legal Metrology (Packaged Commodities) Rules, 2011 requires every package "
            "to declare the name and complete address of the manufacturer, or where the manufacturer is not "
            "the packer, the name and address of the manufacturer and packer, and for any imported commodity, "
            "the name and address of the importer."
        ),
        "plain_language_explanation": (
            "Every consumer package must identify the entity responsible for manufacturing, packing, or importing "
            "the product with a full postal address (including city, state, and PIN code). Incomplete street or "
            "omitted country details make traceability impossible and constitute a statutory violation."
        ),
        "penalty_summary": (
            "Section 36(1) penalty: Up to ₹25,000 for first offence, up to ₹50,000 for second offence, and "
            "up to ₹1,00,000 or imprisonment up to 1 year for subsequent offences."
        ),
        "common_violations": [
            "Missing manufacturer name or physical street address",
            "Listing only a website URL without a registered physical address",
            "Missing importer declaration on foreign-origin goods",
        ],
        "keywords": [
            "manufacturer", "packer", "importer", "address", "company name", "maker",
            "premises", "factory", "origin address", "where made", "who made"
        ],
    },
    {
        "id": "RULE_6_1_B",
        "clause_ref": "Rule 6(1)(b)",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Generic or Common Name of the Commodity",
        "statutory_text": (
            "Rule 6(1)(b) of the Legal Metrology (Packaged Commodities) Rules, 2011 states that the common "
            "or generic names of the commodity contained in the package and where such package with more than "
            "one product, the name and number of each product shall be declared."
        ),
        "plain_language_explanation": (
            "The packaging must state what the product actually is in clear, generic terms (e.g. 'Biscuits', "
            "'Refined Sunflower Oil', 'Wheat Flour') and not rely solely on fancy trade names or brand logos."
        ),
        "penalty_summary": "Section 36(1) fine up to ₹25,000 for 1st offence, up to ₹50,000 for 2nd offence.",
        "common_violations": [
            "Only brand name shown without common commodity identification",
            "Combo packs missing the breakdown of contained items",
        ],
        "keywords": [
            "generic name", "common name", "commodity name", "what is this", "product name",
            "product description", "trade name"
        ],
    },
    {
        "id": "RULE_6_1_C",
        "clause_ref": "Rule 6(1)(c), Rule 11 & Rule 12",
        "act_section": "Section 36(1) & Section 36(2), Legal Metrology Act, 2009",
        "title": "Net Quantity in Standard Metric Units",
        "statutory_text": (
            "Rule 6(1)(c) read with Rules 11 and 12 mandates declaration of the net quantity in terms of standard "
            "units of weight or measure (g, kg, ml, l, m, N) or number. Non-standard symbols such as 'gms', 'gm', "
            "'kilo', 'litres', or non-metric measures are strictly prohibited."
        ),
        "plain_language_explanation": (
            "Packages must clearly display net contents using standard SI metric units (e.g. '500 g', '1 kg', '1 L'). "
            "Colloquial abbreviations like 'gms' or 'litres' are illegal. Delivering less than the declared net quantity "
            "triggers short-delivery penalties under Section 36(2)."
        ),
        "penalty_summary": (
            "Section 36(1) fine up to ₹25,000 for non-standard declaration. Section 36(2) fine up to ₹25,000 "
            "to ₹50,000 plus compounding or court action for short quantity."
        ),
        "common_violations": [
            "Using prohibited symbol 'gms' instead of 'g'",
            "Omission of metric unit symbol",
            "Delivering less quantity than marked on carton",
        ],
        "keywords": [
            "net quantity", "weight", "volume", "grams", "gms", "kg", "liters", "milliliters",
            "metric units", "short quantity", "weight check", "size"
        ],
    },
    {
        "id": "RULE_6_1_D",
        "clause_ref": "Rule 6(1)(d)",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Month and Year of Manufacture, Packing, or Import",
        "statutory_text": (
            "Rule 6(1)(d) mandates that the month and year in which the commodity is manufactured or pre-packed "
            "or imported shall be declared prominently on every package."
        ),
        "plain_language_explanation": (
            "Consumers have a statutory right to know when a packaged item was packed or manufactured. Format must "
            "clearly state MM/YYYY or Month and Year (e.g., '08/2026' or 'Aug 2026'). Obscure lot codes without "
            "explicit month/year violate this rule."
        ),
        "penalty_summary": "Section 36(1) fine up to ₹25,000 for 1st offence, up to ₹50,000 for 2nd offence.",
        "common_violations": [
            "Missing packaging date or batch without readable month/year",
            "Unclear or smeared date imprint",
            "Only expiry date given without date of manufacture",
        ],
        "keywords": [
            "manufacture date", "date of packing", "mfg date", "packed on", "expiry",
            "month and year", "freshness", "batch date", "when made"
        ],
    },
    {
        "id": "RULE_6_1_E",
        "clause_ref": "Rule 6(1)(e)",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Maximum Retail Price (MRP) Inclusive of All Taxes",
        "statutory_text": (
            "Rule 6(1)(e) requires declaration of the Maximum Retail Price (MRP) in the mandatory format: "
            "'Maximum or Max. Retail Price ₹... inclusive of all taxes' or 'MRP ₹... incl. of all taxes'. "
            "No retailer or seller shall charge any price exceeding the declared MRP."
        ),
        "plain_language_explanation": (
            "The price must always feature the Indian Rupee symbol (₹) or 'Rs.' and include the explicit qualifier "
            "'inclusive of all taxes'. Dual pricing or charging extra over the marked MRP (e.g. for cooling or delivery) "
            "is an offence under Section 36."
        ),
        "penalty_summary": (
            "Section 36(1) fine up to ₹25,000 for 1st offence, up to ₹50,000 for 2nd offence. Charging above MRP "
            "is punishable with mandatory fines and confiscation of non-compliant inventory."
        ),
        "common_violations": [
            "Missing 'inclusive of all taxes' or 'incl. of all taxes' phrase",
            "Price altered by stickering over the original printed MRP",
            "Charging above marked MRP on retail counters or e-commerce platforms",
        ],
        "keywords": [
            "mrp", "maximum retail price", "price", "taxes", "inclusive of all taxes", "overcharging",
            "stickering", "rupees", "cost", "dual mrp"
        ],
    },
    {
        "id": "RULE_6_1_F",
        "clause_ref": "Rule 6(1)(f)",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Consumer Care Details & Grievance Redressal",
        "statutory_text": (
            "Rule 6(1)(f) mandates declaration of the name, address, telephone number and e-mail address of the person "
            "or the office which can be contacted in case of consumer complaints."
        ),
        "plain_language_explanation": (
            "Consumers must have a direct channel to lodge complaints. The package must furnish at least an official "
            "email address and telephone/helpline number of the consumer care executive or redressal cell."
        ),
        "penalty_summary": "Section 36(1) fine up to ₹25,000 for 1st offence, up to ₹50,000 for 2nd offence.",
        "common_violations": [
            "Missing customer care telephone number or email",
            "Non-functional helpline or generic website link without designated redressal cell",
        ],
        "keywords": [
            "consumer care", "customer care", "complaints", "helpline", "email", "phone",
            "toll free", "grievance", "support", "contact"
        ],
    },
    {
        "id": "RULE_6_10",
        "clause_ref": "Rule 6(10) & E-Commerce Amendment Rules",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Mandatory E-Commerce Marketplace Disclosures",
        "statutory_text": (
            "Rule 6(10) of the Legal Metrology (Packaged Commodities) Rules requires all e-commerce entities to ensure "
            "that the mandatory declarations (manufacturer, country of origin, net quantity, MRP, expiry, consumer care) "
            "are displayed on the digital marketplace listing prior to purchase."
        ),
        "plain_language_explanation": (
            "Online sellers and marketplaces (Amazon, Flipkart, Blinkit, etc.) must show all mandatory declarations on "
            "the product display page. Advertising a different MRP or omitting the Country of Origin online constitutes "
            "misleading conduct under Legal Metrology and Consumer Protection regulations."
        ),
        "penalty_summary": "Notice under Legal Metrology Act + penalties under Consumer Protection (E-Commerce) Rules, 2020.",
        "common_violations": [
            "Online listing shows lower/higher MRP than actual delivered physical carton",
            "Country of Origin not stated on product web page",
            "Net quantity advertised online does not match physical delivery",
        ],
        "keywords": [
            "ecommerce", "online", "marketplace", "flipkart", "amazon", "blinkit", "listing",
            "country of origin", "digital storefront", "origin disclosure", "mismatch"
        ],
    },
    {
        "id": "RULE_7",
        "clause_ref": "Rule 7 & Table I",
        "act_section": "Section 36(1), Legal Metrology Act, 2009",
        "title": "Minimum Font Size and Height of Declarations",
        "statutory_text": (
            "Rule 7 read with Table I prescribes the minimum height of numerals and letters for declarations based on the "
            "area of the Principal Display Panel (PDP). For example, a PDP area between 100 cm² and 500 cm² mandates a "
            "minimum numeral height of 2.0 mm (or 4.0 mm for blown/embossed letters)."
        ),
        "plain_language_explanation": (
            "Declarations must be legible to the naked eye. Manufacturers cannot shrink mandatory declarations into tiny "
            "unreadable text to conceal required disclosures. Minimum height standards apply strictly according to package size."
        ),
        "penalty_summary": "Section 36(1) fine up to ₹25,000 for 1st offence.",
        "common_violations": [
            "Font height smaller than prescribed Table I millimeter threshold",
            "Numeral height on principal display panel too tiny",
        ],
        "keywords": [
            "font size", "font height", "principal display panel", "pdp", "table 1", "table i",
            "letter height", "legibility", "numeral size", "small text"
        ],
    },
    {
        "id": "SECTION_36_1",
        "clause_ref": "Section 36(1), Legal Metrology Act, 2009",
        "act_section": "Section 36(1)",
        "title": "Statutory Penalties for Manufacturing / Selling Non-Standard Packages",
        "statutory_text": (
            "Section 36(1) stipulates: Whoever manufactures, packs, imports, sells, distributes, delivers or offers or "
            "exposes for sale any pre-packaged commodity which does not conform to the declarations on the package as "
            "provided in this Act, shall be punished with fine which may extend to twenty-five thousand rupees, for the "
            "second offence, with fine which may extend to fifty thousand rupees and for the subsequent offence, with fine "
            "which may extend to one lakh rupees or with imprisonment for a term which may extend to one year or with both."
        ),
        "plain_language_explanation": (
            "Section 36(1) is the primary penal section for all packaging declaration violations. Fines start at ₹25,000 "
            "for a first offence, increase to ₹50,000 for a second offence, and escalate to ₹1,00,000 or up to 1 year imprisonment "
            "for repeat violators."
        ),
        "penalty_summary": "First offence: Up to ₹25,000; Second offence: Up to ₹50,000; Subsequent: Up to ₹1,00,000 or 1 year jail.",
        "common_violations": [
            "Any omission or alteration of mandatory declarations specified in Rule 6",
            "Habitual non-compliance across multiple inspections",
        ],
        "keywords": [
            "penalty", "fine", "section 36", "imprisonment", "repeat offense", "second offence",
            "subsequent offence", "punishment", "legal action", "compounding"
        ],
    },
    {
        "id": "SECTION_18",
        "clause_ref": "Section 18(1), Legal Metrology Act, 2009",
        "act_section": "Section 18(1)",
        "title": "General Prohibition on Non-Conforming Pre-Packaged Commodities",
        "statutory_text": (
            "Section 18(1) mandates that no person shall manufacture, pack, sell, import, distribute, deliver, offer, "
            "expose or possess for sale any pre-packaged commodity unless such package is in such standard quantities or number "
            "and bears thereon such declarations and markings in such manner as may be prescribed."
        ),
        "plain_language_explanation": (
            "Establishes the foundational statutory duty: No packaging may enter commerce in India without conforming "
            "to Legal Metrology standards and packaging declarations."
        ),
        "penalty_summary": "Enforced through penalties under Section 36(1) and seizure under Section 15.",
        "common_violations": [
            "Selling unlabelled or contraband pre-packaged commodities",
            "Commercial distribution of non-conforming goods",
        ],
        "keywords": [
            "section 18", "prohibition", "pre-packaged commodity", "standard packaging",
            "statutory mandate", "seizure", "inspection powers"
        ],
    }
]


class LegalAssistantEngine:
    def __init__(self):
        self.corpus = LEGAL_RULES_CORPUS
        # Prepare combined documents for indexing
        self.docs = [
            f"{c['title']} {c['clause_ref']} {c['statutory_text']} {c['plain_language_explanation']} {' '.join(c['keywords'])}"
            for c in self.corpus
        ]
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        self.tfidf_matrix = self.vectorizer.fit_transform(self.docs)

        # Try to initialize sentence_transformers if available
        self.dense_model = None
        try:
            from sentence_transformers import SentenceTransformer
            # Lightweight, local mini model
            self.dense_model = SentenceTransformer("all-MiniLM-L6-v2")
            self.dense_embeddings = self.dense_model.encode(self.docs, convert_to_numpy=True)
        except Exception:
            self.dense_model = None
            self.dense_embeddings = None

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        query = query.strip()
        if not query:
            return []

        scores = np.zeros(len(self.corpus))

        # 1. TF-IDF / lexical score
        q_tfidf = self.vectorizer.transform([query])
        tfidf_sims = cosine_similarity(q_tfidf, self.tfidf_matrix)[0]
        scores += 0.5 * tfidf_sims

        # 2. Dense semantic score if available
        if self.dense_model is not None and self.dense_embeddings is not None:
            try:
                q_dense = self.dense_model.encode([query], convert_to_numpy=True)
                dense_sims = cosine_similarity(q_dense, self.dense_embeddings)[0]
                scores += 0.5 * dense_sims
            except Exception:
                scores += 0.5 * tfidf_sims
        else:
            scores += 0.5 * tfidf_sims

        # Rank indices
        ranked_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in ranked_indices:
            score_val = float(scores[idx])
            clause = self.corpus[idx].copy()
            clause["relevance_score"] = round(score_val, 3)
            results.append(clause)

        return results

    def answer_query(
        self,
        question: str,
        scan_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Constructs a grounded, template-based legal reference answer.
        Never generates ungrounded free-form text.
        """
        matches = self.search(question, top_k=2)
        if not matches:
            return {
                "question": question,
                "answer": "No relevant Legal Metrology Act or Packaged Commodities rule could be matched.",
                "matched_clauses": [],
            }

        top_match = matches[0]

        # Template-based statutory response construction
        answer_parts = [
            f"**Legal Reference:** {top_match['clause_ref']} — {top_match['title']}",
            f"\n**Statutory Requirement:**\n{top_match['statutory_text']}",
            f"\n**Plain-Language Guidance for Officers:**\n{top_match['plain_language_explanation']}",
            f"\n**Penal Sanction / Consequences:**\n{top_match['penalty_summary']}",
        ]

        # Structured sections for clean, native UI cards without raw markdown
        sections = {
            "legal_reference": f"{top_match['clause_ref']} — {top_match['title']}",
            "act_section": top_match.get("act_section", ""),
            "statutory_requirement": top_match.get("statutory_text", ""),
            "officer_guidance": top_match.get("plain_language_explanation", ""),
            "penal_sanction": top_match.get("penalty_summary", ""),
            "source": "Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011",
            "source_authority": "Ministry of Consumer Affairs, Food & Public Distribution, Govt. of India",
        }

        # If a specific scan context was supplied, ground the answer in that scan's findings
        if scan_context:
            prod = scan_context.get("product_name") or "the scanned commodity"
            compliance_results = scan_context.get("compliance_results") or {}

            # Map clause to field key
            clause_to_field = {
                "RULE_6_1_A": "manufacturer",
                "RULE_6_1_B": "product_name",
                "RULE_6_1_C": "net_quantity",
                "RULE_6_1_D": "manufacture_date",
                "RULE_6_1_E": "mrp",
                "RULE_6_1_F": "consumer_care",
                "RULE_6_10": "country_of_origin",
                "RULE_7": "net_quantity",
            }
            target_field = clause_to_field.get(top_match["id"])
            if target_field and target_field in compliance_results:
                f_res = compliance_results[target_field]
                sections["inspection_finding"] = {
                    "product": prod,
                    "status": f_res.get("status"),
                    "findings": f_res.get("findings"),
                    "rule_reference": f_res.get("rule_reference"),
                }
                answer_parts.append(
                    f"\nSpecific Inspection Finding for '{prod}':\n"
                    f"Status: {f_res.get('status')}\n"
                    f"Finding: {f_res.get('findings')}\n"
                    f"Statutory Citation: {f_res.get('rule_reference')}"
                )

        final_answer = "\n".join(answer_parts)

        return {
            "question": question,
            "answer": final_answer,
            "sections": sections,
            "primary_clause": {
                "id": top_match["id"],
                "clause_ref": top_match["clause_ref"],
                "title": top_match["title"],
                "act_section": top_match["act_section"],
            },
            "matched_clauses": [
                {
                    "id": m["id"],
                    "clause_ref": m["clause_ref"],
                    "title": m["title"],
                    "relevance_score": m["relevance_score"],
                }
                for m in matches
            ],
        }


# Global singleton instance
_ENGINE: Optional[LegalAssistantEngine] = None


def get_assistant_engine() -> LegalAssistantEngine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = LegalAssistantEngine()
    return _ENGINE
