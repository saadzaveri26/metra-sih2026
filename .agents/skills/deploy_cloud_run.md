# Skill: deploy_cloud_run

## Purpose
Deploy METRA (`app_build/metra/`) to Google Cloud Run.

## Process
1. Confirm `deploy_app` has passed first.
2. Add a `Dockerfile` and `cloudbuild.yaml` under `app_build/metra/` if not already present — one for the frontend, one for the backend, or a single multi-stage build if time is short (acceptable simplification for the hackathon).
3. Trigger: `gcloud builds submit --config cloudbuild.yaml`
4. Confirm the Cloud Run service comes up healthy, with environment variables (backend URL, any keys) set via Cloud Run config, never hardcoded.
5. Report the live URL and a basic smoke test (Dashboard loads, `/health` returns ok, a scan request returns a response).

## Rules
- Never commit secrets to `cloudbuild.yaml`.
- Keep the deployment minimal for the internal round — single service is fine unless the architecture genuinely requires two.
