from typing import Any, Dict
import json
from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import numpy as np
from paddleocr import PaddleOCR
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from field_structuring import extract_structured_fields
from font_analysis import analyze_font_sizes
from health_guide import build_health_guide
from overlay_regions import build_region_overlays
from report_generator import build_docx, build_pdf
from repository import (
    dashboard_summary,
    entity_history,
    evidence_file,
    get_scan,
    init_db,
    persist_scan,
    search_scans,
)
from rules_engine import evaluate_compliance


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="METRA Compliance API", lifespan=lifespan)

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


def _scale_box(box, scale_x: float, scale_y: float):
    pts = box.tolist() if hasattr(box, "tolist") else box
    return [[float(p[0]) * scale_x, float(p[1]) * scale_y] for p in pts]


class ComplianceCheckRequest(BaseModel):
    structured_fields: Dict[str, Dict[str, Any]]
    is_imported: bool = False


def run_ocr(img: np.ndarray):
    orig_h, orig_w = img.shape[:2]
    resized = _resize_for_ocr(img)
    rh, rw = resized.shape[:2]
    scale_x = orig_w / rw
    scale_y = orig_h / rh
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
                "bounding_box": _scale_box(box, scale_x, scale_y),
            })
    return blocks


@app.get("/health")
def health():
    return {"status": "ok", "message": "Backend says hello"}


@app.post("/scan")
async def scan_image(
    file: UploadFile = File(...),
    is_imported: bool = Query(default=False, description="Flag if packaging is for imported commodity"),
    product_name: str = Query(default="", description="Officer-entered product name"),
    seller_name: str = Query(default="", description="Officer-entered seller / establishment name"),
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid or undecodable image file")

    image_h, image_w = img.shape[:2]
    blocks = await run_in_threadpool(run_ocr, img)

    # Always return blocks even if no declarations were matched —
    # the frontend uses the raw OCR text as a fallback display.
    structured_fields = extract_structured_fields(blocks)
    compliance = evaluate_compliance(structured_fields, is_imported=is_imported)
    font_analysis = analyze_font_sizes(
        structured_fields,
        image_width=image_w,
        image_height=image_h,
        image_bytes=contents,
    )
    region_overlays = build_region_overlays(
        blocks,
        structured_fields,
        compliance["compliance_results"],
        image_width=image_w,
        image_height=image_h,
    )
    health_guide = build_health_guide(blocks)

    result = {
        "blocks": blocks,
        "structured_fields": structured_fields,
        "compliance_summary": compliance["compliance_summary"],
        "compliance_results": compliance["compliance_results"],
        "font_analysis": font_analysis,
        "region_overlays": region_overlays,
        "health_guide": health_guide,
        "image_width": image_w,
        "image_height": image_h,
    }

    try:
        saved = persist_scan(
            result,
            product_name=product_name,
            seller_name=seller_name,
            is_imported=is_imported,
            image_bytes=contents,
        )
        result["id"] = saved["id"]
        result["created_at"] = saved["created_at"]
        result["product_name"] = saved["product_name"]
        result["seller_name"] = saved["seller_name"]
        result["is_imported"] = saved["is_imported"]
    except Exception:
        result["id"] = None

    return result


@app.post("/compliance/check")
def check_compliance(req: ComplianceCheckRequest):
    return evaluate_compliance(req.structured_fields, is_imported=req.is_imported)


async def _parse_report_request(file: UploadFile, payload: str):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    try:
        scan = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid scan payload JSON") from exc
    if not isinstance(scan, dict):
        raise HTTPException(status_code=400, detail="Scan payload must be an object")
    return contents, scan


@app.post("/report/pdf")
async def report_pdf(
    file: UploadFile = File(...),
    payload: str = Form(..., description="JSON string of the /scan response"),
):
    contents, scan = await _parse_report_request(file, payload)
    pdf_bytes = build_pdf(scan, image_bytes=contents)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="metra-inspection-report.pdf"'},
    )


@app.post("/report/docx")
async def report_docx(
    file: UploadFile = File(...),
    payload: str = Form(..., description="JSON string of the /scan response"),
):
    contents, scan = await _parse_report_request(file, payload)
    docx_bytes = build_docx(scan, image_bytes=contents)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="metra-inspection-report.docx"'},
    )


@app.get("/scans")
def list_scans(
    q: str = Query(default=""),
    product: str = Query(default=""),
    seller: str = Query(default=""),
    status: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return search_scans(
        q=q,
        product=product,
        seller=seller,
        status=status,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )


@app.get("/scans/history")
def scan_history(
    product: str = Query(default=""),
    seller: str = Query(default=""),
):
    try:
        return entity_history(product=product, seller=seller)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/scans/{scan_id}")
def read_scan(scan_id: str):
    record = get_scan(scan_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scan not found")
    return record


@app.get("/scans/{scan_id}/evidence")
def read_scan_evidence(scan_id: str):
    path = evidence_file(scan_id)
    if not path:
        raise HTTPException(status_code=404, detail="No evidence photo for this scan")
    return FileResponse(path, media_type="image/jpeg", filename=path.name)


@app.get("/dashboard/summary")
def read_dashboard_summary():
    return dashboard_summary()
