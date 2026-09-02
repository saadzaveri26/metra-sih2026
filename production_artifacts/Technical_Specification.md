# METRA Technical Specification

## System Architecture Overview
METRA (Legal Metrology Compliance & Enforcement Platform) provides an AI-assisted decision-support pipeline for Legal Metrology officers. The backend processes product packaging scans and extracts mandatory declarations as per the Legal Metrology (Packaged Commodities) Rules.

---

### Feature: Field Structuring
**Purpose:** Map raw OCR text blocks extracted from product packaging into structured Legal Metrology declaration fields using pattern matching and positional/text heuristics.

**Inputs:**
- Raw OCR text blocks from `/scan` (list of objects with `text`, `confidence`, `bounding_box`).

**Outputs:**
- `blocks`: Original list of extracted OCR text blocks with bounding boxes and confidence scores (preserved as-is).
- `structured_fields`: An object mapping mandatory declaration keys to extracted/parsed values, source linkage, and detection metadata:
  - `manufacturer`: `{"value": Optional[str], "confidence": Optional[float], "raw_match": Optional[str], "source_block_index": Optional[int], "bounding_box": Optional[list]}` (detected via keywords like "Mfg by", "Manufactured by", "Pkd by", address patterns)
  - `net_quantity`: `{"value": Optional[str], "confidence": Optional[float], "raw_match": Optional[str], "source_block_index": Optional[int], "bounding_box": Optional[list]}` (detected via units like `g`, `kg`, `ml`, `l`, `N`, `units`, `Net Qty`, `Net Weight`, `Net Contents`)
  - `mrp`: `{"value": Optional[str], "confidence": Optional[float], "raw_match": Optional[str], "source_block_index": Optional[int], "bounding_box": Optional[list]}` (detected via currency symbols `₹`, `Rs`, `INR`, `MRP` prefixes, incl. of all taxes)
  - `country_of_origin`: `{"value": Optional[str], "confidence": Optional[float], "raw_match": Optional[str], "source_block_index": Optional[int], "bounding_box": Optional[list]}` (detected via "Made in", "Country of Origin", "Origin:", "Product of")
  - `manufacture_date`: `{"value": Optional[str], "confidence": Optional[float], "raw_match": Optional[str], "source_block_index": Optional[int], "bounding_box": Optional[list]}` (detected via "Mfg Date", "PKD", "Date of Mfg", date formats DD/MM/YYYY, MM/YYYY, etc.)
  - `consumer_care`: `{"value": Optional[str], "confidence": Optional[float], "raw_match": Optional[str], "source_block_index": Optional[int], "bounding_box": Optional[list]}` (detected via "Customer Care", "Email", "Helpline", phone numbers, email regex)

**Confidence Definition:**
The `confidence` score for each structured field is a combined score reflecting both the raw OCR confidence of the matched text block and the pattern match strength (e.g., exact keyword match vs. fuzzy/heuristic match), capped between 0.0 and 1.0.

**Endpoint (if backend):**
- `POST /scan`
  - Consumes: Multipart form upload (`file: UploadFile`)
  - Produces: JSON response with schema containing `blocks` and `structured_fields`.

**UI reference (if frontend):** N/A (Backend feature; UI integration will be covered in Scan Product screen spec).

**Data model changes:**
- Augmented response schema for `POST /scan` adding `structured_fields` dictionary containing the 6 declaration keys with `source_block_index` and `bounding_box` references without mutating or deleting `blocks`.

**Out of scope:**
- Compliance validation against Legal Metrology Rules (PCR) or penalty calculation (handled in Compliance Matrix / Rule Engine step).
- Category-specific field requirements (e.g., `country_of_origin` only mandatory for imported commodities) are not evaluated here and are deferred to the Rule Check step.
- Multi-image aggregation or barcode/LMPC online registry cross-verification.
- Frontend rendering of the structured fields.

---

### Feature: Rule-Based Compliance Engine & Legal Matrix Lookup
**Purpose:** Evaluate structured packaging declaration fields against Legal Metrology (Packaged Commodities) Rules, 2011, producing per-field compliance verdicts, statutory citations, and an overall scan compliance summary.

**Inputs:**
- `structured_fields`: Structured declaration dictionary produced by `/scan` containing `manufacturer`, `net_quantity`, `mrp`, `country_of_origin`, `manufacture_date`, and `consumer_care`.
- Optional metadata: `is_imported: bool = False` (defaults to False; if True, `country_of_origin` becomes strictly mandatory under Rule 6(10)).

