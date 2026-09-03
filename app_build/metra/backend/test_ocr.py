import unittest
import numpy as np

class TestOCRModule(unittest.TestCase):
    def test_ocr_import_and_engine(self):
        """Verify that at least one supported OCR engine (winocr or paddleocr) is available."""
        has_winocr = False
        has_paddle = False
        
        try:
            import winocr
            has_winocr = True
        except ImportError:
            pass
            
        try:
            from paddleocr import PaddleOCR
            has_paddle = True
        except ImportError:
            pass
            
        self.assertTrue(has_winocr or has_paddle, "Either winocr or paddleocr must be installed.")

if __name__ == "__main__":
    unittest.main()