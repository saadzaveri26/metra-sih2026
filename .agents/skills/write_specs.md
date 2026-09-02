# Skill: write_specs

## Purpose
Convert a feature request for METRA into a precise, implementable technical specification. No code is written under this skill — only the spec.

## Process
1. Read `production_artifacts/Technical_Specification.md` if it exists, to stay consistent with prior decisions.
2. Identify: what data does this feature read/write, which existing file in `app_build/metra/src/` or `app_build/metra/backend/main.py` does it touch, what's the exact API contract between frontend and backend.
3. If the feature is UI-facing, check `ui_design/stitch_exports/` for a matching reference image — describe the screen as designed there, don't invent a new layout.
4. If the feature is backend-facing, check `app_build/metra/backend/main.py` for the existing `/scan` endpoint pattern (FastAPI + Pydantic-style route) and keep new endpoints consistent with it.
5. Append the spec to `production_artifacts/Technical_Specification.md`:

   ### Feature: <name>
   **Purpose:** one sentence, plain language.
   **Inputs:** exact fields/data consumed.
   **Outputs:** exact fields/data produced.
   **Endpoint (if backend):** method + path, matching the style of the existing `/scan` route.
   **UI reference (if frontend):** filename in `ui_design/stitch_exports/`.
   **Data model changes:** new/modified fields, if any.
   **Out of scope:** explicitly state what this feature does NOT do.

## Rules
- Never invent requirements not implied by the request or existing docs.
- Never write implementation code in this skill.
- Keep each spec under one page.
