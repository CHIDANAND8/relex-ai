import sys
import os
sys.path.append(r'c:\RELEX AI\backend')
import numpy as np
import cv2
from services.ocr_service import process_image_ocr

def test():
    print("Generating test image...")
    # Create a simple image with text
    img = np.zeros((200, 400, 3), dtype=np.uint8)
    cv2.putText(img, 'RELEX AI Test 123', (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    test_img_path = 'test_ocr_image.png'
    cv2.imwrite(test_img_path, img)

    print(f"Image saved to {test_img_path}, processing OCR...")
    try:
        text = process_image_ocr(test_img_path)
        print("--- OCR RESULT START ---")
        print(text)
        print("--- OCR RESULT END ---")
        if "RELEX" in text or "Test" in text or "123" in text:
             print("SUCCESS: OCR model successfully extracted text.")
        else:
             print("WARNING: OCR model ran but did not extract expected text.")
    except Exception as e:
        print(f"FAILED: Error running OCR: {e}")
    finally:
        if os.path.exists(test_img_path):
            os.remove(test_img_path)

if __name__ == '__main__':
    test()
