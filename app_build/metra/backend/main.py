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

# Load once at startup, not per-request
ocr = PaddleOCR(use_textline_orientation=True, lang="en", enable_mkldnn=False)


class ComplianceCheckRequest(BaseModel):
    structured_fields: Dict[str, Dict[str, Any]]
    is_imported: bool = False


def run_ocr(img: np.ndarray):
    result = ocr.predict(img)
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
