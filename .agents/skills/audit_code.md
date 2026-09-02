# Skill: audit_code

## Purpose
Review completed work against its spec before it's considered done.

## Process
1. Pull the relevant spec from `production_artifacts/Technical_Specification.md`.
2. Check:
   - Does the implementation in `app_build/metra/backend/main.py` or `app_build/metra/src/` do exactly what the spec says?
   - Hardcoded secrets or API keys committed anywhere?
   - Any synchronous heavy call in an async FastAPI route not wrapped in `run_in_threadpool`?
   - Error handling present for invalid input (matching the `img is None` check pattern already in `/scan`)?
   - If UI: does it match `ui_design/stitch_exports/` in layout and color?
3. Produce a report: PASS, or specific line-level issues. Do not fix issues yourself.

## Rules
- Be specific, not general.
- Flag scope creep as seriously as missing functionality.
