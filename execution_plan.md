# METRA — Execution Plan

SIH PS 26034: Compliance checking system for Packaged Commodities under
Legal Metrology (Packaged Commodities) Rules, 2011.

How to use this file: work through phases in order. Mark status as you go.
Two people can work in parallel once a phase branches into frontend/backend
tracks — otherwise, alternate: one person leads a phase, the other reviews.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Foundations & Skeleton App
- [x] Repo structure finalized (this file + UPDATES.txt in place)
- [x] Next.js frontend scaffolded (`app_build/metra` — Next.js 16 + Tailwind)
- [x] FastAPI backend scaffolded (`app_build/metra/backend`)
- [x] Frontend successfully calls backend `/health` endpoint
- [x] Pushed to GitHub

## Phase 2 — Image Upload + OCR Extraction
- [x] Image upload UI (drag/drop + camera capture button, Avatar states)
- [x] Backend `/scan` endpoint accepts image, runs PaddleOCR (`use_textline_orientation=True`)
- [x] Returns extracted text blocks + bounding box coordinates as JSON (`blocks[]`)
- [x] Image pre-resized to ≤1600 px before OCR for speed (40–60% faster on phone photos)
- [x] 3-step animated loading card (OCR → Structuring → Compliance Check)
- [~] Tested on real product label photos (ongoing — more test images needed)

## Phase 3 — Declaration Detection & Mapping
- [x] Defined 6 mandatory declaration fields per Rules 2011: manufacturer, net_quantity,
      mrp, country_of_origin, manufacture_date, consumer_care
- [x] `field_structuring.py` — regex + keyword classifier maps OCR blocks to fields,
      returns `{field: {value, confidence, raw_match, bounding_box}}` per image
- [x] Structured JSON output wired through `/scan` endpoint
- [x] `DeclarationsPanel` UI — shows all 6 fields with extracted value, confidence bar
      (green ≥80% / amber 55–79% / red <55%), and expandable raw OCR match text
- [x] No-box fallback: when OCR finds text but no fields matched, shows raw OCR accordion
      and "No region overlays" explanation

## Phase 4 — Rule-Based Compliance Engine
- [x] `rules_engine.py` — encodes Legal Metrology (Packaged Commodities) Rules 2011 checks
- [x] Presence check (is the field there at all) — NON_COMPLIANT if missing
- [x] Format/correctness checks:
      - MRP: requires "inclusive of all taxes" phrase (Rule 6(1)(e))
      - Net quantity: standard SI unit symbols only, e.g. g/kg/ml/l (Rule 11 & 12)
      - Manufacturer: minimum length + confidence threshold (Rule 6(1)(a))
      - Country of origin: mandatory for imported goods only (Rule 6(10))
      - Manufacture date: month/year format (Rule 6(1)(d))
      - Consumer care: phone/email presence (Rule 6(1)(f))
- [x] Output: `{status, rule_reference, rule_description, act_section, findings, penalty_clause}` per field
- [x] Overall compliance summary: COMPLIANT / NEEDS_REVIEW / NON_COMPLIANT
- [x] Rule Checklist UI with expandable penalty/findings details
- [x] Compliance Score (0–100) computed from compliant_count / total_fields

## Phase 5 — Font Size & Readability Analysis
- [ ] Measure detected text height in image (OpenCV, using bbox pixel height +
      image DPI/scale)
- [ ] Compare against rule-mandated minimum font sizes
- [ ] Flag violations separately from missing-declaration violations

## Phase 6 — Bounding Box Overlay UI
- [x] `BoundingBoxOverlay` component — SVG polygons over image using PaddleOCR bbox coords
- [x] Green = compliant, Amber = needs review, Red = non-compliant field text region
- [x] Field label rendered above each box
- [ ] **Known limitation**: boxes only appear for fields the regex engine *matched* to an
      OCR block. Missing declarations (field not found) have no image region to highlight.
      Fix in Phase 5/6 revision: highlight nearest candidate block or show edge annotation.
- [ ] Tap/hover box to see rule reference + reason (tooltip, mobile-friendly)

## Phase 7 — Compliance Report Generation
- [ ] Generate structured report per scan (all fields + statuses)
- [ ] Export as PDF
- [ ] Export as editable format (DOCX)
- [ ] Attach original photo(s) as evidence

## Phase 8 — Repository, Search & Inspection History
- [ ] Persist scans (product, seller, timestamp, result) to DB
- [ ] Search/filter past scans by product, seller, date, status
- [ ] View full inspection history for a given product/seller

## Phase 9 — Auth & Role-Based Access
- [ ] Login system (officer vs admin roles)
- [ ] Role-gated routes/actions

## Phase 10 — Dashboard
- [~] Officer dashboard UI built (scans today, open cases, risk queue) — mock data only
- [ ] Wire to real scan history (Phase 8 dependency)
- [ ] Violations-over-time view, compliance trend charts

## Phase 11 — Compliance Graph Lookup (Seller Trust Score)
- [ ] Vector DB setup (ChromaDB/FAISS)
- [ ] Seller-level aggregation of violation history
- [ ] Trust score computation + display

## Phase 12 — METRA Avatar + "Ask METRA" Chat
- [x] Avatar icon states integrated (welcome, scanning, loading, approved, warning, mismatch, closeup)
- [ ] Chat UI + backend Q&A (sentence-transformer / LLM retrieval over the rules)

## Phase 13 — Registration & Barcode Cryptographic Verifier
- [ ] Mock/integrate metrology DB registration number lookup

## Phase 14 — Citizen Reporting Mode
- [ ] Stub only — document as future work in production_artifacts/

## Phase 15 — Polish & Demo Prep
- [ ] Error states, loading states, edge cases
- [ ] Deployment (choose hosting for frontend + backend)
- [ ] Technical documentation → production_artifacts/
- [ ] Demo script + video

---

## Responsiveness
- [x] Mobile layout: bottom tab bar + top bar
- [x] Desktop layout (≥1024px): left sidebar nav with icon + label, top bar hidden

---

## Team Notes
- Update UPDATES.txt every session, however small the change.
- production_artifacts/ holds final outputs only (reports, docs, demo assets) — not source code.
- stitch_metra_compliance_enforcement_app/ is the visual reference — build app_build/ to match its design system (DESIGN.md), don't restyle from scratch.