**Outputs:**
- `compliance_summary`:
  - `overall_status`: `"COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW"`
  - `total_fields_checked`: `int`
  - `compliant_count`: `int`
  - `violations_count`: `int`
  - `review_count`: `int`
- `compliance_results`: Object keyed by field name (`manufacturer`, `net_quantity`, `mrp`, `country_of_origin`, `manufacture_date`, `consumer_care`), each containing:
  - `status`: `"COMPLIANT" | "NON_COMPLIANT" | "NEEDS_REVIEW"`
  - `rule_reference`: e.g. `"Rule 6(1)(a)"`, `"Rule 6(1)(c)"`, `"Rule 6(1)(e)"`, `"Rule 6(1)(d)"`, `"Rule 6(1)(f)"`, `"Rule 6(10)"`
  - `rule_description`: Statutory requirement explanation from PCR 2011.
  - `act_section`: Statutory penalty/offence section under Legal Metrology Act, 2009 (e.g. `"Section 36(1), Legal Metrology Act 2009"`).
  - `findings`: Clear plain-language explanation of compliance or specific violation rationale.
  - `penalty_clause`: Statutory fine/penalty range for officer decision support.
  - `source_block_index`: `Optional[int]` (inherited from structured field).
  - `bounding_box`: `Optional[list]` (inherited from structured field for frontend UI overlay).

**Endpoint (if backend):**
- `POST /scan` (augmented response)
  - Schema includes `blocks`, `structured_fields`, `compliance_summary`, and `compliance_results`.
- `POST /compliance/check`
  - Consumes: JSON `{"structured_fields": {...}, "is_imported": false}`
  - Produces: JSON `{"compliance_summary": {...}, "compliance_results": {...}}`

**UI reference (if frontend):** N/A (Backend feature; UI integration will be covered in Scan Result / Compliance Result screens).

**Data model changes:**
- Adds `compliance_summary` and `compliance_results` to the `/scan` JSON response body alongside `blocks` and `structured_fields`.

**Out of scope:**
- Automated enforcement or automatic penalty issuance (officer discretion is always required).
- Font size physical measurement (handled separately in Font Size & Readability Analysis).
- Direct multi-channel ecommerce scraper / live price comparison (handled in mismatch check).

---

### Feature: Scan Product & Compliance Check Results UI Screen
**Purpose:** Provide an interactive officer interface to upload packaging label images, view dynamic bounding-box overlays color-coded by compliance status, inspect rule-by-rule statutory citations, and trigger decision-support actions.

**Inputs:**
- Image file upload (drag & drop, file selection, or sample presets).
- Optional `is_imported` commodity toggle.
- Backend API response from `POST /scan` (`blocks`, `structured_fields`, `compliance_summary`, `compliance_results`).

**Outputs:**
- Dynamic split-view interface:
  - **Left Pane (Image Analysis & Bounding Box Canvas):**
    - High-resolution scanned label rendering.
    - Interactive SVG/Canvas/CSS bounding box overlay color-coded:
      - Green (`#1B9E77`): `COMPLIANT`
      - Red (`#D64545`): `NON_COMPLIANT`
      - Amber (`#C9A227`): `NEEDS_REVIEW`
    - Legend for compliance indicators.
    - Synchronized highlight when hovering/clicking checklist items.
  - **Right Pane (Compliance Matrix & Officer Actions):**
    - **Compliance Score Ring:** Visual score gauge ($0 - 100$) reflecting compliant declaration percentage.
    - **Rule Checklist Accordion:** Expandable cards for each mandatory declaration field displaying status badges, statutory PCR 2011 rule references, Legal Metrology Act sections, findings, and penalty clauses.
    - **Action Bar:** "Ask METRA" (launches assistant drawer/route) and "Create Case" (enforcement notice / inspection case drafting).

**Endpoint (if backend):** `POST http://localhost:8000/scan`

**UI reference (if frontend):** `stitch_metra_compliance_enforcement_app/compliance_check_results/` (`code.html` and `screen.png`).

**Data model changes:**
- Frontend state management for active scan result, selected field highlight, upload progress, and import status flag.

**Out of scope:**
- Full backend case database schema persistence (stubbed until Phase 8).
- Font size OpenCV measurement overlay (Phase 5).
