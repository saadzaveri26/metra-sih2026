# Workflow: startcycle

## Purpose
The standard cycle for building or modifying one feature of METRA, start to finish.

## Steps
1. **Spec Agent** runs `write_specs`. Output: new section in `production_artifacts/Technical_Specification.md`.
2. If UI-facing: **Frontend Design Agent** runs `design_frontend` using `ui_design/stitch_exports/`.
3. **Backend Agent** (editing `app_build/metra/backend/main.py`) and/or **Frontend Agent** (editing `app_build/metra/src/`) run `generate_code`.
4. **Code Auditor Agent** runs `audit_code`. If issues found, return to step 3 with the specific issues listed.
5. Once audit passes: **Deployment Agent** runs `deploy_app` for a local check. Only run `deploy_cloud_run` before an actual demo/judging checkpoint.

## Current state (update this section as the project progresses)
- Backend: `/health`, `/scan` (PaddleOCR + Field Structuring + Compliance Engine + Font Analysis + Overlay Regions), `/compliance/check`, `/scans/{scan_id}/override`, `/report/pdf`, `/report/docx`, `/scans`, `/scans/history`, `/scans/{scan_id}/evidence`, `/dashboard/summary`, `/sellers/{entity_name}/history`, `/mock-listings`, `/scans/{scan_id}/compare-listing`, and `/assistant/ask` are operational in `app_build/metra/backend/main.py`.
- Security & Performance Hardened: EXIF orientation normalized, OCR latency optimized (1.5-2.5s with mkldnn + fast score mode), upload caps (15MB) enforced, path traversal protections active, SQLite WAL concurrency enabled.
- UI Polish & Ergonomics (Phase B): Synchronized field-to-box pan/zoom with visual emphasis, Officer Manual Override with persistent non-destructive audit trail and real-time rule re-evaluation, and in-app statutory PDF report preview modal before downloading.
- Advanced Intelligence & Modules (Phase C):
  * C1: Seller Compliance Graph & Trust Score with statutory penalty escalation weights, recency decay, monthly timeline series, and dedicated profile view at `/sellers/[name]`.
  * C2: Online vs. Physical Mismatch Check with pre-built mock e-commerce listings (`mock_listings.json`), cross-verification engine (`mismatch_checker.py`), and side-by-side diagnostic modal (`MismatchComparisonModal.tsx`).
  * C3: "Ask METRA" Statutory Legal Reference Assistant with grounded semantic retrieval (`legal_corpus.py`), template-based answers over PCR 2011 & Legal Metrology Act 2009, scan-context integration, and "Ask METRA about this" affordance on the Scan page.
- Frontend: Next.js app with Dashboard (`/`), Scan Diagnostic Lens (`/scan`), Inspection History (`/history`), Risk Queue (`/risk-queue`), Assistant (`/assistant`), and Seller Profile (`/sellers/[name]`).

## Ground rules for this project
- METRA is a decision-support tool — never build automated-penalty logic; the officer always makes the final call.
- Barcode/LMPC lookup and the online-vs-physical comparison use local/mock data only.
- Match `ui_design/stitch_exports/` visual language exactly — navy/white/gold, restrained, government-tool aesthetic.
