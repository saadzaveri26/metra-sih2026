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
- Backend: `/health`, `/scan` (PaddleOCR + Field Structuring + Compliance Engine), and `/compliance/check` are working in `app_build/metra/backend/main.py`.
- Frontend: Next.js scaffold running (`npm run dev` confirmed working on localhost:3000).
- Not yet built: risk scoring, mismatch check, case creation, all frontend screens beyond the scaffold.

## Ground rules for this project
- METRA is a decision-support tool — never build automated-penalty logic; the officer always makes the final call.
- Barcode/LMPC lookup and the online-vs-physical comparison use local/mock data only.
- Match `ui_design/stitch_exports/` visual language exactly — navy/white/gold, restrained, government-tool aesthetic.
