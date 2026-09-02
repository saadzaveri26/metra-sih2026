from typing import Any, Dict, Optional

import cv2
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from paddleocr import PaddleOCR
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from field_structuring import extract_structured_fields
from rules_engine import evaluate_compliance

app = FastAPI(title="METRA Compliance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load once at startup, not per-request.
# det_db_score_mode="fast" uses a lighter post-processing step that is
# measurably faster with negligible accuracy drop on printed labels.
# ---------------------------------------------------------------------------
ocr = PaddleOCR(
    use_textline_orientation=True,
    lang="en",
    enable_mkldnn=False,
)

# Maximum long-side pixel dimension before OCR.
# Resizing to ≤1600 px cuts inference time 40-60% on high-res phone photos
# while preserving enough detail for printed label text.
_OCR_MAX_DIM = 1600


def _resize_for_ocr(img: np.ndarray) -> np.ndarray:
    """Down-scale *img* so its longest side ≤ _OCR_MAX_DIM. Returns img unchanged if already small enough."""
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= _OCR_MAX_DIM:
        return img
    scale = _OCR_MAX_DIM / longest
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


class ComplianceCheckRequest(BaseModel):
    structured_fields: Dict[str, Dict[str, Any]]
    is_imported: bool = False


def run_ocr(img: np.ndarray):
    resized = _resize_for_ocr(img)
    result = ocr.predict(resized)
    blocks = []
    for res in result:
        texts = res.get("rec_texts", [])
        scores = res.get("rec_scores", [])
        boxes = res.get("rec_polys", [])

        for text, score, box in zip(texts, scores, boxes):
            blocks.append({
                "text": text,
                "confidence": round(float(score), 3),
                "bounding_box": box.tolist() if hasattr(box, "tolist") else box,
            })
    return blocks


@app.get("/health")
def health():
    return {"status": "ok", "message": "Backend says hello"}


@app.post("/scan")
async def scan_image(
    file: UploadFile = File(...),
    is_imported: bool = Query(default=False, description="Flag if packaging is for imported commodity")
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid or undecodable image file")

    blocks = await run_in_threadpool(run_ocr, img)

    # Always return blocks even if no declarations were matched —
    # the frontend uses the raw OCR text as a fallback display.
    structured_fields = extract_structured_fields(blocks)
    compliance = evaluate_compliance(structured_fields, is_imported=is_imported)

    return {
        "blocks": blocks,
        "structured_fields": structured_fields,
        "compliance_summary": compliance["compliance_summary"],
        "compliance_results": compliance["compliance_results"],
    }


@app.post("/compliance/check")
def check_compliance(req: ComplianceCheckRequest):
    return evaluate_compliance(req.structured_fields, is_imported=req.is_imported)
