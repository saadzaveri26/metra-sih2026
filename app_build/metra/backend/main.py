import os
from typing import Any, Dict, List, Optional
import io
import json
import re
from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import numpy as np
try:
    from paddleocr import PaddleOCR
    _HAS_PADDLE = True
except ImportError:
    _HAS_PADDLE = False
    PaddleOCR = None

from PIL import Image, ImageOps
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB cap

from field_structuring import extract_structured_fields
from font_analysis import analyze_font_sizes
from legal_corpus import get_assistant_engine
from mismatch_checker import (
    compare_physical_vs_online,
    find_mock_listing,
    load_mock_listings,
)
from overlay_regions import build_region_overlays
from report_generator import build_docx, build_pdf
from repository import (
    dashboard_summary,
    entity_history,
    evidence_file,
    get_scan,
    init_db,
    list_sellers_with_risk,
    persist_scan,
    search_scans,
    seller_compliance_history,
    update_scan_override,
)
from rules_engine import evaluate_compliance


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    # B2: Pre-load legal assistant engine at startup to avoid 30-60s cold-start
    get_assistant_engine()
    yield


app = FastAPI(title="METRA Compliance API", lifespan=lifespan)

# S1: Read CORS origins from env var with localhost fallback
_cors_origins = os.environ.get("METRA_CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load once at startup, not per-request.
# ---------------------------------------------------------------------------
if _HAS_PADDLE and PaddleOCR is not None:
    ocr = PaddleOCR(
        use_angle_cls=False,
        lang="en",
        enable_mkldnn=True,
        det_limit_side_len=960,
        det_db_score_mode="fast",
    )
else:
    ocr = None

# Maximum long-side pixel dimension before OCR.
_OCR_MAX_DIM = 1150


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
    officer_overrides: Optional[Dict[str, Any]] = None


class OverrideRequest(BaseModel):
    field: str
    value: str
    reason: Optional[str] = ""


class CompareListingRequest(BaseModel):
    product_name: Optional[str] = None
    barcode: Optional[str] = None
    listing_id: Optional[str] = None


class AssistantAskRequest(BaseModel):
    question: str
    scan_id: Optional[str] = None

    @property
    def safe_question(self) -> str:
        """S7: Truncate question to 2000 chars to prevent abuse."""
        return self.question[:2000]




class ScanPayloadModel(BaseModel):
    id: Optional[str] = None
    created_at: Optional[str] = None
    product_name: Optional[str] = ""
    seller_name: Optional[str] = ""
    is_imported: Optional[bool] = False
    compliance_summary: Optional[Dict[str, Any]] = None
    compliance_results: Optional[Dict[str, Any]] = None
    font_analysis: Optional[Dict[str, Any]] = None
    structured_fields: Optional[Dict[str, Any]] = None
    officer_overrides: Optional[Dict[str, Any]] = None
    blocks: Optional[List[Any]] = None
    region_overlays: Optional[List[Any]] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None


def run_ocr(img: np.ndarray):
    orig_h, orig_w = img.shape[:2]
    blocks = []

    # 1. Use PaddleOCR if available
    if ocr is not None:
        try:
            resized = _resize_for_ocr(img)
            rh, rw = resized.shape[:2]
            scale_x = orig_w / rw
            scale_y = orig_h / rh
            result = ocr.predict(resized)
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
            if blocks:
                return blocks
        except Exception as exc:
            print(f"PaddleOCR failed: {exc}")

    # 2. Use Windows Native OCR (winocr) - high accuracy, real bounding boxes on Windows 10/11
    try:
        import asyncio
        import winocr
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)

        # Smart resolution scaling: fine print (like MRP and dates on packaging < 1500px)
        # requires ~1.8x to 2.0x scaling for small characters to be detected by Windows OCR
        longest = max(orig_h, orig_w)
        scale = min(2.0, 1800.0 / longest) if longest < 1500 else 1.0
        if scale != 1.0:
            pil_img = pil_img.resize((int(orig_w * scale), int(orig_h * scale)), Image.Resampling.LANCZOS)

        res = asyncio.run(winocr.recognize_pil(pil_img, "en"))
        for line in res.lines:
            words = line.words
            if not words:
                continue
            min_x = min(w.bounding_rect.x for w in words) / scale
            min_y = min(w.bounding_rect.y for w in words) / scale
            max_x = max(w.bounding_rect.x + w.bounding_rect.width for w in words) / scale
            max_y = max(w.bounding_rect.y + w.bounding_rect.height for w in words) / scale
            blocks.append({
                "text": line.text,
                "confidence": 0.95,
                "bounding_box": [
                    [float(min_x), float(min_y)],
                    [float(max_x), float(min_y)],
                    [float(max_x), float(max_y)],
                    [float(min_x), float(max_y)],
                ],
            })
        if blocks:
            return blocks
    except Exception as exc:
        print(f"Windows OCR failed: {exc}")

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
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file exceeds maximum size limit of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    try:
        pil_img = Image.open(io.BytesIO(contents))
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode not in ("RGB", "L"):
            pil_img = pil_img.convert("RGB")
        img = cv2.cvtColor(
            np.array(pil_img),
            cv2.COLOR_RGB2BGR if pil_img.mode == "RGB" else cv2.COLOR_GRAY2BGR,
        )
    except Exception:
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

    result = {
        "blocks": blocks,
        "structured_fields": structured_fields,
        "compliance_summary": compliance["compliance_summary"],
        "compliance_results": compliance["compliance_results"],
        "font_analysis": font_analysis,
        "region_overlays": region_overlays,
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
    return evaluate_compliance(
        req.structured_fields,
        is_imported=req.is_imported,
        officer_overrides=req.officer_overrides,
    )


async def _parse_report_request(file: UploadFile, payload: str):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded evidence photo exceeds maximum size limit of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )
    try:
        raw_json = json.loads(payload)
        if not isinstance(raw_json, dict):
            raise HTTPException(status_code=400, detail="Scan payload must be an object")
        validated = ScanPayloadModel.model_validate(raw_json)
        scan = validated.model_dump()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid scan payload JSON") from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid scan payload schema: {exc}") from exc
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
    if not re.match(r"^INS-\d{8}-[A-F0-9]{6}$", scan_id):
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    record = get_scan(scan_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scan not found")
    return record


@app.post("/scans/{scan_id}/override")
def override_scan(scan_id: str, req: OverrideRequest):
    if not re.match(r"^INS-\d{8}-[A-F0-9]{6}$", scan_id):
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    updated = update_scan_override(
        scan_id,
        field=req.field,
        value=req.value,
        reason=req.reason or "",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Scan not found")
    return updated


@app.get("/scans/{scan_id}/evidence")
def read_scan_evidence(scan_id: str):
    if not re.match(r"^INS-\d{8}-[A-F0-9]{6}$", scan_id):
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    path = evidence_file(scan_id)
    if not path:
        raise HTTPException(status_code=404, detail="No evidence photo for this scan")
    return FileResponse(path, media_type="image/jpeg", filename=path.name)


@app.get("/dashboard/summary")
def read_dashboard_summary():
    return dashboard_summary()


@app.get("/sellers/risk-queue")
def risk_queue():
    """B4: Live risk-prioritized seller queue for the Risk Queue page."""
    return list_sellers_with_risk()


@app.get("/sellers/{entity_name}/history")
def seller_history(entity_name: str):
    # S5: Input validation — reject absurdly long seller names
    if len(entity_name) > 500:
        raise HTTPException(status_code=400, detail="Seller name too long")
    try:
        return seller_compliance_history(entity_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/mock-listings")
def get_mock_listings():
    return load_mock_listings()


@app.post("/scans/{scan_id}/compare-listing")
def compare_scan_listing(scan_id: str, req: Optional[CompareListingRequest] = None):
    if not re.match(r"^INS-\d{8}-[A-F0-9]{6}$", scan_id):
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    record = get_scan(scan_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scan not found")

    payload = record.get("payload") or {}
    structured = payload.get("structured_fields") or {}

    listings = load_mock_listings()
    target_listing = None

    if req and req.listing_id:
        for item in listings:
            if item.get("id") == req.listing_id:
                target_listing = item
                break

    if not target_listing:
        p_name = (req.product_name if req and req.product_name else record.get("product_name")) or ""
        b_code = (req.barcode if req and req.barcode else "") or ""
        target_listing = find_mock_listing(product_name=p_name, barcode=b_code, listings=listings)

    if not target_listing:
        raise HTTPException(status_code=404, detail="No matching online e-commerce listing found")

    comparison = compare_physical_vs_online(structured, target_listing)

    return {
        "scan_id": scan_id,
        "product_name": record.get("product_name"),
        "online_listing": target_listing,
        "comparison": comparison,
    }


@app.post("/assistant/ask")
async def assistant_ask(req: AssistantAskRequest):
    q = req.safe_question.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    scan_context = None
    if req.scan_id:
        if re.match(r"^INS-\d{8}-[A-F0-9]{6}$", req.scan_id):
            record = get_scan(req.scan_id)
            if record:
                payload = record.get("payload") or {}
                scan_context = {
                    "scan_id": req.scan_id,
                    "product_name": record.get("product_name"),
                    "compliance_results": payload.get("compliance_results"),
                    "structured_fields": payload.get("structured_fields"),
                }

    engine = get_assistant_engine()
    # B3: Run CPU-heavy inference in threadpool to avoid blocking the event loop
    return await run_in_threadpool(engine.answer_query, q, scan_context)




