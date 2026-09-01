from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import File, UploadFile
from paddleocr import PaddleOCR
import numpy as np
import cv2

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "message": "Backend says hello"}


ocr = PaddleOCR(use_angle_cls=True, lang='en')  # load once at startup, not per-request

@app.post("/scan")
async def scan_image(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    result = ocr.ocr(img, cls=True)

    blocks = []
    for line in result[0]:
        bbox, (text, confidence) = line
        blocks.append({
            "text": text,
            "confidence": round(float(confidence), 3),
            "bounding_box": bbox  # list of 4 [x, y] points
        })

    return {"blocks": blocks}