from typing import Any, Dict, List, Optional
import os
import json
from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import numpy as np
from pydantic import BaseModel, Field
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
    list_sellers_with_risk,
    update_scan_override,
)
from rules_engine import evaluate_compliance
from legal_corpus import get_assistant_engine
from mismatch_checker import compare_scan_with_listing, load_mock_listings


# ---------------------------------------------------------------------------
# OCR Engine Setup: winocr (Native Windows 10/11 Media OCR) + PaddleOCR Fallback
# ---------------------------------------------------------------------------
_OCR_ENGINE = None

try:
    import winocr
    _OCR_ENGINE = "winocr"
except ImportError:
    try:
        from paddleocr import PaddleOCR
        _OCR_ENGINE = PaddleOCR(
            use_textline_orientation=True,
            lang="en",
            enable_mkldnn=False,
        )
    except Exception:
        _OCR_ENGINE = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    # Preload the assistant search engine to eliminate cold-start delay
    try:
        get_assistant_engine()
    except Exception:
        pass
    yield


app = FastAPI(title="METRA Compliance API", lifespan=lifespan)

cors_origins = os.getenv("METRA_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _scale_box(box, scale_x: float, scale_y: float):
    pts = box.tolist() if hasattr(box, "tolist") else box
    return [[float(p[0]) * scale_x, float(p[1]) * scale_y] for p in pts]


def run_ocr(img: np.ndarray) -> List[Dict[str, Any]]:
    orig_h, orig_w = img.shape[:2]
    longest = max(orig_h, orig_w)
    scale = 1.0

    # For fine print on packaging, scale up if resolution is low, or scale down if excessively large
    if longest < 1400:
        scale = min(2.0, 1800.0 / longest)
        new_w = int(round(orig_w * scale))
        new_h = int(round(orig_h * scale))
        proc_img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    elif longest > 2200:
        scale = 2000.0 / longest
        new_w = int(round(orig_w * scale))
        new_h = int(round(orig_h * scale))
        proc_img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        proc_img = img

    blocks = []

    if _OCR_ENGINE == "winocr":
        import winocr
        rgb_img = cv2.cvtColor(proc_img, cv2.COLOR_BGR2RGB)
        result = winocr.recognize_cv2(rgb_img, lang="en")
        lines = result.get("lines", []) if isinstance(result, dict) else []
        for line in lines:
            text = line.get("text", "").strip()
            if not text:
                continue
            box = line.get("bounding_box", [])
            if not box:
                continue
            # Re-scale bounding boxes back to 1x original image dimensions
            orig_box = [[float(pt[0]) / scale, float(pt[1]) / scale] for pt in box]
            blocks.append({
                "text": text,
                "confidence": 0.95,
                "bounding_box": orig_box,
            })
    elif _OCR_ENGINE is not None:
        result = _OCR_ENGINE.predict(proc_img)
        for res in result:
            texts = res.get("rec_texts", [])
            scores = res.get("rec_scores", [])
            boxes = res.get("rec_polys", [])
            for text, score, box in zip(texts, scores, boxes):
                orig_box = [[float(pt[0]) / scale, float(pt[1]) / scale] for pt in (box.tolist() if hasattr(box, "tolist") else box)]
                blocks.append({
                    "text": text,
                    "confidence": round(float(score), 3),
                    "bounding_box": orig_box,
                })

    return blocks


class ComplianceCheckRequest(BaseModel):
    structured_fields: Dict[str, Dict[str, Any]]
    is_imported: bool = False


class OfficerOverrideRequest(BaseModel):
    field: str
    value: str
    reason: Optional[str] = "Officer manual correction"


class AssistantAskRequest(BaseModel):
    question: str = Field(..., max_length=2000)
    scan_id: Optional[str] = None


class CompareListingRequest(BaseModel):
    product_name: Optional[str] = None
    barcode: Optional[str] = None
    listing_id: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok", "message": "METRA Legal Metrology API operational", "ocr_engine": _OCR_ENGINE}


@app.post("/scan")
async def scan_image(
    file: UploadFile = File(...),
    is_imported: bool = Query(default=False, description="Flag if packaging is for imported commodity"),
    product_name: str = Query(default="", max_length=500, description="Officer-entered product name"),
    seller_name: str = Query(default="", max_length=500, description="Officer-entered seller / establishment name"),
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


@app.post("/scans/{scan_id}/override")
def apply_override(scan_id: str, req: OfficerOverrideRequest):
    updated = update_scan_override(
        scan_id=scan_id,
        field=req.field,
        value=req.value,
        reason=req.reason or "Officer manual verification",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Scan not found or override failed")
    return updated


@app.get("/dashboard/summary")
def read_dashboard_summary():
    return dashboard_summary()


@app.get("/sellers/risk-queue")
def get_risk_queue():
    return list_sellers_with_risk()


@app.get("/sellers/{seller_name}/history")
def get_seller_history(seller_name: str):
    try:
        return entity_history(seller=seller_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/mock-listings")
def get_mock_listings():
    return load_mock_listings()


@app.post("/scans/{scan_id}/compare-listing")
def compare_listing(scan_id: str, req: CompareListingRequest):
    record = get_scan(scan_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scan not found")
    res = compare_scan_with_listing(
        scan_record=record,
        product_name=req.product_name,
        barcode=req.barcode,
        listing_id=req.listing_id,
    )
    return res


@app.post("/assistant/ask")
async def ask_legal_assistant(req: AssistantAskRequest):
    engine = get_assistant_engine()
    scan_ctx = None
    if req.scan_id:
        record = get_scan(req.scan_id)
        if record:
            payload = record.get("payload") or {}
            scan_ctx = {
                "product_name": record.get("product_name"),
                "compliance_results": payload.get("compliance_results"),
            }
    res = await run_in_threadpool(engine.answer_query, req.question, scan_ctx)
    return res
