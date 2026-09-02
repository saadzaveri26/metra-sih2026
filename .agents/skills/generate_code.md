# Skill: generate_code

## Purpose
Implement a feature exactly as defined in its spec in `production_artifacts/Technical_Specification.md`.

## Process
1. Locate the relevant spec section. If none exists, stop and request the Spec Agent run `write_specs` first.
2. Backend work goes in `app_build/metra/backend/main.py` (or a new module under `backend/` if the file is getting long — e.g. `backend/rules_engine.py`, `backend/scoring.py`). Follow the existing pattern already in `main.py`: FastAPI route, CORS already configured, model loaded once at module level (see how `ocr = PaddleOCR(...)` is loaded outside any route — new heavy models/resources follow the same pattern).
3. Frontend work goes in `app_build/metra/src/`:
   - Screens/pages → `src/app/`
   - Reusable UI → `src/components/`
   - API clients/utilities → `src/lib/`
4. If the feature is UI-facing, locate the matching image in `ui_design/stitch_exports/` and match layout, spacing, and color values from it exactly.
5. Any CPU-heavy synchronous call in a FastAPI async route (OCR inference, embedding search) must be wrapped in `run_in_threadpool` — see the fix already applied to `/scan` as the reference pattern.
6. Add basic error handling for invalid/undecodable input — see the `if img is None: raise HTTPException(...)` pattern already in `/scan` as the reference.
7. No placeholder logic left in production paths unless the spec explicitly says a feature is mocked (barcode/LMPC lookup and online-listing comparison are intentionally mocked per project scope).
8. After writing, list every file created or modified.

## Rules
- Never modify `production_artifacts/Technical_Specification.md` from this skill.
- Never silently expand a feature beyond its spec's stated scope.
- Match existing conventions already in `main.py` and the Next.js scaffold rather than introducing new patterns.
