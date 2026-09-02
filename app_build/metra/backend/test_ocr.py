from paddleocr import PaddleOCR

ocr = PaddleOCR(use_textline_orientation=True, lang='en', enable_mkldnn=False)

result = ocr.predict('sample_label1.jpg')

for res in result:
    texts = res['rec_texts']
    scores = res['rec_scores']
    boxes = res['rec_polys']  # 4-point polygon per text box

    for text, score, box in zip(texts, scores, boxes):
        print(f"Text: {text} | Confidence: {score:.2f} | BBox: {box.tolist()}")