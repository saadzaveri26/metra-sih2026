# METRA — Execution Plan

SIH PS 26034: Compliance checking system for Packaged Commodities under
Legal Metrology (Packaged Commodities) Rules, 2011.

How to use this file: work through phases in order. Mark status as you go.
Two people can work in parallel once a phase branches into frontend/backend
tracks — otherwise, alternate: one person leads a phase, the other reviews.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Foundations & Skeleton App
- [ ] Repo structure finalized (this file + UPDATES.txt in place)
- [ ] Next.js frontend scaffolded (`app_build/frontend`)
- [ ] FastAPI backend scaffolded (`app_build/backend`)
- [ ] Frontend successfully calls backend `/health` endpoint
- [ ] Pushed to GitHub

## Phase 2 — Image Upload + OCR Extraction
- [ ] Image upload UI (drag/drop or camera capture)
- [ ] Backend endpoint accepts image, runs PaddleOCR
- [ ] Returns extracted text blocks + bounding box coordinates as JSON
- [ ] Tested on 3–5 real product label photos

## Phase 3 — Declaration Detection & Mapping
- [ ] Define the mandatory declaration fields (MRP, net qty, mfr/packer/importer
      name & address, mfg/import date, consumer care, unit sale price, etc.)
- [ ] Classify each OCR text block into a field (regex + keyword rules to start)
- [ ] Output: structured JSON of {field: value/confidence/bbox} per scanned image

## Phase 4 — Rule-Based Compliance Engine
- [ ] Encode Legal Metrology (Packaged Commodities) Rules 2011 checks per field
- [ ] Presence check (is the field there at all)
- [ ] Format/correctness check (e.g. MRP format, date format)
- [ ] Output: pass/fail + reason per field

## Phase 5 — Font Size & Readability Analysis
- [ ] Measure detected text height in image (OpenCV, using bbox pixel height +
      image DPI/scale)
- [ ] Compare against rule-mandated minimum font sizes
- [ ] Flag violations separately from missing-declaration violations

## Phase 6 — Bounding Box Overlay UI
- [ ] Draw boxes on frontend using OCR bbox coordinates
- [ ] Green = compliant, Red = violation, Amber = needs review
- [ ] Tap/hover box to see rule reference + reason

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
- [ ] Officer dashboard (scans today, open cases, risk queue) — matches Stitch mockup
- [ ] Violations-over-time view, compliance trend charts

## Phase 11 — Compliance Graph Lookup (Seller Trust Score)
- [ ] Vector DB setup (ChromaDB/FAISS)
- [ ] Seller-level aggregation of violation history
- [ ] Trust score computation + display

## Phase 12 — METRA Avatar + "Ask METRA" Chat
- [ ] Integrate avatar icon states (welcome, scanning, warning, etc.)
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

## Team Notes
- Update UPDATES.txt every session, however small the change.
- production_artifacts/ holds final outputs only (reports, docs, demo assets) — not source code.
- stitch_metra_compliance_enforcement_app/ is the visual reference — build app_build/ to match its design system (DESIGN.md), don't restyle from scratch.