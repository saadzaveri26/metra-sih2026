# Skill: deploy_app

## Purpose
Build and run METRA locally for testing before any cloud deployment.

## Process
1. Backend: from `app_build/metra/backend/`, confirm `pip install -r requirements.txt` succeeds and `uvicorn main:app --reload` starts cleanly on port 8000.
2. Frontend: from `app_build/metra/`, confirm `npm run dev` starts cleanly (already confirmed working per current terminal output) and can reach the backend at `http://localhost:8000`.
3. Confirm PaddleOCR loads without error at backend startup — this is the most common silent failure point (missing system libraries, or `paddlepaddle` vs `paddlepaddle-gpu` mismatch).
4. Report any missing dependency or build failure with the exact error.

## Rules
- Never deploy directly to Cloud Run from this skill — that's `deploy_cloud_run`'s job, and only after a clean local run here.
