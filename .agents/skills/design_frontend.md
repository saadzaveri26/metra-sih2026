# Skill: design_frontend

## Purpose
Turn a Stitch-generated UI reference into a faithful, production-ready component — a translation task, not a reinterpretation task.

## Process
1. Open the reference image in `ui_design/stitch_exports/` and extract exact values:
   - Color hex codes (navy #0B2545, white, gold #C9A227, green #1B9E77 / red #D64545 for compliance indicators)
   - Spacing rhythm (8px grid)
   - Corner radius (8-12px — government-tool aesthetic, not pill-shaped consumer-app buttons)
   - Typography weight and hierarchy
2. Build the component in `app_build/metra/src/components/`, using Tailwind CSS utility classes matching those exact values. Define shared tokens once in `tailwind.config.ts` (already present in the repo) rather than hardcoding hex values per component.
3. If the reference shows a data-driven visual (bounding-box overlay, compliance score ring, trend line, risk cards), keep the structure but wire it to real props — never hardcode demo values into the component.
4. Update `ui_design/design_tokens.md` if this component introduces a new token not yet recorded there.

## Rules
- Don't default to generic component-library styling if the reference doesn't show it — match the reference exactly.
- Flag any ambiguous or missing state (empty/loading) rather than inventing one silently.
